# ⚡ REFERENCIA RÁPIDA - CONTROLA.agentes

## 🚀 Comandos de Inicio

```bash
# Terminal 1 - API + Web
cd /var/www/agentes && npm run server

# Terminal 2 - Bot
cd /var/www/agentes && npm start
```

## 🔗 URLs

| Servicio | URL | Login |
|----------|-----|-------|
| Web App | http://localhost:3847 | admin@controla.digital / admin123 |
| API | http://localhost:3847/api | - |
| Bot Health | http://localhost:3848/api/health | - |

## 📊 Verificar Estado

```bash
# Verificar API
curl http://localhost:3847/api/agents

# Verificar Bot
curl http://localhost:3848/api/health

# Verificar conexiones
curl -b /tmp/cookies.txt http://localhost:3847/api/connections
```

## 🔄 Backup y Restore

### ⚠️ REGLA CRÍTICA: BACKUPS PERMANENTES

- ✅ Los backups **NUNCA** se modifican o eliminan
- ✅ El restore **COPIA** desde backup, no reemplaza
- ✅ El backup original permanece **INTACTO**

```bash
# Crear backup (directorio nuevo)
node scripts/backup.js

# Listar backups
node scripts/backup.js --list

# Restaurar (copia DESDE backup)
node scripts/restore.js backups/configuracion_inicial_funcional

# Limpiar sesiones
node scripts/clean-sessions.js --all
```

## 🐛 Problemas Comunes

### Bot no recibe mensajes
```bash
# 1. Logout desde web
# 2. Cerrar sesión en WhatsApp (celular)
# 3. Volver a vincular
```

### Puerto ocupado
```bash
pkill -f "node /var/www/agentes"
sleep 2
npm run server  # Terminal 1
npm start       # Terminal 2
```

### Error API Key
```bash
# Verificar
grep DEEPSEEK .env

# Actualizar agente vía API
```

## 📁 Archivos Críticos

- `app.js` - Bot (Baileys 7.x)
- `server/index.js` - API
- `server/data/agents.json` - API keys
- `.env` - Variables de entorno

## 🔑 Variables .env

```env
APP_PASSWORD=admin123
DEEPSEEK_API_KEY=sk-xxxxx
BOT_PORT=3848
WEBAPP_PORT=3847
```

---

**Documentación completa:** CONFIGURACION_FINAL.md
