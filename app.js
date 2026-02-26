require('dotenv').config()
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    PHONENUMBER_MCC
} = require('@whiskeysockets/baileys')
const { Boom } = require('@hapi/boom')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const pino = require('pino')
const { responderConIA } = require('./services/agenteIA')
const ocrService = require('./services/ocrService')
const NodeCache = require('node-cache')
const citasService = require('./server/services/citasService')
const { getPeruNow, formatPeruDate, formatPeruTime } = require('./server/config/timezone')

const API_URL = process.env.WEBAPP_API_URL || 'http://127.0.0.1:3847'
const DATA_DIR = path.join(__dirname, 'server', 'data')
const BOT_TOKEN = process.env.BOT_INTERNAL_TOKEN
const SESSIONS_DIR = path.join(__dirname, 'bot_sessions')

// Cache para mensajes pendientes
const msgRetryCounterCache = new NodeCache()
const userDevicesCache = new NodeCache()

// PREVENIR MENSAJES DUPLICADOS: Track de mensajes ya procesados
const processedMessages = new Map() // messageId -> timestamp
const PROCESSED_TTL_MS = 60000 // 1 minuto para evitar re-procesamiento

// Limpieza periódica de mensajes procesados
setInterval(() => {
    const now = Date.now()
    for (const [id, timestamp] of processedMessages.entries()) {
        if (now - timestamp > PROCESSED_TTL_MS) {
            processedMessages.delete(id)
        }
    }
}, 30000)

// ============================================================================
// HOT STANDBY: Nueva estructura de instancias
// ============================================================================
// connectionId -> {
//   primary: { sock, connected, createdAt, lastHeartbeat, ... },
//   standby: { sock, connected, createdAt, lastHeartbeat, ... },
//   activeSlot: 'primary' | 'standby',
//   agentId: string,
//   phoneNumber: string,
//   messageQueue: Map<messageId, { message, timestamp, processed }>,
//   failoverCount: number,
//   lastFailover: timestamp
// }
const connections = new Map()

// PREVENIR DUPLICADOS: Track de reconexiones en progreso por slot
const reconnectingSlots = new Map() // connectionId -> Set<'primary' | 'standby'>

// Message Queue global para recuperación post-failover
const MESSAGE_QUEUE_TTL_MS = 120000 // 2 minutos de retención
const messageQueueCleanupInterval = 30000 // Limpieza cada 30s

const apiHeaders = { headers: { 'x-bot-token': BOT_TOKEN } }

/**
 * Normaliza un número de teléfono WhatsApp
 */
function normalizePhoneNumber(number) {
    if (!number) return ''
    let clean = number.split('@')[0]
    if (clean.startsWith('+')) {
        clean = clean.substring(1)
    }
    clean = clean.replace(/\D/g, '')
    return clean
}

/**
 * Verifica si un socket está realmente vivo y funcional
 */
function isSocketAlive(sock) {
    if (!sock) return false
    if (sock.ws && typeof sock.ws.isReady === 'function') {
        return sock.ws.isReady()
    }
    if (sock.authState?.creds?.me) {
        return true
    }
    return !!sock.ev
}

/**
 * Limpia todos los listeners de un socket antes de cerrarlo
 */
function cleanupSocketListeners(sock, connectionId, slot) {
    if (!sock || !sock.ev) return

    const slotTag = slot ? `[${slot}]` : ''
    console.log(`[${connectionId}]${slotTag} Limpiando listeners del socket...`)
    try {
        sock.ev.removeAllListeners('messages.upsert')
        sock.ev.removeAllListeners('connection.update')
        sock.ev.removeAllListeners('creds.update')
        sock.ev.removeAllListeners('messaging-history.set')
        sock.ev.removeAllListeners('chats.upsert')
        sock.ev.removeAllListeners('chats.update')
        sock.ev.removeAllListeners('contacts.update')
        console.log(`[${connectionId}]${slotTag} Listeners limpiados correctamente`)
    } catch (error) {
        console.error(`[${connectionId}]${slotTag} Error limpiando listeners:`, error.message)
    }
}

/**
 * Detiene el heartbeat de una conexión
 */
function stopHeartbeat(connectionId) {
    const conn = connections.get(connectionId)
    if (!conn) return
    
    if (conn.primary?.healthCheckInterval) {
        clearInterval(conn.primary.healthCheckInterval)
        conn.primary.healthCheckInterval = null
    }
    if (conn.standby?.healthCheckInterval) {
        clearInterval(conn.standby.healthCheckInterval)
        conn.standby.healthCheckInterval = null
    }
    console.log(`[${connectionId}] Heartbeats detenidos`)
}

/**
 * Limpia mensajes viejos de la cola (más de 2 minutos)
 */
function cleanupMessageQueue(connectionId) {
    const conn = connections.get(connectionId)
    if (!conn || !conn.messageQueue) return
    
    const now = Date.now()
    let cleaned = 0
    
    for (const [msgId, msgData] of conn.messageQueue.entries()) {
        if (now - msgData.timestamp > MESSAGE_QUEUE_TTL_MS) {
            conn.messageQueue.delete(msgId)
            cleaned++
        }
    }
    
    if (cleaned > 0) {
        console.log(`[${connectionId}] 🧹 Limpieza de cola: ${cleaned} mensajes eliminados`)
    }
}

/**
 * Agrega mensaje a la cola para recuperación post-failover
 */
function enqueueMessage(connectionId, message) {
    const conn = connections.get(connectionId)
    if (!conn) return
    
    if (!conn.messageQueue) {
        conn.messageQueue = new Map()
    }
    
    const msgId = message.key.id || `msg_${Date.now()}_${Math.random()}`
    conn.messageQueue.set(msgId, {
        message,
        timestamp: Date.now(),
        processed: false
    })
    
    // Limitar tamaño de cola (máx 500 mensajes)
    if (conn.messageQueue.size > 500) {
        const firstKey = conn.messageQueue.keys().next().value
        conn.messageQueue.delete(firstKey)
    }
}

/**
 * Marca un mensaje como procesado en la cola
 */
function markMessageProcessed(connectionId, messageId) {
    const conn = connections.get(connectionId)
    if (!conn || !conn.messageQueue) return
    
    const msgData = conn.messageQueue.get(messageId)
    if (msgData) {
        msgData.processed = true
    }
}

/**
 * Verifica y procesa mensajes pendientes acumulados durante la desconexión
 * Se llama después de una reconexión exitosa
 */
async function checkAndProcessPendingMessages(connectionId, sock) {
    const conn = connections.get(connectionId)
    if (!conn || !sock) return

    const now = Date.now()
    const PENDING_WINDOW_MS = 300000 // 5 minutos hacia atrás

    console.log(`[${connectionId}] 🔍 Verificando mensajes pendientes de los últimos ${PENDING_WINDOW_MS/1000}s...`)

    // La cola ya contiene mensajes que llegaron durante la desconexión
    // gracias al evento messages.upsert que los acumula
    const pendingCount = conn.messageQueue?.size || 0
    
    if (pendingCount > 0) {
        console.log(`[${connectionId}] 📨 ${pendingCount} mensajes en cola, procesando...`)
        await recoverUnprocessedMessages(connectionId, sock)
    } else {
        console.log(`[${connectionId}] ✓ No hay mensajes pendientes`)
    }
}

/**
 * Recupera mensajes no procesados de la cola después de un failover
 * Procesa mensajes en paralelo para máxima velocidad
 */
async function recoverUnprocessedMessages(connectionId, sock) {
    const conn = connections.get(connectionId)
    if (!conn || !conn.messageQueue) return 0

    const unprocessed = []
    const now = Date.now()
    const RECOVERY_WINDOW_MS = 120000 // 2 minutos de ventana de recuperación

    for (const [msgId, msgData] of conn.messageQueue.entries()) {
        // Solo recuperar mensajes dentro de la ventana de tiempo
        if (!msgData.processed && (now - msgData.timestamp) < RECOVERY_WINDOW_MS) {
            unprocessed.push(msgData.message)
        }
    }

    if (unprocessed.length > 0) {
        console.log(`[${connectionId}] 📬 Recuperando ${unprocessed.length} mensajes perdidos (ventana: ${RECOVERY_WINDOW_MS/1000}s)...`)

        // Procesar mensajes en paralelo con límite de concurrencia
        const CONCURRENCY_LIMIT = 5
        const batches = []
        
        for (let i = 0; i < unprocessed.length; i += CONCURRENCY_LIMIT) {
            batches.push(unprocessed.slice(i, i + CONCURRENCY_LIMIT))
        }

        for (const batch of batches) {
            await Promise.allSettled(
                batch.map(async (message) => {
                    try {
                        const msgId = message.key.id
                        const msgData = conn.messageQueue.get(msgId)
                        
                        // Verificar doblemente que no se haya procesado
                        if (msgData && !msgData.processed) {
                            msgData.processed = true // Marcar inmediatamente para evitar duplicados
                            await processMessage(connectionId, message, sock)
                            console.log(`[${connectionId}] ✅ Mensaje recuperado: ${msgId}`)
                        }
                    } catch (error) {
                        console.error(`[${connectionId}] Error recuperando mensaje ${message.key.id}:`, error.message)
                    }
                })
            )
        }

        console.log(`[${connectionId}] ✅ Recuperación completada (${unprocessed.length} mensajes)`)
    }

    // Limpieza inmediata de mensajes procesados
    for (const [msgId, msgData] of conn.messageQueue.entries()) {
        if (msgData.processed || (now - msgData.timestamp) > RECOVERY_WINDOW_MS) {
            conn.messageQueue.delete(msgId)
        }
    }

    return unprocessed.length
}

