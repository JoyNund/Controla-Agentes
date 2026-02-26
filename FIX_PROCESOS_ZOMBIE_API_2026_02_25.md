# 🔧 FIX - PROCESOS ZOMBIE EN AGENTES-API

**Fecha:** 25 de Febrero, 2026
**Estado:** ✅ CORREGIDO CON SCRIPT

---

## 🐛 PROBLEMA DETECTADO

### Síntoma:
Cada vez que se ejecutaba `pm2 restart agentes-api`, se creaba un **nuevo proceso** sin matar el anterior, resultando en **múltiples procesos duplicados** corriendo simultáneamente.

### Evidencia:
```bash
# Después de un restart típico:
ps aux | grep "node /var/www/agentes/server/index.js" | grep -v grep

# Resultado (2 procesos):
root     3339614  3.0  1.0 11528428 81504 ?      Ssl  17:20   0:13 node /var/www/agentes/server/index.js
root     3345195 97.4  0.8 1036424 66500 ?       Rsl  17:27   0:01 node /var/www/agentes/server/index.js
```

### Impacto:
- ⚠️ **Consumo de memoria duplicado** (~160MB en lugar de ~80MB)
- ⚠️ **Puerto 3847 en conflicto** (a veces)
- ⚠️ **Comportamiento impredecible** (¿qué proceso responde las requests?)
- ⚠️ **Logs duplicados** en PM2

---

## 🔍 ANÁLISIS DE CAUSAS

### Causa raíz:
**PM2 no está matando completamente el proceso anterior** antes de iniciar el nuevo.

Esto puede deberse a:
1. **Proceso en estado "zombie"** - No responde a señales de terminación
2. **PM2 en modo "cluster"** - Crea workers adicionales automáticamente
3. **Señal SIGINT/SIGTERM ignorada** - El proceso no se entera que debe morir

### ¿Es el Hot Standby?

**NO.** El Hot Standby (`app.js`) es **UN SOLO PROCESO** que maneja **DOS sockets** internamente (PRIMARY + STANDBY). Eso es correcto y esperado.

El problema es **EXCLUSIVO de `agentes-api`** (`server/index.js`).

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Script de limpieza: `scripts/clean-restart-api.sh`

**Ubicación:** `/var/www/agentes/scripts/clean-restart-api.sh`

**Estrategia:**
1. **Detener PM2** primero (evita auto-revive)
2. **Matar procesos manualmente** con `kill -9`
3. **Liberar puerto** si está ocupado
4. **Delete en PM2** (nuclear option)
5. **Recrear desde cero**
6. **Verificar** que solo hay 1 proceso

**Código:**
```bash
#!/bin/bash
API_NAME="agentes-api"
API_FILE="/var/www/agentes/server/index.js"
PORT=3847

# 1. Detener en PM2 PRIMERO
pm2 stop $API_NAME
sleep 2

# 2. Matar TODOS los procesos
PIDS=$(ps aux | grep "node $API_FILE" | grep -v grep | awk '{print $2}')
for PID in $PIDS; do
    kill -9 $PID
done
sleep 2

# 3. Liberar puerto
PORT_PID=$(lsof -ti:$PORT)
if [ -n "$PORT_PID" ]; then
    kill -9 $PORT_PID
    sleep 2
fi

# 4. Delete en PM2
pm2 delete $API_NAME
sleep 1

# 5. Recrear desde cero
pm2 start server/index.js --name $API_NAME --update-env

# 6. Verificar (debe ser 1)
PROCESS_COUNT=$(ps aux | grep "node $API_FILE" | grep -v grep | wc -l)
if [ "$PROCESS_COUNT" -eq 1 ]; then
    echo "✅ CORRECTO"
else
    echo "⚠️ ERROR: Hay $PROCESS_COUNT procesos"
fi
```

---

## 📊 RESULTADOS

### Antes del fix:
```
Comando: pm2 restart agentes-api
Procesos después: 2-3 procesos duplicados
Memoria usada: ~160-240MB
Estado: ⚠️ INESTABLE
```

### Después del fix:
```
Comando: ./scripts/clean-restart-api.sh
Procesos después: 1 proceso
Memoria usada: ~80MB
Estado: ✅ ESTABLE
```

---

## 🔄 USO RECOMENDADO

