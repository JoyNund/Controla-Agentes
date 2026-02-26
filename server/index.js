require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })
const express = require('express')
const cors = require('cors')
const session = require('express-session')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const { agents, settings, connections, conversations, DATA_DIR } = require('./store')
const { extractTextFromFile } = require('./parseKnowledgeFile')
const citasService = require('./services/citasService')
const citasScheduler = require('./services/citasScheduler')
const { getPeruNow, formatPeruDate, formatPeruTime } = require('./config/timezone')

const app = express()
const PORT = process.env.WEBAPP_PORT || 3847
const APP_PASSWORD = process.env.APP_PASSWORD || 'controla2024'
const isProduction = process.env.NODE_ENV === 'production'

// Necesario cuando está detrás de Cloudflare o nginx (subdominio agentes.controla.digital)
app.set('trust proxy', 1)
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'controles-agentes-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: isProduction,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            sameSite: 'lax',
        },
    })
)

const uploadsDir = path.join(DATA_DIR, 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

const upload = multer({ dest: uploadsDir, limits: { fileSize: 15 * 1024 * 1024 } })

function requireAuth(req, res, next) {
    const remoteIp = req.ip || req.connection.remoteAddress
    const isLocal = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1'
    const botToken = req.headers['x-bot-token']
    const isBot = botToken && botToken === process.env.BOT_INTERNAL_TOKEN

    if (isLocal || isBot || req.session?.userId) return next()

    console.log(`[Auth] Blocked ${req.method} ${req.url} from IP: ${remoteIp}`)
    return res.status(401).json({ error: 'No autorizado' })
}

// Validación de Palabra Clave (seguridad UI)
function hexToString(hex) {
    try {
        let str = ''
        for (let i = 0; i < hex.length; i += 2) {
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
        }
        return str
    } catch (e) {
        return ''
    }
}

function validateKeyword(input, storedHex) {
    if (!input || !storedHex) return false
    try {
        const decoded = hexToString(storedHex)
        return input === decoded
    } catch (e) {
        return false
    }
}

function requireKeyword(req, res, next, actionType) {
    const settingsData = settings.get()
    const { keyword } = req.body || {}
    const masterKeyword = settingsData.security?.masterKeyword
    const actionKeyword = settingsData.security?.keywords?.[actionType]
    
    // Validar con keyword de acción específica o master keyword
    const valid = validateKeyword(keyword, actionKeyword) || validateKeyword(keyword, masterKeyword)
    
    if (!valid) {
        return res.status(403).json({ error: 'Palabra clave incorrecta' })
    }
    
    next()
}

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' })
    if (email !== 'admin@controla.digital' || password !== APP_PASSWORD) {
        return res.status(401).json({ error: 'Credenciales incorrectas' })
    }
    req.session.userId = 'admin'
    req.session.userEmail = email
    req.session.userName = 'Administrador'
    return res.json({ user: { id: 'admin', email, name: 'Administrador' } })
})

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy()
    res.json({ ok: true })
})

app.get('/api/auth/me', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'No autorizado' })
    return res.json({
        user: {
            id: req.session.userId,
            email: req.session.userEmail,
            name: req.session.userName,
        },
    })
})

// ---------- Agentes ----------
app.get('/api/agents', requireAuth, (req, res) => {
    const list = agents.list()
    const masked = list.map((a) => ({
        ...a,
        apiKey: a.apiKey ? '************' + (a.apiKey.slice(-4) || '') : undefined,
        apiKeyExists: !!a.apiKey, // Indicador de si hay API key guardada
    }))
    res.json(masked)
})

// ========== ENDPOINT PARA ASISTENTE DE CONFIGURACIÓN DE AGENTES ==========
// Debe estar ANTES de /api/agents/:id para que Express no lo capture como :id
const { generarConfiguracionAgente } = require('../services/agenteIA')

app.post('/api/agents/generate-config', requireAuth, async (req, res) => {
    try {
        const { tipo, respuestas } = req.body

        if (!tipo || !respuestas) {
            return res.status(400).json({ error: 'Faltan campos requeridos: tipo, respuestas' })
        }

        if (!['personalidad', 'base_conocimiento', 'saludo', 'objeciones'].includes(tipo)) {
            return res.status(400).json({ error: 'Tipo de configuración no válido' })
        }

        // Obtener API Key del agente por defecto o de .env
        const agentsStore = require('./store').agents
        const agentList = agentsStore.list()
        const defaultApiKey = agentList.length > 0
            ? agentList[0].apiKey
            : process.env.DEEPSEEK_API_KEY

        if (!defaultApiKey) {
            return res.status(400).json({ error: 'No hay API Key configurada. Configura DEEPSEEK_API_KEY en .env o crea un agente con API Key.' })
        }

        // Generar configuración con IA usando Deepseek
        const textoGenerado = await generarConfiguracionAgente(tipo, respuestas, defaultApiKey)

        res.json({ texto_generado: textoGenerado })
    } catch (error) {
        console.error('Error generando configuración:', error.message)
        res.status(500).json({ error: error.message })
    }
})

