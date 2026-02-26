# 📊 Avance Actual de Desarrollo - CONTROLA.agentes

**Fecha:** 21 de Febrero, 2026  
**Versión:** 1.0.0  
**Estado:** ✅ FUNCIONAL - En monitoreo de estabilidad

---

## 🎯 Estado Actual del Sistema

### **Instancias Activas**

| Nombre | ID | Estado | Teléfono | Sesión | Heartbeat |
|--------|-----|--------|----------|--------|-----------|
| **nuevooo** | `conn_1771700341570_k4fg` | ✅ `connected` | `51903172378` | ✅ Activa | ✅ Cada 30s |
| **every** | `conn_1771700517574_e3p2` | ❌ `disconnected` | `51933902835` | ⚠️ Inactiva | ❌ Detenido |

### **Resumen**
- **Total de instancias creadas:** 2
- **Instancias conectadas:** 1 (`nuevooo`)
- **Instancias desconectadas:** 1 (`every` - desvinculada desde celular)
- **Sesiones en caché:** 2 (1 activa, 1 inactiva)
- **QRs pendientes:** 0

### **Estado de Conexiones Verificado**

```
API REST (puerto 3847):
  ✅ nuevooo → connected
  ❌ every → disconnected

Bot Baileys (puerto 3848):
  ✅ conn_1771700341570_k4fg → connected=true
  ⚪ conn_1771700517574_e3p2 → sin instancia (correcto)

Sesiones en filesystem:
  ✅ bot_sessions/conn_1771700341570_k4fg/ → sesión válida
  ⚠️ bot_sessions/conn_1771700517574_e3p2/ → sesión inactiva (se limpia automáticamente)
```

---

## 🐛 Bug Monitoreado: "Pérdida de Conexión Espontánea"

### **Descripción del Bug Histórico**
- **Síntoma:** Las conexiones WhatsApp se perdían después de 2-6 horas sin actividad aparente
- **Manifestación:** El estado mostraba `connected=true` pero los mensajes no se procesaban
- **Causa Raíz Identificada:** Socket "zombie" - WebSocket interno desconectado pero estado reportado como activo

### **Posibles Causas Investigadas**
1. ✅ **Timeout de consultas** → Solucionado con `defaultQueryTimeoutMs: undefined`
2. ✅ **Listeners duplicados en reconexión** → Solucionado con cleanup explícito
3. ✅ **Falta de heartbeat** → Implementado monitoreo cada 30s
4. ✅ **Mensajes `append` ignorados** → Ahora se procesan correctamente
5. ⏳ **Estabilidad a largo plazo** → **EN MONITOREO**

### **Estado de Verificación**
- ✅ Conexión establecida correctamente
- ✅ Mensajes se procesan en tiempo real
- ✅ Heartbeat activo y reportando actividad
- ✅ Reconexión automática funciona (razón 500 → reconectado)
- ⏳ **Prueba de tiempo:** Esperando 6-12 horas para confirmar estabilidad

---

## 🔧 Mejoras Implementadas

### **1. Gestión de Sesiones Mejorada**

**Archivo:** `app.js`

```javascript
// ✅ Verificación de sesiones existentes antes de iniciar
const credsPath = path.join(sessionPath, 'creds.json')
if (fs.existsSync(credsPath) && creds.me?.id) {
    console.log(`📁 Sesión existente encontrada para ${creds.me.id}`)
    // Puede reconectar automáticamente sin QR
}

// ✅ Limpieza de QR anterior antes de generar nuevo
const oldQrPath = path.join(DATA_DIR, `qr_${connectionId}.png`)
if (fs.existsSync(oldQrPath)) fs.unlinkSync(oldQrPath)
```

**Beneficios:**
- Reanudación automática de sesiones válidas
- Sin QRs huérfanos acumulados
- Logs detallados de estado de sesión

---

### **2. Prevención de Procesos Duplicados**

**Archivo:** `app.js`

```javascript
// Flag global para tracking de reconexiones
const reconnectingConnections = new Map()

// En startBaileysConnection():
if (reconnectingConnections.get(connectionId)) {
    console.log(`⚠️ Reconexión ya en progreso, omitiendo...`)
    return { success: false, reason: 'reconnecting_in_progress' }
}

// Marcar como reconectando
reconnectingConnections.set(connectionId, true)

// Limpiar flag cuando conecta
if (connection === 'open') {
    reconnectingConnections.delete(connectionId)
}
```

**Beneficios:**
- Evita múltiples sockets para la misma conexión
- Previene corrupción de `creds.json` por escrituras simultáneas
- Reduce consumo de memoria

---