### Para restarts normales:
```bash
# Usar el script en lugar de pm2 restart directo
cd /var/www/agentes
./scripts/clean-restart-api.sh
```

### Para verificar procesos:
```bash
# Ver procesos de API
ps aux | grep "node /var/www/agentes/server/index.js" | grep -v grep

# Debería mostrar SOLO 1 proceso
```

### Para cleanup manual (si el script falla):
```bash
# 1. Matar todos los procesos
pkill -9 -f "node /var/www/agentes/server/index.js"

# 2. Liberar puerto
lsof -ti:3847 | xargs kill -9

# 3. Delete en PM2
pm2 delete agentes-api

# 4. Iniciar limpio
cd /var/www/agentes
pm2 start server/index.js --name agentes-api --update-env
```

---

## 🛡️ PREVENCIÓN A LARGO PLAZO

### Opción 1: PM2 ecosystem file (RECOMENDADO)

Crear `/var/www/agentes/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'agentes-api',
    script: './server/index.js',
    instances: 1,  // Forzar 1 solo proceso
    exec_mode: 'fork',  // No cluster
    kill_timeout: 3000,  // Esperar 3s antes de kill -9
    force: true,  // Forzar restart si puerto ocupado
    env: {
      NODE_ENV: 'production',
      PORT: 3847
    }
  }]
}
```

**Uso:**
```bash
pm2 start ecosystem.config.js --only agentes-api
```

### Opción 2: Wrapper script

Crear `/var/www/agentes/restart-api.sh`:

```bash
#!/bin/bash
cd /var/www/agentes
./scripts/clean-restart-api.sh
```

**Uso:**
```bash
./restart-api.sh
```

### Opción 3: PM2 alias en .bashrc

Agregar a `~/.bashrc`:
```bash
alias restart-api='cd /var/www/agentes && ./scripts/clean-restart-api.sh'
```

**Uso:**
```bash
restart-api
```

---

## 📁 ARCHIVOS CREADOS

| Archivo | Propósito |
|---------|-----------|
| `scripts/clean-restart-api.sh` | Script de limpieza y restart |

---

## 🧪 TESTING

### Verificar que no hay duplicados:

```bash
# 1. Ejecutar restart
./scripts/clean-restart-api.sh

# 2. Ver procesos inmediatamente
ps aux | grep "node /var/www/agentes/server/index.js" | grep -v grep

# 3. Debería mostrar 1 proceso
# 4. Esperar 10 segundos y verificar de nuevo
# 5. Todavía debería haber 1 proceso
```

### Verificar API respondiendo:

```bash
curl http://localhost:3847/api/pagos | python3 -m json.tool | head -5
```

---

## ⚠️ ADVERTENCIAS

1. **NO usar `pm2 restart agentes-api` directamente** - Usar el script
2. **NO usar `pm2 start` sin delete previo** - Puede crear duplicados
3. **Siempre verificar después del restart** - `ps aux | grep agentes-api`

---

## 🔍 COMANDOS DE DIAGNÓSTICO

### Ver procesos duplicados:
```bash
ps aux | grep "node /var/www/agentes/server/index.js" | grep -v grep | wc -l
# Debería ser 1
```

### Ver puerto ocupado:
```bash
lsof -i:3847
# Debería mostrar 1 proceso
```

### Ver logs de PM2:
```bash
pm2 logs agentes-api --lines 50
```

### Ver estado en PM2:
```bash
pm2 list agentes-api
```

---

## 📝 NOTAS TÉCNICAS

### ¿Por qué PM2 no mata el proceso?

Posibles razones:
1. **Proceso bloqueado en I/O** - Esperando lectura/escritura
2. **Signal handler personalizado** - Ignora SIGTERM
3. **Child processes huérfanos** - PM2 pierde el track
4. **Race condition** - Start antes de que termine el stop

### Solución definitiva:

La única forma 100% confiable es:
1. `pm2 stop` (intento graceful)
2. `kill -9` (fuerza bruta)
3. `pm2 delete` (limpiar estado)
4. `pm2 start` (crear nuevo)

---

**Última actualización:** 25 de Febrero, 2026
**Responsable:** Asistente de IA
**Estado:** ✅ FUNCIONAL - Script probado y verificado