app.get('/api/agents/:id', requireAuth, (req, res) => {
    const agent = agents.get(req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' })
    res.json({ 
        ...agent, 
        apiKey: agent.apiKey ? '************' + (agent.apiKey.slice(-4) || '') : undefined,
        apiKeyExists: !!agent.apiKey, // Indicador de si hay API key guardada
    })
})

app.post('/api/agents', requireAuth, (req, res, next) => {
    // Al crear agente, la keyword es OPCIONAL (se establece para ese agente)
    // No requerimos validación contra settings, solo que se proporcione si se quiere
    const body = req.body || {}
    const id = 'ag_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const agent = {
        id,
        name: body.name || 'Sin nombre',
        isPrimary: body.isPrimary ?? false,
        systemPrompt: body.systemPrompt || '',
        knowledgeBase: body.knowledgeBase || '',
        rules: body.rules || { saludoInicial: '' },
        objections: body.objections || [],
        motor: body.motor || 'deepseek',
        model: body.model || 'deepseek-chat',
        apiKey: body.apiKey || '',
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.3,
        active: body.active !== false,
        type: body.type || 'ai',
        connectionMethod: body.connectionMethod || 'baileys',
        triggers: body.triggers || [],
        enableSmartMedia: body.enableSmartMedia ?? true,  // Habilitar envío inteligente de multimedia
        keyword: body.keyword ? Buffer.from(body.keyword).toString('hex') : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
    agents.save(agent)
    res.status(201).json({ ...agent, apiKey: agent.apiKey ? '************' : undefined })
})

app.put('/api/agents/:id', requireAuth, (req, res) => {
    const existing = agents.get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Agente no encontrado' })
    
    const body = req.body || {}
    const { keyword } = body
    
    // Validar keyword: Master Keyword O keyword específica del agente
    const settingsData = settings.get()
    const masterKeyword = settingsData.security?.masterKeyword
    const actionKeyword = settingsData.security?.keywords?.['agent_edit']
    
    // Verificar si la keyword proporcionada es válida (Master o acción)
    const isMasterValid = validateKeyword(keyword, masterKeyword)
    const isActionValid = validateKeyword(keyword, actionKeyword)
    
    // Verificar si es la keyword específica del agente
    const isAgentKeyword = existing.keyword && validateKeyword(keyword, existing.keyword)
    
    // Debe pasar alguna validación
    if (!isMasterValid && !isActionValid && !isAgentKeyword) {
        return res.status(403).json({ error: 'Palabra clave incorrecta' })
    }
    
    const agent = {
        ...existing,
        name: body.name !== undefined ? body.name : existing.name,
        systemPrompt: body.systemPrompt !== undefined ? body.systemPrompt : existing.systemPrompt,
        knowledgeBase: body.knowledgeBase !== undefined ? body.knowledgeBase : existing.knowledgeBase,
        rules: body.rules !== undefined ? body.rules : existing.rules,
        objections: body.objections !== undefined ? body.objections : existing.objections,
        motor: body.motor !== undefined ? body.motor : existing.motor,
        model: body.model !== undefined ? body.model : existing.model,
        apiKey: (body.apiKey && body.apiKey.length > 20 && !body.apiKey.startsWith('****'))
            ? body.apiKey
            : existing.apiKey,
        temperature: body.temperature !== undefined ? body.temperature : existing.temperature,
        active: body.active !== undefined ? body.active : existing.active,
        type: body.type !== undefined ? body.type : existing.type,
        connectionMethod: body.connectionMethod !== undefined ? body.connectionMethod : existing.connectionMethod,
        triggers: body.triggers !== undefined ? body.triggers : existing.triggers,
        enableSmartMedia: body.enableSmartMedia !== undefined ? body.enableSmartMedia : existing.enableSmartMedia,
        keyword: body.keyword !== undefined
            ? (body.keyword ? Buffer.from(body.keyword).toString('hex') : existing.keyword)
            : existing.keyword,
        updatedAt: new Date().toISOString(),
    }
    agents.save(agent)
    res.json({ ...agent, apiKey: agent.apiKey ? '************' : undefined, apiKeyExists: !!agent.apiKey })
})

app.delete('/api/agents/:id', requireAuth, (req, res) => {
    const agent = agents.get(req.params.id)
    if (!agent) return res.status(404).json({ error: 'Agente no encontrado' })
    
    const { keyword } = req.body || {}
    
    // Validar keyword: Master Keyword O keyword de acción O keyword específica del agente
    const settingsData = settings.get()
    const masterKeyword = settingsData.security?.masterKeyword
    const actionKeyword = settingsData.security?.keywords?.['agent_delete']
    
    // Verificar si la keyword proporcionada es válida (Master o acción)
    const isMasterValid = validateKeyword(keyword, masterKeyword)
    const isActionValid = validateKeyword(keyword, actionKeyword)
    
    // Verificar si es la keyword específica del agente
    const isAgentKeyword = agent.keyword && validateKeyword(keyword, agent.keyword)
    
    // Debe pasar alguna validación
    if (!isMasterValid && !isActionValid && !isAgentKeyword) {
        return res.status(403).json({ error: 'Palabra clave incorrecta' })
    }
    
    agents.delete(req.params.id)
    res.json({ ok: true })
})

app.post('/api/agents/upload-knowledge', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' })
    try {
        const text = await extractTextFromFile(req.file.path)
        fs.unlinkSync(req.file.path)
        return res.json({ text })
    } catch (e) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
        return res.status(400).json({ error: e.message || 'Error al leer el archivo' })
    }
})

// ========== CONEXIONES ==========
// Las conexiones son entidades independientes de los agentes
// Una conexión = un dispositivo WhatsApp
// Un agente = configuración de comportamiento IA
// Una conexión puede tener un agente asignado

// Listar todas las conexiones
app.get('/api/connections', requireAuth, (req, res) => {
    res.json(connections.list())
})

// Obtener una conexión específica
app.get('/api/connections/:id', requireAuth, (req, res) => {
    const conn = connections.get(req.params.id)
    if (!conn) return res.status(404).json({ error: 'Conexión no encontrada' })
    res.json(conn)
})

// Crear nueva conexión
app.post('/api/connections', requireAuth, (req, res, next) => {
    requireKeyword(req, res, () => {
        const { name, agentId, keyword } = req.body || {}
        try {
            const conn = connections.create({ name, agentId, keyword })
            res.status(201).json(conn)
        } catch (error) {
            console.error('Error creating connection:', error)
            res.status(500).json({ error: 'Error al crear conexión' })
        }
    }, 'connection_create')
})

// Actualizar conexión (nombre, agente asignado, status, etc)
app.put('/api/connections/:id', requireAuth, (req, res) => {
    const existing = connections.get(req.params.id)
    if (!existing) return res.status(404).json({ error: 'Conexión no encontrada' })

    const { name, agentId, status } = req.body || {}
    const updated = {
        ...existing,
        name: name !== undefined ? name : existing.name,
        agentId: agentId !== undefined ? agentId : existing.agentId,
        status: status !== undefined ? status : existing.status,
        updatedAt: new Date().toISOString()
    }
    connections.set(req.params.id, updated)
    res.json(updated)
})