/**
 * Inicia heartbeat activo solo para PRIMARY
 * Sin standby para evitar cierre por conexión duplicada (440)
 */
function startHeartbeat(connectionId) {
    const conn = connections.get(connectionId)
    if (!conn) return

    // Detener heartbeats anteriores
    stopHeartbeat(connectionId)

    // Heartbeat para PRIMARY (cada 15 segundos) - ACTIVO
    if (conn.primary) {
        const primaryInterval = setInterval(async () => {
            const currentConn = connections.get(connectionId)
            if (!currentConn || !currentConn.primary?.sock) {
                clearInterval(primaryInterval)
                return
            }

            const slot = currentConn.primary
            const alive = isSocketAlive(slot.sock)
            const now = Date.now()
            const timeSinceLastActivity = now - (slot.lastHeartbeat || now)

            // Heartbeat ACTIVO: enviar ping real
            try {
                await Promise.race([
                    slot.sock.sendPresenceUpdate('available'),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 5000))
                ])
                slot.lastHeartbeat = now
                slot.pingFailures = 0
                console.log(`[${connectionId}] [PRIMARY] ♥ Ping OK (actividad: ${Math.floor(timeSinceLastActivity/1000)}s)`)
            } catch (error) {
                slot.pingFailures = (slot.pingFailures || 0) + 1
                console.warn(`[${connectionId}] [PRIMARY] ⚠️ Ping fallido (${slot.pingFailures}/3)`)

                // 3 fallos consecutivos = reconexión inmediata
                if (slot.pingFailures >= 3) {
                    console.error(`[${connectionId}] [PRIMARY] ❌ 3 fallos de ping, reconectando...`)
                    slot.pingFailures = 0
                    // Limpiar y reconectar
                    try {
                        cleanupSocketListeners(slot.sock, connectionId, 'PRIMARY')
                        slot.sock.end(undefined)
                    } catch (e) {}
                    createSocketInSlot(connectionId, 'primary', currentConn.agentId)
                }
            }

            // Verificación zombie (5 minutos sin actividad)
            if (!alive || timeSinceLastActivity > 5 * 60 * 1000) {
                console.error(`[${connectionId}] [PRIMARY] ⚠️ SOCKET ZOMBIE - alive=${alive}, inactivo ${Math.floor(timeSinceLastActivity/1000)}s`)
                try {
                    cleanupSocketListeners(slot.sock, connectionId, 'PRIMARY')
                    slot.sock.end(undefined)
                } catch (e) {}
                createSocketInSlot(connectionId, 'primary', currentConn.agentId)
            }
        }, 15000) // Cada 15 segundos

        conn.primary.healthCheckInterval = primaryInterval
    }

    console.log(`[${connectionId}] Heartbeat iniciado (primary: 15s activo)`)
}

/**
 * Reconexión rápida después de fallo
 * Reemplaza al failover ya que no tenemos standby
 */
async function executeFailover(connectionId) {
    const conn = connections.get(connectionId)
    if (!conn) return

    console.log(`[${connectionId}] 🔄 === RECONEXIÓN RÁPIDA ===`)

    // Registrar intento
    conn.failoverCount = (conn.failoverCount || 0) + 1
    conn.lastFailover = Date.now()

    // Cerrar socket actual
    if (conn.primary?.sock) {
        try {
            cleanupSocketListeners(conn.primary.sock, connectionId, 'PRIMARY')
            conn.primary.sock.end(undefined)
        } catch (e) {}
        conn.primary = null
    }

    // Reconectar inmediatamente
    console.log(`[${connectionId}] 🔄 Reconectando socket primary...`)
    await createSocketInSlot(connectionId, 'primary', conn.agentId)

    console.log(`[${connectionId}] ✅ Reconexión completada (intentos: ${conn.failoverCount})`)
}

/**
 * Obtiene historial de conversación para contexto
 */
async function getConversationContext(from, limit = 10) {
    try {
        const res = await axios.get(`${API_URL}/api/conversations`, apiHeaders)
        const conversations = res.data || []
        const conv = conversations.find(c => c.id === from || c.contact === from)

        if (!conv || !conv.messages) return ''

        const recentMessages = conv.messages.slice(-limit)
        const context = recentMessages.map(m => {
            const role = m.from === 'bot' ? 'Asistente' : 'Cliente'
            return `${role}: ${m.body}`
        }).join('\n')

        return context
    } catch (error) {
        console.error('Error getting conversation context:', error.message)
        return ''
    }
}

/**
 * Procesa imagen con OCR para detectar pagos
 */
