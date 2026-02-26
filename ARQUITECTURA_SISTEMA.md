# 📚 ARQUITECTURA DEL SISTEMA - CONTROLA.agentes

**Fecha:** 25 de Febrero, 2026
**Estado:** ✅ VERIFICADO

---

## 🏗️ ARQUITECTURA CORRECTA

### Procesos PM2 Requeridos:

| Proceso | Script | Propósito | Puerto | Estado |
|---------|--------|-----------|--------|--------|
| `agentes-bot` | `app.js` | Bot Baileys (WhatsApp con Hot Standby) | 3848 | ✅ Requerido |
| `agentes-web` | `server/index.js` | API REST + Frontend React | 3847 | ✅ Requerido |

### **NO crear procesos adicionales:**
- ❌ `agentes-api` - DUPLICADO de `agentes-web`
- ❌ Cualquier otro proceso con `server/index.js`

---

## 📁 COMPONENTES

### 1. Bot Baileys (`agentes-bot`)

**Script:** `/var/www/agentes/app.js`

**Funciones:**
- Conexión WhatsApp Business con Baileys 7.x
- Hot Standby (dual socket: PRIMARY + STANDBY)
- Procesamiento de mensajes entrantes
- OCR de pagos (Tesseract.js)
- Integración con agente IA (Deepseek, OpenAI, etc.)
- Sistema de colas y recuperación de mensajes

**Puerto:** 3848

**Comandos:**
```bash
pm2 restart agentes-bot
pm2 logs agentes-bot
```

---

### 2. API + Frontend (`agentes-web`)

**Script:** `/var/www/agentes/server/index.js`

**Funciones:**
- API REST para gestión de agentes, conexiones, conversaciones
- Servir frontend React (Vite build)
- Autenticación de usuarios
- Sistema de palabras clave de seguridad
- CRUD de pagos (sistema OCR)
- Scheduler de recordatorios de citas

**Puerto:** 3847

**Endpoints principales:**
- `GET /api/agents` - Listar agentes
- `GET /api/connections` - Listar conexiones
- `GET /api/pagos` - Listar pagos
- `POST /api/auth/login` - Login

**Comandos:**
```bash
pm2 restart agentes-web
pm2 logs agentes-web
```

---

## 🔄 COMANDOS DE GESTIÓN

### Restart limpio de la API:

```bash
cd /var/www/agentes
./scripts/clean-restart-api.sh
```

### Restart del bot:

```bash
pm2 restart agentes-bot
```

### Ver estado:

```bash
pm2 list | grep agentes
```

### Ver logs:

```bash
# Bot
pm2 logs agentes-bot --lines 50

# API
pm2 logs agentes-web --lines 50
```

### Health check:

```bash
# API
curl http://localhost:3847/api/health

# Bot
curl http://localhost:3848/api/health
```

---

## ⚠️ PROBLEMAS COMUNES

### 1. Puerto 3847 en uso (EADDRINUSE)

**Síntoma:**
```
Error: listen EADDRINUSE: address already in use :::3847
```

**Causa:** Hay más de un proceso corriendo `server/index.js`

**Solución:**
```bash
# Ver procesos duplicados
ps aux | grep "node /var/www/agentes/server/index.js" | grep -v grep

# Matar todos y restart limpio
./scripts/clean-restart-api.sh
```

### 2. Procesos zombie

**Síntoma:**
```bash
pm2 list muestra múltiples procesos del mismo tipo
```

**Solución:**
```bash
# Listar procesos PM2
pm2 list

# Eliminar duplicados
pm2 delete agentes-api  # Si existe

# Solo deberían quedar:
# - agentes-bot
# - agentes-web
```

### 3. Bot no responde mensajes

**Verificar:**
```bash
# Ver estado del bot
pm2 logs agentes-bot | grep -E "connected|FAIL|ERROR" | tail -20

# Ver health check
curl http://localhost:3848/api/health | python3 -m json.tool
```

---

## 📊 FLUJO DE MENSAJES

```
┌─────────────┐
│  WhatsApp   │
│  (Cliente)  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│  agentes-bot (puerto 3848)      │
│  - Baileys Hot Standby          │
│  - Procesa mensaje entrante     │
│  - OCR si es imagen (pagos)     │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  Agente IA (Deepseek/OpenAI)    │
│  - Genera respuesta             │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  agentes-bot                    │
│  - Envía respuesta a WhatsApp   │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  agentes-web (puerto 3847)      │
│  - API REST                     │
│  - Frontend React               │
│  - CRUD de pagos, citas, etc.   │
└─────────────────────────────────┘
```

---

## 🛡️ PREVENCIÓN DE PROBLEMAS

### Reglas de oro:

1. **NUNCA** uses `pm2 restart agentes-api`
   - Usa `pm2 restart agentes-web` o el script `./scripts/clean-restart-api.sh`

2. **NUNCA** crees procesos adicionales con `server/index.js`
   - Solo debe existir `agentes-web`

3. **SIEMPRE** verifica después de un restart:
   ```bash
   pm2 list | grep agentes
   # Debería mostrar solo 2 procesos: agentes-bot y agentes-web
   ```

4. **ANTE DUDA**, usa el script de limpieza:
   ```bash
   ./scripts/clean-restart-api.sh
   ```

---

## 📝 NOTAS TÉCNICAS

### Hot Standby (agentes-bot):

- **UN SOLO PROCESO** con **DOS SOCKETS** internos
- PRIMARY: Activo, procesa mensajes
- STANDBY: En espera, listo para failover
- Failover automático < 5 segundos
- Message Queue para recuperación

### API + Frontend (agentes-web):

- **UN SOLO PROCESO** que corre Express + sirve archivos estáticos
- Build de React en `/var/www/agentes/webapp/dist/`
- Session management con express-session
- Rate limiting y autenticación

---

**Última actualización:** 25 de Febrero, 2026
**Responsable:** Asistente de IA
**Estado:** ✅ VERIFICADO EN PRODUCCIÓN
