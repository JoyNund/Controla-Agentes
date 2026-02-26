# 📦 POLÍTICA DE BACKUPS - CONTROLA.agentes

## ⚠️ REGLA DE ORO

**LOS BACKUPS SON PERMANENTES E INAMOVIBLES**

---

## ✅ Lo que SÍ se debe hacer

### 1. Crear backups frecuentemente
```bash
# Antes de hacer cambios
node scripts/backup.js antes_de_actualizar

# Después de configuración importante
node scripts/backup.js despues_de_configurar_agentes

# Backup automático con timestamp
node scripts/backup.js
```

### 2. Restaurar DESDE un backup
```bash
# El restore COPIA archivos DESDE el backup HACIA el proyecto
node scripts/restore.js backups/backup_20260221_001500
```

### 3. Mantener múltiples backups
```
backups/
├── configuracion_inicial_funcional/    ← Nunca tocar
├── antes_de_cambio_ia/                  ← Nunca tocar
├── despues_de_actualizar_agentes/       ← Nunca tocar
└── pre_restore_20260221_120000/         ← Auto-creado
```

### 4. Listar backups disponibles
```bash
node scripts/backup.js --list
```

---

## ❌ Lo que NUNCA se debe hacer

### 1. NUNCA eliminar backups
```bash
# ❌ INCORRECTO - NUNCA HACER ESTO
rm -rf backups/configuracion_inicial_funcional
rm backups/alguna_cosas
```

### 2. NUNCA mover archivos del backup
```bash
# ❌ INCORRECTO - NUNCA HACER ESTO
mv backups/configuracion_inicial_funcional/app.js .
mv backups/alguna_cosas/ .
```

### 3. NUNCA reemplazar archivos en backup
```bash
# ❌ INCORRECTO - NUNCA HACER ESTO
cp mi_nuevo_app.js backups/configuracion_inicial_funcional/app.js
cp server/index.js backups/.../server/
```

### 4. NUNCA modificar contenido de backup
```bash
# ❌ INCORRECTO - NUNCA HACER ESTO
echo "cambio" >> backups/.../.env
vim backups/.../server/data/agents.json
```

---

## 🔄 Flujo Correcto de Restore

### Paso 1: Verificar backups disponibles
```bash
node scripts/backup.js --list
```

### Paso 2: Restaurar
```bash
node scripts/restore.js backups/configuracion_inicial_funcional
```

**Lo que hace el script:**
1. ✅ Lee el manifiesto del backup
2. ✅ Crea backup automático del estado actual (`pre_restore_TIMESTAMP`)
3. ✅ **COPIA** archivos DESDE el backup HACIA el proyecto
4. ✅ El backup original permanece **INTACTO**
5. ✅ Muestra instrucciones de reinicio

### Paso 3: Reiniciar servidores
```bash
# Matar procesos
pkill -f "node /var/www/agentes"

# Iniciar API
npm run server

# Iniciar Bot (otra terminal)
npm start
```

### Paso 4: Verificar
```bash
curl http://localhost:3848/api/health
```

---

## 📊 ¿Qué se respalda?

### Archivos Críticos (12)
1. `app.js` - Bot orchestrator
2. `server/index.js` - API REST
3. `server/store.js` - Persistencia
4. `services/agenteIA.js` - Servicio de IA
5. `.env` - Variables de entorno
6. `package.json` - Dependencias
7. `package-lock.json` - Lock file
8. `server/data/agents.json` - Agentes con API keys
9. `server/data/connections.json` - Conexiones
10. `server/data/settings.json` - Configuración
11. `webapp/src/pages/Conexion.jsx` - UI de conexiones
12. `webapp/src/api.js` - API client

### Archivos Opcionales (2)
1. `server/data/conversations.json` - Historial de chats
2. `server/data/blockedNumbers.json` - Números bloqueados

---

## 🗂️ Estructura de Backup