// Eliminar conexión (desvincula y borra)
app.delete('/api/connections/:id', requireAuth, async (req, res) => {
    const conn = connections.get(req.params.id)
    if (!conn) return res.status(404).json({ error: 'Conexión no encontrada' })
    
    const { keyword } = req.body || {}
    
    // Validar keyword: Master Keyword O keyword de acción O keyword específica de la conexión
    const settingsData = settings.get()
    const masterKeyword = settingsData.security?.masterKeyword
    const actionKeyword = settingsData.security?.keywords?.['connection_delete']
    
    // Verificar si la keyword proporcionada es válida (Master o acción)
    const isMasterValid = validateKeyword(keyword, masterKeyword)
    const isActionValid = validateKeyword(keyword, actionKeyword)
    
    // Verificar si es la keyword específica de la conexión
    const isConnKeyword = conn.keyword && validateKeyword(keyword, conn.keyword)
    
    // Debe pasar alguna validación
    if (!isMasterValid && !isActionValid && !isConnKeyword) {
        return res.status(403).json({ error: 'Palabra clave incorrecta' })
    }
    
    try {
        // Notificar al bot para que limpie la sesión
        await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`,
            { command: 'delete', connectionId: req.params.id },
            { headers: { 'x-bot-token': process.env.BOT_INTERNAL_TOKEN } }
        ).catch(() => {})
        
        // Limpiar QR si existe
        const qrPath = path.join(DATA_DIR, `qr_${req.params.id}.png`)
        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath)
        }
        
        // Eliminar de la DB
        connections.delete(req.params.id)
        res.json({ ok: true, message: 'Conexión eliminada' })
    } catch (error) {
        console.error('Error deleting connection:', error)
        res.status(500).json({ error: 'Error al eliminar conexión' })
    }
})

// Actualizar estado de conexión (usado por el bot)
app.post('/api/connections/:id/status', (req, res) => {
    const { status, phoneNumber } = req.body || {}
    if (!status) return res.status(400).json({ error: 'Estado requerido' })
    
    const conn = connections.get(req.params.id)
    if (!conn) {
        // Si no existe, crear una entrada básica
        connections.set(req.params.id, { 
            id: req.params.id,
            status, 
            phoneNumber,
            logs: [],
            updatedAt: new Date().toISOString()
        })
    } else {
        connections.updateStatus(req.params.id, status, phoneNumber)
    }
    
    res.json({ ok: true })
})

// Agregar log a conexión (usado por el bot)
app.post('/api/connections/:id/log', (req, res) => {
    const { text } = req.body || {}
    if (!text) return res.status(400).json({ error: 'Texto requerido' })
    
    connections.appendLog(req.params.id, text)
    res.json({ ok: true })
})

// Asignar agente a conexión
app.post('/api/connections/:id/assign-agent', requireAuth, (req, res, next) => {
    requireKeyword(req, res, () => {
        const { agentId } = req.body || {}
        const conn = connections.get(req.params.id)
        if (!conn) return res.status(404).json({ error: 'Conexión no encontrada' })

        const agent = agents.get(agentId)
        if (!agent) return res.status(404).json({ error: 'Agente no encontrado' })

        // Validar SOLO keyword de la conexión (el agente no requiere validación adicional)
        const { keyword } = req.body || {}
        if (conn.keyword && !validateKeyword(keyword, conn.keyword)) {
            return res.status(403).json({ error: 'Palabra clave de la conexión incorrecta' })
        }

        connections.assignAgent(req.params.id, agentId)
        res.json({ ok: true, message: 'Agente asignado' })
    }, 'connection_assign_agent')
})

// Logout de conexión (desvincula WhatsApp pero mantiene la conexión en DB)
app.post('/api/connections/:id/logout', requireAuth, async (req, res, next) => {
    requireKeyword(req, res, async () => {
        const conn = connections.get(req.params.id)
        if (!conn) return res.status(404).json({ error: 'Conexión no encontrada' })
        
        // Validar keyword de la conexión
        const { keyword } = req.body || {}
        if (conn.keyword && !validateKeyword(keyword, conn.keyword)) {
            return res.status(403).json({ error: 'Palabra clave de la conexión incorrecta' })
        }

        try {
            // Notificar al bot para que haga logout
            await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`,
                { command: 'logout', connectionId: req.params.id },
                { headers: { 'x-bot-token': process.env.BOT_INTERNAL_TOKEN } }
            ).catch(() => {})

            // Limpiar sesión en filesystem
            const sessionPath = path.join(__dirname, '..', 'bot_sessions', req.params.id)
            if (fs.existsSync(sessionPath)) {
                fs.rmSync(sessionPath, { recursive: true, force: true })
                fs.mkdirSync(sessionPath, { recursive: true })
            }

            // Eliminar QR si existe
            const qrPath = path.join(DATA_DIR, `qr_${req.params.id}.png`)
            if (fs.existsSync(qrPath)) {
                fs.unlinkSync(qrPath)
            }

            // Actualizar estado
            connections.updateStatus(req.params.id, 'disconnected')
            connections.appendLog(req.params.id, `[${new Date().toLocaleTimeString()}] Logout forzado por usuario`)

            res.json({ ok: true, message: 'Sesión cerrada correctamente' })
        } catch (error) {
            console.error('Error logging out:', error)
            res.status(500).json({ error: 'Error al cerrar sesión', details: error.message })
        }
    }, 'connection_toggle')
})

