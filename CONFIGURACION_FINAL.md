# 📋 CONFIGURACIÓN FINAL - CONTROLA.agentes

## ✅ Estado del Sistema

**Fecha:** 21 de Febrero, 2026  
**Estado:** ✅ FUNCIONANDO CORRECTAMENTE

### Arquitectura Implementada

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTROLA.agentes                             │
├─────────────────────────────────────────────────────────────────┤
│  WEB APP (React + Vite)  →  http://localhost:3847              │
│  - Login: admin@controla.digital / admin123                     │
│  - Gestión de Agentes (plantillas de IA)                        │
│  - Gestión de Conexiones (dispositivos WhatsApp)                │
│  - Monitor de Chats                                             │
├─────────────────────────────────────────────────────────────────┤
│  API (Express + Session) → server/index.js                      │
│  - CRUD Agentes                                                 │
│  - CRUD Conexiones                                              │
│  - Conversaciones                                               │
├─────────────────────────────────────────────────────────────────┤
│  BOT ORCHESTRATOR (app.js) → Puerto 3848                        │
│  - Baileys 7.0.0-rc.9                                           │
│  - Múltiples instancias por conexión                            │
│  - Lee API key directamente de DB (no de API)                   │
├─────────────────────────────────────────────────────────────────┤
│  IA SERVICE (services/agenteIA.js)                              │
│  - Deepseek (default) / OpenAI                                  │
│  - Contexto de conversación (últimos 10 mensajes)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Conceptos Clave

### Agente ≠ Conexión

| Concepto | Descripción | Ejemplo |
|----------|-------------|---------|
| **Agente** | Plantilla de comportamiento de IA | `CONTROLA` - Estratega de ventas |
| **Conexión** | Dispositivo WhatsApp vinculado | `conn_CONTROLA_1` - Número 51903172378 |

**Relación:** Una conexión TIENE UN agente asignado que determina su comportamiento.

---

## 📁 Archivos Críticos

### Backend

| Archivo | Función | ¿Backup? |
|---------|---------|----------|
| `app.js` | Bot orchestrator (Baileys 7.x) | ✅ CRÍTICO |
| `server/index.js` | API REST + Auth | ✅ CRÍTICO |
| `server/store.js` | Persistencia JSON | ✅ CRÍTICO |
| `services/agenteIA.js` | Servicio de IA | ✅ CRÍTICO |
| `.env` | Variables de entorno | ✅ CRÍTICO (sensible) |
| `package.json` | Dependencias | ✅ IMPORTANTE |

### Datos

| Archivo | Función | ¿Backup? |
|---------|---------|----------|
| `server/data/agents.json` | Agentes con API keys | ✅ CRÍTICO |
| `server/data/connections.json` | Conexiones activas | ✅ IMPORTANTE |
| `server/data/conversations.json` | Historial de chats | ⚠️ OPCIONAL (grande) |
| `server/data/settings.json` | Configuración global | ⚠️ OPCIONAL |

### Frontend

| Archivo | Función | ¿Backup? |
|---------|---------|----------|
| `webapp/src/pages/Conexion.jsx` | UI de conexiones | ⚠️ MODERADO |
| `webapp/src/api.js` | API client | ⚠️ MODERADO |

---

## 🔧 Configuración de Variables de Entorno

### Archivo `.env`

```env
# === SEGURIDAD ===
NODE_ENV=production
APP_PASSWORD=admin123
SESSION_SECRET=a7f3c91e4b2d8e60f5c1a9b7d3e6f2a8c4b0e1d9f7a5c3b8e2d6f4a1c9b7e5d3
BOT_INTERNAL_TOKEN=a7f3c91e4b2d8e60f5c1a9b7d3e6f2a8c4b0e1d9f7a5c3b8e2d6f4a1c9b7e5d3

# === IA (Deepseek recomendado) ===
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Obtener en: https://platform.deepseek.com/

# === PUERTOS ===
BOT_PORT=3848
WEBAPP_PORT=3847
WEBAPP_API_URL=http://localhost:3847

# === WHATSAPP ===
WHATSAPP_PHONE_NUMBER=+51936956306
```

---

## 🚀 Comandos de Inicio

### 1. Iniciar API + Web App

```bash
cd /var/www/agentes
npm run server
```

**Puerto:** 3847  
**URL:** http://localhost:3847

### 2. Iniciar Bot de WhatsApp

```bash
cd /var/www/agentes
npm start
```

**Puerto:** 3848

### 3. Verificar Estado

```bash
# Verificar API
curl http://localhost:3847/api/agents

# Verificar Bot
curl http://localhost:3848/api/health
```

---

## 🔐 Flujo de Conexión de WhatsApp

### Paso 1: Crear Conexión

1. Abrir http://localhost:3847
2. Login: `admin@controla.digital` / `admin123`
3. Ir a **"Conexión"**
4. Click en **"+ Nueva Conexión"**
5. Nombre: Ej: "WhatsApp Ventas"
6. Agente inicial: Seleccionar agente (opcional)
7. Click en **"Crear Conexión"**

### Paso 2: Vincular Dispositivo

1. En la tarjeta de la conexión, click en **"Encender"**
2. Esperar a que aparezca el QR
3. En WhatsApp (celular):
   - Ajustas → Dispositivos vinculados
   - Vincular dispositivo → Escanear QR
4. Escanear el QR en pantalla
5. Esperar a que cambie a **"CONECTADO"**

