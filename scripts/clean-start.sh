#!/bin/bash
# Script de inicio limpio para el bot de WhatsApp
# Previene procesos duplicados y limpia sesiones corruptas

set -e

cd /var/www/agentes

echo "🧹 === LIMPIEZA INICIAL ==="

# 1. Verificar si hay procesos duplicados del bot
BOT_PIDS=$(pm2 list --name agentes-bot 2>/dev/null | grep -E "agentes-bot.*online" | awk '{print $2}' | wc -l || echo "0")

if [ "$BOT_PIDS" -gt 1 ]; then
    echo "⚠️  Detectados $BOT_PIDS procesos del bot. Limpiando..."
    pm2 delete agentes-bot 2>/dev/null || true
    sleep 2
fi

# 2. Verificar puerto 3848
PORT_USER=$(lsof -t -i:3848 2>/dev/null | head -1 || echo "")
if [ -n "$PORT_USER" ]; then
    PROC_NAME=$(ps -p $PORT_USER -o comm= 2>/dev/null || echo "unknown")
    if [[ "$PROC_NAME" != *"node"* ]] || [[ "$PROC_NAME" == *"server/index.js"* ]]; then
        echo "⚠️  Puerto 3848 ocupado por $PROC_NAME (PID $PORT_USER). Liberando..."
        kill -9 $PORT_USER 2>/dev/null || true
        sleep 1
    fi
fi

# 3. Limpiar sesiones corruptas (sin creds válidos)
echo "📁 Verificando sesiones..."
for dir in /var/www/agentes/bot_sessions/*/; do
    if [ -d "$dir" ]; then
        CREDS_FILE="$dir/creds.json"
        if [ -f "$CREDS_FILE" ]; then
            # Verificar si creds.json tiene me.id
            if ! grep -q '"me":' "$CREDS_FILE" 2>/dev/null; then
                CONN_ID=$(basename "$dir")
                echo "   🗑️  Sesión corrupta: $CONN_ID"
                rm -rf "$dir"
                rm -f "/var/www/agentes/server/data/qr_${CONN_ID}.png"
            fi
        fi
    fi
done

echo ""
echo "🚀 === INICIANDO BOT ==="

# 4. Iniciar bot con PM2
pm2 start app.js --name agentes-bot --max-memory-restart 500M

# 5. Esperar a que esté listo
echo "⏳ Esperando inicio..."
sleep 5

# 6. Verificar estado
if pm2 list --name agentes-bot | grep -q "online"; then
    echo ""
    echo "✅ Bot iniciado exitosamente"
    pm2 status agentes-bot
else
    echo ""
    echo "❌ Error al iniciar el bot"
    pm2 logs agentes-bot --lines 20 --nostream
    exit 1
fi

echo ""
echo "📊 === ESTADO FINAL ==="
pm2 status
