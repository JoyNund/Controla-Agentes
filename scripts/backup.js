#!/usr/bin/env node
/**
 * Script de Backup - CONTROLA.agentes
 * 
 * Crea backup de archivos críticos para poder restaurar la configuración
 * en caso de fallos futuros.
 * 
 * ⚠️ REGLA CRÍTICA: Los backups son PERMANENTES E INAMOVIBLES
 * - NUNCA reemplazar archivos de un backup existente
 * - NUNCA modificar el contenido de un backup
 * - NUNCA eliminar backups (excepto manualmente con buena razón)
 * - Los backups nuevos SIEMPRE crean un directorio nuevo
 * 
 * Uso: node scripts/backup.js [nombre_opcional]
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT_DIR = path.join(__dirname, '..')
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups')

// Archivos críticos a respaldar
const CRITICAL_FILES = [
    // Backend
    'app.js',
    'server/index.js',
    'server/store.js',
    'services/agenteIA.js',
    '.env',
    'package.json',
    'package-lock.json',
    
    // Datos (con API keys)
    'server/data/agents.json',
    'server/data/connections.json',
    'server/data/settings.json',
    
    // Frontend crítico
    'webapp/src/pages/Conexion.jsx',
    'webapp/src/api.js',
]

// Archivos opcionales (grandes o regenerables)
const OPTIONAL_FILES = [
    'server/data/conversations.json',
    'server/data/blockedNumbers.json',
]

function generateTimestamp() {
    const now = new Date()
    return now.toISOString().replace(/[:.]/g, '').slice(0, 15)
}

function calculateHash(filePath) {
    const content = fs.readFileSync(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

function copyFile(src, dest) {
    const srcPath = path.join(ROOT_DIR, src)
    const destPath = path.join(dest, src.replace(/\//g, path.sep))
    
    if (!fs.existsSync(srcPath)) {
        console.log(`  ⚠️  No existe: ${src}`)
        return false
    }
    
    // Crear directorio destino si no existe
    const destDir = path.dirname(destPath)
    ensureDir(destDir)
    
    // Copiar archivo
    fs.copyFileSync(srcPath, destPath)
    
    // Calcular hash
    const hash = calculateHash(srcPath)
    
    console.log(`  ✅ ${src} (${hash.slice(0, 8)}...)`)
    return true
}

function createBackup(backupName = null) {
    console.log('\n🔵 === BACKUP DE CONTROLA.agentes ===\n')
    
    const timestamp = generateTimestamp()
    const name = backupName || `backup_${timestamp}`
    const backupPath = path.join(BACKUPS_DIR, name)
    
    console.log(`📁 Directorio de backup: ${backupPath}`)
    console.log('')
    
    // Crear directorio de backup
    ensureDir(backupPath)
    
    // Copiar archivos críticos
    console.log('📋 Archivos críticos:')
    let criticalCount = 0
    for (const file of CRITICAL_FILES) {
        if (copyFile(file, backupPath)) {
            criticalCount++
        }
    }
    
    // Copiar archivos opcionales (si existen)
    console.log('\n📦 Archivos opcionales:')
    let optionalCount = 0
    for (const file of OPTIONAL_FILES) {
        if (copyFile(file, backupPath)) {
            optionalCount++
        }
    }
    
    // Crear manifiesto
    const manifest = {
        name: name,
        timestamp: new Date().toISOString(),
        criticalFiles: CRITICAL_FILES,
        optionalFiles: OPTIONAL_FILES,
        backedUpCritical: criticalCount,
        backedUpOptional: optionalCount,
        nodeVersion: process.version,
        hostname: require('os').hostname()
    }
    
    fs.writeFileSync(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    )
    
    // Crear README del backup
    const readme = `# Backup de CONTROLA.agentes

**Nombre:** ${name}  
**Fecha:** ${manifest.timestamp}  
**Hostname:** ${manifest.hostname}  
**Node.js:** ${manifest.nodeVersion}

## Archivos Respaldados

- **Críticos:** ${criticalCount}/${CRITICAL_FILES.length}
- **Opcionales:** ${optionalCount}/${OPTIONAL_FILES.length}

## Cómo Restaurar

\`\`\`bash
cd /var/www/agentes
node scripts/restore.js backups/${name}
\`\`\`

## Notas

Este backup incluye:
- Código del bot y API
- Configuración de agentes (con API keys)
- Configuración de conexiones
- Frontend crítico

NO incluye:
- Sesiones de Baileys (bot_sessions/)
- Logs antiguos
- Node_modules
`
    
    fs.writeFileSync(path.join(backupPath, 'README.md'), readme)
    
    // Resumen
    console.log('\n' + '='.repeat(50))
    console.log('✅ BACKUP COMPLETADO')
    console.log('='.repeat(50))
    console.log(`📁 Ubicación: ${backupPath}`)
    console.log(`📊 Archivos: ${criticalCount + optionalCount} (${criticalCount} críticos, ${optionalCount} opcionales)`)
    console.log(`📝 Manifiesto: ${path.join(backupPath, 'manifest.json')}`)
    console.log('')
    
    // Listar backups existentes
    listBackups()
    
    return backupPath
}

function listBackups() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        console.log('📦 No hay backups existentes\n')
        return
    }
    
    const backups = fs.readdirSync(BACKUPS_DIR)
        .filter(name => name.startsWith('backup_'))
        .sort()
        .reverse()
    
    if (backups.length === 0) {
        console.log('📦 No hay backups existentes\n')
        return
    }
    
    console.log('📦 Backups existentes:')
    for (const backup of backups.slice(0, 10)) {
        const manifestPath = path.join(BACKUPS_DIR, backup, 'manifest.json')
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath))
            console.log(`   • ${backup} (${manifest.timestamp.slice(0, 10)})`)
        } else {
            console.log(`   • ${backup}`)
        }
    }
    console.log('')
}

// Main
const backupName = process.argv[2]

if (backupName === '--list' || backupName === '-l') {
    listBackups()
} else if (backupName === '--help' || backupName === '-h') {
    console.log(`
🔵 BACKUP DE CONTROLA.agentes

Uso:
  node scripts/backup.js [nombre_opcional]
  node scripts/backup.js --list
  node scripts/backup.js --help

Ejemplos:
  node scripts/backup.js                    # Backup con timestamp automático
  node scripts/backup.js antes_de_cambio    # Backup con nombre personalizado
  node scripts/backup.js --list             # Listar backups existentes

Archivos respaldados:
  - app.js, server/index.js, server/store.js
  - services/agenteIA.js
  - .env, package.json
  - server/data/agents.json, connections.json
  - webapp/src/pages/Conexion.jsx, api.js
`)
} else {
    createBackup(backupName || null)
}
