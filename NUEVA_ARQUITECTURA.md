# Nueva Arquitectura de Conexiones - Febrero 20, 2026

## 🎯 Cambio Fundamental

**ANTES (incorrecto):**
- 1 Agente = 1 Conexión
- El agente y la conexión estaban acoplados
- No se podían tener múltiples dispositivos con el mismo agente

**AHORA (correcto):**
- **Agente** = Plantilla de comportamiento (configuración de IA, prompts, base de conocimiento)
- **Conexión** = Dispositivo WhatsApp vinculado (número de teléfono real)
- **Relación**: N conexiones pueden usar M agentes (muchos-a-muchos)

## 📊 Estructura de Datos

### Agente (`agents.json`)
```json
{
  "id": "ag_1770876627427_3rxa1w",
  "name": "CONTROLA AI",
  "systemPrompt": "...",
  "knowledgeBase": "...",
  "motor": "deepseek",
  "apiKey": "sk-..."
}
```

### Conexión (`connections.json`)
```json
{
  "conn_CONTROLA_1": {
    "id": "conn_CONTROLA_1",
    "name": "WhatsApp CONTROLA Principal",
    "status": "connected",
    "agentId": "ag_1770876627427_3rxa1w",  // ← Referencia al agente
    "phoneNumber": "51936956306",
    "logs": [],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

## 🔧 Nuevas Funcionalidades

### 1. **Verificación de Estado REAL**
- El estado ya no es solo el guardado en DB
- Se verifica si hay sesión real de Baileys (`creds.json`)
- Se detecta cuando el usuario cierra sesión desde el celular

### 2. **Gestión Independiente de Conexiones**
- Crear conexiones sin agente
- Asignar/cambiar agente en cualquier momento
- Eliminar conexiones completamente (desvincula + borra)

### 3. **Logout Correcto**
- Valida si hay sesión activa antes de intentar logout
- Limpia sesión de Baileys completamente
- Actualiza estado real en DB

### 4. **Desvincular/Eliminar**
- Botón "Eliminar Conexión" en UI
- Notifica al bot para limpiar sesión
- Borra de la DB permanentemente

## 🛠️ Endpoints Nuevos

### Conexiones
```
GET    /api/connections              - Listar todas
GET    /api/connections/:id          - Obtener una
POST   /api/connections              - Crear nueva
PUT    /api/connections/:id          - Actualizar (nombre, agente)
DELETE /api/connections/:id          - Eliminar completamente
POST   /api/connections/:id/assign-agent - Asignar agente
POST   /api/connections/:id/logout   - Cerrar sesión (desvincular)
POST   /api/connections/:id/restart  - Reiniciar conexión
GET    /api/connections/:id/logs     - Obtener logs
GET    /api/connections/:id/qr       - Obtener QR
```

### Bot Command Server (puerto 3848)
```
POST   /api/command  - logout, restart, delete, status
GET    /api/health   - Estado del bot
```

## 🖥️ UI Actualizada

### Página de Conexiones
- **Tarjetas por conexión** (no por agente)
- Botón "+ Nueva Conexión"
- Selector de agente dentro de cada conexión
- Botón "Eliminar Conexión" (rojo)
- Estado real verificado

### Flujo de Uso
1. Click en "+ Nueva Conexión"
2. Poner nombre (ej: "Ventas 1", "Soporte")
3. Opcional: asignar agente inicial
4. Click en "Encender" en la tarjeta
5. Escanear QR
6. Listo ✅

## 🔄 Migración Realizada

### Archivos Actualizados
1. **app.js** - Refactorizado completamente
   - `instances` Map usa `connectionId` (no `agentId`)
   - `checkRealConnectionStatus()` verifica sesión real
   - `deleteConnection()` elimina completamente

2. **server/store.js** - Nueva estructura de connections
   - `create()`, `delete()`, `assignAgent()`, `updateStatus()`

3. **server/index.js** - Nuevos endpoints
   - CRUD completo para conexiones
   - Logout con validación de estado real

4. **webapp/src/api.js** - `connectionsApi` nuevo

5. **webapp/src/pages/Conexion.jsx** - UI renovada
   - Modal para crear conexión
   - Tarjetas independientes
   - Selector de agente por conexión

### Datos Migrados
- `connections.json`: Nueva estructura con `conn_CONTROLA_1`
- `bot_sessions/`: Directorio renombrado a `conn_CONTROLA_1`

## ✅ Problemas Solucionados

| # | Problema | Solución |
|---|----------|----------|
| 1 | Estado mostrado ≠ estado real | Verificación de `creds.json` y sesión Baileys |
| 2 | Logout fallaba si ya estaba cerrado | Validación previa de estado |
| 3 | No se podía eliminar conexión | Nuevo endpoint `DELETE /api/connections/:id` |
| 4 | Agente = Conexión (incorrecto) | Separación completa de conceptos |
| 5 | No se podía reusar agente | Ahora N conexiones pueden usar M agentes |

## 🚀 Cómo Probar

### 1. Crear Nueva Conexión
```bash
curl -X POST http://localhost:3847/api/connections \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"name":"Ventas 2","agentId":"ag_1770876627427_3rxa1w"}'
```

### 2. Asignar Agente
```bash
curl -X POST http://localhost:3847/api/connections/conn_CONTROLA_1/assign-agent \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"agentId":"ag_1770876627427_3rxa1w"}'
```

### 3. Logout (Desvincular)
```bash
curl -X POST http://localhost:3847/api/connections/conn_CONTROLA_1/logout \
  -H "Cookie: session=..."
```

### 4. Eliminar Conexión
```bash
curl -X DELETE http://localhost:3847/api/connections/conn_CONTROLA_1 \
  -H "Cookie: session=..."
```

## 📝 Notas Importantes

1. **Sesiones de Baileys**: Se guardan en `bot_sessions/{connectionId}/`
2. **QR Codes**: Se guardan en `server/data/qr_{connectionId}.png`
3. **Estado Real**: Se verifica cada 5s en el polling
4. **Auth Required**: Todos los endpoints de conexiones requieren autenticación

## 🎯 Siguientes Pasos Recomendados

1. **Testear flujo completo**: Crear conexión → Encender → QR → Conversar → Logout → Eliminar
2. **Verificar estado real**: Cerrar sesión desde el celular y ver si la UI lo detecta
3. **Probar múltiples conexiones**: Crear 2-3 conexiones con el mismo agente
4. **Monitor de chats**: Actualizar para mostrar conexión de origen