// Reiniciar conexión
app.post('/api/connections/:id/restart', requireAuth, async (req, res, next) => {
    requireKeyword(req, res, async () => {
        const conn = connections.get(req.params.id)
        if (!conn) return res.status(404).json({ error: 'Conexión no encontrada' })
        
        // Validar keyword de la conexión
        const { keyword } = req.body || {}
        if (conn.keyword && !validateKeyword(keyword, conn.keyword)) {
            return res.status(403).json({ error: 'Palabra clave de la conexión incorrecta' })
        }

        try {
            connections.updateStatus(req.params.id, 'restart')
            connections.appendLog(req.params.id, `[${new Date().toLocaleTimeString()}] Reiniciando conexión`)

            // Notificar al bot
            await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`,
                { command: 'restart', connectionId: req.params.id },
                { headers: { 'x-bot-token': process.env.BOT_INTERNAL_TOKEN } }
            ).catch(() => {})

            res.json({ ok: true, message: 'Reinicio solicitado' })
        } catch (error) {
            console.error('Error restarting:', error)
            res.status(500).json({ error: 'Error al reiniciar', details: error.message })
        }
    }, 'connection_toggle')
})

// Obtener logs de conexión
app.get('/api/connections/:id/logs', requireAuth, (req, res) => {
    const conn = connections.get(req.params.id)
    if (!conn) return res.status(404).json({ error: 'Conexión no encontrada' })
    res.json(conn.logs || [])
})

// QR de conexión
app.get('/api/connections/:id/qr', (req, res) => {
    const { id: connectionId } = req.params
    const possiblePaths = [
        path.join(DATA_DIR, `qr_${connectionId}.png`),
        path.join(__dirname, '..', `${connectionId}.qr.png`)
    ]

    for (const qrPath of possiblePaths) {
        if (fs.existsSync(qrPath)) {
            return res.sendFile(qrPath)
        }
    }

    res.status(404).json({ error: 'QR no generado aún' })
})

// ---------- Legacy: Endpoints anteriores de connection (para compatibilidad) ----------
app.get('/api/connection/:agentId?', requireAuth, (req, res) => {
    const { agentId } = req.params
    if (!agentId) return res.json(connections.list())
    const c = connections.get(agentId)
    res.json(c)
})

app.post('/api/connection', requireAuth, (req, res) => {
    const { agentId, status, pairingCode } = req.body || {}
    if (!agentId) return res.status(400).json({ error: 'agentId requerido' })
    const connectionData = { status }
    if (pairingCode) connectionData.pairingCode = pairingCode
    const c = connections.set(agentId, connectionData)
    if (status === 'connecting') {
        connections.appendLog(agentId, `[${new Date().toLocaleTimeString()}] Iniciando conexión con agente ${agentId}`)
    }
    if (status === 'restart') {
        connections.appendLog(agentId, `[${new Date().toLocaleTimeString()}] Reiniciando conexión con agente ${agentId}`)
    }
    res.json(c)
})

// Endpoint para forzar logout y limpieza de sesión
app.post('/api/connection/logout', requireAuth, async (req, res) => {
    const { agentId } = req.body || {}
    if (!agentId) return res.status(400).json({ error: 'agentId requerido' })
    
    try {
        // Limpiar sesión en el filesystem
        const sessionPath = path.join(__dirname, '..', 'bot_sessions', agentId)
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true })
            fs.mkdirSync(sessionPath, { recursive: true })
        }
        
        // Eliminar QR si existe
        const qrPath = path.join(DATA_DIR, `qr_${agentId}.png`)
        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath)
        }
        
        // Actualizar estado
        connections.set(agentId, { status: 'disconnected' })
        connections.appendLog(agentId, `[${new Date().toLocaleTimeString()}] Logout forzado y sesión limpiada`)
        
        // Notificar al bot para que limpie su instancia
        await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`, 
            { command: 'logout', agentId },
            { headers: { 'x-bot-token': process.env.BOT_INTERNAL_TOKEN } }
        ).catch(() => {})
        
        res.json({ ok: true, message: 'Sesión limpiada correctamente' })
    } catch (error) {
        console.error('Error en logout:', error.message)
        res.status(500).json({ error: 'Error al realizar logout', details: error.message })
    }
})

// Endpoint para reiniciar conexión
app.post('/api/connection/restart', requireAuth, async (req, res) => {
    const { agentId } = req.body || {}
    if (!agentId) return res.status(400).json({ error: 'agentId requerido' })
    
    try {
        // Actualizar estado a restart
        connections.set(agentId, { status: 'restart' })
        connections.appendLog(agentId, `[${new Date().toLocaleTimeString()}] Solicitando reinicio de conexión`)
        
        // Notificar al bot
        await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`, 
            { command: 'restart', agentId },
            { headers: { 'x-bot-token': process.env.BOT_INTERNAL_TOKEN } }
        ).catch(() => {})
        
        res.json({ ok: true, message: 'Reinicio solicitado' })
    } catch (error) {
        console.error('Error en restart:', error.message)
        res.status(500).json({ error: 'Error al reiniciar', details: error.message })
    }
})

app.get('/api/connection/qr/:agentId', (req, res) => {
    const { agentId } = req.params
    const possiblePaths = [
        path.join(DATA_DIR, `qr_${agentId}.png`),
        path.join(__dirname, '..', `${agentId}.qr.png`),
        path.join(__dirname, '..', 'bot.qr.png') // fallback genérico
    ]

    for (const qrPath of possiblePaths) {
        if (fs.existsSync(qrPath)) {
            return res.sendFile(qrPath)
        }
    }

    res.status(404).json({ error: 'QR no generado aún' })
})

app.post('/api/connection/log', (req, res) => {
    const { agentId, text } = req.body || {}
    if (agentId && text) connections.appendLog(agentId, text)
    res.json({ ok: true })
})

app.get('/api/connection/logs/:agentId', requireAuth, (req, res) => {
    const { agentId } = req.params
    res.json(connections.get(agentId).logs || [])
})

// ---------- Conversaciones (monitor) ----------
app.get('/api/conversations', requireAuth, (req, res) => {
    res.json(conversations.list())
})

app.get('/api/conversations/:id', requireAuth, (req, res) => {
    const c = conversations.get(req.params.id)
    if (!c) return res.status(404).json({ error: 'Conversación no encontrada' })
    res.json(c)
})

app.post('/api/conversations/push', (req, res) => {
    const { from, body, fromBot } = req.body || {}
    if (!from || body === undefined) return res.status(400).json({ error: 'from y body requeridos' })
    const list = conversations.list()
    let c = list.find((x) => x.id === from || x.contact === from)
    if (!c) {
        c = { id: from, contact: from, messages: [], tag: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        conversations.save(c)
    }
    conversations.addMessage(from, { body, from: fromBot ? 'bot' : 'user', at: new Date().toISOString() })
    return res.json(conversations.get(from) || c)
})

app.put('/api/conversations/:id/tag', requireAuth, (req, res) => {
    const { tag } = req.body || {}
    if (!['frio', 'tibio', 'caliente'].includes(tag)) return res.status(400).json({ error: 'Etiqueta inválida' })
    const c = conversations.get(req.params.id)
    if (!c) return res.status(404).json({ error: 'Conversación no encontrada' })
    c.tag = tag
    c.updatedAt = new Date().toISOString()
    conversations.save(c)
    res.json(c)
})

app.delete('/api/conversations/:id', requireAuth, (req, res) => {
    const id = req.params.id
    const { conversations } = require('./store')
    
    try {
        const deleted = conversations.delete(id)
        if (deleted) {
            res.json({ ok: true, message: 'Conversación eliminada' })
        } else {
            res.status(404).json({ error: 'Conversación no encontrada' })
        }
    } catch (error) {
        console.error('Error deleting conversation:', error)
        res.status(500).json({ error: 'Error al eliminar conversación' })
    }
})

// ---------- Conversaciones por conexión (NEW) ----------
app.get('/api/conversations/by-connection/:connectionId', requireAuth, (req, res) => {
    const { connectionId } = req.params
    const { conversations } = require('./store')

    const all = conversations.list()
    // Filtrar conversaciones que coincidan con el connectionId
    // Las conversaciones tienen id = número@s.whatsapp.net, necesitamos matchear con la conexión
    const filtered = all.filter(c => {
        // Extraer número de la conversación
        const convNumber = c.id?.split('@')[0]
        // Obtener número de la conexión
        const conn = connections.get(connectionId)
        const connNumber = conn?.phoneNumber

        return convNumber === connNumber
    })

    res.json(filtered)
})

// ========== ENDPOINTS PARA CITAS ==========

// Listar todas las citas (con filtros)
app.get('/api/citas', requireAuth, (req, res) => {
    const citas = citasService.getAll()
    
    const { estado, connectionId, conversationId } = req.query
    let filtradas = citas
    
    if (estado) {
        filtradas = filtradas.filter(c => c.estado === estado)
    }
    if (connectionId) {
        filtradas = filtradas.filter(c => c.connectionId === connectionId)
    }
    if (conversationId) {
        filtradas = filtradas.filter(c => c.conversationId === conversationId)
    }
    
    res.json(filtradas)
})

// Obtener estadísticas de citas
app.get('/api/citas/stats', requireAuth, (req, res) => {
    const stats = citasService.getStats()
    res.json(stats)
})

// Obtener cita por ID
app.get('/api/citas/:id', requireAuth, (req, res) => {
    const cita = citasService.getById(req.params.id)
    if (!cita) {
        return res.status(404).json({ error: 'Cita no encontrada' })
    }
    res.json(cita)
})

// Verificar si un cliente tiene cita activa
app.get('/api/citas/conversation/:conversationId/activa', requireAuth, (req, res) => {
    const cita = citasService.getActivaByConversation(req.params.conversationId)
    
    if (!cita) {
        return res.json({ tieneCita: false })
    }
    
    res.json({
        tieneCita: true,
        cita: {
            id: cita.id,
            fecha: cita.fecha,
            hora: cita.hora,
            tipo: cita.tipo,
            fechaFormateada: formatPeruDate(cita.fecha),
            horaFormateada: formatPeruTime(cita.hora)
        }
    })
})

// Crear cita
app.post('/api/citas', requireAuth, (req, res) => {
    const { conversationId, connectionId, nombre, telefono, fecha, hora, tipo, descripcion } = req.body
    
    // Validaciones
    if (!conversationId || !connectionId || !nombre || !telefono || !fecha || !hora || !tipo) {
        return res.status(400).json({ error: 'Campos requeridos faltantes' })
    }
    
    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({ error: 'Formato de fecha inválido (usar YYYY-MM-DD)' })
    }
    
    // Validar formato de hora
    if (!/^\d{2}:\d{2}$/.test(hora)) {
        return res.status(400).json({ error: 'Formato de hora inválido (usar HH:MM)' })
    }
    
    try {
        const cita = citasService.create({
            conversationId,
            connectionId,
            nombre,
            telefono,
            fecha,
            hora,
            tipo,
            descripcion
        })
        
        res.status(201).json(cita)
    } catch (error) {
        // Error de cita duplicada
        if (error.message.includes('ya tiene una cita activa')) {
            return res.status(409).json({ error: error.message })
        }
        res.status(500).json({ error: error.message })
    }
})

// Cancelar cita
app.post('/api/citas/:id/cancelar', requireAuth, (req, res) => {
    const { canceladoPor, motivo } = req.body
    
    const cita = citasService.cancelar(req.params.id, canceladoPor || 'agente', motivo)
    if (!cita) {
        return res.status(404).json({ error: 'Cita no encontrada' })
    }
    
    res.json(cita)
})

// Eliminar cita manualmente
app.delete('/api/citas/:id', requireAuth, (req, res) => {
    const deleted = citasService.deleteCita(req.params.id)
    res.json({ ok: true })
})

// Actualizar cita
app.put('/api/citas/:id', requireAuth, (req, res) => {
    const cita = citasService.update(req.params.id, req.body)
    if (!cita) {
        return res.status(404).json({ error: 'Cita no encontrada' })
    }
    res.json(cita)
})

// Marcar cita como completada
app.post('/api/citas/:id/completar', requireAuth, (req, res) => {
    const cita = citasService.marcarCompletada(req.params.id)
    if (!cita) {
        return res.status(404).json({ error: 'Cita no encontrada' })
    }
    res.json(cita)
})

// ---------- Blocked Numbers ----------
app.get('/api/blocked-numbers', requireAuth, (req, res) => {
    const { blockedNumbers } = require('./store')
    res.json(blockedNumbers.list())
})

app.post('/api/blocked-numbers', requireAuth, (req, res) => {
    const { blockedNumbers } = require('./store')
    const { number } = req.body || {}
    if (!number) return res.status(400).json({ error: 'Número requerido' })
    
    blockedNumbers.add(number)
    res.json({ ok: true })
})

app.delete('/api/blocked-numbers/:number', requireAuth, (req, res) => {
    const { blockedNumbers } = require('./store')
    const { number } = req.params
    
    blockedNumbers.remove(number)
    res.json({ ok: true })
})

// ---------- Settings ----------
app.get('/api/settings', requireAuth, (req, res) => {
    res.json(settings.get())
})

app.put('/api/settings', requireAuth, (req, res) => {
    const current = settings.get()
    const next = { ...current, ...req.body }
    
    // Si se actualiza security, preservar keywords existentes
    if (req.body.security) {
        next.security = {
            ...current.security,
            ...req.body.security
        }
    }
    
    settings.save(next)
    res.json(next)
})

// ---------- Qwen OAuth ----------
const { requestDeviceCode, pollForToken, removeTokenForAgent, getTokenStatus } = require('../services/qwenOAuth')
const qwenProxy = require('../services/qwenProxy')

// Endpoint para verificar estado de OAuth (proxy local)
app.get('/api/agents/qwen/status', requireAuth, async (req, res) => {
    try {
        const qwenProxy = require('./services/qwenProxy')
        const status = qwenProxy.getCredentialStatus()
        
        // Leer modelo desde settings.json
        const fs = require('fs')
        const os = require('os')
        const path = require('path')
        const settingsPath = path.join(os.homedir(), '.qwen', 'settings.json')
        let model = 'coder-model' // default
        
        if (fs.existsSync(settingsPath)) {
            try {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
                model = settings?.model?.name || 'coder-model'
            } catch (e) {
                console.error('Error leyendo settings.json:', e.message)
            }
        }
        
        res.json({
            success: true,
            ...status,
            model
        })
    } catch (error) {
        console.error('Error obteniendo estado OAuth:', error)
        res.status(500).json({ error: error.message })
    }
})

// ========== QWEN OAUTH ENDPOINTS (para componente QwenOAuth) ==========

/**
 * GET /api/qwen/auth/status
 * Verifica el estado de la autenticación con Qwen
 */
app.get('/api/qwen/auth/status', requireAuth, async (req, res) => {
    try {
        const fs = require('fs')
        const os = require('os')
        const path = require('path')
        
        // Leer oauth_creds.json
        const credsPath = path.join(os.homedir(), '.qwen', 'oauth_creds.json')
        let creds = null
        
        if (fs.existsSync(credsPath)) {
            creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
        }
        
        // Leer settings.json para el modelo
        const settingsPath = path.join(os.homedir(), '.qwen', 'settings.json')
        let model = 'coder-model'
        
        if (fs.existsSync(settingsPath)) {
            try {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
                model = settings?.model?.name || 'coder-model'
            } catch (e) {
                console.error('Error leyendo settings.json:', e.message)
            }
        }
        
        const now = Date.now()
        const expiresAt = creds?.expiry_date || 0
        const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000))
        const isValid = creds !== null && expiresIn > 0
        
        // Formatear tiempo
        function formatTime(seconds) {
            if (seconds < 60) return `${Math.floor(seconds)}s`
            if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
            if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
            return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
        }
        
        res.json({
            success: true,
            connected: isValid,
            hasCredentials: creds !== null,
            isValid,
            expiresAt: new Date(expiresAt).toISOString(),
            expiresIn,
            expiresInFormatted: formatTime(expiresIn),
            model,
            message: isValid 
                ? `Token válido por ${formatTime(expiresIn)}`
                : (creds ? 'Token expirado' : 'No autenticado')
        })
    } catch (error) {
        console.error('Error en /api/qwen/auth/status:', error)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// Iniciar flujo OAuth para un agente
app.post('/api/agents/:id/qwen/oauth/start', requireAuth, async (req, res) => {
    try {
        const result = await requestDeviceCode()

        if (!result.success) {
            return res.status(500).json({
                error: result.error,
                status: result.status
            })
        }

        // Guardar device_code en sesión para polling
        req.session.qwenDeviceCode = result.device_code
        req.session.qwenAgentId = req.params.id

        res.json({
            success: true,
            user_code: result.user_code,
            verification_uri: result.verification_uri,
            verification_uri_complete: result.verification_uri_complete,
            expires_in: result.expires_in,
            interval: result.interval
        })
    } catch (error) {
        console.error('Error iniciando OAuth Qwen:', error)
        res.status(500).json({ error: error.message })
    }
})

// Polling para obtener token OAuth
app.post('/api/agents/:id/qwen/oauth/poll', requireAuth, async (req, res) => {
    try {
        const deviceCode = req.session.qwenDeviceCode
        const agentId = req.params.id

        if (!deviceCode) {
            return res.status(400).json({ error: 'No hay sesión de OAuth iniciada' })
        }

        const result = await pollForToken(deviceCode, agentId)

        if (result.success) {
            // Limpiar sesión
            delete req.session.qwenDeviceCode
            delete req.session.qwenAgentId

            res.json({
                success: true,
                authorized: true,
                message: 'Token OAuth obtenido exitosamente'
            })
        } else if (result.error === 'authorization_pending') {
            res.json({
                success: false,
                authorized: false,
                message: 'Esperando autorización del usuario'
            })
        } else if (result.error === 'slow_down') {
            res.json({
                success: false,
                authorized: false,
                message: 'Reduciendo frecuencia de polling',
                slowDown: true
            })
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                error_description: result.error_description
            })
        }
    } catch (error) {
        console.error('Error en polling OAuth Qwen:', error)
        res.status(500).json({ error: error.message })
    }
})

// Verificar estado del token OAuth para un agente
app.get('/api/agents/:id/qwen/oauth/status', requireAuth, async (req, res) => {
    try {
        const status = getTokenStatus(req.params.id)
        res.json({
            success: true,
            ...status
        })
    } catch (error) {
        console.error('Error obteniendo estado OAuth:', error)
        res.status(500).json({ error: error.message })
    }
})

// Revocar token OAuth (logout)
app.post('/api/agents/:id/qwen/oauth/revoke', requireAuth, async (req, res) => {
    try {
        removeTokenForAgent(req.params.id)
        res.json({
            success: true,
            message: 'Token OAuth revocado exitosamente'
        })
    } catch (error) {
        console.error('Error revocando token OAuth:', error)
        res.status(500).json({ error: error.message })
    }
})

// ========== CATÁLOGO MULTIMEDIA ==========
const mediaCatalog = require('./services/mediaCatalog')
const mediaDirBase = path.join(DATA_DIR, 'media')

// Configurar multer para uploads de multimedia (máx 20 MB)
const mediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const agentId = req.params.id
        const agentDir = path.join(mediaDirBase, agentId)
        
        // Asegurar que la carpeta exista
        if (!fs.existsSync(agentDir)) {
            fs.mkdirSync(agentDir, { recursive: true })
        }
        
        cb(null, agentDir)
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now()
        const random = Math.random().toString(36).slice(2, 8)
        const originalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
        cb(null, `${timestamp}_${random}_${originalName}`)
    }
})

const mediaUpload = multer({
    storage: mediaStorage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 20 MB
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/webp',
            'video/mp4', 'video/quicktime',
            'application/pdf', 'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]
        
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error('Tipo de archivo no permitido. Solo imágenes, videos y documentos PDF/Word.'), false)
        }
    }
})

// GET /api/agents/:id/media - Listar catálogo
app.get('/api/agents/:id/media', requireAuth, (req, res) => {
    try {
        const catalog = mediaCatalog.getMediaCatalog(req.params.id)
        res.json({ success: true, catalog })
    } catch (error) {
        res.status(400).json({ success: false, error: error.message })
    }
})

// GET /api/agents/:id/media/search - Buscar en catálogo
app.get('/api/agents/:id/media/search', requireAuth, (req, res) => {
    try {
        const { q } = req.query
        if (!q) {
            return res.status(400).json({ success: false, error: 'Parámetro q requerido' })
        }
        
        const results = mediaCatalog.searchMediaCatalog(req.params.id, q)
        res.json({ success: true, results })
    } catch (error) {
        res.status(400).json({ success: false, error: error.message })
    }
})

// POST /api/agents/:id/media - Subir archivo o enlace de WhatsApp
app.post('/api/agents/:id/media', requireAuth, mediaUpload.single('file'), (req, res) => {
    try {
        const { title, description, category, price, tags, mediaType } = req.body
        const type = mediaType || 'file' // 'file' o 'whatsapp-link'

        // Manejar enlace de WhatsApp
        if (type === 'whatsapp-link') {
            const { whatsappLink } = req.body

            if (!whatsappLink || !whatsappLink.trim()) {
                return res.status(400).json({ success: false, error: 'Enlace de WhatsApp requerido' })
            }

            // Validar estructura del enlace: https://wa.me/p/PRODUCTO/TELEFONO
            const whatsappPattern = /^https?:\/\/(www\.)?wa\.me\/p\/(\d+)\/(\d+)(\?.*)?$/i
            const match = whatsappLink.match(whatsappPattern)

            if (!match) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'El enlace no tiene un formato válido. Debe ser: https://wa.me/p/NUMERODEPRODUCTO/NUMERODETELEFONO'
                })
            }

            const [, , productId, phoneNumber] = match

            // Parsear tags si viene como string
            let tagsArray = []
            if (tags) {
                tagsArray = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(t => t) : tags
            }

            // Crear item con el enlace
            const newItem = mediaCatalog.addMediaItem(req.params.id, {
                title,
                description: description || '',
                category: category || 'general',
                price: price || null,
                type: 'whatsapp-link',
                whatsappLink,
                productId,
                phoneNumber,
                url: whatsappLink,
                tags: tagsArray
            })

            return res.status(201).json({ success: true, item: newItem })
        }

        // Manejar archivo tradicional
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'Archivo requerido' })
        }

        // Determinar tipo de archivo
        let fileType = 'document'
        if (req.file.mimetype.startsWith('image/')) fileType = 'image'
        else if (req.file.mimetype.startsWith('video/')) fileType = 'video'

        // Parsear tags si viene como string
        let tagsArray = []
        if (tags) {
            tagsArray = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(t => t) : tags
        }

        // Validar datos
        const validation = mediaCatalog.validateMediaItem({
            title,
            type: fileType,
            mimeType: req.file.mimetype,
            fileSize: req.file.size
        })

        if (!validation.valid) {
            // Eliminar archivo subido
            fs.unlinkSync(req.file.path)
            return res.status(400).json({ success: false, errors: validation.errors })
        }

        // Crear item
        const newItem = mediaCatalog.addMediaItem(req.params.id, {
            title,
            description: description || '',
            category: category || 'general',
            price: price || null,
            fileName: req.file.originalname,
            filePath: req.file.path,
            url: `/api/agents/${req.params.id}/media/${Date.now()}/file`,
            type: fileType,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            tags: tagsArray
        })

        res.status(201).json({ success: true, item: newItem })
    } catch (error) {
        console.error('Error subiendo archivo:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

// PUT /api/agents/:agentId/media/:itemId - Actualizar metadata
app.put('/api/agents/:agentId/media/:itemId', requireAuth, (req, res) => {
    try {
        const { title, description, category, price, tags } = req.body
        
        const updatedItem = mediaCatalog.updateMediaItem(req.params.agentId, req.params.itemId, {
            title,
            description,
            category,
            price,
            tags
        })
        
        res.json({ success: true, item: updatedItem })
    } catch (error) {
        res.status(400).json({ success: false, error: error.message })
    }
})

// DELETE /api/agents/:agentId/media/:itemId - Eliminar archivo
app.delete('/api/agents/:agentId/media/:itemId', requireAuth, (req, res) => {
    try {
        const deletedItem = mediaCatalog.deleteMediaItem(req.params.agentId, req.params.itemId)
        res.json({ success: true, deletedItem })
    } catch (error) {
        res.status(400).json({ success: false, error: error.message })
    }
})

// GET /api/agents/:agentId/media/:itemId/file - Descargar/servir archivo
app.get('/api/agents/:agentId/media/:itemId/file', requireAuth, (req, res) => {
    try {
        const item = mediaCatalog.getMediaItem(req.params.agentId, req.params.itemId)
        
        if (!item) {
            return res.status(404).json({ success: false, error: 'Archivo no encontrado' })
        }
        
        if (!fs.existsSync(item.filePath)) {
            return res.status(404).json({ success: false, error: 'Archivo físico no encontrado' })
        }
        
        res.setHeader('Content-Type', item.mimeType)
        res.setHeader('Content-Disposition', `inline; filename="${item.fileName}"`)
        res.sendFile(item.filePath)
    } catch (error) {
        res.status(500).json({ success: false, error: error.message })
    }
})

// ---------- Seed agente por defecto ----------
app.post('/api/seed-default-agent', requireAuth, (req, res) => {
    const list = agents.list()
    if (list.length > 0) return res.status(400).json({ error: 'Ya existen agentes' })
    const protocolPath = path.join(DATA_DIR, 'PROTOCOLO_BASE_CONOCIMIENTO.txt')
    let knowledgeBase = ''
    if (fs.existsSync(protocolPath)) knowledgeBase = fs.readFileSync(protocolPath, 'utf8')
    const defaultApiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
    const agent = {
        id: 'ag_default_1',
        name: 'Agente Ventas',
        isPrimary: true,
        systemPrompt: 'Eres un asistente de ventas amable. Sigues estrictamente el protocolo de conversación y cierre. Respuestas breves, máx 3-5 líneas. No alucines; basate solo en la base de conocimiento.',
        knowledgeBase,
        rules: { saludoInicial: 'Hola! ¿En qué puedo ayudarte hoy?' },
        objections: [],
        motor: 'deepseek',
        model: 'deepseek-chat',
        apiKey: defaultApiKey,
        temperature: 0.3,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }
    agents.save(agent)
    res.status(201).json({ ...agent, apiKey: '************' })
})

// ========== ENDPOINT PARA MENSAJE PROACTIVO (Citas) ==========
app.post('/api/command/proactive-message', requireAuth, async (req, res) => {
    try {
        const { connectionId, to, message } = req.body
        
        if (!connectionId || !to || !message) {
            return res.status(400).json({ error: 'Faltan campos requeridos' })
        }
        
        // Enviar comando al bot para mensaje proactivo
        await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`, {
            command: 'send-proactive-message',
            connectionId,
            to,
            message
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-bot-token': process.env.BOT_INTERNAL_TOKEN || 'default-token'
            }
        })
        
        res.json({ ok: true, message: 'Mensaje enviado' })
    } catch (error) {
        console.error('Error enviando mensaje proactivo:', error.message)
        res.status(500).json({ error: 'Error enviando mensaje' })
    }
})