async function procesarImagenConOCR(connectionId, from, message, sock) {
    try {
        const ocrService = require('./services/ocrService')
        const { downloadMediaMessage } = require('@whiskeysockets/baileys')
        const path = require('path')
        const fs = require('fs')

        // Descargar imagen
        const buffer = await downloadMediaMessage(message, 'buffer', {})
        console.log(`[${connectionId}] [OCR] Imagen descargada: ${buffer.length} bytes`)

        // Guardar en temporal
        const pagoId = `pago_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        const tempPath = path.join(__dirname, 'media/pagos/temp', `${pagoId}.jpg`)
        fs.writeFileSync(tempPath, buffer)
        console.log(`[${connectionId}] [OCR] Guardado en: ${tempPath}`)

        // Extraer caption si tiene
        const caption = message.message?.conversation ||
                       message.message?.extendedTextMessage?.text ||
                       message.message?.imageMessage?.caption ||
                       ''

        // Encolar para OCR (espera a que termine el procesamiento)
        // Pasar el socket para que el OCR pueda responder
        await ocrService.enqueue({
            id: pagoId,
            from,
            imagePath: tempPath,
            connectionId,
            caption,
            message,
            sock // ← Pasar socket
        })

        console.log(`[${connectionId}] [OCR] Imagen encolada: ${pagoId}`)
        // El OCR service responderá al cliente después de procesar

    } catch (error) {
        console.error(`[${connectionId}] [OCR] Error:`, error.message)
        console.error(`[${connectionId}] [OCR] Stack:`, error.stack)
    }
}

/**
 * Procesa mensajes entrantes
 */
async function processMessage(connectionId, message, sock) {
    try {
        const conn = connections.get(connectionId)
        if (!conn) {
            console.log(`[${connectionId}] Conexión no encontrada, omitiendo mensaje`)
            return
        }

        const { agentId } = conn

        // Extraer datos del mensaje
        const from = message.key.remoteJid
        const messageId = message.key.id // ID único del mensaje

        // Detectar si es imagen
        const esImagen = !!message.message?.imageMessage
        
        // Track de resultado OCR (para usar después al enviar respuesta)
        let ocrResultado = null

        // Extraer body (texto o caption de imagen)
        let body = message.message?.conversation ||
                   message.message?.extendedTextMessage?.text ||
                   message.message?.imageMessage?.caption ||
                   message.message?.videoMessage?.caption ||
                   ''

        // Si es imagen sin caption, el agente debe saberlo
        if (esImagen && !body) {
            body = '[Imagen adjunta]'
        } else if (esImagen && body) {
            body = `[Imagen con texto: "${body}"]`
        }

        // DEBUG: Log de TODOS los mensajes que llegan
        console.log(`[${connectionId}] [DEBUG] Mensaje entrante:`, Object.keys(message.message || {}))
        console.log(`[${connectionId}] [DEBUG] Mensaje completo:`, JSON.stringify(message.message, null, 2).substring(0, 500))

        if (from === 'status@broadcast') return

        // Permitir imágenes sin texto (para OCR)
        // esImagen ya está definido arriba
        if (!body && !esImagen) {
            console.log(`[${connectionId}] [DEBUG] Sin body y no es imagen, omitiendo`)
            return
        }

        const fromMe = message.key.fromMe
        if (fromMe) return // Ignorar mensajes enviados por el bot

        // =================================================================
        // DETECTOR DE ÓRDENES DE CATÁLOGO (WhatsApp Business)
        // =================================================================
        const order = message.message?.orderMessage
        
        if (order) {
            console.log(`[${connectionId}] 🛒 === ORDEN DE CATÁLOGO DETECTADA ===`)
            console.log(`[${connectionId}] 🛒 ID del pedido: ${order.orderId}`)
            console.log(`[${connectionId}] 🛒 Título: ${order.orderTitle}`)
            console.log(`[${connectionId}] 🛒 Cantidad de items: ${order.itemCount}`)
            console.log(`[${connectionId}] 🛒 Mensaje del cliente: ${order.message || '(sin mensaje)'}`)
            
            // El total viene expresado en milésimas (ej: 10000 = 10.00)
            const total = order.totalAmount1000 ? (order.totalAmount1000 / 1000) : 0
            console.log(`[${connectionId}] 🛒 Total: ${total.toFixed(2)} ${order.currency || 'PEN'}`)
            console.log(`[${connectionId}] 🛒 Estado: ${order.status || 'INQUIRY'}`)
            console.log(`[${connectionId}] 🛒 Thumbnail: ${order.thumbnail ? 'Disponible' : 'No disponible'}`)
            
            // Guardar orden en archivo JSON
            try {
                const ordersFile = path.join(DATA_DIR, 'orders.json')
                let orders = []
                
                if (fs.existsSync(ordersFile)) {
                    orders = JSON.parse(fs.readFileSync(ordersFile, 'utf8'))
                }
                
                const nuevaOrden = {
                    id: `order_${Date.now()}`,
                    orderId: order.orderId,
                    connectionId,
                    from,
                    fromMe: message.key.fromMe,
                    messageId: message.key.id,
                    orderTitle: order.orderTitle,
                    itemCount: order.itemCount,
                    totalAmount1000: order.totalAmount1000,
                    total: total,
                    currency: order.currency || 'PEN',
                    status: order.status || 'INQUIRY',
                    message: order.message || '',
                    thumbnail: order.thumbnail ? 'disponible' : 'no_disponible',
                    orderRequestMessageId: order.orderRequestMessageId || null,
                    receivedAt: Date.now(),
                    processed: false
                }
                
                orders.push(nuevaOrden)
                fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2))
                console.log(`[${connectionId}] 🛒 ✅ Orden guardada en orders.json`)
                
                // Notificar al agente para que responda
                body = `🛒 *¡Nuevo pedido recibido!*\n\n` +
                       `*Pedido:* ${order.orderTitle}\n` +
                       `*Items:* ${order.itemCount}\n` +
                       `*Total:* ${total.toFixed(2)} ${order.currency || 'PEN'}\n` +
                       `${order.message ? `*Mensaje:* ${order.message}\n\n` : ''}` +
                       `¿Cómo quieres proceder con este pedido?`
                
            } catch (error) {
                console.error(`[${connectionId}] 🛒 Error guardando orden:`, error.message)
            }
        }

        // =================================================================
        // DETECTOR DE COMPROBANTES DE PAGO (OCR) - PROCESAMIENTO BLOQUEANTE
        // =================================================================
        // Si es imagen, procesar con OCR ANTES de llamar al agente
        const settings = require('./server/data/settings.json')
        
        // Verificar si el agente tiene la capacidad de procesar pagos activada
        const agentCapabilities = connections.get(connectionId)?.agentCapabilities || {}
        const capacidadPagosActiva = agentCapabilities.procesarPagos !== false

        if (settings.features?.ocrPagos === true && capacidadPagosActiva && esImagen) {
            console.log(`[${connectionId}] 📸 [OCR] Imagen detectada, procesando...`)

            try {
                // Procesar imagen (bloquea hasta terminar)
                const { downloadMediaMessage } = require('@whiskeysockets/baileys')
                const path = require('path')
                const fs = require('fs')
                const ocrService = require('./services/ocrService')

                const buffer = await downloadMediaMessage(message, 'buffer', {})
                const pagoId = `pago_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
                const tempPath = path.join(__dirname, 'media/pagos/temp', `${pagoId}.jpg`)
                fs.writeFileSync(tempPath, buffer)

                const caption = message.message?.imageMessage?.caption || ''

                // Procesar OCR (espera a que termine)
                ocrResultado = await ocrService.procesarImagenDirecta({
                    id: pagoId,
                    from,
                    imagePath: tempPath,
                    connectionId,
                    caption,
                    sock
                })

                console.log(`[${connectionId}] [OCR] Resultado:`, ocrResultado)

                // Si OCR detectó pago válido, CAMBIAR el body para que el agente responda al OCR
                if (ocrResultado && ocrResultado.esPago && ocrResultado.mensaje) {
                    // Reemplazar el body con el mensaje del OCR (esto hace que el agente lo priorice)
                    body = ocrResultado.mensaje
                    console.log(`[${connectionId}] [OCR] Body reemplazado con mensaje OCR para que el agente responda`)
                }

            } catch (error) {
                console.error(`[${connectionId}] [OCR] Error:`, error.message)
            }
        } else if (esImagen && settings.features?.ocrPagos === true && !capacidadPagosActiva) {
            console.log(`[${connectionId}] ⚠️ [OCR] Imagen ignorada - capacidad procesarPagos desactivada para este agente`)
        }
        // =================================================================

        // === PREVENIR RE-PROCESAMIENTO DE MENSAJES ===
        // Verificar si este mensaje ya fue procesado (evita duplicados por recovery)
        if (processedMessages.has(messageId)) {
            console.log(`[${connectionId}] ⚠️ Mensaje ${messageId} ya procesado, omitiendo...`)
            return
        }
        processedMessages.set(messageId, Date.now())
        console.log(`[${connectionId}] ✅ Mensaje ${messageId} registrado como procesado`)

        // === COMANDO ESPECIAL PARA VERIFICAR MODELO ===
        if (body.toLowerCase() === '/modelo' || body.toLowerCase() === '/model') {
            const agentConfig = agents.find(a => a.id === agentId)
            const respuestaModelo = `🤖 *Información del Modelo*\n\n` +
                `• Motor: *${agentConfig?.motor || 'N/A'}*\n` +
                `• Modelo: *${agentConfig?.model || 'N/A'}*\n` +
                `• API Key: *${agentConfig?.apiKey ? 'Configurada' : 'No configurada'}*\n` +
                `\n_Este mensaje confirma qué modelo está respondiendo._`
            
            await sock.sendMessage(from, { 
                text: respuestaModelo 
            }, { quoted: message })
            console.log(`[${connectionId}] ✅ Información de modelo enviada`)
            return
        }

        // === VERIFICAR NÚMERO BLOQUEADO ===
        const senderNumber = normalizePhoneNumber(from)
        try {
            const blockedResponse = await axios.get(`${API_URL}/api/blocked-numbers`, apiHeaders)
            const blockedNumbers = blockedResponse.data || []
            const normalizedBlocked = blockedNumbers.map(n => normalizePhoneNumber(n))
            if (Array.isArray(normalizedBlocked) && normalizedBlocked.includes(senderNumber)) {
                console.log(`[${connectionId}] ❌ Mensaje de número BLOQUEADO (${senderNumber}), ignorando.`)
                return
            }
        } catch (blockError) {
            console.error(`[${connectionId}] Error verificando números bloqueados:`, blockError.message)
        }

        console.log(`\n[${connectionId}] === NUEVO MENSAJE ===`)
        console.log(`[${connectionId}] De: ${from}`)
        console.log(`[${connectionId}] Mensaje: ${body.substring(0, 100)}...`)

        // Obtener configuración del agente
        let agentConfig = null
        if (agentId) {
            try {
                const agentsPath = path.join(DATA_DIR, 'agents.json')
                if (fs.existsSync(agentsPath)) {
                    const agentsData = JSON.parse(fs.readFileSync(agentsPath, 'utf8'))
                    agentConfig = agentsData.find(a => a.id === agentId)
                }

                if (!agentConfig) {
                    agentConfig = {
                        id: agentId,
                        motor: 'deepseek',
                        model: 'deepseek-chat',
                        apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
                        systemPrompt: 'Eres un asistente útil.',
                        knowledgeBase: '',
                        temperature: 0.3
                    }
                }
                
                console.log(`[${connectionId}] Agente configurado: ${agentConfig.id} (${agentConfig.name || 'Sin nombre'})`)
            } catch (err) {
                console.error(`[${connectionId}] Error obteniendo agente:`, err.message)
            }
        }

        // Guardar mensaje en API
        await axios.post(`${API_URL}/api/conversations/push`,
            { from, body, fromBot: false },
            apiHeaders
        ).catch(err => console.error(`[${connectionId}] Error pushing message:`, err.message))

        // === VERIFICACIÓN AUTOMÁTICA DE CITAS EN BACKEND ===
        // Esto se ejecuta ANTES de llamar a la IA para tener datos reales
        let citaActiva = null
        let citaInfoTexto = ''
        
        // Verificar si el agente tiene la capacidad de agendar citas activada
        const agentCaps = connections.get(connectionId)?.agentCapabilities || {}
        const capacidadCitasActiva = agentCaps.agendarCitas !== false

        // Solo verificar citas si la capacidad está activada
        if (capacidadCitasActiva) {
            // Obtener fecha y hora REAL de Perú
            const fechaPeru = getPeruNow()
            const fechaPeruTexto = fechaPeru.toLocaleDateString('es-PE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            const horaPeruTexto = fechaPeru.toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            })

            // Información de fecha para inyectar en el contexto
            const fechaInfoTexto = `
[FECHA Y HORA ACTUAL EN PERÚ - ESTO ES VERDAD ABSOLUTA]
Hoy es ${fechaPeruTexto}
Hora actual: ${horaPeruTexto}
NUNCA inventes otra fecha. Usa ESTA información.
`

            // Buscar cita por conversationId
            citaActiva = citasService.getActivaByConversation(from)

            // Si no encuentra, buscar por teléfono
            if (!citaActiva) {
                const todasCitas = citasService.getAll()
                const numeroTelefono = normalizePhoneNumber(from)
                citaActiva = todasCitas.find(c =>
                    c.estado === 'activa' && c.telefono === numeroTelefono
                )
            }

            // Preparar información de citas para inyectar en el contexto
            // NOTA: Siempre inyectamos, pero el system prompt le dice a la IA cuándo mencionar
            if (citaActiva) {
                citaInfoTexto = `
[CONTEXTO: CITA ACTIVA DEL CLIENTE - USAR SOLO SI ES RELEVANTE]
El cliente TIENE una cita activa verificada en el sistema:
- ID: ${citaActiva.id}
- Nombre: ${citaActiva.nombre}
- Teléfono: ${citaActiva.telefono}
- Fecha: ${citaActiva.fecha}
- Hora: ${citaActiva.hora}
- Tipo: ${citaActiva.tipo}
- Descripción: ${citaActiva.descripcion || 'Sin descripción'}
- Estado: ${citaActiva.estado}

INSTRUCCIONES:
- Si el cliente pregunta por su cita (ej: "tengo cita?", "cuándo es?", "mi cita"): USA estos datos
- Si el cliente quiere cancelar (ej: "cancelar", "ya no puedo"): USA estos datos y genera JSON
- Si el cliente saluda o habla de otros temas: NO menciones esta información
[FIN CONTEXTO]
`
            } else {
                citaInfoTexto = `
[CONTEXTO: SIN CITAS - USAR SOLO SI ES RELEVANTE]
El cliente NO tiene citas activas en el sistema.

INSTRUCCIONES:
- Si el cliente pregunta por citas: Informa que no hay nada agendado
- Si el cliente quiere agendar: Pide los datos y genera JSON de creación
- Si el cliente saluda o habla de otros temas: NO menciones este contexto
[FIN CONTEXTO]
`
            }
        } else {
            // Capacidad de citas desactivada - no inyectar contexto de citas
            console.log(`[${connectionId}] ⚠️ Citas desactivadas - capacidad agendarCitas=false`)
        }

        // Obtener contexto
        const context = await getConversationContext(from, 10)
        console.log(`[${connectionId}] Contexto: ${context ? 'Sí' : 'No'}`)
        console.log(`[${connectionId}] Cita activa en backend: ${citaActiva ? 'Sí (' + citaActiva.fecha + ' ' + citaActiva.hora + ')' : 'No'}`)

        // === LLAMAR A IA CON CONTEXTO ENRIQUECIDO ===
        // Inyectar información real del backend + fecha de Perú en el contexto
        const contextoEnriquecido = context + (citaInfoTexto || '')

        // Llamar a IA
        let respuestaIA = 'Lo siento, no hay un agente configurado para esta conexión.'
        if (agentConfig) {
            try {
                console.log(`[${connectionId}] Llamando a IA...`)

                // Agregar número de teléfono al contexto para que el OCR lo encuentre
                const numeroTelefono = normalizePhoneNumber(from)
                const contextoConTelefono = contextoEnriquecido + `\n\n[CLIENTE TELÉFONO: ${numeroTelefono}]`

                respuestaIA = await responderConIA(body, contextoConTelefono, agentConfig)
                console.log(`[${connectionId}] IA respondió: ${respuestaIA.substring(0, 100)}...`)
            } catch (error) {
                console.error(`[${connectionId}] Error en IA:`, error.message)
                respuestaIA = 'Lo siento, hubo un error procesando tu mensaje.'
            }
        }

        // === VERIFICAR SI LA RESPUESTA CONTIENE UNA CITA CONFIRMADA ===
        const citaPattern = /__CITA_CONFIRMADA__([\s\S]*?)__FIN_CITA__/
        const citaMatch = respuestaIA.match(citaPattern)

        if (citaMatch && capacidadCitasActiva) {
            try {
                const citaData = JSON.parse(citaMatch[1])

                // Validar datos requeridos
                if (!citaData.nombre || !citaData.telefono || !citaData.fecha || !citaData.hora || !citaData.tipo) {
                    console.error(`[${connectionId}] Datos de cita incompletos:`, citaData)
                } else {
                    // Crear cita en el sistema
                    const nuevaCita = await axios.post(`${API_URL}/api/citas`, {
                        conversationId: from,
                        connectionId,
                        ...citaData
                    }, apiHeaders)

                    console.log(`[${connectionId}] ✅ Cita creada: ${nuevaCita.data.id}`)

                    // Enviar confirmación al cliente
                    const confirmacion = `✅ *CITA AGENDADA EXITOSAMENTE*

📅 *Fecha:* ${formatPeruDate(citaData.fecha)}
🕐 *Hora:* ${formatPeruTime(citaData.hora)} (hora Perú)
📋 *Tipo:* ${citaData.tipo}

Te enviaré un recordatorio 1 hora antes.

*Para cancelar:* Responde "cancelar cita"
*Para reprogramar:* Cancela y agenda una nueva`

                    await sock.sendMessage(from, { text: confirmacion }, { quoted: message })

                    // NO guardar respuestaIA null en conversaciones ni enviar nada más
                    console.log(`[${connectionId}] Cita procesada, saliendo...`)
                    return // Salir inmediatamente para evitar procesamiento adicional
                }
            } catch (error) {
                console.error(`[${connectionId}] ❌ Error creando cita:`, error.response?.data || error.message)

                // Error de cita duplicada
                if (error.response?.status === 409) {
                    await sock.sendMessage(from, {
                        text: `⚠️ Ya tienes una cita agendada. Si deseas cambiarla, primero cancela la actual respondiendo "cancelar cita".`
                    }, { quoted: message })
                    return // Salir inmediatamente
                }
            }
        } else if (citaMatch && !capacidadCitasActiva) {
            console.log(`[${connectionId}] ⚠️ Cita ignorada - capacidad agendarCitas desactivada`)
        }

        // === VERIFICAR SI LA RESPUESTA CONTIENE UNA CANCELACIÓN DE CITA ===
        const cancelacionPattern = /__CITA_CANCELADA__([\s\S]*?)__FIN_CANCELACION__/
        const cancelacionMatch = respuestaIA.match(cancelacionPattern)

        if (cancelacionMatch && capacidadCitasActiva) {
            try {
                const cancelacionData = JSON.parse(cancelacionMatch[1])
                const citaId = cancelacionData.citaId

                if (citaId) {
                    // Ejecutar cancelación real en el backend
                    await axios.post(`${API_URL}/api/citas/${citaId}/cancelar`, {
                        canceladoPor: 'cliente'
                    }, apiHeaders)

                    console.log(`[${connectionId}] ✅ Cita cancelada: ${citaId}`)

                    // Enviar confirmación al cliente
                    const confirmacion = `❌ *CITA CANCELADA EXITOSAMENTE*

Tu cita ha sido cancelada. Si deseas reprogramar, avísame y con gusto te ayudo.`

                    await sock.sendMessage(from, { text: confirmacion }, { quoted: message })

                    // NO continuar con procesamiento adicional
                    console.log(`[${connectionId}] Cancelación procesada, saliendo...`)
                    return
                }
            } catch (error) {
                console.error(`[${connectionId}] ❌ Error cancelando cita:`, error.response?.data || error.message)
                // Continuar con el flujo normal
            }
        } else if (cancelacionMatch && !capacidadCitasActiva) {
            console.log(`[${connectionId}] ⚠️ Cancelación ignorada - capacidad agendarCitas desactivada`)
        }

        // Guardar respuesta en conversaciones
        await axios.post(`${API_URL}/api/conversations/push`,
            { from, body: typeof respuestaIA === 'object' ? JSON.stringify(respuestaIA) : respuestaIA, fromBot: true },
            apiHeaders
        ).catch(err => console.error(`[${connectionId}] Error pushing response:`, err.message))

        // === ENVIAR RESPUESTA ===
        // Si respuestaIA es null, ya fue procesada (cita/cancelación), no enviar nada
        if (!respuestaIA) {
            console.log(`[${connectionId}] Respuesta ya procesada, no enviar nada`)
            return
        }

        console.log(`[${connectionId}] Enviando respuesta...`)

        // Verificar si la IA devolvió un comando para enviar archivo
        let esComandoArchivo = false
        try {
            // Intentar parsear como JSON (la IA pudo haber devuelto un comando)
            if (typeof respuestaIA === 'string') {
                console.log(`[${connectionId}] Respuesta completa:`, respuestaIA)

                // Buscar patrón JSON en la respuesta (más flexible)
                const jsonMatch = respuestaIA.match(/\{[^{}]*"tipo"[^{}]*"enviar_archivo"[^{}]*\}/s)
                if (jsonMatch) {
                    console.log(`[${connectionId}] JSON detectado:`, jsonMatch[0])
                    const comando = JSON.parse(jsonMatch[0])
                    if (comando.tipo === 'enviar_archivo' && comando.archivoId) {
                        esComandoArchivo = true
                        console.log(`[${connectionId}] Enviando archivo:`, comando.archivoId)
                        await enviarArchivoWhatsApp(connectionId, from, comando.archivoId, comando.caption, message, sock)
                    }
                } else {
                    console.log(`[${connectionId}] No se detectó JSON de envío de archivo`)
                }
            } else if (typeof respuestaIA === 'object' && respuestaIA.tipo === 'enviar_archivo') {
                esComandoArchivo = true
                await enviarArchivoWhatsApp(connectionId, from, respuestaIA.archivoId, respuestaIA.caption, message, sock)
            }
        } catch (error) {
            console.error(`[${connectionId}] Error procesando comando de archivo:`, error.message)
            // Si falla el envío de archivo, enviar texto normal
            esComandoArchivo = false
        }

        // Si no es comando de archivo, enviar como texto normal
        if (!esComandoArchivo) {
            // Si OCR detectó pago, NO citar la imagen (responder como mensaje normal)
            if (ocrResultado && ocrResultado.esPago) {
                await sock.sendMessage(from, { text: typeof respuestaIA === 'object' ? JSON.stringify(respuestaIA) : respuestaIA })
                console.log(`[${connectionId}] Respuesta enviada (sin citar, OCR detectó pago)`)
            } else {
                await sock.sendMessage(from, { text: typeof respuestaIA === 'object' ? JSON.stringify(respuestaIA) : respuestaIA }, { quoted: message })
                console.log(`[${connectionId}] Respuesta enviada (citando mensaje)`)
            }
        }

        console.log(`[${connectionId}] Respuesta enviada`)

        // Actualizar actividad
        const activeSlot = conn[conn.activeSlot]
        if (activeSlot) {
            activeSlot.lastActivity = Date.now()
            activeSlot.lastHeartbeat = Date.now()
        }
    } catch (error) {
        console.error(`[${connectionId}] Error procesando mensaje:`, error.message)
    }
}

