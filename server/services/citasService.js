/**
 * Citas Service - Gestión de Citas/Reuniones
 * 
 * Maneja el CRUD de citas con caducidad automática.
 * Cada cliente solo puede tener UNA cita activa a la vez.
 * Las citas caducadas se eliminan automáticamente.
 * 
 * Uso:
 *   const citasService = require('./server/services/citasService')
 *   const cita = citasService.create({...})
 */

const fs = require('fs')
const path = require('path')
const { getPeruTimestamp, fechaHoraToTimestamp } = require('../config/timezone')

const CITAS_FILE = path.join(__dirname, '../data/citas.json')

/**
 * Inicializar archivo de citas si no existe
 */
function initCitasFile() {
    if (!fs.existsSync(CITAS_FILE)) {
        fs.writeFileSync(CITAS_FILE, JSON.stringify({
            citas: [],
            metadata: {
                ultimaVerificacionCaducidad: new Date().toISOString(),
                ultimoRecordatorio: new Date().toISOString()
            }
        }, null, 2))
        console.log('📁 Archivo de citas inicializado')
    }
}

/**
 * Leer todas las citas del archivo
 * @returns {Array} Lista de citas
 */
function getAll() {
    initCitasFile()
    const data = JSON.parse(fs.readFileSync(CITAS_FILE, 'utf8'))
    return data.citas || []
}

/**
 * Buscar cita activa por conversationId (UNA SOLA por cliente)
 * @param {string} conversationId - ID de conversación de WhatsApp
 * @returns {Object|null} Cita activa o null
 */
function getActivaByConversation(conversationId) {
    const citas = getAll()
    return citas.find(c => 
        c.conversationId === conversationId && 
        c.estado === 'activa'
    )
}

/**
 * Verificar si un cliente tiene cita activa
 * @param {string} conversationId - ID de conversación de WhatsApp
 * @returns {boolean} True si tiene cita activa
 */
function tieneCitaActiva(conversationId) {
    return !!getActivaByConversation(conversationId)
}

/**
 * Buscar citas próximas para recordatorio (1 hora antes)
 * @returns {Array} Citas que necesitan recordatorio
 */
function getCitasParaRecordatorio() {
    const citas = getAll()
    const ahora = Date.now() // Timestamp UTC actual

    return citas.filter(cita => {
        // Solo citas activas sin recordatorio enviado
        if (cita.estado !== 'activa') return false
        if (cita.recordatorioEnviado) return false

        // Calcular minutos hasta la cita (usando timestamp de la cita que ya está en UTC)
        const diffMinutes = (cita.timestamp - ahora) / (1000 * 60)

        // Recordar entre 0 y 60 minutos antes
        return diffMinutes > 0 && diffMinutes <= 60
    })
}

/**
 * Buscar citas caducadas (para eliminar)
 * @returns {Array} Citas caducadas
 */
function getCitasCaducadas() {
    const citas = getAll()
    const ahora = getPeruTimestamp()
    
    return citas.filter(cita => {
        // Cita activa que ya pasó su hora de expiración
        return cita.estado === 'activa' && ahora > cita.expiresAt
    })
}

/**
 * Crear nueva cita
 * @param {Object} citaData - Datos de la cita
 * @param {string} citaData.conversationId - ID de conversación WhatsApp
 * @param {string} citaData.connectionId - ID de conexión del agente
 * @param {string} citaData.nombre - Nombre del cliente
 * @param {string} citaData.telefono - Teléfono del cliente
 * @param {string} citaData.fecha - Fecha YYYY-MM-DD
 * @param {string} citaData.hora - Hora HH:MM
 * @param {string} citaData.tipo - Tipo de reunión
 * @param {string} [citaData.descripcion] - Descripción opcional
 * @returns {Object} Cita creada
 * @throws {Error} Si el cliente ya tiene una cita activa
 */
