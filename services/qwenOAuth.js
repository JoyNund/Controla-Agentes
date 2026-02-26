/**
 * Servicio de OAuth para Qwen (Device Flow - RFC 8628)
 * Implementa el flujo de autorización de dispositivos para Qwen.ai
 * 
 * Endpoints del backend proxy:
 * - POST /api/qwen/device-code - Inicia el flujo OAuth
 * - POST /api/qwen/poll-token - Polling para obtener token
 * - POST /api/qwen/refresh-token - Renueva token expirado
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')

// URLs oficiales de Qwen OAuth (Device Flow) - basadas en configuración OpenClaw
const QWEN_PORTAL_BASE = 'https://portal.qwen.ai'
const QWEN_CHAT_BASE = 'https://chat.qwen.ai'
const CLIENT_ID = 'qwen-code' // Client ID para Qwen Code CLI

// Endpoints OAuth
const OAUTH_DEVICE_CODE = `${QWEN_PORTAL_BASE}/oauth/device/code`
const OAUTH_TOKEN = `${QWEN_PORTAL_BASE}/oauth/token`
const OAUTH_AUTHORIZE = `${QWEN_CHAT_BASE}/authorize`

// Almacenamiento de sesiones de polling (en memoria para producción usar Redis)
const pollingSessions = new Map()

// Directorio para guardar tokens persistentes
const TOKENS_DIR = path.join(__dirname, '..', 'qwen_tokens')
if (!fs.existsSync(TOKENS_DIR)) {
    fs.mkdirSync(TOKENS_DIR, { recursive: true })
}

/**
 * Guarda un token para un agente específico
 */
function saveTokenForAgent(agentId, tokenData) {
    const tokenPath = path.join(TOKENS_DIR, `${agentId}_token.json`)
    fs.writeFileSync(tokenPath, JSON.stringify({
        ...tokenData,
        savedAt: new Date().toISOString()
    }, null, 2))
    console.log(`[QwenOAuth] Token guardado para agente ${agentId}`)
}

/**
 * Carga el token guardado para un agente
 */
function loadTokenForAgent(agentId) {
    const tokenPath = path.join(TOKENS_DIR, `${agentId}_token.json`)
    if (!fs.existsSync(tokenPath)) {
        return null
    }
    try {
        const data = JSON.parse(fs.readFileSync(tokenPath, 'utf8'))
        console.log(`[QwenOAuth] Token cargado para agente ${agentId}`)
        return data
    } catch (e) {
        console.error(`[QwenOAuth] Error al cargar token para ${agentId}:`, e.message)
        return null
    }
}

/**
 * Elimina el token de un agente (logout)
 */
function removeTokenForAgent(agentId) {
    const tokenPath = path.join(TOKENS_DIR, `${agentId}_token.json`)
    if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath)
        console.log(`[QwenOAuth] Token eliminado para agente ${agentId}`)
    }
    pollingSessions.delete(agentId)
}

/**
 * PASO 1: Solicitar device code a Qwen
 * Endpoint: POST https://portal.qwen.ai/oauth/device/code
 */
async function requestDeviceCode() {
    try {
        const response = await axios.post(
            OAUTH_DEVICE_CODE,
            { client_id: CLIENT_ID },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        )

        const data = response.data

        // Guardar sesión de polling
        pollingSessions.set(data.device_code, {
            status: 'pending',
            token: null,
            created: Date.now(),
            attempts: 0
        })

        // Construir URL de autorización: https://chat.qwen.ai/authorize?user_code=XXX&client=qwen-code
        const verification_uri_complete = `${OAUTH_AUTHORIZE}?user_code=${data.user_code}&client=${CLIENT_ID}`
        const verification_uri = OAUTH_AUTHORIZE

        return {
            success: true,
            device_code: data.device_code,
            user_code: data.user_code,
            verification_uri,
            verification_uri_complete,
            expires_in: data.expires_in || 900,
            interval: data.interval || 5
        }
    } catch (error) {
        console.error('[QwenOAuth] Error al solicitar device code:', error.message)
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data)
        }
        return {
            success: false,
            error: error.message,
            status: error.response?.status
        }
    }
}

/**
 * PASO 2: Hacer polling hasta obtener el token
 */