/**
 * Envía un archivo multimedia por WhatsApp
 * @param {string} connectionId - ID de la conexión
 * @param {string} from - Número de destino
 * @param {string} archivoId - ID del archivo en mediaCatalog
 * @param {string} caption - Texto descriptivo
 * @param {object} message - Mensaje original (para quote)
 * @param {object} sock - Socket de Baileys
 */
async function enviarArchivoWhatsApp(connectionId, from, archivoId, caption, message, sock) {
    let archivoEnviado = false
    
    try {
        // Obtener agente asignado a esta conexión
        const conn = connections.get(connectionId)
        if (!conn || !conn.agentId) {
            console.error(`[${connectionId}] No hay agente asignado para enviar archivo`)
            return
        }

        // Buscar el archivo en mediaCatalog
        const agents = require('./server/store').agents
        const agent = agents.list().find(a => a.id === conn.agentId)

        if (!agent || !agent.mediaCatalog) {
            console.error(`[${connectionId}] Agente no tiene catálogo multimedia`)
            return
        }

        const archivo = agent.mediaCatalog.find(item => item.id === archivoId)

        if (!archivo) {
            console.error(`[${connectionId}] Archivo ${archivoId} no encontrado en catálogo`)
            await sock.sendMessage(from, {
                text: '⚠️ El archivo solicitado no está disponible.'
            }, { quoted: message })
            return
        }

        // Verificar que el archivo existe en filesystem
        if (!fs.existsSync(archivo.filePath)) {
            console.error(`[${connectionId}] Archivo físico no encontrado: ${archivo.filePath}`)
            await sock.sendMessage(from, {
                text: '⚠️ El archivo no está disponible en el servidor.'
            }, { quoted: message })
            return
        }

        // Leer archivo
        const fileBuffer = fs.readFileSync(archivo.filePath)

        console.log(`[${connectionId}] Enviando archivo: ${archivo.fileName} (${archivo.type})`)

        // Enviar según tipo de archivo
        if (archivo.type === 'image') {
            await sock.sendMessage(from, {
                image: fileBuffer,
                caption: caption || archivo.description || ''
            }, { quoted: message })
            archivoEnviado = true
        } else if (archivo.type === 'video') {
            await sock.sendMessage(from, {
                video: fileBuffer,
                caption: caption || archivo.description || '',
                mimetype: archivo.mimeType
            }, { quoted: message })
            archivoEnviado = true
        } else if (archivo.type === 'document') {
            await sock.sendMessage(from, {
                document: fileBuffer,
                fileName: archivo.fileName,
                caption: caption || archivo.description || '',
                mimetype: archivo.mimeType
            }, { quoted: message })
            archivoEnviado = true
        } else {
            // Tipo no soportado, enviar como texto
            await sock.sendMessage(from, {
                text: `📎 ${archivo.title}\n${archivo.description || ''}\n\n${caption || ''}`
            }, { quoted: message })
            archivoEnviado = true
        }

        console.log(`[${connectionId}] ✅ Archivo enviado: ${archivo.fileName}`)

        // Registrar en logs
        connections.appendLog(connectionId, `📎 Archivo enviado: ${archivo.title} (${archivo.type})`)

    } catch (error) {
        console.error(`[${connectionId}] Error enviando archivo:`, error.message)
        
        // Solo enviar mensaje de error si NO se envió el archivo exitosamente
        if (!archivoEnviado) {
            await sock.sendMessage(from, {
                text: '⚠️ Hubo un error al enviar el archivo. Inténtalo de nuevo.'
            }, { quoted: message })
        }
    }
}

