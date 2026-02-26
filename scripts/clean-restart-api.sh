#!/bin/bash
# ============================================
# SCRIPT DE RESTART LIMPIO PARA AGENTES-WEB
# ============================================
# Prevención de procesos zombie/duplicados
# ============================================

set -e

API_NAME="agentes-web"
API_FILE="/var/www/agentes/server/index.js"
PORT=3847

echo "🧹 === LIMPIEZA DE PROCESOS API ==="

# 1. Detener en PM2 PRIMERO (para que no intente auto-revive)
echo "⏹️  Deteniendo en PM2..."
pm2 stop $API_NAME 2>/dev/null || true
sleep 3  # Esperar más tiempo para que libere el puerto

# 2. Matar TODOS los procesos de la API (no solo PM2)
echo "📋 Buscando y matando procesos de la API..."
PIDS=$(ps aux | grep "node $API_FILE" | grep -v grep | awk '{print $2}' || true)

if [ -n "$PIDS" ]; then
    echo "⚠️  Procesos encontrados: $PIDS"
    for PID in $PIDS; do
        echo "   Matando proceso $PID..."
        kill -9 $PID 2>/dev/null || true
    done
    sleep 3  # Esperar más tiempo
else
    echo "✅ No hay procesos duplicados"
fi

# 3. Verificar que el puerto esté libre
echo "🔍 Verificando puerto $PORT..."
PORT_PID=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
    echo "⚠️  Puerto ocupado por PID $PORT_PID, liberando..."
    kill -9 $PORT_PID 2>/dev/null || true
    sleep 3  # Esperar más tiempo
fi

# 4. Delete y recreate en PM2 (nuclear option)
echo "💣 Eliminando en PM2..."
pm2 delete $API_NAME 2>/dev/null || true
sleep 2  # Esperar que PM2 limpie

# 5. Iniciar limpio desde cero
echo "🚀 Iniciando API desde cero..."
cd /var/www/agentes
pm2 start server/index.js --name $API_NAME --update-env

# 6. Esperar y verificar
sleep 5  # Esperar más tiempo para que el proceso esté estable

echo ""
echo "=== VERIFICACIÓN FINAL ==="

# Verificar usando PM2
PM2_STATUS=$(pm2 list $API_NAME --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print('online' if d and d[0].get('status')=='online' else 'offline')" 2>/dev/null || echo "error")

if [ "$PM2_STATUS" == "online" ]; then
    echo "✅ CORRECTO: API en línea en PM2"
    pm2 list $API_NAME
    echo ""
    echo "🎉 API reiniciada exitosamente"
    
    # Verificación adicional: que no haya EADDRINUSE en logs
    if tail -20 /root/.pm2/logs/${API_NAME}-error.log 2>/dev/null | grep -q "EADDRINUSE"; then
        echo "⚠️  ADVERTENCIA: Hay errores EADDRINUSE en logs"
    else
        echo "✅ Sin errores de puerto"
    fi
    
    exit 0
else
    echo "⚠️  ERROR: API no está online en PM2 (estado: $PM2_STATUS)"
    pm2 list $API_NAME
    exit 1
fi