### **3. Delay Exponencial en Reconexiones**

**Archivo:** `app.js`

```javascript
// Reconectar con delay exponencial para evitar loops
const retryCount = (connectionConfig?.retryCount || 0) + 1
const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000) // Máx 30s

console.log(`Reintento #${retryCount} en ${delay}ms...`)

setTimeout(() => {
    reconnectingConnections.delete(connectionId)
    startBaileysConnection(connectionId, { ...connectionConfig, retryCount }, agentConfig)
}, delay)
```

**Secuencia de reintentos:**
- Intento 1: 1 segundo
- Intento 2: 2 segundos
- Intento 3: 4 segundos
- Intento 4: 8 segundos
- Intento 5+: 30 segundos (máximo)

**Beneficios:**
- Evita saturación de logs
- Da tiempo a que la red se estabilice
- Previene loops de reconexión infinitos

---

### **4. Manejo de Mensajes `append`**

**Archivo:** `app.js`

```javascript
// Tipos de mensajes Baileys:
// - notify: mensajes nuevos en tiempo real
// - append: mensajes agregados post-reconexión (historial reciente)  
// - history: historial inicial de sincronización

if (type !== 'notify' && type !== 'append') {
    console.log(`Ignorando tipo: ${type} (no es notify ni append)`)
    return
}

// Para tipo 'append', solo procesar si la conexión tiene >10s
// Esto evita procesar mensajes viejos durante reconexión inicial
if (type === 'append') {
    const timeSinceStart = Date.now() - (instance?.startedAt || Date.now())
    if (timeSinceStart < 10000) {
        console.log(`Skip append: conexión muy reciente (${timeSinceStart}ms)`)
        return
    }
}
```

**Beneficios:**
- Mensajes post-reconexión ya se procesan
- Evita duplicados durante reconexión temprana
- Mejora experiencia de usuario después de caída de red

---

### **5. Heartbeat con Detección de Sockets Zombie**

**Archivo:** `app.js`

```javascript
function startHeartbeat(connectionId) {
    const interval = setInterval(() => {
        const alive = isSocketAlive(currentInstance.sock)
        const timeSinceLastActivity = Date.now() - (currentInstance.lastHeartbeat || Date.now())

        // Si el socket no está vivo o no ha tenido actividad en 5 minutos
        if (!alive || timeSinceLastActivity > 5 * 60 * 1000) {
            console.error(`⚠️ SOCKET ZOMBIE DETECTADO`)
            
            // Forzar reconexión
            currentInstance.sock.end(undefined)
            cleanupSocketListeners(currentInstance.sock, connectionId)
            instances.delete(connectionId)
            
            // Reconectar automáticamente
            startBaileysConnection(connectionId, {}, agent)
        } else {
            console.log(`♥ Heartbeat OK (actividad: ${Math.floor(timeSinceLastActivity/1000)}s)`)
        }
    }, 30000) // Cada 30 segundos
}
```

**Función de verificación:**

```javascript
function isSocketAlive(sock) {
    if (!sock) return false
    // Verificar si el websocket está listo
    if (sock.ws && typeof sock.ws.isReady === 'function') {
        return sock.ws.isReady()
    }
    // Fallback: verificar credenciales de usuario
    if (sock.authState?.creds?.me) {
        return true
    }
    return !!sock.ev
}
```

**Beneficios:**
- Detección proactiva de sockets muertos
- Reconexión automática antes de que el usuario note el problema
- Monitoreo continuo de salud de conexión

---

### **6. Cleanup de Listeners**

**Archivo:** `app.js`

```javascript
function cleanupSocketListeners(sock, connectionId) {
    if (!sock || !sock.ev) return
    
    console.log(`Limpiando listeners del socket...`)
    try {
        sock.ev.removeAllListeners('messages.upsert')
        sock.ev.removeAllListeners('connection.update')
        sock.ev.removeAllListeners('creds.update')
        sock.ev.removeAllListeners('messaging-history.set')
        sock.ev.removeAllListeners('chats.upsert')
        sock.ev.removeAllListeners('chats.update')
        sock.ev.removeAllListeners('contacts.update')
        console.log(`Listeners limpiados correctamente`)
    } catch (error) {
        console.error(`Error limpiando listeners:`, error.message)
    }
}
```

**Uso en reconexión:**

```javascript
if (shouldReconnect) {
    // Limpiar listeners ANTES de crear nuevo socket
    cleanupSocketListeners(sock, connectionId)
    stopHeartbeat(connectionId)
    instances.delete(connectionId)
    
    // Delay exponencial
    setTimeout(() => {
        startBaileysConnection(...)
    }, delay)
}
```

**Beneficios:**
- Previene memory leaks
- Evita listeners duplicados
- Mejora estabilidad a largo plazo

---

### **7. Normalización de Números**

**Archivo:** `app.js`

```javascript
function normalizePhoneNumber(number) {
    if (!number) return ''
    // Remover @s.whatsapp.net o @lid
    let clean = number.split('@')[0]
    // Remover prefijo '+' si existe
    if (clean.startsWith('+')) {
        clean = clean.substring(1)
    }
    // Remover cualquier caracter no numérico
    clean = clean.replace(/\D/g, '')
    return clean
}
```

**Uso en mensajes:**

```javascript
// Extraer número limpio usando normalización
const senderNumber = normalizePhoneNumber(from)