/**
 * Crea un socket en un slot específico (primary o standby)
 */
async function createSocketInSlot(connectionId, slot, agentConfig) {
    const conn = connections.get(connectionId)
    if (!conn) {
        console.error(`[${connectionId}] ❌ No existe la conexión, no se puede crear socket en ${slot}`)
        return null
    }

    // Verificar si ya hay reconexión en progreso para este slot
    if (!reconnectingSlots.has(connectionId)) {
        reconnectingSlots.set(connectionId, new Set())
    }
    const slotsReconectando = reconnectingSlots.get(connectionId)
    
    if (slotsReconectando.has(slot)) {
        console.log(`[${connectionId}] [${slot.toUpperCase()}] ⚠️ Reconexión ya en progreso, omitiendo...`)
        return null
    }

    // Limpiar slot existente si hay uno
    if (conn[slot]?.sock) {
        console.log(`[${connectionId}] [${slot.toUpperCase()}] Cerrando socket existente...`)
        cleanupSocketListeners(conn[slot].sock, connectionId, slot.toUpperCase())
        try {
            conn[slot].sock.end(undefined)
        } catch (e) {}
    }

    const sessionPath = path.join(SESSIONS_DIR, connectionId)

    // Crear directorio de sesión si no existe
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true })
    }

    console.log(`[${connectionId}] [${slot.toUpperCase()}] === INICIANDO BAILEYS 7.x ===`)
    console.log(`[${connectionId}] [${slot.toUpperCase()}] Agente: ${agentConfig?.name || 'Ninguno'}`)

    // Estado de autenticación
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

    // Crear socket
    const sock = makeWASocket({
        version: (await fetchLatestBaileysVersion()).version,
        logger: pino({ level: 'fatal' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
        },
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        msgRetryCounterCache,
        userDevicesCache,
        browser: ['Ubuntu', 'Chrome', '22.0.1204.1'],
        defaultQueryTimeoutMs: undefined,
        syncFullHistory: false,
        patchCaches: true,
    })

    // Guardar credenciales
    sock.ev.on('creds.update', async (creds) => {
        await saveCreds(creds)
        const currentConn = connections.get(connectionId)
        if (currentConn && currentConn[slot]) {
            currentConn[slot].lastHeartbeat = Date.now()
        }
    })

    // Marcar slot como reconectando
    slotsReconectando.add(slot)

    // QR
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log(`[${connectionId}] [${slot.toUpperCase()}] === QR GENERADO === (${qr.length} caracteres)`)

            try {
                const qrPath = path.join(DATA_DIR, `qr_${connectionId}.png`)
                const qrImage = require('qr-image')
                const qrPng = qrImage.imageSync(qr, { type: 'png' })
                fs.writeFileSync(qrPath, qrPng)
                console.log(`[${connectionId}] [${slot.toUpperCase()}] ✅ QR guardado`)
            } catch (error) {
                console.error(`[${connectionId}] [${slot.toUpperCase()}] ❌ Error guardando QR:`, error.message)
            }

            // Solo actualizar API si este slot es el activo
            if (slot === 'primary' && conn.activeSlot === 'primary') {
                axios.post(`${API_URL}/api/connections/${connectionId}/status`,
                    { status: 'connecting' },
                    apiHeaders
                ).catch(() => {})
            }
        }

        if (connection === 'updating') {
            console.log(`[${connectionId}] [${slot.toUpperCase()}] ⚠️ Conexión actualizándose`)
            const currentConn = connections.get(connectionId)
            if (currentConn && currentConn[slot]) {
                currentConn[slot].lastHeartbeat = Date.now()
            }
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
            const shouldReconnect = reason !== DisconnectReason.loggedOut

            console.log(`[${connectionId}] [${slot.toUpperCase()}] Conexión cerrada. Reconectar: ${shouldReconnect}, Razón: ${reason}`)

            if (shouldReconnect) {
                // Reconectar con delay
                const delay = slot === 'primary' ? 2000 : 5000
                console.log(`[${connectionId}] [${slot.toUpperCase()}] Reconnect en ${delay}ms...`)
                
                setTimeout(() => {
                    slotsReconectando.delete(slot)
                    createSocketInSlot(connectionId, slot, agentConfig)
                }, delay)
            } else {
                // Logout detectado (WhatsApp cerró sesión)
                console.log(`[${connectionId}] [${slot.toUpperCase()}] Logout detectado`)
                console.error(`[${connectionId}] === DEBUG LOGOUT === slot=${slot}, activeSlot=${conn?.activeSlot || 'N/A'}, standby.connected=${conn?.standby?.connected || 'N/A'}`)
                slotsReconectando.delete(slot)

                // Eliminar sesión corrupta para forzar generación de QR nuevo
                const sessionPath = path.join(SESSIONS_DIR, connectionId)
                if (fs.existsSync(sessionPath)) {
                    console.log(`[${connectionId}] 🗑️ Eliminando sesión corrupta: ${sessionPath}`)
                    try {
                        fs.rmSync(sessionPath, { recursive: true, force: true })
                        console.log(`[${connectionId}] ✅ Sesión eliminada`)
                    } catch (error) {
                        console.error(`[${connectionId}] ❌ Error eliminando sesión:`, error.message)
                    }
                }

                // Eliminar QR anterior si existe
                const qrPath = path.join(DATA_DIR, `qr_${connectionId}.png`)
                if (fs.existsSync(qrPath)) {
                    try {
                        fs.unlinkSync(qrPath)
                        console.log(`[${connectionId}] QR anterior eliminado`)
                    } catch (e) {}
                }

                if (slot === conn.activeSlot) {
                    console.log(`[${connectionId}] Slot activo, verificando failover...`)
                    // El slot activo hizo logout, intentar failover
                    if (slot === 'primary' && conn.standby?.connected) {
                        console.log(`[${connectionId}] Ejecutando failover...`)
                        await executeFailover(connectionId)
                    } else {
                        console.log(`[${connectionId}] No hay failover, generando QR nuevo...`)
                        // No hay backup: marcar como desconectado y generar QR nuevo
                        axios.post(`${API_URL}/api/connections/${connectionId}/status`,
                            { status: 'disconnected' },
                            apiHeaders
                        ).catch(() => {})

                        // Reiniciar socket después de 3 segundos para generar QR nuevo
                        console.log(`[${connectionId}] 🔄 Reiniciando socket para generar QR nuevo en 3s...`)
                        setTimeout(async () => {
                            try {
                                // Crear directorio de sesión vacío
                                if (!fs.existsSync(sessionPath)) {
                                    fs.mkdirSync(sessionPath, { recursive: true })
                                }
                                // Reiniciar socket - esto generará QR automáticamente
                                console.log(`[${connectionId}] [${slot.toUpperCase()}] Reiniciando socket...`)
                                await createSocketInSlot(connectionId, slot, agentConfig)
                            } catch (error) {
                                console.error(`[${connectionId}] Error reiniciando socket:`, error.message)
                            }
                        }, 3000)
                    }
                } else {
                    console.log(`[${connectionId}] Slot NO activo (${slot} != ${conn.activeSlot}), omitiendo...`)
                }
            }
        }

        if (connection === 'open') {
            console.log(`[${connectionId}] [${slot.toUpperCase()}] === CONECTADO ===`)

            slotsReconectando.delete(slot)

            const rawId = sock.user?.id || ''
            const phoneNumber = normalizePhoneNumber(rawId.split(':')[0])

            // Actualizar slot
            const currentConn = connections.get(connectionId)
            if (currentConn && currentConn[slot]) {
                currentConn[slot].connected = true
                currentConn[slot].phoneNumber = phoneNumber
                currentConn[slot].lastActivity = Date.now()
                currentConn[slot].lastHeartbeat = Date.now()
            }

            // Si este slot es el activo, actualizar estado global
            if (slot === conn.activeSlot) {
                conn.connected = true
                conn.phoneNumber = phoneNumber

                axios.post(`${API_URL}/api/connections/${connectionId}/status`,
                    { status: 'connected', phoneNumber },
                    apiHeaders
                ).catch(() => {})

                axios.post(`${API_URL}/api/connections/${connectionId}/log`,
                    { text: `[${new Date().toLocaleTimeString()}] ${slot.toUpperCase()} Conectado ✅` },
                    apiHeaders
                ).catch(() => {})

                // Verificar mensajes pendientes después de reconexión
                setTimeout(() => {
                    checkAndProcessPendingMessages(connectionId, sock)
                }, 1000)
            } else {
                console.log(`[${connectionId}] [${slot.toUpperCase()}] 🛡️ Standby listo para failover`)
            }
        }
    })

    // MENSAJES - Manejo inteligente con cola para failover
    // IMPORTANTE: Solo el slot activo procesa mensajes para evitar duplicados
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        const currentConn = connections.get(connectionId)
        if (!currentConn) return

        // Solo el slot activo procesa mensajes
        if (currentConn.activeSlot !== slot) {
            // Slot standby: NO hacer nada, los mensajes llegarán cuando sea activo
            return
        }

        if (type !== 'notify' && type !== 'append') {
            return
        }

        // Para tipo 'append', esperar a que la conexión esté estable
        if (type === 'append') {
            const slotData = currentConn[slot]
            const timeSinceStart = Date.now() - (slotData?.createdAt || Date.now())
            if (timeSinceStart < 5000) { // Reducido a 5s
                console.log(`[${connectionId}] Esperando conexión estable para procesar mensajes append...`)
                return
            }
        }

        // Encolar y procesar mensajes
        for (const message of messages) {
            enqueueMessage(connectionId, message)
            await processMessage(connectionId, message, sock)
        }
    })

    // Guardar/actualizar slot
    const slotData = {
        sock,
        connected: false,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        lastHeartbeat: Date.now(),
        phoneNumber: null,
        pingFailures: 0
    }

    conn[slot] = slotData

    console.log(`[${connectionId}] [${slot.toUpperCase()}] Socket Baileys iniciado`)
    return slotData
}

