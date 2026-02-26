#!/usr/bin/env node
/**
 * Script de Restore - CONTROLA.agentes
 * 
 * Restaura archivos DESDE un backup creado con backup.js
 * 
 * ⚠️ REGLA CRÍTICA SOBRE BACKUPS:
 * - Los backups son PERMANENTES E INAMOVIBLES
 * - NUNCA se reemplazan archivos del backup
 * - NUNCA se modifica el contenido de un backup
 * - El restore COPIA archivos DESDE el backup HACIA el proyecto
 * - El backup original permanece INTACTO después del restore
 * - Antes de restaurar, se crea un backup automático del estado actual
 * 
 * Uso: node scripts/restore.js <directorio_backup>
 */

const fs = require('fs')
const path = require('path')

const ROOT_DIR = path.join(__dirname, '..')
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups')

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
}

function restoreBackup(backupPath) {
    console.log('\n🔵 === RESTORE DE CONTROLA.agentes ===\n')
    
    // Verificar que el backup existe
    if (!fs.existsSync(backupPath)) {
        console.error(`❌ Error: El backup no existe: ${backupPath}`)
        console.log('\nBackups disponibles:')
        listBackups()
        process.exit(1)
    }
    
    // Verificar manifiesto
    const manifestPath = path.join(backupPath, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
        console.error(`❌ Error: No hay manifiesto en el backup`)
        process.exit(1)
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    
    console.log(`📁 Restaurando desde: ${backupPath}`)
    console.log(`📅 Backup creado: ${manifest.timestamp}`)
    console.log(`🖥️  Hostname original: ${manifest.hostname}`)
    console.log(`📦 Archivos: ${manifest.backedUpCritical} críticos, ${manifest.backedUpOptional} opcionales`)
    console.log('')
    
    // Confirmación
    console.log('⚠️  ADVERTENCIA: Esto sobrescribirá los archivos actuales.')
    console.log('')
    
    const readline = require('readline')
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    
    rl.question('¿Continuar con el restore? (y/N): ', (answer) => {
        rl.close()
        
        if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log('\n❌ Restore cancelado\n')
            process.exit(0)
        }
        
        // Crear backup automático del estado actual antes de restaurar
        console.log('\n📦 Creando backup del estado actual...')
        const { execSync } = require('child_process')
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)
        const preRestorePath = path.join(BACKUPS_DIR, `pre_restore_${timestamp}`)
        
        try {
            execSync(`node ${path.join(__dirname, 'backup.js')} pre_restore_${timestamp}`, { stdio: 'pipe' })
            console.log(`✅ Backup previo guardado en: ${preRestorePath}`)
        } catch (error) {
            console.log('⚠️  No se pudo crear backup previo, continuando...')
        }
        
        // Restaurar archivos críticos
        console.log('\n📋 Restaurando archivos críticos:')
        let restoredCount = 0
        for (const file of manifest.criticalFiles) {
            const srcPath = path.join(backupPath, file)
            const destPath = path.join(ROOT_DIR, file)
            
            if (fs.existsSync(srcPath)) {
                // Crear directorio destino si no existe
                const destDir = path.dirname(destPath)
                ensureDir(destDir)
                
                // Copiar archivo
                fs.copyFileSync(srcPath, destPath)
                console.log(`  ✅ ${file}`)
                restoredCount++
            } else {
                console.log(`  ⚠️  No existe en backup: ${file}`)
            }
        }
        
        // Restaurar archivos opcionales
        console.log('\n📦 Restaurando archivos opcionales:')
        let optionalCount = 0
        for (const file of manifest.optionalFiles || []) {
            const srcPath = path.join(backupPath, file)
            const destPath = path.join(ROOT_DIR, file)
            
            if (fs.existsSync(srcPath)) {
                const destDir = path.dirname(destPath)
                ensureDir(destDir)
                fs.copyFileSync(srcPath, destPath)
                console.log(`  ✅ ${file}`)
                optionalCount++
            }
        }
        
        // Resumen
        console.log('\n' + '='.repeat(50))
        console.log('✅ RESTORE COMPLETADO')
        console.log('='.repeat(50))
        console.log(`📊 Archivos restaurados: ${restoredCount} críticos, ${optionalCount} opcionales`)
        console.log('')
        console.log('📝 SIGUIENTES PASOS:')
        console.log('')
        console.log('1. Verificar que .env tenga las variables correctas:')
        console.log('   cat /var/www/agentes/.env | grep DEEPSEEK')
        console.log('')
        console.log('2. Reiniciar los servidores:')
        console.log('   # Matar procesos actuales')
        console.log('   pkill -f "node /var/www/agentes"')
        console.log('')
        console.log('   # Iniciar API')
        console.log('   npm run server')
        console.log('')
        console.log('   # Iniciar Bot (en otra terminal)')
        console.log('   npm start')
        console.log('')
        console.log('3. Verificar que todo funcione:')
        console.log('   curl http://localhost:3848/api/health')
        console.log('')
    })
}

function listBackups() {
    if (!fs.existsSync(BACKUPS_DIR)) {
        console.log('   No hay backups disponibles')
        return
    }
    
    const backups = fs.readdirSync(BACKUPS_DIR)
        .filter(name => name.startsWith('backup_') || name.startsWith('pre_restore_'))
        .sort()
        .reverse()
    
    if (backups.length === 0) {
        console.log('   No hay backups disponibles')
        return
    }
    
    for (const backup of backups.slice(0, 10)) {
        const manifestPath = path.join(BACKUPS_DIR, backup, 'manifest.json')
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath))
            console.log(`   • ${backup} (${manifest.timestamp.slice(0, 10)}) - ${manifest.backedUpCritical} archivos`)
        } else {
            console.log(`   • ${backup}`)
        }
    }
}

// Main
const backupDir = process.argv[2]

if (!backupDir || backupDir === '--help' || backupDir === '-h') {
    console.log(`
🔵 RESTORE DE CONTROLA.agentes

Uso:
  node scripts/restore.js <directorio_backup>

Ejemplos:
  node scripts/restore.js backups/backup_20260221_001500
  node scripts/restore.js backups/pre_restore_20260221_120000

Backups disponibles:
`)
    listBackups()
    console.log('')
    process.exit(0)
}

restoreBackup(backupDir)
