#!/usr/bin/env node
/**
 * Script para limpiar sesiones de agentes
 * Uso: node scripts/clean-sessions.js [agentId]
 * Si no se proporciona agentId, limpia TODAS las sesiones
 */

const fs = require('fs')
const path = require('path')

const SESSIONS_DIR = path.join(__dirname, '..', 'bot_sessions')
const DATA_DIR = path.join(__dirname, '..', 'server', 'data')

function cleanSession(agentId) {
    const sessionPath = path.join(SESSIONS_DIR, agentId)
    
    if (fs.existsSync(sessionPath)) {
        console.log(`🧹 Limpiando sesión de ${agentId}...`)
        fs.rmSync(sessionPath, { recursive: true, force: true })
        fs.mkdirSync(sessionPath, { recursive: true })
        console.log(`✅ Sesión de ${agentId} limpiada`)
    } else {
        console.log(`ℹ️  No existe sesión para ${agentId}`)
    }
    
    // Limpiar QR si existe
    const qrPath = path.join(DATA_DIR, `qr_${agentId}.png`)
    if (fs.existsSync(qrPath)) {
        fs.unlinkSync(qrPath)
        console.log(`🗑️  QR eliminado para ${agentId}`)
    }
}

function cleanAllSessions() {
    if (!fs.existsSync(SESSIONS_DIR)) {
        console.log('ℹ️  No existe directorio de sesiones')
        return
    }
    
    const entries = fs.readdirSync(SESSIONS_DIR)
    console.log(`🧹 Limpiando ${entries.length} sesiones...`)
    
    for (const agentId of entries) {
        const agentPath = path.join(SESSIONS_DIR, agentId)
        if (fs.statSync(agentPath).isDirectory()) {
            fs.rmSync(agentPath, { recursive: true, force: true })
            fs.mkdirSync(agentPath, { recursive: true })
            console.log(`  ✅ ${agentId}`)
        }
    }
    
    // Limpiar QRs
    if (fs.existsSync(DATA_DIR)) {
        const files = fs.readdirSync(DATA_DIR)
        for (const file of files) {
            if (file.startsWith('qr_') && file.endsWith('.png')) {
                fs.unlinkSync(path.join(DATA_DIR, file))
                console.log(`  🗑️  QR: ${file}`)
            }
        }
    }
    
    console.log('✅ Todas las sesiones limpiadas')
}

// Main
const agentId = process.argv[2]

if (agentId === '--all' || !agentId) {
    cleanAllSessions()
} else {
    cleanSession(agentId)
}

console.log('\n💡 Ahora puedes reiniciar el bot para generar un nuevo QR')
