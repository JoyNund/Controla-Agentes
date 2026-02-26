# 🔄 SEPARACIÓN DE ENTORNOS - CONTROLA.agentes

**Fecha:** 26 de Febrero, 2026  
**Estado:** ✅ Completado

---

## 📋 RESUMEN EJECUTIVO

Se ha aislado y duplicado el proyecto CONTROLA.agentes en dos entornos completamente independientes:

1. **BETA (Producción Actual)** - `/var/www/agentes` - Funcionalidad estable
2. **COMMERCIAL (Desarrollo)** - `/var/www/agentes-commercial` - Próxima versión escalable

---

## 🏗️ ARQUITECTURA DE ENTORNOS

### Ambiente BETA (Existente)
```
┌─────────────────────────────────────────┐
│  /var/www/agentes                       │
│  - API:  http://localhost:3847          │
│  - Bot:  Puerto 3848                    │
│  - PM2:  agentes-web, agentes-bot       │
│  - Estado: ✅ PRODUCCIÓN ESTABLE        │
└─────────────────────────────────────────┘
```

### Ambiente COMMERCIAL (Nuevo)
```
┌─────────────────────────────────────────┐
│  /var/www/agentes-commercial            │
│  - API:  http://localhost:3947          │
│  - Bot:  Puerto 3948                    │
│  - PM2:  agentes-commercial-api,        │
│          agentes-commercial-bot         │
│  - Estado: 🚧 DESARROLLO / ESCALAMIENTO │
└─────────────────────────────────────────┘
```

---

## 📊 TABLA COMPARATIVA

| Característica | BETA | COMMERCIAL |
|----------------|------|------------|
| **Ubicación** | `/var/www/agentes` | `/var/www/agentes-commercial` |
| **API Port** | 3847 | 3947 |
| **Bot Port** | 3848 | 3948 |
| **PM2 API** | `agentes-web` | `agentes-commercial-api` |
| **PM2 Bot** | `agentes-bot` | `agentes-commercial-bot` |
| **SESSION_SECRET** | `a7f3c91e...` | `b8g4d02f...` |
| **BOT_TOKEN** | `a7f3c91e...` | `b8g4d02f...` |
| **Sessions** | `bot_sessions/` | `bot_sessions_commercial/` |
| **Media** | `media/pagos/` | `media/pagos/` (aislado) |
| **Config** | `.env` | `.env` + `ecosystem.config.js` |

---

## 🚀 COMANDOS DE GESTIÓN

### Ambiente BETA
```bash
# Reiniciar API
pm2 restart agentes-web

# Reiniciar Bot
pm2 restart agentes-bot

# Ver logs API
pm2 logs agentes-web --lines 50

# Ver logs Bot
pm2 logs agentes-bot --lines 50

# Health check
curl http://localhost:3847/api/health

# Ver estado
pm2 list | grep agentes
```

### Ambiente COMMERCIAL
```bash
# Reiniciar API
pm2 restart agentes-commercial-api

# Reiniciar Bot
pm2 restart agentes-commercial-bot

# Ver logs API
pm2 logs agentes-commercial-api --lines 50

# Ver logs Bot
pm2 logs agentes-commercial-bot --lines 50

# Health check
curl http://localhost:3947/api/health

# Ver estado
pm2 list | grep commercial
```

### Ambos Ambientes
```bash
# Ver todos los procesos
pm2 list

# Guardar configuración actual
pm2 save

# Reiniciar todo
pm2 restart all

# Monitoreo en tiempo real
pm2 monit
```

---

## 📁 ESTRUCTURA DE DIRECTORIOS

```
/var/www/
├── agentes/                          # BETA (Producción)
│   ├── .env                          # Puertos: 3847, 3848
│   ├── app.js                        # Bot orchestrator
│   ├── server/
│   │   └── index.js                  # API REST
│   ├── webapp/
│   │   └── dist/                     # Frontend build
│   ├── bot_sessions/                 # Sesiones WhatsApp
│   └── media/pagos/                  # Comprobantes OCR
│
└── agentes-commercial/               # COMMERCIAL (Desarrollo)
    ├── .env                          # Puertos: 3947, 3948
    ├── ecosystem.config.js           # PM2 config
    ├── app.js                        # Bot orchestrator (copiado)
    ├── server/
    │   └── index.js                  # API REST (copiado)
    ├── webapp/
    │   └── dist/                     # Frontend build (copiado)
    ├── bot_sessions_commercial/      # Sesiones WhatsApp (aisladas)
    └── media/pagos/                  # Comprobantes OCR (aislados)
```

---

## 🔐 AISLAMIENTO DE DATOS