// Iniciar scheduler de citas al arrancar el servidor
setTimeout(() => {
    try {
        citasScheduler.start()
        console.log('✅ Scheduler de citas iniciado')
    } catch (error) {
        console.error('❌ Error iniciando scheduler de citas:', error.message)
    }
}, 5000) // Esperar 5 segundos a que el bot esté listo

// ========== ENDPOINTS DE PAGOS (Sistema OCR) ==========
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json')

// LISTAR PAGOS (con filtros)
app.get('/api/pagos', requireAuth, async (req, res) => {
    try {
        const { cliente, estado, desde, hasta, tipoServicio, agentId } = req.query

        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }

        // Filtrar solo pagos válidos (excluir _info y _estructura)
        // Un pago válido tiene id que empieza con 'pago_' seguido de números y no contiene '|' o 'TIMESTAMP'
        let pagosArray = Object.values(payments).filter(p =>
            p && p.id && p.id.startsWith('pago_') &&
            !p.id.includes('|') &&
            !p.id.includes('TIMESTAMP')
        )

        // Filtros
        if (cliente) {
            // Soporte para búsqueda parcial (sin @lid o @s.whatsapp.net)
            const clienteClean = cliente.split('@')[0]
            pagosArray = pagosArray.filter(p => {
                const pCliente = p.cliente ? p.cliente.split('@')[0] : ''
                return pCliente === clienteClean || p.cliente === cliente
            })
        }

        if (estado) {
            pagosArray = pagosArray.filter(p => p.estado === estado)
        }

        if (desde) {
            pagosArray = pagosArray.filter(p => p.fechaPago >= desde)
        }

        if (hasta) {
            pagosArray = pagosArray.filter(p => p.fechaPago <= hasta)
        }

        if (tipoServicio) {
            pagosArray = pagosArray.filter(p => p.tipoServicio === tipoServicio)
        }

        // Filtro por agente (solo si se proporciona)
        if (agentId && agentId !== 'todos') {
            pagosArray = pagosArray.filter(p => p.agentId === agentId)
        }

        // Ordenar por fecha (más reciente primero)
        pagosArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

        res.json(pagosArray)
    } catch (error) {
        console.error('Error listando pagos:', error.message)
        res.status(500).json({ error: 'Error listando pagos' })
    }
})