// Normalizar también números bloqueados
const normalizedBlocked = blockedNumbers.map(n => normalizePhoneNumber(n))
if (normalizedBlocked.includes(senderNumber)) {
    console.log(`Número BLOQUEADO (${senderNumber}), ignorando.`)
    return
}
```

**Beneficios:**
- IDs con o sin `+` se manejan igual
- Comparación correcta con lista de bloqueados
- Previene falsos negativos en bloqueos

---

### **8. Detección de Inconsistencias API/Bot**

**Archivo:** `app.js`

```javascript
// En startPolling():
// INCONSISTENCIA DETECTADA: API dice "connected" pero bot no tiene instancia
if (conn.status === 'connected' && !instance) {
    console.warn(`⚠️ INCONSISTENCIA: API dice "connected" pero no hay instancia. Corrigiendo...`)
    // Cambiar a connecting para forzar reconexión
    axios.put(`${API_URL}/api/connections/${connectionId}`,
        { status: 'connecting' },
        apiHeaders
    ).catch(() => {})
    continue
}
```

**Beneficios:**
- Auto-corrección de estados inconsistentes
- Sincronización API ↔ Bot
- Previene "estados fantasma"

---

### **9. Timeout Indefinido**

**Archivo:** `app.js`

```javascript
const sock = makeWASocket({
    // ... otras configuraciones
    defaultQueryTimeoutMs: undefined,  // Timeout indefinido
    syncFullHistory: false,            // No sincronizar historial completo
    patchCaches: true,                 // Parchear caches para rendimiento
})
```

**Beneficios:**
- Previene congelamientos por timeout de consultas
- Mejora estabilidad en conexiones lentas

---

## 📁 Scripts Creados

### **`scripts/clean-start.sh`**

**Propósito:** Inicio limpio del bot, previene procesos duplicados y limpia sesiones corruptas.

**Funciones:**
1. Detecta y elimina procesos duplicados del bot
2. Libera puerto 3848 si está ocupado por proceso no válido
3. Limpia sesiones corruptas (sin `creds.me.id`)
4. Inicia bot con PM2
5. Verifica que esté online

**Uso:**
```bash
/var/www/agentes/scripts/clean-start.sh
```

**Output esperado:**
```
🧹 === LIMPIEZA INICIAL ===
📁 Verificando sesiones...
🚀 === INICIANDO BOT ===
✅ Bot iniciado exitosamente
📊 === ESTADO FINAL ===
```

---

### **`test-heartbeat.js`**

**Propósito:** Monitoreo en tiempo real del estado del bot y heartbeat.

**Uso:**
```bash
node /var/www/agentes/test-heartbeat.js
```

**Output:**
```
=== ESTADO DEL BOT ===
✅ Bot: ONLINE
📊 Instancias activas: 1
⏱️  Uptime: 208s

=== INSTANCIAS ===
📱 Conexión: conn_XXX
   Estado: ✅ CONECTADO
   Teléfono: 51903172378
```

---

## 🔍 Monitoreo Actual

### **Métricas en Tiempo Real**

```bash
# Ver estado del bot
curl -s http://localhost:3848/api/health | jq '.'

# Ver instancias activas
curl -s -X POST http://localhost:3848/api/command \
  -H "x-bot-token: TU_TOKEN" \
  -d '{"command":"status"}' | jq '.'

# Ver conexiones en API
curl -s http://localhost:3847/api/connections | jq '.'

# Ver logs en vivo
pm2 logs agentes-bot --lines 100

