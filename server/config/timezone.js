/**
 * Configuración de Zona Horaria - Perú (UTC-5)
 * 
 * Este módulo permite trabajar con la hora de Perú independientemente
 * de la zona horaria del servidor.
 * 
 * Uso:
 *   const { getPeruNow, getPeruTimestamp } = require('./config/timezone')
 *   const ahora = getPeruNow()
 */

const PERU_TIMEZONE = 'America/Lima' // UTC-5

/**
 * Obtiene la fecha/hora actual en Perú
 * @returns {Date} Fecha actual en zona horaria Perú
 */
function getPeruNow() {
    const now = new Date()
    const peruTime = new Date(now.toLocaleString('en-US', { 
        timeZone: PERU_TIMEZONE 
    }))
    return peruTime
}

/**
 * Obtiene timestamp actual en Perú
 * @returns {number} Timestamp en milisegundos
 */
function getPeruTimestamp() {
    return getPeruNow().getTime()
}

/**
 * Convierte fecha + hora a timestamp UTC (zona horaria Perú)
 * @param {string} fecha - Formato YYYY-MM-DD
 * @param {string} hora - Formato HH:MM
 * @returns {number} Timestamp UTC
 */
function fechaHoraToTimestamp(fecha, hora) {
    // Crear fecha asumiendo que es hora de Perú (UTC-5)
    // Formato: YYYY-MM-DDTHH:MM:00-05:00
    const fechaConTimezone = `${fecha}T${hora}:00-05:00`;
    return new Date(fechaConTimezone).getTime();
}

/**
 * Formatea fecha para mostrar en Perú
 * @param {string} fechaISO - Fecha ISO (YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS)
 * @returns {string} Fecha formateada
 */
function formatPeruDate(fechaISO) {
    // Extraer año, mes, día directamente del string (asumir que ya es fecha Perú)
    const match = fechaISO.match(/(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return fechaISO
    
    const year = parseInt(match[1])
    const month = parseInt(match[2]) - 1 // JS usa 0-11 para meses
    const day = parseInt(match[3])
    
    // Crear fecha y formatear manualmente (sin conversión de timezone)
    const fecha = new Date(year, month, day)
    const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    
    const weekday = weekdays[fecha.getDay()]
    const monthName = months[fecha.getMonth()]
    
    return `${weekday}, ${day} de ${monthName} de ${year}`
}

/**
 * Formatea hora para mostrar en Perú (formato 12h)
 * @param {string} hora - Hora HH:MM (asumir que es hora Perú)
 * @returns {string} Hora formateada
 */
function formatPeruTime(hora) {
    // Parsear hora directamente como hora de Perú (sin conversión de timezone)
    const [h, m] = hora.split(':')
    const hours = parseInt(h)
    const minutes = parseInt(m)
    
    // Formato 12h manual (sin depender de timezone)
    const period = hours >= 12 ? 'p. m.' : 'a. m.'
    const hours12 = hours % 12 || 12
    
    return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * Verifica si una fecha ya pasó (en hora Perú)
 * @param {number} timestamp - Timestamp de la cita
 * @returns {boolean} True si ya pasó
 */
function isPast(timestamp) {
    return getPeruTimestamp() > timestamp
}

/**
 * Obtiene diferencia en minutos desde ahora hasta timestamp
 * @param {number} timestamp - Timestamp futuro
 * @returns {number} Minutos restantes (negativo si ya pasó)
 */
function getMinutesUntil(timestamp) {
    const diff = timestamp - getPeruTimestamp()
    return Math.floor(diff / (1000 * 60))
}

/**
 * Obtiene diferencia en horas desde ahora hasta timestamp
 * @param {number} timestamp - Timestamp futuro
 * @returns {number} Horas restantes (negativo si ya pasó)
 */
function getHoursUntil(timestamp) {
    const diff = timestamp - getPeruTimestamp()
    return Math.floor(diff / (1000 * 60 * 60))
}

module.exports = {
    PERU_TIMEZONE,
    getPeruNow,
    getPeruTimestamp,
    fechaHoraToTimestamp,
    formatPeruDate,
    formatPeruTime,
    isPast,
    getMinutesUntil,
    getHoursUntil
}
