#!/bin/bash
# Script de rollback para sistema OCR de pagos
# Uso: ./scripts/rollback-ocr.sh

echo "🔄 === ROLLBACK DE SISTEMA OCR ==="

# Backup actual
BACKUP_ACTUAL="/var/www/agentes/app.js.backup.pre-ocr.$(date +%Y%m%d_%H%M%S)"
echo "📦 Creando backup actual: $BACKUP_ACTUAL"
cp /var/www/agentes/app.js "$BACKUP_ACTUAL"

# Restaurar backup original
echo "🔄 Restaurando app.js desde backup original..."
cp /var/www/agentes/app.js.backup.original /var/www/agentes/app.js

# Reiniciar bot
echo "🔄 Reiniciando bot..."
pm2 restart agentes-bot

# Esperar a que arranque
sleep 3

# Verificar estado
echo "📊 Verificando estado..."
pm2 logs agentes-bot --lines 20

echo ""
echo "✅ Rollback completado"
echo "ℹ️  El backup original está en: /var/www/agentes/app.js.backup.original"
echo "ℹ️  El backup pre-OCR está en: $BACKUP_ACTUAL"