// DETALLE DE PAGO
app.get('/api/pagos/:id', requireAuth, async (req, res) => {
    try {
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }
        
        const pago = payments[req.params.id]
        
        if (!pago) {
            return res.status(404).json({ error: 'Pago no encontrado' })
        }
        
        // Incluir imagen en base64 si existe
        if (pago.comprobantePath && fs.existsSync(pago.comprobantePath)) {
            const imageBase64 = fs.readFileSync(pago.comprobantePath, 'base64')
            pago.imageBase64 = `data:image/jpeg;base64,${imageBase64}`
        }
        
        res.json(pago)
    } catch (error) {
        console.error('Error obteniendo pago:', error.message)
        res.status(500).json({ error: 'Error obteniendo pago' })
    }
})

// IMAGEN DE COMPROBANTE
app.get('/api/pagos/:id/imagen', requireAuth, async (req, res) => {
    try {
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }
        
        const pago = payments[req.params.id]
        
        if (!pago || !pago.comprobantePath) {
            return res.status(404).json({ error: 'Imagen no encontrada' })
        }
        
        res.sendFile(path.resolve(pago.comprobantePath))
    } catch (error) {
        console.error('Error enviando imagen:', error.message)
        res.status(500).json({ error: 'Error enviando imagen' })
    }
})