/**
 * Inicia conexión con reconexión rápida y message queue
 * NOTA: Removemos Hot Standby porque WhatsApp cierra conexiones duplicadas (440)
 * En su lugar usamos reconexión rápida (< 3s) + message queue persistente
 */
async function startBaileysConnection(connectionId, connectionConfig, agentConfig) {
    const conn = connections.get(connectionId)

    // Si ya existe, verificar estado
    if (conn) {
        if (conn.connected && conn.primary?.connected) {
            console.log(`[${connectionId}] Ya está conectado, omitiendo...`)
            return { success: false, reason: 'already_connected' }
        }

        // Limpiar conexión existente
        console.log(`[${connectionId}] Limpiando conexión existente...`)
        stopHeartbeat(connectionId)

        if (conn.primary?.sock) {
            cleanupSocketListeners(conn.primary.sock, connectionId, 'PRIMARY')
            conn.primary.sock.end(undefined)
        }
        if (conn.standby?.sock) {
            cleanupSocketListeners(conn.standby.sock, connectionId, 'STANDBY')
            conn.standby.sock.end(undefined)
        }

        connections.delete(connectionId)
    }

    // Crear estructura de conexión simplificada (sin standby)
    const newConn = {
        primary: null,
        standby: null, // Mantenido por compatibilidad pero no usado
        activeSlot: 'primary',
        agentId: agentConfig?.id || null,
        agentCapabilities: agentConfig?.capabilities || {  // Capacidades del agente
            procesarPagos: true,
            agendarCitas: true
        },
        connected: false,
        phoneNumber: null,
        messageQueue: new Map(),
        failoverCount: 0,
        lastFailover: null,
        reconnectAttempts: 0,
        lastReconnect: null
    }

    connections.set(connectionId, newConn)

    console.log(`[${connectionId}] === INICIANDO CONEXIÓN RÁPIDA ===`)
    console.log(`[${connectionId}] Agente: ${agentConfig?.name || 'Ninguno'}`)
    console.log(`[${connectionId}] Capacidades: procesarPagos=${newConn.agentCapabilities.procesarPagos}, agendarCitas=${newConn.agentCapabilities.agendarCitas}`)

    // Crear socket PRIMARY único
    await createSocketInSlot(connectionId, 'primary', agentConfig)

    // Iniciar heartbeats cuando primary esté listo
    const checkAndStartHeartbeat = setInterval(() => {
        const currentConn = connections.get(connectionId)
        if (currentConn?.primary?.connected) {
            startHeartbeat(connectionId)
            clearInterval(checkAndStartHeartbeat)
        }
    }, 1000)

    return { success: true }
}

