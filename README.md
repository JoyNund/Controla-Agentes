# CONTROLA.agentes - Sistema de Agentes IA para WhatsApp

[![Estado](https://img.shields.io/badge/estado-funcional-green)]()
[![Baileys](https://img.shields.io/badge/Baileys-7.0.0--rc.9-blue)]()
[![Node](https://img.shields.io/badge/Node-20.x-green)]()

Sistema de agentes de IA para atención automática de WhatsApp con gestión multi-dispositivo.

---

## 🚀 Inicio Rápido

### 1. Iniciar Servidores

**Terminal 1 - API + Web App:**
```bash
cd /var/www/agentes
npm run server
```

**Terminal 2 - Bot de WhatsApp:**
```bash
cd /var/www/agentes
npm start
```

### 2. Acceder a la Web

- **URL:** http://localhost:3847
- **Login:** `admin@controla.digital` / `admin123`

### 3. Vincular WhatsApp

1. Ir a **"Conexión"**
2. Click en **"+ Nueva Conexión"**
3. Click en **"Encender"**
4. Escanear QR desde WhatsApp

---

## 📚 Documentación

| Documento | Descripción |
|-----------|-------------|
| [CONFIGURACION_FINAL.md](./CONFIGURACION_FINAL.md) | **Configuración completa y troubleshooting** |
| [CAMBIOS_REALIZADOS.md](./CAMBIOS_REALIZADOS.md) | Historial de cambios |
| [NUEVA_ARQUITECTURA.md](./NUEVA_ARQUITECTURA.md) | Arquitectura del sistema |

---

## 🛠️ Scripts de Utilidad

### ⚠️ REGLA CRÍTICA: BACKUPS PERMANENTES

**Los backups son INAMOVIBLES y NUNCA se modifican:**

- ✅ El restore **COPIA** archivos DESDE el backup HACIA el proyecto
- ✅ El backup original permanece **INTACTO** siempre
- ✅ **NUNCA** reemplazar, mover o eliminar archivos del backup

```bash
# Crear backup (crea directorio nuevo)
node scripts/backup.js

# Listar backups
node scripts/backup.js --list

# Restaurar (copia DESDE backup, no reemplaza)
node scripts/restore.js backups/configuracion_inicial_funcional

# Help
node scripts/backup.js --help
```

---

## 📁 Estructura del Proyecto

```
/var/www/agentes/
├── app.js                      # Bot orchestrator (Baileys 7.x)
├── server/
│   ├── index.js                # API REST
│   ├── store.js                # Persistencia JSON
│   └── data/
│       ├── agents.json         # Agentes con API keys
│       ├── connections.json    # Conexiones activas
│       └── conversations.json  # Historial de chats
├── services/
│   └── agenteIA.js             # Servicio de IA (Deepseek/OpenAI)
├── webapp/                     # Frontend React
│   └── src/
│       ├── pages/
│       │   ├── Conexion.jsx    # UI de conexiones
│       │   └── ...
│       └── api.js              # API client
├── scripts/
│   ├── backup.js               # Script de backup
│   ├── restore.js              # Script de restore
│   └── clean-sessions.js       # Limpieza de sesiones
├── backups/                    # Backups creados
└── bot_sessions/               # Sesiones de Baileys
```

---

## 🔑 Conceptos Clave

### Agente ≠ Conexión

- **Agente:** Plantilla de comportamiento de IA (prompt, base de conocimiento, API key)
- **Conexión:** Dispositivo WhatsApp vinculado (número de teléfono)
- **Relación:** Una conexión tiene un agente asignado

### Ejemplo

```
Agente: "CONTROLA" (ventas, API key de Deepseek)
   ↓
Conexión 1: "WhatsApp Ventas" → 51903172378
Conexión 2: "WhatsApp Soporte" → 519999888777
```

---

## 🔧 Variables de Entorno

Archivo `.env`:

```env
# Seguridad
APP_PASSWORD=admin123
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx

# Puertos
BOT_PORT=3848
WEBAPP_PORT=3847
```

---

## 🐛 Troubleshooting

### Bot no recibe mensajes

1. Cerrar sesión desde WhatsApp (celular)
2. Logout desde web
3. Volver a vincular

### Error de API Key

```bash
# Verificar API key
grep DEEPSEEK /var/www/agentes/.env

# Actualizar agente
curl -X PUT http://localhost:3847/api/agents/AG_ID \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"apiKey":"sk-xxxxx"}'
```

### Puerto ocupado

```bash
# Matar procesos
pkill -f "node /var/www/agentes"

# Reiniciar
npm run server  # Terminal 1
npm start       # Terminal 2
```

---

## 📞 Soporte

- **Documentación bot-whatsapp:** https://bot-whatsapp.netlify.app/
- **Discord:** https://link.codigoencasa.com/DISCORD
- **Baileys GitHub:** https://github.com/WhiskeySockets/Baileys

---

## ✅ Checklist de Funcionamiento

- [ ] API corriendo en puerto 3847
- [ ] Bot corriendo en puerto 3848
- [ ] Web accesible en http://localhost:3847
- [ ] Login funcional
- [ ] Agente configurado con API key
- [ ] Conexión creada y vinculada
- [ ] Estado: "CONECTADO"
- [ ] Mensajes entrantes se procesan
- [ ] IA responde correctamente
- [ ] Backup creado

---

**Última actualización:** 21 de Febrero, 2026  
**Estado:** ✅ FUNCIONANDO