```
backups/
└── backup_20260221_001500/
    ├── manifest.json           ← Metadatos del backup
    ├── README.md               ← Instrucciones específicas
    ├── app.js                  ← Archivos críticos
    ├── server/
    │   ├── index.js
    │   ├── store.js
    │   └── data/
    │       ├── agents.json     ← API keys incluidas
    │       ├── connections.json
    │       └── settings.json
    ├── services/
    │   └── agenteIA.js
    ├── .env                    ← Variables de entorno
    ├── package.json
    └── webapp/
        └── src/
            ├── pages/Conexion.jsx
            └── api.js
```

### Manifiesto (manifest.json)
```json
{
  "name": "backup_20260221_001500",
  "timestamp": "2026-02-21T00:15:00.000Z",
  "criticalFiles": [...],
  "optionalFiles": [...],
  "backedUpCritical": 12,
  "backedUpOptional": 2,
  "nodeVersion": "v20.20.0",
  "hostname": "vmi3043352"
}
```

---

## 📅 Cuándo crear backups

### ✅ Momentos recomendados

1. **Antes de actualizar código**
   ```bash
   node scripts/backup.js antes_de_actualizar_app
   ```

2. **Después de configurar agentes**
   ```bash
   node scripts/backup.js agentes_configurados
   ```

3. **Antes de cambios en .env**
   ```bash
   node scripts/backup.js antes_de_cambiar_env
   ```

4. **Después de cambios en frontend**
   ```bash
   node scripts/backup.js frontend_actualizado
   ```

5. **Automáticamente antes de restore**
   - El script `restore.js` crea `pre_restore_TIMESTAMP` automáticamente

### ❌ Cuándo NO crear backups

- No crear backups duplicados innecesarios
- No crear backups después de cada cambio menor
- No crear backups con nombres genéricos como "backup1", "backup2"

---

## 🔐 Seguridad de Backups

### ¿Qué incluye el backup?

- ✅ **API Keys** de agentes (en `server/data/agents.json`)
- ✅ **Variables de entorno** (en `.env`)
- ✅ **Configuración de agentes** (prompts, base de conocimiento)
- ✅ **Configuración de conexiones**

### ¿Qué NO incluye el backup?

- ❌ **Sesiones de Baileys** (`bot_sessions/`) - Se regeneran
- ❌ **Node modules** - Se reinstalan con `npm install`
- ❌ **Logs antiguos** - No son críticos
- ❌ **QR codes** - Se regeneran al conectar

### Recomendaciones de seguridad

1. **Copias externas:** Considerar copiar backups a otro servidor o cloud
2. **Encriptación:** Para backups con datos sensibles, considerar encriptación
3. **Acceso restringido:** Solo admin debe tener acceso a backups

---

## 🚨 Recuperación de Desastres

### Escenario: El servidor se cayó completamente

**Paso 1: Restaurar sistema operativo y Node.js**

**Paso 2: Clonar/cargar código del proyecto**

**Paso 3: Restaurar desde backup**
```bash
cd /var/www/agentes
node scripts/restore.js backups/configuracion_inicial_funcional
```

**Paso 4: Instalar dependencias**
```bash
npm install --legacy-peer-deps
```

**Paso 5: Verificar .env**
```bash
cat .env | grep DEEPSEEK
```

**Paso 6: Iniciar servidores**
```bash
npm run server  # Terminal 1
npm start       # Terminal 2
```

**Paso 7: Verificar**
```bash
curl http://localhost:3848/api/health
```

---

## 📞 Soporte

Para dudas sobre backups:

1. Revisar `CONFIGURACION_FINAL.md`
2. Revisar `README.md`
3. Ejecutar `node scripts/backup.js --help`
4. Ejecutar `node scripts/restore.js --help`

---

**Última actualización:** 21 de Febrero, 2026  
**Política:** BACKUPS PERMANENTES E INAMOVIBLES