/**
 * Detiene conexión completa (primary + standby)
 */
async function stopConnection(connectionId) {
    const conn = connections.get(connectionId)
    if (!conn) return

    console.log(`[${connectionId}] Deteniendo conexión completa...`)
    
    stopHeartbeat(connectionId)

    if (conn.primary?.sock) {
        cleanupSocketListeners(conn.primary.sock, connectionId, 'PRIMARY')
        conn.primary.sock.end(undefined)
    }
    if (conn.standby?.sock) {
        cleanupSocketListeners(conn.standby.sock, connectionId, 'STANDBY')
        conn.standby.sock.end(undefined)
    }

    connections.delete(connectionId)
    console.log(`[${connectionId}] Conexión detenida`)
}

/**
 * Logout completo con cleanup total
 */
async function logoutConnection(connectionId, keepSession = false) {
    const conn = connections.get(connectionId)
    if (conn) {
        stopHeartbeat(connectionId)

        if (conn.primary?.sock) {
            cleanupSocketListeners(conn.primary.sock, connectionId, 'PRIMARY')
            conn.primary.sock.logout()
        }
        if (conn.standby?.sock) {
            cleanupSocketListeners(conn.standby.sock, connectionId, 'STANDBY')
            conn.standby.sock.logout()
        }
        
        connections.delete(connectionId)
    }

    const sessionPath = path.join(SESSIONS_DIR, connectionId)
    if (!keepSession && fs.existsSync(sessionPath)) {
        console.log(`[${connectionId}] 🗑️ Eliminando sesión: ${sessionPath}`)
        fs.rmSync(sessionPath, { recursive: true, force: true })
    } else if (keepSession) {
        console.log(`[${connectionId}] 📁 Manteniendo sesión en: ${sessionPath}`)
    }

    try {
        const qrPath = path.join(DATA_DIR, `qr_${connectionId}.png`)
        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath)
            console.log(`[${connectionId}] QR eliminado: ${qrPath}`)
        }
    } catch (e) {}

    axios.post(`${API_URL}/api/connections/${connectionId}/status`,
        { status: 'disconnected' },
        apiHeaders
    ).catch(() => {})
}

/**
 * Limpia sesiones huérfanas
 */
function cleanupOrphanSessions() {
    console.log('\n🧹 === LIMPIEZA DE SESIONES HUÉRFANAS ===')
    
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true })
        console.log('Directorio de sesiones creado')
        return
    }

    const dirs = fs.readdirSync(SESSIONS_DIR)
    let cleaned = 0

    for (const dir of dirs) {
        const dirPath = path.join(SESSIONS_DIR, dir)
        const stats = fs.statSync(dirPath)
        
        if (!stats.isDirectory()) continue

        const credsPath = path.join(dirPath, 'creds.json')
        if (fs.existsSync(credsPath)) {
            try {
                const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'))
                if (!creds.me?.id) {
                    console.log(`   🗑️  Sesión corrupta: ${dir}`)
                    fs.rmSync(dirPath, { recursive: true, force: true })
                    cleaned++
                }
            } catch (error) {
                console.log(`   🗑️  Sesión inválida: ${dir}`)
                fs.rmSync(dirPath, { recursive: true, force: true })
                cleaned++
            }
        }
    }

    console.log(`🧹 Limpieza completada: ${cleaned} sesiones eliminadas\n`)
}

/**
 * Polling para detectar cambios
 */