function create(citaData) {
    const citas = getAll()

    // VALIDACIÓN CRÍTICA: Cliente no puede tener otra cita activa
    // Validar por conversationId O por teléfono (para cubrir casos donde el ID cambia)
    const existingActiva = citas.find(c =>
        c.estado === 'activa' &&
        (c.conversationId === citaData.conversationId || c.telefono === citaData.telefono)
    )

    if (existingActiva) {
        throw new Error(`El cliente ya tiene una cita activa el ${existingActiva.fecha} a las ${existingActiva.hora}`)
    }
    
    // Calcular timestamp y expiresAt (2 horas de gracia después de la cita)
    const timestamp = fechaHoraToTimestamp(citaData.fecha, citaData.hora)
    const expiresAt = timestamp + (2 * 60 * 60 * 1000) // 2 horas de gracia
    
    const nuevaCita = {
        id: `cita_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        conversationId: citaData.conversationId,
        connectionId: citaData.connectionId,
        nombre: citaData.nombre,
        telefono: citaData.telefono,
        fecha: citaData.fecha,
        hora: citaData.hora,
        timestamp: timestamp,
        tipo: citaData.tipo,
        descripcion: citaData.descripcion || '',
        estado: 'activa',
        recordatorioEnviado: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(expiresAt).toISOString()
    }
    
    citas.push(nuevaCita)
    save(citas)
    
    console.log(`📅 Cita creada: ${nuevaCita.id} - ${citaData.nombre} (${citaData.fecha} ${citaData.hora})`)
    return nuevaCita
}

/**
 * Actualizar cita existente
 * @param {string} id - ID de la cita
 * @param {Object} updates - Campos a actualizar
 * @returns {Object|null} Cita actualizada o null
 */
function update(id, updates) {
    const citas = getAll()
    const index = citas.findIndex(c => c.id === id)
    
    if (index === -1) {
        console.warn(`⚠️ Cita no encontrada: ${id}`)
        return null
    }
    
    citas[index] = {
        ...citas[index],
        ...updates,
        updatedAt: new Date().toISOString()
    }
    
    save(citas)
    return citas[index]
}

/**
 * Cancelar cita
 * @param {string} id - ID de la cita
 * @param {string} canceladoPor - 'cliente' o 'agente'
 * @param {string} [motivo] - Motivo de cancelación opcional
 * @returns {Object|null} Cita cancelada o null
 */
function cancelar(id, canceladoPor, motivo = null) {
    console.log(`❌ Cancelando cita ${id} por ${canceladoPor}`)
    return update(id, {
        estado: 'cancelada',
        canceladoPor,
        motivoCancelacion: motivo,
        expiresAt: new Date().toISOString() // Expira inmediatamente
    })
}

/**
 * Marcar recordatorio como enviado
 * @param {string} id - ID de la cita
 * @returns {Object|null} Cita actualizada o null
 */
function marcarRecordatorioEnviado(id) {
    return update(id, { recordatorioEnviado: true })
}

/**
 * Marcar cita como completada (uso manual desde frontend)
 * @param {string} id - ID de la cita
 * @returns {Object|null} Cita actualizada o null
 */
function marcarCompletada(id) {
    return update(id, {
        estado: 'completada',
        expiresAt: new Date().toISOString()
    })
}

/**
 * Eliminar cita físicamente del JSON
 * @param {string} id - ID de la cita
 * @returns {boolean} True si se eliminó
 */
function deleteCita(id) {
    const citas = getAll()
    const filtradas = citas.filter(c => c.id !== id)
    save(filtradas)
    console.log(`🗑️ Cita eliminada: ${id}`)
    return true
}

/**
 * Eliminar citas caducadas (limpieza automática)
 * @returns {number} Cantidad de citas eliminadas
 */
function limpiarCaducadas() {
    const citas = getAll()
    const caducadas = getCitasCaducadas()
    
    if (caducadas.length === 0) return 0
    
    const filtradas = citas.filter(c => 
        !caducadas.find(cad => cad.id === c.id)
    )
    
    save(filtradas)
    
    console.log(`🗑️ ${caducadas.length} citas caducadas eliminadas`)
    return caducadas.length
}

/**
 * Obtener estadísticas de citas
 * @returns {Object} Estadísticas
 */
function getStats() {
    const citas = getAll()
    return {
        total: citas.length,
        activas: citas.filter(c => c.estado === 'activa').length,
        canceladas: citas.filter(c => c.estado === 'cancelada').length,
        completadas: citas.filter(c => c.estado === 'completada').length,
        paraRecordatorio: getCitasParaRecordatorio().length,
        caducadas: getCitasCaducadas().length
    }
}

/**
 * Buscar cita por ID
 * @param {string} id - ID de la cita
 * @returns {Object|null} Cita o null
 */
function getById(id) {
    const citas = getAll()
    return citas.find(c => c.id === id)
}

/**
 * Guardar citas en archivo
 * @param {Array} citas - Lista de citas
 */
function save(citas) {
    const data = {
        citas,
        metadata: {
            ultimaVerificacionCaducidad: new Date().toISOString(),
            ultimoRecordatorio: new Date().toISOString()
        }
    }
    fs.writeFileSync(CITAS_FILE, JSON.stringify(data, null, 2))
}

module.exports = {
    initCitasFile,
    getAll,
    getById,
    getActivaByConversation,
    tieneCitaActiva,
    getCitasParaRecordatorio,
    getCitasCaducadas,
    create,
    update,
    cancelar,
    marcarRecordatorioEnviado,
    marcarCompletada,
    deleteCita,
    limpiarCaducadas,
    getStats
}
