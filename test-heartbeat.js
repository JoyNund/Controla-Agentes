/**
 * Script de prueba para verificar el sistema de heartbeat
 * Ejecutar mientras el bot está corriendo para monitorear el estado
 */

const axios = require('axios')

const BOT_URL = 'http://localhost:3848'
const API_URL = 'http://localhost:3847'
const BOT_TOKEN = 'a7f3c91e4b2d8e60f5c1a9b7d3e6f2a8c4b0e1d9f7a5c3b8e2d6f4a1c9b7e5d3'

const apiHeaders = { headers: { 'x-bot-token': BOT_TOKEN } }

async function checkHealth() {
    try {
        // Verificar salud del bot
        const health = await axios.get(`${BOT_URL}/api/health`)
        console.log('\n=== ESTADO DEL BOT ===')
        console.log(`✅ Bot: ${health.data.ok ? 'ONLINE' : 'OFFLINE'}`)
        console.log(`📊 Instancias activas: ${health.data.instances}`)
        console.log(`⏱️  Uptime: ${Math.floor(health.data.uptime)}s`)

        // Verificar estado de cada instancia
        const status = await axios.post(`${BOT_URL}/api/command`,
            { command: 'status' },
            { headers: { 'x-bot-token': BOT_TOKEN, 'Content-Type': 'application/json' } }
        )

        console.log('\n=== INSTANCIAS ===')
        for (const [connId, info] of Object.entries(status.data.status)) {
            console.log(`\n📱 Conexión: ${connId}`)
            console.log(`   Estado: ${info.connected ? '✅ CONECTADO' : '❌ DESCONECTADO'}`)
            console.log(`   Agente: ${info.agentId || 'Ninguno'}`)
            console.log(`   Teléfono: ${info.phoneNumber || 'No disponible'}`)
        }

        // Verificar conexiones en API
        const connections = await axios.get(`${API_URL}/api/connections`)
        console.log('\n=== CONEXIONES EN API ===')
        for (const [connId, conn] of Object.entries(connections.data)) {
            console.log(`\n📱 Conexión: ${connId}`)
            console.log(`   Nombre: ${conn.name}`)
            console.log(`   Estado: ${conn.status}`)
            console.log(`   Teléfono: ${conn.phoneNumber}`)
            console.log(`   Logs: ${conn.logs?.length || 0} registros`)
            
            if (conn.logs?.length > 0) {
                const lastLog = conn.logs[conn.logs.length - 1]
                console.log(`   Último log: ${lastLog.time} - ${lastLog.text}`)
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message)
    }
}

// Ejecutar inmediatamente
checkHealth()

// Y luego cada 30 segundos
setInterval(checkHealth, 30000)

console.log('Presiona Ctrl+C para salir')
