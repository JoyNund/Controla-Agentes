/**
 * Citas Scheduler - Recordatorios y Limpieza Automática
 * 
 * Servicio que se ejecuta en segundo plano para:
 * - Enviar recordatorios de citas 1 hora antes
 * - Eliminar citas caducadas automáticamente
 * 
 * Uso:
 *   const citasScheduler = require('./server/services/citasScheduler')
 *   citasScheduler.start()
 */

const citasService = require('./citasService')
const { getPeruNow, getMinutesUntil, formatPeruDate, formatPeruTime } = require('../config/timezone')
const axios = require('axios')

const API_URL = process.env.WEBAPP_API_URL || 'http://localhost:3847'
const BOT_PORT = process.env.BOT_PORT || 3848
const BOT_URL = `http://localhost:${BOT_PORT}`
const BOT_TOKEN = process.env.BOT_INTERNAL_TOKEN || 'default-token'

let schedulerInterval = null
let isRunning = false

/**
 * Iniciar el scheduler
 */
function start() {
    if (isRunning) {
        console.log('⚠️ Citas Scheduler ya está en ejecución')
        return
    }
    
    isRunning = true
    console.log('🗓️ Citas Scheduler iniciado (Zona horaria: Perú UTC-5)')
    console.log(`🕐 Hora actual en Perú: ${getPeruNow().toISOString()}`)
    
    // Ejecutar inmediatamente
    verificarRecordatorios()
    verificarCaducidad()
    
    // Programar polling cada 60 segundos
    schedulerInterval = setInterval(() => {
        verificarRecordatorios()
        verificarCaducidad()
    }, 60000)
}

/**
 * Detener el scheduler
 */
function stop() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval)
        schedulerInterval = null
        isRunning = false
        console.log('🗓️ Citas Scheduler detenido')
    }
}

/**
 * Verificar citas para recordatorio
 */
async function verificarRecordatorios() {
    try {
        const citasParaRecordatorio = citasService.getCitasParaRecordatorio()
        
        console.log(`🗓️ [Scheduler] Verificando recordatorios... ${citasParaRecordatorio.length} citas pendientes`)

        if (citasParaRecordatorio.length === 0) return

        for (const cita of citasParaRecordatorio) {
            await enviarRecordatorio(cita)
        }

        console.log(`🔔 ${citasParaRecordatorio.length} recordatorios enviados`)
    } catch (error) {
        console.error('❌ Error verificando recordatorios:', error.message)
    }
}

/**
 * Verificar y eliminar citas caducadas
 */
async function verificarCaducidad() {
    try {
        const caducadas = citasService.getCitasCaducadas()
        
        if (caducadas.length === 0) return
        
        console.log(`⏰ ${caducadas.length} citas caducadas detectadas`)
        
        for (const cita of caducadas) {
            // Eliminar cita caducada
            citasService.deleteCita(cita.id)
            console.log(`🗑️ Cita eliminada: ${cita.id} (${cita.nombre})`)
        }
    } catch (error) {
        console.error('❌ Error verificando caducidad:', error.message)
    }
}

/**
 * Enviar recordatorio por WhatsApp
 * @param {Object} cita - Datos de la cita
 */
async function enviarRecordatorio(cita) {
    try {
        // Obtener conexión asociada
        let conexion = null
        try {
            const connectionsResponse = await axios.get(`${API_URL}/api/connections`, {
                headers: {
                    Cookie: `session=${process.env.SESSION_SECRET || ''}`
                }
            })
            
            if (connectionsResponse.data && Array.isArray(connectionsResponse.data)) {
                conexion = connectionsResponse.data.find(c => c.id === cita.connectionId)
            }
        } catch (error) {
            console.error(`⚠️ No se pudo obtener conexiones: ${error.message}`)
        }

        if (!conexion) {
            console.warn(`⚠️ Conexión no encontrada: ${cita.connectionId}, enviando de todas formas...`)
        }

        const mensaje = `⏰ *RECORDATORIO DE CITA* ⏰

Hola ${cita.nombre}, te recordamos tu reunión agendada:

📅 *Fecha:* ${formatPeruDate(cita.fecha)}
🕐 *Hora:* ${formatPeruTime(cita.hora)} (hora Perú)
📋 *Tipo:* ${cita.tipo}
📝 *Descripción:* ${cita.descripcion}

Si necesitas cancelar o reprogramar, responde a este mensaje.

¡Nos vemos pronto!`

        // Enviar mensaje proactivo a través del bot
        const response = await axios.post(`${BOT_URL}/api/command`, {
            command: 'send-proactive-message',
            connectionId: cita.connectionId,
            to: `${cita.telefono}@s.whatsapp.net`,
            message: mensaje
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-bot-token': BOT_TOKEN
            }
        }).catch(error => {
            console.error(`❌ Error enviando mensaje: ${error.message}`)
            // Si falla el envío proactivo, intentar método alternativo
            return enviarRecordatorioAlternativo(cita, mensaje)
        })
        
        // Marcar recordatorio como enviado
        citasService.marcarRecordatorioEnviado(cita.id)
        
        console.log(`✅ Recordatorio enviado a ${cita.nombre} (${cita.telefono})`)
    } catch (error) {
        console.error(`❌ Error enviando recordatorio:`, error.message)
    }
}

/**
 * Método alternativo para enviar recordatorio (si el primero falla)
 * @param {Object} cita - Datos de la cita
 * @param {string} mensaje - Mensaje a enviar
 */
async function enviarRecordatorioAlternativo(cita, mensaje) {
    try {
        // Intentar enviar directamente por la API del bot
        await axios.post(`${BOT_URL}/api/message/send`, {
            connectionId: cita.connectionId,
            to: `${cita.telefono}@s.whatsapp.net`,
            message: mensaje
        }, {
            headers: {
                'Content-Type': 'application/json',
                'x-bot-token': BOT_TOKEN
            }
        })
        
        citasService.marcarRecordatorioEnviado(cita.id)
        console.log(`✅ Recordatorio enviado (método alternativo)`)
    } catch (error) {
        console.error(`❌ Error en método alternativo:`, error.message)
    }
}

/**
 * Obtener estado del scheduler
 * @returns {Object} Estado y estadísticas
 */
async function getStatus() {
    const stats = citasService.getStats()
    const ahoraPeru = getPeruNow()
    
    return {
        running: isRunning,
        horaPeru: ahoraPeru.toISOString(),
        timezone: 'America/Lima (UTC-5)',
        stats
    }
}

module.exports = {
    start,
    stop,
    verificarRecordatorios,
    verificarCaducidad,
    getStatus
}