# Ver solo heartbeats
pm2 logs agentes-bot --lines 100 | grep "Heartbeat"
```

### **Checklist de Verificación**

- [x] Bot online en PM2
- [x] Instancia `nuevooo` conectada
- [x] Heartbeat activo (reporta cada 30s)
- [x] Mensajes se procesan
- [x] IA responde correctamente
- [x] Reconexión automática funciona
- [x] Sesiones se limpian al logout
- [ ] **Estabilidad >6 horas** ← EN MONITOREO

---

## 🎯 Próximos Pasos

### **Inmediatos**
1. ⏳ **Monitorear estabilidad** de conexión `nuevooo` por 6-12 horas
2. ⏳ **Verificar** que no haya pérdida espontánea de conexión
3. ⏳ **Confirmar** que heartbeats continúan después de horas de inactividad

### **Futuros (si el bug persiste)**
1. Implementar file locking para escritura de `creds.json`
2. Agregar reconexión por evento `connection.updating`
3. Mejorar logs de errores de WebSocket
4. Considerar migración a WhatsApp Business API si problemas continúan

---

## 📝 Notas de la Sesión

### **Problemas Resueltos**
1. ✅ Mensajes `append` ignorados post-reconexión
2. ✅ Procesos duplicados en PM2
3. ✅ Sesiones corruptas por reconexiones simultáneas
4. ✅ QRs huérfanos acumulados
5. ✅ Estados inconsistentes API/Bot
6. ✅ Números con `+` no se manejaban correctamente

### **Técnicas Implementadas**
- Flag de reconexión para prevenir duplicados
- Delay exponencial en reintentos
- Cleanup explícito de listeners
- Heartbeat con detección de zombies
- Normalización de números de teléfono
- Auto-corrección de inconsistencias

### **Archivos Modificados**
- `app.js` (+400 líneas agregadas)
- `scripts/clean-start.sh` (nuevo)
- `test-heartbeat.js` (nuevo)

### **Archivos sin Cambios**
- `server/index.js` (API estable)
- `services/agenteIA.js` (IA funciona correctamente)
- `webapp/` (frontend estable)

---

## 📊 Conclusión

El sistema está **funcional y estable** en este momento. Las mejoras implementadas abordan las causas raíz identificadas del bug de pérdida de conexión. 

**Próximo hito crítico:** Confirmar que la conexión `nuevooo` se mantiene estable después de 6-12 horas de operación continua, incluyendo períodos de inactividad.

**Fecha de inicio de monitoreo:** 21 de Febrero, 2026 - 19:00 (hora local)  
**Fecha de verificación:** 22 de Febrero, 2026 - 07:00 (hora local)

---

**Última actualización:** 21 de Febrero, 2026 - 20:30  
**Estado:** ✅ FUNCIONAL - En monitoreo de estabilidad a largo plazo

---

## 🆕 Mejoras Recientes (20:30)

### **Monitor de Chats Mejorado**

#### **1. Delete Real de Conversaciones**
- ✅ Backend: Ahora usa `conversations.delete()` del store correctamente
- ✅ Frontend: Refresca la lista desde el servidor después de eliminar
- ✅ Manejo de errores con alertas al usuario
- ✅ Cierra el detalle si la conversación eliminada estaba seleccionada

**Código backend (`server/index.js`):**
```javascript
app.delete('/api/conversations/:id', requireAuth, (req, res) => {
    const { conversations } = require('./store')
    const deleted = conversations.delete(id)
    if (deleted) {
        res.json({ ok: true, message: 'Conversación eliminada' })
    }
})
```

#### **2. Dropdown para Filtrar por Conexión**
- ✅ Nuevo dropdown arriba del historial de chats
- ✅ Permite seleccionar: "Todas las conexiones" o una conexión específica
- ✅ Muestra nombre de conexión y número de teléfono
- ✅ Filtra conversaciones en tiempo real
- ✅ Botón "X" para volver a mostrar todas

**UI:**
```jsx
<select value={selectedConnection} onChange={...}>
    <option value="all">Todas las conexiones</option>
    {allConnections.map(conn => (
        <option key={conn.id} value={conn.id}>
            {conn.name} ({conn.phoneNumber || 'Sin número'})
        </option>
    ))}
</select>
```

**Filtrado:**
```javascript
const loadConversations = async () => {
    let conversations = await conversationsApi.list()
    
    if (selectedConnection !== 'all') {
        const conn = allConnections.find(c => c.id === selectedConnection)
        if (conn?.phoneNumber) {
            conversations = conversations.filter(c => {
                const convNumber = c.id?.split('@')[0]
                return convNumber === conn.phoneNumber
            })
        }
    }
    setList(conversations)
}
```

#### **3. API Nueva: Conversaciones por Conexión**
```javascript
app.get('/api/conversations/by-connection/:connectionId', requireAuth, ...)
```
- Endpoint opcional para filtrar desde el backend
- Útil para grandes volúmenes de conversaciones

---
