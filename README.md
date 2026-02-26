# CONTROLA.agentes 🤖

> Sistema multi-agente de IA para WhatsApp Business con OCR de pagos, catálogo multimedia y failover automático.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Business-25D366.svg)](https://www.whatsapp.com/business/)

**Versión:** 2.6.0 (Beta)
**Estado:** ✅ Funcional en producción
**Próxima versión:** 3.0.0 (Commercial - Multi-tenant)

---

## 📊 Plan de Escalamiento

Este proyecto está en transición hacia una **versión comercial escalable** con las siguientes características:

### Modelo Híbrido (SaaS + Self-Hosted)
- **SaaS Multi-Tenant**: Suscripción mensual ($29-299/mes) con hosting incluido
- **Self-Hosted**: License perpetua ($299-2499) para instalación local
- **License Server Central**: Validación de licencias y feature flags

### Roadmap v3.0
- [ ] Migración a PostgreSQL con Row Level Security
- [ ] Autenticación JWT multi-usuario
- [ ] Sistema de billing con Stripe
- [ ] Dashboard administrativo multi-tenant
- [ ] Rate limiting y quotas por tenant
- [ ] Kubernetes/Docker para auto-scaling

Ver [PLAN_ESCALAMIENTO_2026.md](./PLAN_ESCALAMIENTO_2026.md) para detalles completos.

---

## 🚀 Características Principales

### Multi-Agente de IA
- **Agentes configurables**: Cada agente tiene personalidad, base de conocimiento y reglas personalizadas
- **Multi-motor IA**: Soporte para Deepseek, OpenAI, Qwen OAuth, Gemini y Llama
- **Cambio dinámico**: Cambia el agente de una conexión sin reiniciar WhatsApp
- **Asistente de configuración**: IA ayuda a redactar personalidad, saludo y objeciones

### WhatsApp Business Integration
- **Baileys 7.x**: Conexión directa sin API oficial
- **Hot Standby**: Failover automático < 5 segundos con dual socket (PRIMARY + STANDBY)
- **Message Queue**: Recuperación automática de mensajes perdidos
- **Multi-conexión**: Múltiples números WhatsApp en una sola instancia

### Sistema OCR de Pagos 💳
- **Detección automática**: Yape, Plin, BCP, Transferencias bancarias
- **Tesseract.js**: Procesamiento local de imágenes
- **Validación inteligente**: Patrones para asteriscos, case-insensitive, montos > 0
- **Organización por cliente**: `/media/pagos/{telefono}/`
- **CRUD completo**: Registro, edición, eliminación y monitoreo de pagos

### Catálogo Multimedia 📁
- **Envío inteligente**: Checkbox `enableSmartMedia` para envío contextual
- **Múltiples formatos**: Imágenes, PDFs, videos
- **Enlaces WhatsApp**: Soporte para productos vía `wa.me/p/PRODUCTO`
- **Búsqueda contextual**: IA selecciona el archivo relevante según el chat

### Gestión de Citas 📅
- **Agendamiento automático**: IA detecta solicitudes de citas en conversaciones
- **Validación de horarios**: Reglas configurables por agente
- **Recordatorios**: Notificaciones automáticas (configurable)

### Seguridad 🔐
- **Keywords ofuscadas**: HEX encoding para contraseñas de operaciones críticas
- **Master Keyword**: Palabra clave global para administración
- **Keywords individuales**: Por agente y conexión
- **Modales de confirmación**: UI protege acciones sensibles

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  WEB APP (React + Vite + Bootstrap)                     │
│  - Gestión de Agentes y Conexiones                      │
│  - Monitor de Chats en tiempo real                      │
│  - CRUD de Pagos y Citas                                │
├─────────────────────────────────────────────────────────┤
│  API REST (Express + Session) → Puerto 3847             │
│  - CRUD Agentes, Conexiones, Conversaciones             │
│  - Endpoints de Pagos, Citas, Media                     │
├─────────────────────────────────────────────────────────┤
│  BOT ORCHESTRATOR (Baileys 7.x) → Puerto 3848           │
│  - Dual Socket: PRIMARY + STANDBY                       │
│  - Failover automático < 5s                             │
│  - Message Queue + Recovery                             │
├─────────────────────────────────────────────────────────┤
│  IA SERVICE                                             │
│  - Multi-motor: Deepseek, OpenAI, Qwen, Gemini, Llama   │
│  - Contexto de conversación (últimos 10 mensajes)       │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 Requisitos

- **Node.js** 18+ 
- **npm** o **yarn**
- **PM2** (para producción)
- **Tesseract.js** (para OCR)
- **Baileys** 7.x (para WhatsApp)

---

## ⚙️ Instalación

### Entornos Disponibles

El proyecto cuenta con **dos entornos completamente aislados**:

| Entorno | Ubicación | Puertos | Propósito |
|---------|-----------|---------|-----------|
| **BETA** | `/var/www/agentes` | 3847/3848 | Producción actual |
| **COMMERCIAL** | `/var/www/agentes-commercial` | 3947/3948 | Desarrollo v3.0 |

Ver [SEPARACION_ENTORNOS.md](./SEPARACION_ENTORNOS.md) para más detalles.

### 1. Clonar el repositorio

```bash
git clone https://github.com/JoyNund/Controla-Agentes.git
cd Controla-Agentes
```

### 2. Instalar dependencias

```bash
# Dependencias del backend
npm install

# Dependencias del frontend
cd webapp
npm install
npm run build
cd ..
```

### 3. Configurar variables de entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales
nano .env
```

**Variables requeridas:**
```env
# API Keys de IA
DEEPSEEK_API_KEY=sk-xxx
OPENAI_API_KEY=sk-xxx

# Configuración del servidor
PORT=3847
BOT_PORT=3848

# Session secret
SESSION_SECRET=tu_secreto_seguro

# WhatsApp (opcional, se genera QR)
PHONE_NUMBER=51999999999
```

### 4. Iniciar con PM2 (Producción)

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar API y Bot
pm2 start ecosystem.config.js

# Ver estado
pm2 list

# Ver logs
pm2 logs
```

### 5. Iniciar en modo desarrollo

```bash
# Terminal 1: API
cd server
npm run dev

# Terminal 2: Bot
node app.js

# Terminal 3: Frontend (desarrollo)
cd webapp
npm run dev
```

---

## 🎯 Uso

### 1. Acceder al Dashboard

Abre tu navegador en `http://localhost:3847`

### 2. Configurar Agente

1. Ve a **Agentes** → **Nuevo Agente**
2. Configura:
   - **Nombre**: Identificador del agente
   - **Keyword**: Palabra clave de seguridad (opcional)
   - **Personalidad**: Prompt del sistema
   - **Base de conocimiento**: Información del negocio
   - **Saludo**: Mensaje inicial
   - **Objeciones**: Respuestas a objeciones comunes
   - **Motor IA**: Deepseek, OpenAI, etc.
   - **Capacidades**: OCR Pagos, Agendar Citas

### 3. Crear Conexión WhatsApp

1. Ve a **Conexiones** → **Nueva Conexión**
2. Configura:
   - **Nombre**: Identificador de la conexión
   - **Keyword**: Palabra clave de seguridad
   - **Agente**: Asigna un agente configurado
3. Escanea el QR con WhatsApp Business

### 4. Monitorear Chats

Ve a **Monitor** para ver conversaciones en tiempo real y:
- Ver mensajes entrantes/salientes
- Forzar respuesta de IA
- Ver estado de capacidades (OCR, Citas)

### 5. Gestionar Pagos

Ve a **Pagos** para:
- Ver pagos detectados por OCR
- Editar/eliminar pagos
- Filtrar por cliente, estado, fecha, agente

---

## 📁 Estructura del Proyecto

```
Controla-Agentes/
├── app.js                          # Bot Orchestrator (Baileys + OCR)
├── server/
│   ├── index.js                    # API REST Express
│   ├── data/                       # Datos JSON (no subir a Git)
│   │   ├── agents.json
│   │   ├── connections.json
│   │   ├── payments.json
│   │   └── settings.json
│   └── services/
│       ├── agenteIA.js             # Servicio de IA multi-motor
│       ├── ocrService.js           # OCR con Tesseract.js
│       └── mediaCatalog.js         # Catálogo multimedia
├── webapp/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Agentes.jsx         # Gestión de agentes
│   │   │   ├── Conexiones.jsx      # Gestión de WhatsApp
│   │   │   ├── Monitor.jsx         # Chats en vivo
│   │   │   ├── Pagos.jsx           # CRUD de pagos
│   │   │   └── Citas.jsx           # Gestión de citas
│   │   └── components/
│   │       ├── AgentConfigAssistant.jsx
│   │       ├── KeywordModal.jsx
│   │       └── PagoModal.jsx
│   └── dist/                       # Build de producción
├── bot_sessions/                   # Sesiones WhatsApp (no subir)
├── media/                          # Archivos OCR (no subir)
├── recuperacion/                   # Backups y recuperación
├── DOCUMENTACION_*.md              # Documentación completa
└── ecosystem.config.js             # Configuración PM2
```

---

## 🔐 Seguridad

### Keywords de Seguridad

El sistema usa keywords ofuscadas (HEX) para proteger operaciones críticas:

| Acción | Keyword Requerida |
|--------|-------------------|
| Crear/Editar Agente | Master Keyword o individual |
| Eliminar Agente | Master Keyword |
| Asignar Agente a Conexión | Keyword de la conexión |
| Logout/Restart Conexión | Keyword de la conexión |

**Default Master Keyword:** `John0306` (cambiar en producción)

### Archivos Sensibles

Los siguientes archivos **NO** deben subirse a Git:

- `.env` (credenciales)
- `server/data/*.json` (datos de clientes)
- `bot_sessions/` (credenciales de WhatsApp)
- `media/` (imágenes OCR)
- `recuperacion/backups/` (copias de seguridad)

---

## 🧪 Comandos Útiles

```bash
# Health check
curl http://localhost:3848/api/health | python3 -m json.tool

# Reiniciar bot
pm2 restart agentes-bot

# Reiniciar API
pm2 restart agentes-api

# Ver logs en vivo
pm2 logs --lines 50

# Ver uso de memoria
pm2 list

# Crear backup
cd recuperacion && ./recuperar.sh --create

# Restaurar backup
cd recuperacion && ./recuperar.sh --restore <ID>
```

---

## 📊 Endpoints de la API

### Agentes
```bash
GET    /api/agents              # Listar agentes
POST   /api/agents              # Crear agente
PUT    /api/agents/:id          # Actualizar agente
DELETE /api/agents/:id          # Eliminar agente
POST   /api/agents/generate-config  # Generar config con IA
```

### Conexiones
```bash
GET    /api/connections         # Listar conexiones
POST   /api/connections         # Crear conexión
PUT    /api/connections/:id     # Actualizar conexión
DELETE /api/connections/:id     # Eliminar conexión
POST   /api/connections/:id/assign  # Asignar agente
```

### Pagos
```bash
GET    /api/pagos               # Listar pagos
POST   /api/pagos               # Crear pago
PUT    /api/pagos/:id           # Actualizar pago
DELETE /api/pagos/:id           # Eliminar pago
```

### Citas
```bash
GET    /api/citas               # Listar citas
POST   /api/citas               # Crear cita
PUT    /api/citas/:id           # Actualizar cita
DELETE /api/citas/:id           # Eliminar cita
```

---

## 🛣️ Roadmap

### Versión 3.0 - Commercial (Q2 2026) - **En Desarrollo**

**Modelo:** Híbrido (SaaS + Self-Hosted)

#### Fase 1: Preparación (2-3 semanas)
- [ ] Migración de JSON a PostgreSQL
- [ ] Implementación de Auth JWT
- [ ] Tenant isolation con Row Level Security
- [ ] Feature flags por plan/tenant

#### Fase 2: Multi-Tenant Core (4-6 semanas)
- [ ] Database layer con tenant context
- [ ] API actualizada para multi-tenant
- [ ] Bot orchestrator con rate limiting
- [ ] Quotas por tenant (mensajes/día)

#### Fase 3: License Server (3-4 semanas)
- [ ] Central License API
- [ ] Validación de licencias
- [ ] License client para self-hosted
- [ ] Telemetry opcional

#### Fase 4: Billing & Subscriptions (2-3 semanas)
- [ ] Integración con Stripe
- [ ] Planes: Free, Pro ($29), Enterprise ($299)
- [ ] Gestión de suscripciones
- [ ] Control de quotas por plan

#### Fase 5: Dashboard & Analytics (3-4 semanas)
- [ ] Admin Dashboard multi-tenant
- [ ] Métricas globales de uso
- [ ] Reportes de revenue
- [ ] Alertas y notificaciones

### Versión 2.7 (Q1 2026) - **Próximo**
- [ ] Plantillas de respuestas rápidas
- [ ] Broadcast masivo (con rate limiting)
- [ ] Etiquetas y segmentación de clientes
- [ ] Exportación de conversaciones (PDF/CSV)

### Versión 2.6 (Actual) - ✅ **Completado**
- [x] Multi-agente con IA
- [x] Hot Standby (failover < 5s)
- [x] Sistema OCR de pagos
- [x] Catálogo multimedia
- [x] Gestión de citas
- [x] Keywords de seguridad
- [x] Multi-motor IA (Deepseek, OpenAI, Qwen, Gemini, Llama)
- [x] Enlaces de WhatsApp para productos
- [x] Órdenes de catálogo WhatsApp

---

## 📄 Documentación Adicional

- [DOCUMENTACION_COMPLETA_2026_02_26.md](./DOCUMENTACION_COMPLETA_2026_02_26.md) - Guía completa del sistema
- [PLAN_ESCALAMIENTO_2026.md](./PLAN_ESCALAMIENTO_2026.md) - Plan para versión comercial
- [DOCUMENTACION_ORDENES_CATALOGO.md](./DOCUMENTACION_ORDENES_CATALOGO.md) - Pedidos de WhatsApp
- [DOCUMENTACION_ENLACES_WHATSAPP.md](./DOCUMENTACION_ENLACES_WHATSAPP.md) - Enlaces de productos
- [SISTEMA_KEYWORDS_SEGURIDAD.md](./SISTEMA_KEYWORDS_SEGURIDAD.md) - Sistema de seguridad
- [IMPLEMENTACION_HOT_STANDBY.md](./IMPLEMENTACION_HOT_STANDBY.md) - Failover automático

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'Añadir nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](./LICENSE) para más detalles.

---

## 🙏 Agradecimientos

- [Baileys](https://github.com/WhiskeySockets/Baileys) - Librería de WhatsApp
- [Tesseract.js](https://github.com/naptha/tesseract.js) - OCR en JavaScript
- [React](https://react.dev/) - Framework de UI
- [Express](https://expressjs.com/) - Framework de backend

---

## 📞 Soporte

- **Issues:** [GitHub Issues](https://github.com/JoyNund/Controla-Agentes/issues)
- **Discusión:** [GitHub Discussions](https://github.com/JoyNund/Controla-Agentes/discussions)

---

**Hecho con ❤️ para WhatsApp Business**