async function startPolling() {
    let lastState = {}

    setInterval(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/connections`, apiHeaders)
            const connectionsData = res.data

            const agentsRes = await axios.get(`${API_URL}/api/agents`, apiHeaders)
            const agents = agentsRes.data

            for (const connectionId in connectionsData) {
                const conn = connectionsData[connectionId]
                const agent = conn.agentId ? agents.find(a => a.id === conn.agentId) : null
                const instance = connections.get(connectionId)

                // Detectar cambio de estado
                if (lastState[connectionId] !== conn.status) {
                    console.log(`[${connectionId}] Cambio: ${lastState[connectionId] || 'n/a'} → ${conn.status}`)
                    lastState[connectionId] = conn.status
                }

                // DETECTAR CAMBIO DE AGENTE: Si el agentId cambió, recargar configuración
                if (instance && conn.agentId && conn.agentId !== instance.agentId) {
                    console.log(`[${connectionId}] 🔄 Agente cambió: ${instance.agentId} → ${conn.agentId}`)
                    console.log(`[${connectionId}] Recargando configuración del agente...`)

                    // Actualizar agentId en la instancia
                    instance.agentId = conn.agentId
                    instance.agent = agent
                    // Guardar capacidades del agente
                    instance.agentCapabilities = agent?.capabilities || {
                        procesarPagos: true,
                        agendarCitas: true
                    }

                    console.log(`[${connectionId}] ✅ Nueva configuración cargada: ${agent?.name || 'Sin nombre'}`)
                    console.log(`[${connectionId}] Capacidades: procesarPagos=${instance.agentCapabilities.procesarPagos}, agendarCitas=${instance.agentCapabilities.agendarCitas}`)

                    // Registrar en logs de conexión
                    connections.appendLog(connectionId, `🔄 Agente cambiado a: ${agent?.name || 'Sin nombre'}`)
                }

                // Verificar si los sockets están vivos
                if (instance) {
                    const primaryAlive = instance.primary?.sock && isSocketAlive(instance.primary.sock)
                    const activeAlive = instance[instance.activeSlot]?.sock && isSocketAlive(instance[instance.activeSlot].sock)

                    if (!activeAlive && instance[instance.activeSlot]) {
                        console.error(`[${connectionId}] ⚠️ Slot activo muerto, ejecutando failover...`)
                        await executeFailover(connectionId)
                    }
                }

                // INCONSISTENCIA: API dice "connected" pero no hay instancia
                if (conn.status === 'connected' && !instance) {
                    console.warn(`[${connectionId}] ⚠️ INCONSISTENCIA: API dice "connected" pero no hay instancia`)
                    axios.put(`${API_URL}/api/connections/${connectionId}`,
                        { status: 'connecting' },
                        apiHeaders
                    ).catch(() => {})
                    continue
                }

                // Conectar
                if (conn.status === 'connecting' && !instance) {
                    console.log(`[${connectionId}] Iniciando conexión con Hot Standby...`)
                    await startBaileysConnection(connectionId, conn, agent)
                }

                // Desconectar
                if (conn.status === 'disconnected' && instance) {
                    console.log(`[${connectionId}] Deteniendo...`)
                    await stopConnection(connectionId)
                }
            }
        } catch (e) {
            console.error('Polling error:', e.message)
        }
    }, 3000)
}

/**
 * Server HTTP para comandos
 */
async function startCommandServer() {
    const http = require('http')
    const PORT = process.env.BOT_PORT || 3848

    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-bot-token')

        if (req.method === 'OPTIONS') {
            res.writeHead(200)
            res.end()
            return
        }

        if (req.method === 'POST' && req.url === '/api/command') {
            let body = ''
            req.on('data', chunk => body += chunk)
            req.on('end', async () => {
                try {
                    const { command, connectionId } = JSON.parse(body)
                    const token = req.headers['x-bot-token']

                    if (token !== BOT_TOKEN) {
                        res.writeHead(401)
                        res.end(JSON.stringify({ error: 'No autorizado' }))
                        return
                    }

                    if (command === 'logout' && connectionId) {
                        await logoutConnection(connectionId, false)
                        res.writeHead(200)
                        res.end(JSON.stringify({ ok: true }))
                    } else if (command === 'delete' && connectionId) {
                        await logoutConnection(connectionId, false)
                        res.writeHead(200)
                        res.end(JSON.stringify({ ok: true }))
                    } else if (command === 'cleanup-sessions') {
                        cleanupOrphanSessions()
                        res.writeHead(200)
                        res.end(JSON.stringify({ ok: true }))
                    } else if (command === 'force-reconnect' && connectionId) {
                        const conn = connections.get(connectionId)
                        if (conn) {
                            stopHeartbeat(connectionId)
                            if (conn.primary?.sock) {
                                cleanupSocketListeners(conn.primary.sock, connectionId, 'PRIMARY')
                                conn.primary.sock.end(undefined)
                            }
                            if (conn.standby?.sock) {
                                cleanupSocketListeners(conn.standby.sock, connectionId, 'STANDBY')
                                conn.standby.sock.end(undefined)
                            }
                            connections.delete(connectionId)
                        }
                        const sessionPath = path.join(SESSIONS_DIR, connectionId)
                        if (fs.existsSync(sessionPath)) {
                            fs.rmSync(sessionPath, { recursive: true, force: true })
                        }
                        res.writeHead(200)
                        res.end(JSON.stringify({ ok: true }))
                    } else if (command === 'status') {
                        const status = {}
                        for (const [id, conn] of connections.entries()) {
                            status[id] = {
                                activeSlot: conn.activeSlot,
                                primary: conn.primary?.connected || false,
                                standby: conn.standby?.connected || false,
                                agentId: conn.agentId,
                                phoneNumber: conn.phoneNumber,
                                failoverCount: conn.failoverCount || 0
                            }
                        }
                        res.writeHead(200)
                        res.end(JSON.stringify({ status }))
                    } else if (command === 'force-failover' && connectionId) {
                        // Comando para testing: fuerza failover manual
                        await executeFailover(connectionId)
                        res.writeHead(200)
                        res.end(JSON.stringify({ ok: true, message: 'Failover ejecutado' }))
                    } else if (command === 'process-pending' && connectionId) {
                        // Forzar procesamiento de mensajes pendientes
                        const conn = connections.get(connectionId)
                        if (!conn) {
                            res.writeHead(404)
                            res.end(JSON.stringify({ error: 'Conexión no encontrada' }))
                        } else {
                            const sock = conn[conn.activeSlot]?.sock
                            if (!sock) {
                                res.writeHead(400)
                                res.end(JSON.stringify({ error: 'Socket no disponible' }))
                            } else {
                                const count = await checkAndProcessPendingMessages(connectionId, sock)
                                res.writeHead(200)
                                res.end(JSON.stringify({ ok: true, processed: count }))
                            }
                        }
                    } else if (command === 'send-proactive-message' && connectionId) {
                        // Enviar mensaje proactivo (para recordatorios de citas)
                        const { to, message } = JSON.parse(body)
                        
                        if (!to || !message) {
                            res.writeHead(400)
                            res.end(JSON.stringify({ error: 'Faltan campos: to, message' }))
                            return
                        }
                        
                        const conn = connections.get(connectionId)
                        if (!conn || !conn[conn.activeSlot]?.sock) {
                            res.writeHead(400)
                            res.end(JSON.stringify({ error: 'Conexión no disponible' }))
                            return
                        }
                        
                        try {
                            const sock = conn[conn.activeSlot].sock
                            await sock.sendMessage(to, { text: message })
                            console.log(`[${connectionId}] ✅ Mensaje proactivo enviado a ${to}`)
                            res.writeHead(200)
                            res.end(JSON.stringify({ ok: true }))
                        } catch (error) {
                            console.error(`[${connectionId}] Error enviando mensaje proactivo:`, error.message)
                            res.writeHead(500)
                            res.end(JSON.stringify({ error: error.message }))
                        }
                    } else {
                        res.writeHead(400)
                        res.end(JSON.stringify({ error: 'Comando inválido' }))
                    }
                } catch (error) {
                    res.writeHead(500)
                    res.end(JSON.stringify({ error: error.message }))
                }
            })
        } else if (req.method === 'GET' && req.url === '/api/health') {
            const health = {
                ok: true,
                connections: connections.size,
                details: {}
            }
            for (const [id, conn] of connections.entries()) {
                health.details[id] = {
                    active: conn.activeSlot,
                    primary: conn.primary?.connected || false,
                    standby: conn.standby?.connected || false,
                    failovers: conn.failoverCount || 0,
                    pendingMessages: conn.messageQueue?.size || 0,
                    lastHeartbeat: conn.lastHeartbeat ? new Date(conn.lastHeartbeat).toISOString() : null
                }
            }
            res.writeHead(200)
            res.end(JSON.stringify(health))
        } else {
            res.writeHead(404)
            res.end()
        }
    })

    server.listen(PORT, () => {
        console.log(`\n🤖 Bot Command Server en puerto ${PORT}`)
    })
}

/**
 * Limpieza periódica de colas de mensajes
 */
function startMessageQueueCleanup() {
    setInterval(() => {
        for (const [connectionId, conn] of connections.entries()) {
            cleanupMessageQueue(connectionId)
        }
    }, messageQueueCleanupInterval)
    
    console.log(`🕒 Limpieza de colas iniciada (cada ${messageQueueCleanupInterval/1000}s)`)
}

/**
 * Main
 */
async function main() {
    console.log('\n🚀 === ORQUESTADOR BAILEYS 7.x CON HOT STANDBY ===')
    console.log(`📡 API: ${API_URL}`)
    console.log(`🔑 Token: ${BOT_TOKEN ? 'Configurado' : 'No configurado'}`)
    console.log(`🛡️ Hot Standby: ACTIVADO`)
    console.log(`📬 Message Recovery: ACTIVADO`)
    console.log(`💓 Heartbeat Activo: 15s (primary), 20s (standby)`)

    // Inicializar servicio OCR (si está habilitado)
    try {
        const settings = require('./server/data/settings.json')
        if (settings.features?.ocrPagos === true) {
            console.log(`📸 OCR de pagos: ACTIVADO (feature flag habilitado)`)
            ocrService.init()
        } else {
            console.log(`📸 OCR de pagos: DESACTIVADO (feature flag deshabilitado)`)
        }
    } catch (error) {
        console.log(`📸 OCR de pagos: No se pudo inicializar (${error.message})`)
    }

    // Limpiar sesiones huérfanas al iniciar
    cleanupOrphanSessions()

    await startCommandServer()
    await startPolling()
    startMessageQueueCleanup()

    console.log('\n✅ Orquestador listo. Esperando conexiones...')
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM recibido, cerrando...')
    for (const [connectionId, conn] of connections.entries()) {
        stopHeartbeat(connectionId)
        if (conn.primary?.sock) {
            cleanupSocketListeners(conn.primary.sock, connectionId, 'PRIMARY')
            conn.primary.sock.end(undefined)
        }
        if (conn.standby?.sock) {
            cleanupSocketListeners(conn.standby.sock, connectionId, 'STANDBY')
            conn.standby.sock.end(undefined)
        }
    }
    connections.clear()
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT recibido (Ctrl+C), cerrando...')
    for (const [connectionId, conn] of connections.entries()) {
        stopHeartbeat(connectionId)
        if (conn.primary?.sock) {
            cleanupSocketListeners(conn.primary.sock, connectionId, 'PRIMARY')
            conn.primary.sock.end(undefined)
        }
        if (conn.standby?.sock) {
            cleanupSocketListeners(conn.standby.sock, connectionId, 'STANDBY')
            conn.standby.sock.end(undefined)
        }
    }
    connections.clear()
    process.exit(0)
})

process.on('exit', () => {
    console.log('👋 Procesos limpiados, puertos liberados')
})

main().catch(console.error)
