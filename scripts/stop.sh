#!/bin/bash

echo "🛑 Deteniendo servicios de Controla.Agentes..."

# Función para matar procesos por patrón
kill_pattern() {
    local pattern=$1
    local pids=$(pgrep -f "$pattern" 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "   Deteniendo: $pattern (PIDs: $pids)"
        kill -15 $pids 2>/dev/null  # SIGTERM primero para graceful shutdown
        sleep 2
        # Si aún existen, forzar
        pids=$(pgrep -f "$pattern" 2>/dev/null)
        if [ -n "$pids" ]; then
            echo "   Forzando: $pattern"
            kill -9 $pids 2>/dev/null
        fi
    fi
}

# Matar procesos específicos
kill_pattern "node /var/www/agentes/app.js"
kill_pattern "node /var/www/agentes/server/index.js"
kill_pattern "node /var/www/agentes"

# Matar procesos en los puertos
for port in 3847 3848; do
    pid=$(lsof -t -i:$port 2>/dev/null | head -1)
    if [ -n "$pid" ]; then
        echo "   Liberando puerto $port (PID: $pid)"
        kill -9 $pid 2>/dev/null
    fi
done

# Esperar
sleep 2

# Verificar
if pgrep -f "node /var/www/agentes" > /dev/null 2>&1; then
    echo "❌ Algunos procesos no se pudieron detener:"
    ps aux | grep "node /var/www/agentes" | grep -v grep
else
    echo "✅ Todos los servicios detenidos correctamente"
fi

# Verificar puertos
if lsof -i:3847 -i:3848 2>/dev/null | grep -q LISTEN; then
    echo "⚠️  Puertos aún ocupados:"
    lsof -i:3847 -i:3848 2>/dev/null
else
    echo "✅ Puertos liberados"
fi