### Paso 3: Probar

1. Enviar mensaje desde el número vinculado al bot
2. Verificar respuesta en WhatsApp
3. Verificar en **"Monitor de Chats"**

---

## 🐛 Problemas Comunes y Soluciones

### 1. Bot no recibe mensajes

**Síntoma:** Conexión dice "connected" pero no llegan mensajes

**Causa:** Sesión de WhatsApp expiró o no sincronizada

**Solución:**
```bash
# 1. Cerrar sesión desde WhatsApp (celular)
# Ajustas → Dispositivos vinculados → Cerrar sesión

# 2. Logout desde web
# Conexión → Click en tarjeta → "Cerrar sesión"

# 3. Volver a vincular
# Conexión → "Encender" → Escanear QR
```

### 2. Error de API Key

**Síntoma:** Responde "❌ Error de autenticación con la API"

**Causa:** API key no configurada en el agente

**Solución:**
```bash
# 1. Verificar API key en .env
grep DEEPSEEK /var/www/agentes/.env

# 2. Actualizar agente
curl -X PUT http://localhost:3847/api/agents/AG_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"apiKey":"sk-xxxxx"}'
```

### 3. Puerto ocupado

**Síntoma:** `Error: listen EADDRINUSE: address already in use :::3848`

**Solución:**
```bash
# Matar procesos
ps aux | grep "node /var/www/agentes" | grep -v grep | awk '{print $2}' | xargs kill -9

# Verificar puertos libres
ss -tlnp | grep -E "3847|3848"

# Reiniciar
npm run server  # Terminal 1
npm start       # Terminal 2
```

### 4. Bot no inicia después de cambios

**Síntoma:** Error de sintaxis o módulos faltantes

**Solución:**
```bash
# Verificar sintaxis
node -c app.js
node -c server/index.js

# Reinstalar dependencias
npm install --legacy-peer-deps
```

---

## 📊 Estructura de Datos

### Agente (agents.json)

```json
{
  "id": "ag_1770876627427_3rxa1w",
  "name": "CONTROLA",
  "motor": "deepseek",
  "model": "deepseek-chat",
  "apiKey": "sk-8928b7e8f33a4fc4be6d5471af00fa50",
  "temperature": 0.3,
  "systemPrompt": "Eres CONTROLA AI...",
  "knowledgeBase": "BASE DE CONOCIMIENTO...",
  "active": true,
  "type": "ai",
  "connectionMethod": "baileys-qr",
  "triggers": [],
  "rules": {"saludoInicial": "Hola, soy CONTROLA.AI"}
}
```

### Conexión (connections.json)

```json
{
  "conn_CONTROLA_1": {
    "id": "conn_1771628026014_c3hb",
    "name": "controla",
    "status": "connected",
    "agentId": "ag_1770876627427_3rxa1w",
    "phoneNumber": "51903172378:5",
    "logs": [],
    "createdAt": "2026-02-20T22:53:46.014Z",
    "updatedAt": "2026-02-21T00:11:21.189Z"
  }
}
```

---

## 🛠️ Scripts de Utilidad

### ⚠️ REGLA CRÍTICA SOBRE BACKUPS

**Los backups son PERMANENTES E INAMOVIBLES:**

- ✅ **NUNCA** reemplazar archivos de un backup existente
- ✅ **NUNCA** modificar el contenido de un backup
- ✅ **NUNCA** eliminar backups (excepto manualmente con buena razón)
- ✅ Los backups nuevos **SIEMPRE** crean un directorio nuevo
- ✅ El restore **COPIA** archivos DESDE el backup HACIA el proyecto
- ✅ El backup original permanece **INTACTO** después del restore

**Flujo correcto:**
```bash
# ✅ CORRECTO: Crear backup (crea directorio nuevo)
node scripts/backup.js antes_de_cambio

# ✅ CORRECTO: Restaurar (copia DESDE backup HACIA proyecto)
node scripts/restore.js backups/antes_de_cambio

# ❌ INCORRECTO: NUNCA hacer esto
rm -rf backups/alguna_cosas  # NUNCA eliminar backups
mv backups/alguna_cosas .    # NUNCA mover archivos del backup
cp mi_archivo.js backups/... # NUNCA reemplazar en backup
```

### Backup

```bash
node scripts/backup.js
```

### Restore

```bash
node scripts/restore.js backups/backup_20260221_001500/
```

### Limpiar Sesiones

```bash
node scripts/clean-sessions.js [connectionId|--all]
```

---

## 📝 Notas Importantes

1. **API Key:** El bot lee la API key directamente de `server/data/agents.json`, NO de la API HTTP (que la enmascara por seguridad).

2. **Baileys 7.x:** Usa `@whiskeysockets/baileys@7.0.0-rc.9`. No actualizar a otra versión sin testing.

3. **Sesiones:** Se guardan en `bot_sessions/{connectionId}/`. Cada conexión tiene su sesión aislada.

4. **Polling:** El bot hace polling cada 3 segundos para detectar cambios de estado.

5. **Logs:** 
   - Bot: `/tmp/bot-*.log`
   - API: `/tmp/api-server.log`

---

## 📞 Soporte

- **Documentación bot-whatsapp:** https://bot-whatsapp.netlify.app/
- **Discord:** https://link.codigoencasa.com/DISCORD
- **Baileys GitHub:** https://github.com/WhiskeySockets/Baileys
