/**
 * Qwen Proxy Service
 * 
 * Servicio proxy para OAuth de Qwen.
 * Lee tokens desde ~/.qwen/oauth_creds.json (donde Qwen CLI los guarda)
 * y los renueva automáticamente cuando están por expirar.
 * 
 * Uso:
 *   const { getValidToken } = require('./qwenProxy')
 *   const token = await getValidToken()
 */

const axios = require('axios')
const fs = require('fs')
const path = require('path')
const os = require('os')

// Configuración
const QWEN_CHAT_BASE = 'https://chat.qwen.ai'
const QWEN_PORTAL_BASE = 'https://portal.qwen.ai'
const CLIENT_ID = 'qwen-code'

// Paths donde Qwen CLI guarda credenciales
const QWEN_CREDS_PATHS = [
    path.join(os.homedir(), '.qwen', 'oauth_creds.json'),
    path.join(os.homedir(), '.config', 'qwen', 'oauth_creds.json'),
    path.join(process.env.HOME || os.homedir(), '.qwen', 'oauth_creds.json'),
]

/**
 * Obtiene la ruta del archivo de credenciales
 */
function getCredsPath() {
    for (const p of QWEN_CREDS_PATHS) {
        if (fs.existsSync(p)) {
            return p
        }
    }
    return null
}

/**
 * Lee las credenciales OAuth desde el archivo
 * Formato esperado:
 * {
 *   "access_token": "...",
 *   "refresh_token": "...",
 *   "expires_at": 1771757551548
 * }
 */
function readCredentials() {
    const credsPath = getCredsPath()
    if (!credsPath) {
        return null
    }
    
    try {
        const content = fs.readFileSync(credsPath, 'utf8')
        const data = JSON.parse(content)
        
        console.log('[QwenProxy] Credenciales leídas desde:', credsPath)
        console.log('[QwenProxy] Expires at:', data.expires_at ? new Date(data.expires_at).toISOString() : 'N/A')
        
        return {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_at: data.expires_at,
            path: credsPath
        }
    } catch (error) {
        console.error('[QwenProxy] Error leyendo credenciales:', error.message)
        return null
    }
}

/**
 * Verifica si el token está por expirar (menos de 5 minutos)
 */
function isTokenExpiringSoon(creds, minutes = 5) {
    if (!creds || !creds.expires_at) return true
    
    const now = Date.now()
    const expiresAt = creds.expires_at
    const threshold = minutes * 60 * 1000
    
    return (expiresAt - now) < threshold
}

/**
 * Renueva el token usando refresh_token
 * Endpoint: POST https://portal.qwen.ai/oauth/token
 */
async function refreshAccessToken(refreshToken) {
    try {
        console.log('[QwenProxy] Renovando token...')
        
        const response = await axios.post(
            `${QWEN_PORTAL_BASE}/oauth/token`,
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
            console.log('[QwenProxy] Token renovado exitosamente')
            
            // Actualizar archivo de credenciales
            const creds = readCredentials()
            if (creds && creds.path) {
                const newCreds = {
                    access_token: data.access_token,
                    refresh_token: data.refresh_token || refreshToken,
                    expires_at: Date.now() + (data.expires_in || 3600) * 1000
                }
                fs.writeFileSync(creds.path, JSON.stringify(newCreds, null, 2))
                console.log('[QwenProxy] Credenciales actualizadas en:', creds.path)
            }
            
            return {
                access_token: data.access_token,
                refresh_token: data.refresh_token || refreshToken,
                expires_at: Date.now() + (data.expires_in || 3600) * 1000
            }
        }
        
        return null
    } catch (error) {
        console.error('[QwenProxy] Error renovando token:', error.message)
        if (error.response) {
            console.error('Response:', error.response.status, error.response.data)
        }
        return null
    }
}

/**
 * Obtiene un token válido para usar con Qwen API
 * - Lee credenciales desde ~/.qwen/oauth_creds.json
 * - Si el token existe, lo retorna (Qwen CLI lo renueva automáticamente)
 * - Solo intenta renovar si realmente es necesario
 */
async function getValidToken() {
    // Leer credenciales actuales
    let creds = readCredentials()

    if (!creds) {
        return {
            success: false,
            error: 'No se encontraron credenciales OAuth. Ejecuta "qwen auth login" primero.',
            needsAuth: true
        }
    }

    // Si tenemos access_token, lo retornamos
    // Qwen CLI se encarga de renovarlo automáticamente cuando es necesario
    if (creds.access_token) {
        const expiresIn = Math.max(0, Math.floor((creds.expires_at - Date.now()) / 1000))
        
        // Solo intentar renovar si falta menos de 1 minuto para expirar
        if (expiresIn < 60 && creds.refresh_token) {
            console.log('[QwenProxy] Token muy cerca de expirar, intentando renovar...')
            const refreshed = await refreshAccessToken(creds.refresh_token)
            
            if (refreshed) {
                console.log('[QwenProxy] Token renovado exitosamente')
                creds = refreshed
            } else {
                // Renovación falló, pero usar el token actual si aún no expiró
                if (expiresIn > 0) {
                    console.log('[QwenProxy] Renovación falló, usando token actual')
                }
            }
        }
        
        return {
            success: true,
            access_token: creds.access_token,
            refresh_token: creds.refresh_token,
            expiresIn: expiresIn
        }
    }

    return {
        success: false,
        error: 'Token no encontrado. Ejecuta "qwen auth login" nuevamente.',
        needsAuth: true
    }
}

/**
 * Verifica si hay credenciales válidas disponibles
 */
function hasCredentials() {
    const creds = readCredentials()
    return creds !== null && creds.access_token !== null
}

/**
 * Obtiene información del estado de las credenciales
 */
function getCredentialStatus() {
    const creds = readCredentials()
    
    if (!creds) {
        return {
            hasCredentials: false,
            isValid: false,
            message: 'No se encontraron credenciales. Ejecuta "qwen auth login"'
        }
    }
    
    const now = Date.now()
    const expiresAt = creds.expires_at || 0
    const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000))
    const isValid = !isTokenExpiringSoon(creds, 1)
    
    return {
        hasCredentials: true,
        isValid,
        expiresAt: new Date(expiresAt).toISOString(),
        expiresIn,
        expiresInFormatted: formatTime(expiresIn),
        path: creds.path,
        message: isValid 
            ? `Token válido por ${formatTime(expiresIn)}`
            : 'Token expirado o por expirar'
    }
}

/**
 * Formatea tiempo en segundos a string legible
 */
function formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
}

/**
 * Inicializa el servicio (verifica credenciales al iniciar)
 */
function init() {
    const status = getCredentialStatus()
    console.log('[QwenProxy] Iniciado -', status.message)
    return status
}

module.exports = {
    // Función principal
    getValidToken,
    
    // Utilidades
    hasCredentials,
    getCredentialStatus,
    readCredentials,
    refreshAccessToken,
    
    // Inicialización
    init,
    
    // Constantes
    QWEN_CHAT_BASE,
    QWEN_PORTAL_BASE,
    CLIENT_ID
}
