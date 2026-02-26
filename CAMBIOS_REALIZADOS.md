# Cambios Realizados - Febrero 20, 2026

## Problemas Identificados y Solucionados

### 1. **Gestión de Sesiones por Agente** ✅
**Problema:** Las sesiones se reutilizaban entre reinicios, impidiendo mostrar el QR nuevamente.
**Solución:** 
- Cada agente ahora tiene su propio directorio de sesión: `bot_sessions/{agentId}/`
- Se implementó `clearAgentSession()` para limpiar completamente la sesión
- El logout ahora elimina todo el directorio de sesión del agente

### 2. **Recepción de Mensajes** ✅
**Problema:** Los mensajes no se procesaban correctamente.
**Solución:**
- Mejorado el evento `message` del provider para inyectar `agentId` y `agentConfig` en cada mensaje
- Agregados logs detallados para debuggear el flujo de mensajes
- El contexto de conversación ahora se recupera de la API antes de llamar a la IA

### 3. **Contexto de Conversación para IA** ✅
**Problema:** La IA solo recibía el mensaje actual, sin contexto de la conversación.
**Solución:**
- Implementada función `getConversationContext(from, limit)` que recupera los últimos 10 mensajes
- La IA ahora recibe el historial como contexto en el system prompt
- Mejor manejo de la conversación en `agenteIA.js`

### 4. **Polling de Conexiones** ✅
**Problema:** El polling intentaba reconectar instancias ya conectadas.
**Solución:**
- Verificación `if (instance.connected) return` para evitar reconexiones innecesarias
- Detección de cambios de estado para no procesar lo mismo múltiples veces
- Estados claros: `disconnected`, `connecting`, `connected`, `restart`

### 5. **Logout y Restart por Agente** ✅
**Problema:** No había forma de forzar un logout limpio desde la UI.
**Solución:**
- Endpoint API: `POST /api/connection/logout` - Limpia sesión y notifica al bot
- Endpoint API: `POST /api/connection/restart` - Reinicia la conexión
- Comando HTTP server en el bot para recibir comandos externos

### 6. **UI de Conexiones** ✅
**Problema:** Una sola tarjeta de conexión para todos los agentes.
**Solución:**
- Tarjetas individuales por agente en la página de Conexiones
- Botones de acción por agente: Encender, Reiniciar, Cerrar Sesión, Detener
- Panel detallado al seleccionar un agente específico
- Logs en tiempo tiempo por agente

## Archivos Modificados

### Backend
1. **app.js** - Refactorizado completamente
   - Gestión de instancias por agente
   - Limpieza de sesiones
   - Comando HTTP server
   - Mejor logging

2. **server/index.js** - Nuevos endpoints
   - `POST /api/connection/logout`
   - `POST /api/connection/restart`

3. **services/agenteIA.js** - Mejor manejo de contexto
   - Historial de conversación en system prompt
   - Logs detallados de llamadas a API
   - Manejo de errores específico

### Frontend
4. **webapp/src/pages/Conexion.jsx** - UI renovada
   - Tarjetas por agente
   - Controles individuales
   - Panel detallado por agente

5. **webapp/src/api.js** - Nuevos métodos
   - `connectionApi.getAll()`
   - `connectionApi.logout(agentId)`
   - `connectionApi.restart(agentId)`

### Utilidades
6. **scripts/clean-sessions.js** - Script de limpieza
   - `node scripts/clean-sessions.js [agentId]`
   - `node scripts/clean-sessions.js --all`

## Cómo Probar el Flujo Completo

### 1. Limpiar Sesiones Existentes
```bash
cd /var/www/agentes
node scripts/clean-sessions.js --all
```

### 2. Iniciar Servidores (en orden)

**Terminal 1 - API + Web App:**
```bash
npm run server
```
Debería mostrar: `CONTROLA.agentes API en http://localhost:3847`

**Terminal 2 - Bot de WhatsApp:**
```bash
npm start
```
Debería mostrar:
```
🚀 === INICIANDO ORQUESTADOR DE BOTS ===
🤖 Bot Command Server en puerto 3848
✅ Orquestador listo. Esperando conexiones...
```

### 3. Probar Conexión desde la Web

1. Abre http://localhost:3847 (o tu dominio)
2. Login: `admin@controla.digital` / `admin123`
3. Ve a **Conexión**
4. Deberías ver tarjetas por agente
5. Selecciona un agente y haz clic en **Encender**
6. El QR debería aparecer después de unos segundos
7. Escanea el QR con WhatsApp
8. Debería cambiar a **CONECTADO**

### 4. Probar Recepción de Mensajes

1. Envía un mensaje desde WhatsApp al número vinculado
2. Revisa los logs en la página de Conexión
3. Deberías ver:
   - `=== NUEVO MENSAJE ===`
   - `=== EVENTO MESSAGE CAPTURADO ===`
   - `Llamando a responderConIA...`
   - `Respuesta IA: ...`
4. La respuesta debería llegar a WhatsApp

### 5. Probar Contexto de Conversación

1. Envía varios mensajes consecutivos
2. Revisa si la IA responde con contexto
3. Ejemplo:
   - Usuario: "¿Qué servicios ofrecen?"
   - Bot: "Ofrecemos páginas web, tiendas online..."
   - Usuario: "¿Cuánto cuesta?"
   - Bot: (debería entender que te refieres a los servicios mencionados)

### 6. Probar Logout

1. En la web, ve a Conexión
2. Selecciona un agente conectado
3. Haz clic en **Cerrar Sesión**
4. Confirma el logout
5. La sesión debería limpiarse
6. El estado cambia a **DESCONECTADO**
7. Para volver a conectar, necesitarás escanear QR nuevamente

## Posibles Problemas y Soluciones

### QR no aparece
- Verifica que la sesión esté limpia: `node scripts/clean-sessions.js [agentId]`
- Revisa los logs del bot en busca de errores
- Asegúrate de que el estado sea `connecting`

### Mensajes no se procesan
- Revisa logs del bot: debe decir `=== EVENTO MESSAGE CAPTURADO ===`
- Verifica que la API Key de Deepseek esté configurada
- Revisa `services/agenteIA.js` logs para errores de API

### IA responde con error
- Verifica `DEEPSEEK_API_KEY` en `.env`
- Revisa logs de `agenteIA.js` para ver respuesta de la API
- Puede ser timeout o límite de rate

### Sesión no se limpia
- Ejecuta `node scripts/clean-sessions.js [agentId]` manualmente
- Reinicia el bot después de limpiar

## Métricas de Éxito

- ✅ QR se genera y muestra correctamente
- ✅ Escaneo de QR conecta exitosamente
- ✅ Mensajes entrantes se capturan y procesan
- ✅ IA responde con contexto de conversación
- ✅ Logout limpia sesión completamente
- ✅ Múltiples agentes pueden coexistir sin conflictos