async function pollForToken(deviceCode, agentId = null) {
    const session = pollingSessions.get(deviceCode)
    if (!session) {
        return {
            success: false,
            error: 'Sesión de polling no encontrada o expirada'
        }
    }

    // Limite de intentos (15 minutos aprox)
    if (session.attempts > 180) {
        pollingSessions.delete(deviceCode)
        return {
            success: false,
            error: 'Tiempo de espera agotado'
        }
    }

    session.attempts++

    try {
        // Endpoint: POST https://portal.qwen.ai/oauth/token
        const response = await axios.post(
            OAUTH_TOKEN,
            {
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                device_code: deviceCode,
                client_id: CLIENT_ID
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        )

        const data = response.data

        if (data.access_token) {
            // Éxito! Token obtenido
            pollingSessions.delete(deviceCode)

            const tokenData = {
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_at: Date.now() + (data.expires_in || 3600) * 1000
            }

            // Guardar token si hay agentId
            if (agentId) {
                saveTokenForAgent(agentId, tokenData)
            }

            return {
                success: true,
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                expires_in: data.expires_in
            }
        }

        // Aún pendiente de autorización
        if (data.error === 'authorization_pending') {
            return {
                success: false,
                error: 'authorization_pending',
                message: 'Esperando autorización del usuario'
            }
        }

        // Slow down - aumentar intervalo
        if (data.error === 'slow_down') {
            return {
                success: false,
                error: 'slow_down',
                message: 'Reduciendo frecuencia de polling'
            }
        }

        // Error de autorización
        return {
            success: false,
            error: data.error,
            error_description: data.error_description
        }

    } catch (error) {
        console.error('[QwenOAuth] Error en polling:', error.message)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * PASO 3: Renovar token usando refresh token
 */
async function refreshAccessToken(refreshToken, agentId = null) {
    try {
        const response = await axios.post(
            OAUTH_TOKEN,
            {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: CLIENT_ID
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            }
        )

        const data = response.data

        if (data.access_token) {
            const tokenData = {
                access_token: data.access_token,
                refresh_token: data.refresh_token || refreshToken,
                expires_at: Date.now() + (data.expires_in || 3600) * 1000
            }

            // Guardar token actualizado si hay agentId
            if (agentId) {
                saveTokenForAgent(agentId, tokenData)
            }

            return {
                success: true,
                access_token: data.access_token,
                refresh_token: tokenData.refresh_token,
                expires_in: data.expires_in
            }
        }

        return {
            success: false,
            error: data.error || 'No se pudo renovar el token'
        }

    } catch (error) {
        console.error('[QwenOAuth] Error al renovar token:', error.message)
        return {
            success: false,
            error: error.message
        }
    }
}

/**
 * Obtener token válido para un agente (renueva si está por expirar)
 */
async function getValidTokenForAgent(agentId) {
    // Intentar cargar token guardado
    let tokenData = loadTokenForAgent(agentId)

    if (!tokenData) {
        return {
            success: false,
            error: 'No hay token OAuth guardado para este agente'
        }
    }

    // Verificar si expira en menos de 5 minutos
    const now = Date.now()
    const expiresAt = tokenData.expires_at || 0
    const timeToExpiry = expiresAt - now

    if (timeToExpiry < 300000) { // 5 minutos
        console.log('[QwenOAuth] Token por expirar, renovando...')
        if (tokenData.refresh_token) {
            const refreshResult = await refreshAccessToken(tokenData.refresh_token, agentId)
            if (refreshResult.success) {
                return {
                    success: true,
                    access_token: refreshResult.access_token
                }
            } else {
                return {
                    success: false,
                    error: 'No se pudo renovar el token: ' + refreshResult.error
                }
            }
        } else {
            return {
                success: false,
                error: 'Token expirado y no hay refresh token'
            }
        }
    }

    // Token válido
    return {
        success: true,
        access_token: tokenData.access_token
    }
}

/**
 * Verificar si un agente tiene token OAuth válido
 */
function hasValidToken(agentId) {
    const tokenData = loadTokenForAgent(agentId)
    if (!tokenData) return false

    const now = Date.now()
    const expiresAt = tokenData.expires_at || 0
    return now < expiresAt - 300000 // Válido si faltan más de 5 min para expirar
}

/**
 * Obtener información del estado OAuth para un agente
 */
function getTokenStatus(agentId) {
    const tokenData = loadTokenForAgent(agentId)
    if (!tokenData) {
        return {
            hasToken: false,
            isValid: false,
            expiresAt: null,
            expiresIn: null
        }
    }

    const now = Date.now()
    const expiresAt = tokenData.expires_at || 0
    const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000))

    return {
        hasToken: true,
        isValid: now < expiresAt,
        expiresAt: new Date(expiresAt).toISOString(),
        expiresIn: expiresIn,
        savedAt: tokenData.savedAt
    }
}

module.exports = {
    // Funciones principales
    requestDeviceCode,
    pollForToken,
    refreshAccessToken,
    getValidTokenForAgent,

    // Gestión de tokens
    saveTokenForAgent,
    loadTokenForAgent,
    removeTokenForAgent,
    hasValidToken,
    getTokenStatus,

    // Constantes
    QWEN_PORTAL_BASE,
    QWEN_CHAT_BASE,
    CLIENT_ID
}