### Totalmente Aislado
- ✅ **Sessions de WhatsApp**: Cada entorno tiene sus propias credenciales
- ✅ **Datos de Agentes**: `server/data/agents.json` independiente
- ✅ **Conexiones**: `server/data/connections.json` independiente
- ✅ **Pagos**: `server/data/payments.json` independiente
- ✅ **Secrets**: SESSION_SECRET y BOT_TOKEN diferentes
- ✅ **Media**: Archivos OCR en carpetas separadas

### Compartido (Sin conflicto)
- 📦 **Código base**: Mismo código en ambos (por ahora)
- 🔑 **API Keys**: Mismas API keys de Deepseek (se pueden separar luego)

---

## 🎯 PRÓXIMOS PASOS - DESARROLLO COMMERCIAL

### Fase 1: Desarrollo (Actual)
1. ✅ Aislar entornos
2. ✅ Configurar puertos distintos
3. ✅ Duplicar proyecto
4. 🔄 Comenzar desarrollo de multi-tenant

### Fase 2: Testing
1. Probar que ambos entornos funcionan simultáneamente
2. Verificar que no hay interferencia de puertos
3. Testear WhatsApp en ambos entornos (números diferentes)

### Fase 3: Migración Gradual
1. Mover usuarios beta a commercial (opcional)
2. Mantener beta como fallback
3. Commercial como producción principal

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### WhatsApp Business
- **BETA**: Usa el número `+51936956306` (puede usarse)
- **COMMERCIAL**: Necesita **otro número** de WhatsApp
  - No se puede usar el mismo número en dos instancias simultáneas
  - WhatsApp Business API permite multi-dispositivo, pero Baileys no

### Puertos
- **No cambiar** puertos de BETA (3847, 3848) - hay apps en producción
- **Commercial** usa (3947, 3948) - libres sin conflicto
- **Futuro**: Asignar rangos específicos para cada tenant

### Base de Datos
- **Actual**: JSON files (funciona para ambos)
- **Futuro**: PostgreSQL con schemas por tenant

### Backups
```bash
# Backup BETA
cd /var/www/agentes/recuperacion && ./recuperar.sh --list

# Backup COMMERCIAL (nuevo)
cd /var/www/agentes-commercial/recuperacion && ./recuperar.sh --list
```

---

## 📊 ESTADO ACTUAL

| Componente | BETA | COMMERCIAL |
|------------|------|------------|
| API REST | ✅ Online (3847) | ✅ Online (3947) |
| Bot Baileys | ✅ Online (3848) | ✅ Online (3948) |
| Frontend | ✅ Build listo | ✅ Build copiado |
| PM2 Processes | ✅ Configurados | ✅ Configurados |
| Sessions | ✅ Activas | ⏳ Requiere vincular |
| Datos | ✅ Existentes | ⏳ Vacíos (copiados) |

---

## 🔧 MANTENIMIENTO

### Actualización de Código

**Si modificas BETA y quieres pasar a COMMERCIAL:**
```bash
# Copiar cambios específicos
rsync -av /var/www/agentes/app.js /var/www/agentes-commercial/app.js
rsync -av /var/www/agentes/server/index.js /var/www/agentes-commercial/server/index.js

# Reiniciar commercial
pm2 restart agentes-commercial-api agentes-commercial-bot --update-env
```

**Si desarrollas algo nuevo en COMMERCIAL:**
```bash
# El código nuevo queda solo en commercial
# No hacer rsync inverso hasta que esté estable
```

### Monitoreo
```bash
# Ver uso de memoria
pm2 list

# Ver logs en tiempo real
pm2 monit

# Ver logs específicos
pm2 logs agentes-commercial-bot --lines 100
```

---

## 🎉 VERIFICACIÓN FINAL

### Check BETA
```bash
curl http://localhost:3847/api/health
# Debe responder: {"status":"ok",...}
```

### Check COMMERCIAL
```bash
curl http://localhost:3947/api/health
# Debe responder: {"status":"ok",...}
```

### Verificar Aislamiento
```bash
# Crear agente en BETA
# NO debe aparecer en COMMERCIAL

# Crear agente en COMMERCIAL
# NO debe aparecer en BETA
```

---

## 📞 SOPORTE

### Si hay conflicto de puertos
```bash
# Ver qué usa el puerto
lsof -i :3847
lsof -i :3947

# Matar proceso conflictivo
pm2 delete <nombre>
```

### Si commercial no arranca
```bash
# Ver logs
pm2 logs agentes-commercial-api --err --lines 100

# Reiniciar con update-env
pm2 restart agentes-commercial-api --update-env

# Verificar .env
cat /var/www/agentes-commercial/.env
```

---

**Documentación creada:** 26 de Febrero, 2026  
**Entornos:** 2 (BETA + COMMERCIAL)  
**Estado:** ✅ Listo para desarrollo paralelo