// CONFIRMAR PAGO
app.post('/api/pagos/:id/confirmar', requireAuth, async (req, res) => {
    try {
        const { asesorId } = req.body
        
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }
        
        const pago = payments[req.params.id]
        
        if (!pago) {
            return res.status(404).json({ error: 'Pago no encontrado' })
        }
        
        pago.estado = 'confirmado'
        pago.confirmadoPor = asesorId || 'admin'
        pago.confirmadoEn = new Date().toISOString()
        pago.updatedAt = new Date().toISOString()
        
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2))
        
        // Notificar al cliente por WhatsApp (opcional)
        try {
            await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`, {
                command: 'send-message',
                connectionId: pago.connectionId,
                to: pago.cliente,
                message: {
                    text: `✅ *¡Pago confirmado!*\n\n` +
                          `Hola ${pago.nombreCliente || 'cliente'},\n\n` +
                          `Tu pago de S/ ${pago.montoPagado?.toFixed(2)} ha sido confirmado.\n\n` +
                          `Gracias por tu compra. ¡Bienvenido/a!`
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-token': process.env.BOT_INTERNAL_TOKEN
                }
            })
        } catch (error) {
            console.error('Error enviando notificación:', error.message)
        }
        
        res.json({ ok: true, pago })
    } catch (error) {
        console.error('Error confirmando pago:', error.message)
        res.status(500).json({ error: 'Error confirmando pago' })
    }
})

// RECHAZAR PAGO
app.post('/api/pagos/:id/rechazar', requireAuth, async (req, res) => {
    try {
        const { asesorId, motivo } = req.body
        
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }
        
        const pago = payments[req.params.id]
        
        if (!pago) {
            return res.status(404).json({ error: 'Pago no encontrado' })
        }
        
        pago.estado = 'rechazado'
        pago.rechazadoPor = asesorId || 'admin'
        pago.rechazadoEn = new Date().toISOString()
        pago.motivoRechazo = motivo || 'No especificado'
        pago.updatedAt = new Date().toISOString()
        
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2))
        
        // Notificar al cliente
        try {
            await axios.post(`http://127.0.0.1:${process.env.BOT_PORT || 3848}/api/command`, {
                command: 'send-message',
                connectionId: pago.connectionId,
                to: pago.cliente,
                message: {
                    text: `⚠️ *Pago no aprobado*\n\n` +
                          `Hola ${pago.nombreCliente || 'cliente'},\n\n` +
                          `Tu comprobante no pudo ser aprobado.\n\n` +
                          `Motivo: ${motivo || 'No especificado'}\n\n` +
                          `Si crees que es un error, por favor responde este mensaje.`
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-token': process.env.BOT_INTERNAL_TOKEN
                }
            })
        } catch (error) {
            console.error('Error enviando notificación:', error.message)
        }
        
        res.json({ ok: true, pago })
    } catch (error) {
        console.error('Error rechazando pago:', error.message)
        res.status(500).json({ error: 'Error rechazando pago' })
    }
})

