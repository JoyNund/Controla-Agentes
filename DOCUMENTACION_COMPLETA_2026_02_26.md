# 📚 DOCUMENTACIÓN COMPLETA - CONTROLA.agentes

**Fecha:** 26 de Febrero, 2026  
**Versión:** 2.5.0  
**Ubicación:** `/var/www/agentes`

---

## 🏗️ ARQUITECTURA DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLA.agentes v2.5.0                      │
│         Sistema Multi-Agente de IA para WhatsApp                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WEB APP (React + Vite + DaisyUI) → :3847              │   │
│  │  - Gestión de Agentes (plantillas de IA)                │   │
│  │  - Gestión de Conexiones (dispositivos WhatsApp)        │   │
│  │  - Monitor de Chats en tiempo real                      │   │
│  │  - Catálogo Multimedia                                  │   │
│  │  - Gestión de Pagos (OCR)                               │   │
│  │  - Gestión de Citas                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API REST (Express + Session) → :3847/api              │   │
│  │  - CRUD Agentes, Conexiones, Conversaciones             │   │
│  │  - Endpoints Multimedia (/api/agents/:id/media)         │   │
│  │  - Endpoints Pagos (/api/pagos/*)                       │   │
│  │  - Endpoints Citas (/api/citas/*)                       │   │
│  │  - Autenticación Qwen OAuth                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  BOT ORCHESTRATOR (app.js) → Puerto 3848               │   │
│  │  - Baileys 7.x con HOT STANDBY (dual socket)            │   │
│  │  - Multi-instancias por conexión                        │   │
│  │  - Message Queue + Recovery                             │   │
│  │  - Heartbeat monitoring (15s/20s)                       │   │
│  │  - Failover automático < 5 segundos                     │   │
│  │  - Sistema OCR de pagos integrado                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  IA SERVICE (services/agenteIA.js)                     │   │
│  │  - Multi-motor: Deepseek, OpenAI, Qwen, Gemini, Llama   │   │
│  │  - Contexto de conversación (últimos 10 mensajes)       │   │
│  │  - Generación de respuestas con temperatura ajustable   │   │
│  │  - Soporte para imágenes (visión por computadora)       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
/var/www/agentes/
├── app.js                          # Bot orchestrator principal (Baileys + OCR)
├── server/
│   ├── index.js                    # API REST Express
│   ├── data/                       # JSON database
│   │   ├── agents.json             # Configuración de agentes
│   │   ├── connections.json        # Conexiones WhatsApp
│   │   ├── conversations.json      # Historial de chats
│   │   ├── payments.json           # Pagos procesados (OCR)
│   │   ├── appointments.json       # Citas agendadas
│   │   └── settings.json           # Configuración global + feature flags
│   └── services/
│       ├── agenteIA.js             # Servicio de IA multi-motor
│       ├── ocrService.js           # Servicio OCR de pagos
│       └── citasService.js         # Servicio de gestión de citas
├── webapp/                         # Frontend React + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Agentes.jsx         # Gestión de agentes
│   │   │   ├── Conexiones.jsx      # Gestión de conexiones
│   │   │   ├── Monitor.jsx         # Monitor de chats
│   │   │   ├── Pagos.jsx           # CRUD de pagos
│   │   │   ├── Citas.jsx           # CRUD de citas
│   │   │   └── Configuraciones.jsx # Settings globales
│   │   └── components/
│   │       ├── KeywordModal.jsx    # Modal de seguridad
│   │       ├── AgentConfigAssistant.jsx # Asistente IA
│   │       └── PagoModal.jsx       # Modal de detalle de pago
│   └── dist/                       # Build de producción
├── bot_sessions/                   # Sesiones WhatsApp por conexión
│   └── {connectionId}/
│       ├── creds.json              # Credenciales encriptadas
│       └── pre-key-*.json          # Pre-keys para cifrado
├── media/
│   └── pagos/                      # Comprobantes OCR organizados
│       └── {telefono}/
│           └── {timestamp}.jpg     # Imagen del comprobante
├── recuperacion/
│   ├── backups/                    # Backups automáticos
│   └── recuperar.sh                # Script de restauración
└── logs/                           # Logs de PM2
```

---

## 🔐 SISTEMA DE SEGURIDAD - PALABRAS CLAVE

### Descripción
Sistema de autenticación basado en palabras clave ofuscadas (HEX) para acciones críticas.

### Acciones Protegidas
- ✅ Crear/Editar/Eliminar Agentes
- ✅ Crear Conexiones
- ✅ Asignar Agente a Conexión
- ✅ Logout/Restart/Delete Conexión

### Configuración
```json
// server/data/settings.json
{
  "security": {
    "keywords": {
      "master": "John0306"  // Master Keyword global
    }
  }
}
```

### Keywords por Elemento
| Tipo | Nombre | Keyword |
|------|--------|---------|
| Agente | CONTROLA | `John0306` |
| Agente | Anandara | `Holistic` |
| Agente | Lethal | `JAzz` |
| Conexión | nuevooo | `John0306` |
| Conexión | every | `Cata` |
| Conexión | anandara | `Holistic` |

### Flujo de Validación
1. Usuario realiza acción crítica → Modal solicita keyword
2. Frontend ofusca keyword a HEX
3. Backend compara con valor almacenado
4. Si coincide → ejecuta acción, si no → rechaza

---

## 🔄 HOT STANDBY - FAILOVER AUTOMÁTICO

### Descripción
Cada conexión WhatsApp tiene 2 sockets simultáneos:
- **PRIMARY**: Socket activo que maneja mensajes
- **STANDBY**: Socket en espera para failover

### Características
- **Heartbeat**: Ping cada 15s (primary) y 20s (standby)
- **Detección de caída**: 3 fallos consecutivos → trigger failover
- **Tiempo de failover**: < 5 segundos
- **Message Queue**: Mensajes en cola durante failover se recuperan
- **Recuperación automática**: Socket caído se reconecta solo

### Estados del Socket
```javascript
{
  connectionId: "conn_XXX",
  primary: {
    status: "connected",
    lastPing: 1234567890,
    failoverCount: 0
  },
  standby: {
    status: "connected",
    lastPing: 1234567890
  }
}
```

### Comandos de Monitoreo
```bash
# Ver estado de conexiones
curl http://localhost:3848/api/health | python3 -m json.tool

# Ver failovers en logs
pm2 logs agentes-bot | grep -i failover

# Ver heartbeats
pm2 logs agentes-bot | grep -E "Ping OK|Standby OK"
```

---

## 🤖 MULTI-MOTOR DE IA

### Motores Soportados
| Motor | Modelos | Configuración |
|-------|---------|---------------|
| **Deepseek** | `deepseek-chat`, `deepseek-coder` | API Key requerida |
| **OpenAI** | `gpt-4o`, `gpt-3.5-turbo`, `gpt-4-turbo` | API Key requerida |
| **Qwen** | `qwen-max`, `qwen-plus` | OAuth (sin API Key) |
| **Gemini** | `gemini-1.5-pro`, `gemini-1.5-flash` | API Key requerida |
| **Llama** | `llama-3-70b`, `llama-3-8b` | API Key (Groq/Together) |
| **Custom** | Cualquier modelo compatible OpenAI | URL + API Key |

### Configuración por Agente
```json
{
  "id": "agent_XXX",
  "name": "CONTROLA",
  "motor": "deepseek",
  "model": "deepseek-chat",
  "apiKey": "sk-...",  // Enmascarada en frontend
  "temperature": 0.7,
  "systemPrompt": "Eres un asistente de ventas...",
  "knowledgeBase": "Protocolo de atención...",
  "rules": {
    "saludoInicial": "¡Hola! ¿En qué puedo ayudarte?"
  },
  "objections": [
    "Si el cliente dice: \"Es muy caro\", respondes: \"Entiendo tu preocupación...\""
  ]
}
```

### Contexto de Conversación
- Últimos **10 mensajes** se envían como contexto
- Historial almacenado en `conversations.json`
- Limpieza automática de conversaciones antiguas (> 7 días)

---

## 📸 SISTEMA OCR DE PAGOS

### Descripción
Servicio permanente que procesa imágenes en segundo plano usando Tesseract.js para detectar comprobantes de pago.

### Feature Flag
```json
// server/data/settings.json
{
  "features": {
    "ocrPagos": true,
    "gestionCitas": true
  }
}
```

### Patrones de Detección

#### 1. Bancos y Entidades
```javascript
bcp, bbva, interbank, scotiabank, banco de la nación, banbif,
izipay, izi pay, tunki, pagoefectivo, pago efectivo
```

#### 2. Apps de Pago
```javascript
yape, plin, bim, nequi, momo, cash, wallet, billetera,
yapeaste, yapeé, plinaste, pliné, yapeando, plineando
```

#### 3. Términos de Transacción (40+ palabras)
```javascript
transferencia, depósito, abono, pago, enviaste, recibió,
transacción, compra, venta, cancelado, saldo, operación,
codigo, referencia, destino, origen, fecha, hora,
cajero, agente, voucher, comprobante, recibo, exitoso
```

#### 4. Monedas
```javascript
s/, s/., soles, sol, pen, usd, $, dólares, eur, €, euros
```

#### 5. Patrones de Montos (Regex)
```javascript
/[\d,]+\.\d{2}/           // 150.00, 1,250.00
/\d+\.\d+/                // 150.5, 20.0
/\d+\s*(soles|dolares)/i  // 150 soles, 20 usd
/s\/?\s*\d+/              // S/ 150, S150
/\$\s*\d+/                // $ 150, $150
/s\/?\s*\*+\s*\d+\.?\d*/i // S/ ****16.20 (asteriscos OCR)
/[sS]\/?\s*[XxKk¥$*]+\s*\d+\.?\d*/ // S/ X¥KKXKK16.20 (artefactos OCR)
```

#### 6. Yape/Plin Específico
```javascript
yapeaste, yapeé, plinaste, pliné,
nro celular, recibiste un yape, yape recibido,
datos de la transaccion, qr, código qr, escanear
```

### Flujo de Procesamiento
1. **Recepción**: Cliente envía imagen por WhatsApp
2. **Encolado**: Imagen se agrega a cola de OCR
3. **OCR**: Tesseract.js extrae texto (spa)
4. **Análisis**: Busca patrones en texto extraído
5. **Puntaje**: 
   - Banco: +20 pts
   - App de pago: +25 pts
   - Yape/Plin: +30 pts
   - Término transacción: +15 pts (máx 60)
   - Moneda: +30 pts
   - **Umbral mínimo**: 60 pts con monto > 0
6. **Acción**:
   - ✅ **Es pago**: Guarda en `payments.json`, organiza en `/media/pagos/{telefono}/`
   - ❌ **No es pago**: Limpia imagen, responde al cliente

### Respuesta al Cliente
```
📸 *Imagen recibida*

No reconozco esta imagen como un comprobante de pago.

Si es un pago, por favor asegurate de que se vea:
• El monto (ej: S/ 50)
• El banco (Yape, Plin, BCP, etc.)
• El código de operación

¿Es un comprobante de pago? Si es así, volvé a enviarla.
```

### Organización de Archivos
```
/media/pagos/
└── 51987654321/
    ├── 1708912345678.jpg  # Comprobante 1
    └── 1708912345679.jpg  # Comprobante 2
```

### Endpoints API
```javascript
GET    /api/pagos              // Listar todos los pagos
GET    /api/pagos/:id          // Detalle de pago
POST   /api/pagos              // Crear pago manual
PUT    /api/pagos/:id          // Actualizar pago
DELETE /api/pagos/:id          // Eliminar pago
GET    /api/pagos/cliente/:tel // Pagos por cliente
```

---

## 📅 GESTIÓN DE CITAS

### Descripción
Sistema de agendamiento de citas/reuniones directamente desde el chat.

### Estructura de Cita
```json
{
  "id": "appt_XXX",
  "cliente": {
    "nombre": "Juan Pérez",
    "telefono": "51987654321"
  },
  "fecha": "2026-02-27",
  "hora": "15:00",
  "duracion": 60,  // minutos
  "tipo": "Presencial | Virtual",
  "servicio": "Asesoría",
  "notas": "Primera consulta",
  "estado": "confirmada | cancelada | completada",
  "agenteId": "agent_XXX",
  "connectionId": "conn_XXX",
  "createdAt": 1708912345678
}
```

### Endpoints API
```javascript
GET    /api/citas              // Listar todas las citas
GET    /api/citas/:id          // Detalle de cita
POST   /api/citas              // Crear cita
PUT    /api/citas/:id          // Actualizar cita
DELETE /api/citas/:id          // Eliminar cita
GET    /api/citas/cliente/:tel // Citas por cliente
GET    /api/citas/hoy          // Citas del día
GET    /api/citas/proximanas   // Próximas citas (7 días)
```

### Comandos en Chat
El agente puede:
- **Agendar**: "Quiero agendar una cita para el viernes a las 3pm"
- **Cancelar**: "Necesito cancelar mi cita del viernes"
- **Reprogramar**: "¿Podemos mover mi cita para el lunes?"
- **Consultar**: "¿Qué citas tengo esta semana?"

---

## 🎭 CAPACIDADES POR AGENTE

### Descripción
Cada agente tiene capacidades activables/desactivables individualmente.

### Configuración
```json
{
  "id": "agent_XXX",
  "name": "CONTROLA",
  "capabilities": {
    "procesarPagos": true,   // Requiere plan de pago
    "agendarCitas": true     // Requiere plan de pago
  },
  "enableSmartMedia": true   // Envío inteligente de imágenes
}
```

### Default para Nuevos Agentes
```json
{
  "procesarPagos": false,  // Deshabilitado por defecto
  "agendarCitas": false    // Deshabilitado por defecto
}
```

### UI en Frontend
- Switches tipo toggle en `/agentes` (edición de agente)
- Indicador "💎 Requiere plan de pago"
- Feedback visual: ✅ Habilitado / ⚠️ Deshabilitado

### Validación Backend
Antes de procesar OCR o agendar cita:
```javascript
if (!agent.capabilities?.procesarPagos) {
    throw new Error('Agente no tiene capacidad para procesar pagos')
}
```

---

## 🖼️ CATÁLOGO MULTIMEDIA

### Descripción
Sistema de gestión de archivos multimedia (imágenes, videos, documentos) asociados a agentes.

### Estructura de Item
```json
{
  "id": "media_XXX",
  "agentId": "agent_XXX",
  "title": "Producto Destacado",
  "description": "Descripción del producto",
  "category": "general | promocion | destacado",
  "price": "150.00",
  "tags": ["producto", "oferta"],
  "fileUrl": "/media/agents/agent_XXX/item_XXX.jpg",
  "fileType": "image | video | document",
  "createdAt": 1708912345678
}
```

### Envío Inteligente (Smart Media)
Cuando `enableSmartMedia: true`:
1. IA analiza contexto del chat
2. Si detecta oportunidad de venta → sugiere imagen del catálogo
3. Usuario puede aprobar o rechazar envío
4. Imagen se envía con mensaje contextual

### Endpoints API
```javascript
GET    /api/agents/:id/media           // Listar multimedia
POST   /api/agents/:id/media           // Subir archivo
DELETE /api/agents/:id/media/:itemId   // Eliminar archivo
```

---

## 🛠️ COMANDOS ÚTILES

### PM2 - Gestión de Procesos
```bash
# Reiniciar bot
pm2 restart agentes-bot

# Reiniciar frontend
pm2 restart agentes-web

# Ver estado
pm2 list

# Ver logs en tiempo real
pm2 logs agentes-bot --lines 50

# Ver logs de OCR
pm2 logs agentes-bot | grep -i "ocr"

# Monitorear memoria
pm2 list | grep agentes-bot
```

### Health Check
```bash
# Verificar salud del bot
curl http://localhost:3848/api/health | python3 -m json.tool

# Respuesta esperada
{
  "status": "ok",
  "bot": "running",
  "connections": {
    "conn_XXX": {
      "primary": "connected",
      "standby": "connected"
    }
  }
}
```

### Backups
```bash
# Listar backups disponibles
cd /var/www/agentes/recuperacion
./recuperar.sh --list

# Restaurar backup
./recuperar.sh --restore backup_20260226_XXX

# Backup manual
cp -r server/data recuperacion/backups/backup_$(date +%Y%m%d_%H%M%S)/
```

### Debugging
```bash
# Ver conexiones activas
curl http://localhost:3848/api/connections

# Ver sesiones WhatsApp
ls -la bot_sessions/

# Ver pagos procesados
cat server/data/payments.json | python3 -m json.tool

# Ver logs de errores
tail -f /root/.pm2/logs/agentes-bot-error.log
```

---

## 🔧 CONFIGURACIÓN DE ENTORNO

### Variables de Entorno (.env)
```bash
# Puertos
BOT_PORT=3848
WEBAPP_PORT=3847

# Tokens
BOT_INTERNAL_TOKEN=token_secreto_interno

# Deepseek (default)
DEEPSEEK_API_KEY=sk-...

# OpenAI (opcional)
OPENAI_API_KEY=sk-...

# Google Gemini (opcional)
GEMINI_API_KEY=AIza...

# Qwen OAuth (no requiere API Key)

# Rutas
DATA_DIR=/var/www/agentes/server/data
MEDIA_DIR=/var/www/agentes/media
SESSIONS_DIR=/var/www/agentes/bot_sessions
```

---

## 📊 MÉTRICAS DEL SISTEMA

### Rendimiento
| Métrica | Valor Actual | Objetivo |
|---------|--------------|----------|
| Tiempo failover | < 5s | < 10s ✅ |
| Mensajes perdidos | 0 | 0 ✅ |
| Detección de caída | 45s | < 60s ✅ |
| Memoria bot | ~114MB | < 800MB ✅ |
| Failovers/día | 0-2 | < 5 ✅ |
| OCR precisión | ~85% | > 80% ✅ |
| Tiempo respuesta IA | 1-3s | < 5s ✅ |

### Capacidad
| Recurso | Límite | Actual |
|---------|--------|--------|
| Agentes máx | 5 | 3 |
| Conexiones máx | 10 | 3 |
| Memoria disponible | 8GB | 6GB free |
| CPU disponible | 8 cores | 4 cores free |

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### El bot no responde
```bash
# 1. Verificar estado
pm2 list

# 2. Ver logs
pm2 logs agentes-bot --lines 100

# 3. Reiniciar
pm2 restart agentes-bot

# 4. Verificar conexión WhatsApp
curl http://localhost:3848/api/health
```

### OCR no detecta pagos
```bash
# 1. Verificar feature flag
cat server/data/settings.json | grep ocrPagos

# 2. Ver logs de OCR
pm2 logs agentes-bot | grep -i "ocr"

# 3. Verificar imagen
# - Debe verse monto, banco, código de operación
# - Evitar imágenes borrosas o muy oscuras
```

### Failovers frecuentes
```bash
# 1. Verificar causa
pm2 logs agentes-bot | grep -i "failover"

# 2. Ajustar threshold (app.js línea ~230)
# Cambiar de 3 a 5 fallos consecutivos

# 3. Ajustar heartbeat interval
# Cambiar de 15s a 20s
```

### Frontend no carga
```bash
# 1. Reiniciar frontend
pm2 restart agentes-web

# 2. Rebuild
cd webapp && npm run build

# 3. Limpiar caché navegador
# Ctrl + Shift + R (hard refresh)
```

---

## 📝 ENDPOINTS API COMPLETOS

### Agentes
```
GET    /api/agents              # Listar agentes
POST   /api/agents              # Crear agente
GET    /api/agents/:id          # Detalle de agente
PUT    /api/agents/:id          # Actualizar agente
DELETE /api/agents/:id          # Eliminar agente
POST   /api/agents/:id/knowledge # Subir documento conocimiento
GET    /api/agents/:id/media    # Listar multimedia
POST   /api/agents/:id/media    # Subir archivo multimedia
DELETE /api/agents/:id/media/:id # Eliminar archivo multimedia
```

### Conexiones
```
GET    /api/connections         # Listar conexiones
POST   /api/connections         # Crear conexión
GET    /api/connections/:id     # Detalle de conexión
PUT    /api/connections/:id     # Actualizar conexión
DELETE /api/connections/:id     # Eliminar conexión
POST   /api/connections/:id/qr  # Generar QR
POST   /api/connections/:id/logout # Logout
POST   /api/connections/:id/restart # Reiniciar
```

### Conversaciones
```
GET    /api/conversations       # Listar conversaciones
GET    /api/conversations/:id   # Detalle de conversación
DELETE /api/conversations/:id   # Eliminar conversación
GET    /api/conversations/phone/:tel # Por teléfono
```

### Pagos
```
GET    /api/pagos               # Listar pagos
POST   /api/pagos               # Crear pago
GET    /api/pagos/:id           # Detalle de pago
PUT    /api/pagos/:id           # Actualizar pago
DELETE /api/pagos/:id           # Eliminar pago
GET    /api/pagos/cliente/:tel  # Pagos por cliente
```

### Citas
```
GET    /api/citas               # Listar citas
POST   /api/citas               # Crear cita
GET    /api/citas/:id           # Detalle de cita
PUT    /api/citas/:id           # Actualizar cita
DELETE /api/citas/:id           # Eliminar cita
GET    /api/citas/cliente/:tel  # Citas por cliente
GET    /api/citas/hoy           # Citas del día
GET    /api/citas/proximanas    # Próximas citas
```

### Utilidades
```
GET    /api/health              # Health check del bot
POST   /api/command             # Enviar comando al bot
GET    /api/settings            # Obtener settings
PUT    /api/settings            # Actualizar settings
```

---

## 🎯 PRÓXIMAS MEJORAS (ROADMAP)

### Fase 3 - Planes de Pago
- [ ] Integración con pasarela de pagos (Stripe/MercadoPago)
- [ ] Sistema de suscripciones mensual
- [ ] Activación automática de capacidades según plan
- [ ] Dashboard de facturación

### Fase 4 - Analytics
- [ ] Dashboard de métricas de atención
- [ ] Reportes de pagos procesados
- [ ] Análisis de satisfacción de clientes
- [ ] Exportación de datos (CSV, PDF)

### Fase 5 - Multi-idioma
- [ ] Soporte para inglés, portugués
- [ ] Detección automática de idioma
- [ ] Traducción de respuestas en tiempo real

### Fase 6 - Integraciones
- [ ] Google Calendar para citas
- [ ] Slack para notificaciones
- [ ] Zapier para automatizaciones
- [ ] Webhooks personalizados

---

## 📞 SOPORTE

### Documentación Adicional
- `ARQUITECTURA_SISTEMA.md` - Arquitectura detallada
- `IMPLEMENTACION_HOT_STANDBY.md` - Detalles de failover
- `SISTEMA_KEYWORDS_SEGURIDAD.md` - Guía de seguridad
- `CAPACIDADES_AGENTES_IMPLEMENTACION.md` - Capacidades por agente

### Backups
- Ubicación: `/var/www/agentes/recuperacion/backups/`
- Frecuencia: Automática antes de cambios críticos
- Retención: Últimos 10 backups

### Logs
- PM2: `/root/.pm2/logs/agentes-bot-*.log`
- Aplicación: `/var/www/agentes/app.log`
- Baileys: `/var/www/agentes/baileys.log`

---

**Última actualización:** 26 de Febrero, 2026  
**Responsable:** Equipo de Desarrollo CONTROLA.agentes