// ELIMINAR PAGO (individual)
app.delete('/api/pagos/:id', requireAuth, async (req, res) => {
    try {
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }

        const pagoId = req.params.id
        const pago = payments[pagoId]

        if (!pago) {
            return res.status(404).json({ error: 'Pago no encontrado' })
        }

        // Guardar información para log
        const montoEliminado = pago.montoPagado || pago.monto || 0
        const clienteEliminado = pago.cliente

        // Eliminar el pago
        delete payments[pagoId]

        // Guardar cambios
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2))

        // Log de eliminación (importante para auditoría financiera)
        console.log(`💀 [PAGOS] ELIMINADO: ${pagoId} - Cliente: ${clienteEliminado} - Monto: S/ ${montoEliminado.toFixed(2)}`)

        res.json({ ok: true, message: 'Pago eliminado permanentemente' })
    } catch (error) {
        console.error('Error eliminando pago:', error.message)
        res.status(500).json({ error: 'Error eliminando pago' })
    }
})

// ESTADÍSTICAS DE PAGOS
app.get('/api/pagos/estadisticas', requireAuth, async (req, res) => {
    try {
        const { desde, hasta } = req.query
        
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }
        
        const pagosArray = Object.values(payments)
        
        const filtrados = pagosArray.filter(p => {
            if (!desde && !hasta) return true
            const fechaPago = new Date(p.fechaPago)
            if (desde && fechaPago < new Date(desde)) return false
            if (hasta && fechaPago > new Date(hasta)) return false
            return true
        })
        
        const totalPagos = filtrados.length
        const confirmados = filtrados.filter(p => p.estado === 'confirmado')
        const pendientes = filtrados.filter(p => p.estado === 'pendiente_confirmacion_asesor' || p.estado === 'no_legible')
        const rechazados = filtrados.filter(p => p.estado === 'rechazado')
        
        const montoTotal = confirmados.reduce((sum, p) => sum + (p.montoPagado || 0), 0)
        
        // Pagos por servicio
        const porServicio = {}
        confirmados.forEach(p => {
            const servicio = p.tipoServicio || 'No especificado'
            if (!porServicio[servicio]) {
                porServicio[servicio] = { count: 0, monto: 0 }
            }
            porServicio[servicio].count++
            porServicio[servicio].monto += (p.montoPagado || 0)
        })
        
        res.json({
            totalPagos,
            confirmados: confirmados.length,
            pendientes: pendientes.length,
            rechazados: rechazados.length,
            montoTotal,
            porServicio,
            periodo: { desde, hasta }
        })
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error.message)
        res.status(500).json({ error: 'Error obteniendo estadísticas' })
    }
})

// ---------- Servir frontend (build) ----------
const webappBuild = path.join(__dirname, '..', 'webapp', 'dist')
if (fs.existsSync(webappBuild)) {
    app.use(express.static(webappBuild))
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).end()
        res.sendFile(path.join(webappBuild, 'index.html'))
    })
}

app.listen(PORT, () => {
    console.log(`CONTROLA.agentes API en http://localhost:${PORT}`)
})
