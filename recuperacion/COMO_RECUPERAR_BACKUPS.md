# 🔄 Cómo Recuperar Backups - Guía Paso a Paso

## 📋 Información General

- **Ubicación de backups:** `/var/www/agentes/recuperacion/backups/`
- **Archivos respaldados:** `app.js`, `server/index.js`, `server/store.js`
- **Política:** Los backups NUNCA se mueven, solo se copian
- **Script automático:** `/var/www/agentes/recuperacion/recuperar.sh`

---

## 🚀 MÉTODO RECOMENDADO: Script Automático

### Usar el Script de Recuperación

```bash
cd /var/www/agentes/recuperacion

# 1. Listar backups disponibles
./recuperar.sh --list

# 2. Verificar integridad de un backup
./recuperar.sh --verify backup_20260222_151500_pre_hot_standby

# 3. Restaurar backup específico
./recuperar.sh --restore backup_20260222_151500_pre_hot_standby

# 4. O restaurar el más reciente automáticamente
./recuperar.sh --latest
```

### Ventajas del Script Automático

- ✅ Verifica integridad antes de restaurar
- ✅ Detiene servicios automáticamente
- ✅ Copia archivos correctamente
- ✅ Reinicia servicios después de restaurar
- ✅ Muestra confirmación antes de proceder
- ✅ Mantiene backups intactos

---

## 🚨 ESCENARIO 1: Emergencia (Sistema Caído)

### Síntomas
- Bot no responde
- API devuelve errores
- Conexiones WhatsApp caídas

### Pasos de Restauración Rápida

```bash
# 1. Ir al directorio del proyecto
cd /var/www/agentes

# 2. Detener todos los procesos
pkill -9 -f "node /var/www/agentes"
pm2 stop all 2>/dev/null || true

# 3. Listar backups disponibles
ls -lht recuperacion/backups/

# 4. Identificar el último backup estable (generalmente el más reciente)
#    Ejemplo: backup_20260222_143000_pre_hot_standby

# 5. COPIAR archivos desde el backup (NO MOVER)
cp recuperacion/backups/backup_20260222_143000_pre_hot_standby/app.js app.js
cp recuperacion/backups/backup_20260222_143000_pre_hot_standby/server/index.js server/index.js

# 6. Verificar que el backup sigue intacto
ls recuperacion/backups/backup_20260222_143000_pre_hot_standby/
# ✅ Los archivos deben seguir ahí

# 7. Reiniciar servicios
pm2 start agentes-bot
pm2 start server

# 8. Verificar estado
pm2 status
curl http://localhost:3847/api/health
curl http://localhost:3848/api/health
```

---

## ⚠️ ESCENARIO 2: Rollback de Feature Específico

### Síntomas
- Una funcionalidad específica falla (ej: Hot Standby)
- Quieres volver a la versión anterior

### Pasos de Restauración Selectiva

```bash
cd /var/www/agentes

# 1. Identificar el backup ANTES del cambio problemático
ls -lht recuperacion/backups/

# 2. Leer el MANIFIESTO para entender qué cambió
cat recuperacion/backups/backup_XXXXXX_descripcion/MANIFIESTO.md

# 3. Detener servicios afectados
pm2 stop agentes-bot

# 4. Copiar SOLO el archivo problemático
cp recuperacion/backups/backup_XXXXXX/app.js app.js

# 5. Reiniciar solo el servicio afectado
pm2 start agentes-bot

# 6. Monitorear logs
pm2 logs agentes-bot --lines 50
```

---

## 🔍 ESCENARIO 3: Verificación Preventiva

### Para verificar que los backups son válidos

```bash
cd /var/www/agentes

# 1. Listar todos los backups
echo "=== BACKUPS DISPONIBLES ==="
ls -lht recuperacion/backups/

# 2. Para cada backup, verificar integridad
for backup in recuperacion/backups/*/; do
    echo ""
    echo "=== $backup ==="
    
    # Verificar archivos existentes
    ls -lh $backup/*.js 2>/dev/null
    
    # Verificar sintaxis JavaScript
    for file in $backup/*.js; do
        if [ -f "$file" ]; then
            echo -n "Sintaxis $file: "
            node -c "$file" 2>&1 | grep -q "OK" && echo "✅ OK" || echo "❌ ERROR"
        fi
    done
done
```

---

## 📊 ESCENARIO 4: Comparar Versiones

### Para ver diferencias entre backup y versión actual

```bash
cd /var/www/agentes

# Comparar app.js actual con el backup
diff -u app.js recuperacion/backups/backup_XXXXXX/app.js | head -100

# O usar un herramienta visual si está disponible
code --diff app.js recuperacion/backups/backup_XXXXXX/app.js
```

---

## 🧪 ESCENARIO 5: Test en Entorno Aislado

### Para probar un backup sin afectar producción

```bash
cd /var/www/agentes

# 1. Crear carpeta temporal
mkdir -p /tmp/test_backup

# 2. Copiar archivos del backup a carpeta temporal
cp recuperacion/backups/backup_XXXXXX/*.js /tmp/test_backup/

# 3. Copiar .env y dependencias
cp .env /tmp/test_backup/
cp package.json /tmp/test_backup/

# 4. Instalar dependencias en temporal
cd /tmp/test_backup
npm install --legacy-peer-deps

# 5. Probar sintaxis y carga
node -c app.js
node -c server/index.js

# 6. Si todo OK, proceder con restauración en producción
cd /var/www/agentes
# Seguir pasos del ESCENARIO 1 o 2
```

---

## 📋 CHECKLIST POST-RESTAURACIÓN

Después de restaurar un backup, verificar:

- [ ] **API responde:** `curl http://localhost:3847/api/health`
- [ ] **Bot responde:** `curl http://localhost:3848/api/health`
- [ ] **Conexiones activas:** Verificar en webapp
- [ ] **Mensajes se procesan:** Enviar mensaje de prueba
- [ ] **Logs sin errores:** `pm2 logs --lines 50`
- [ ] **Sesiones válidas:** Verificar `bot_sessions/` tiene creds.json

---

## 🆘 COMANDOS DE DIAGNÓSTICO

```bash
# Ver estado de procesos PM2
pm2 list

# Ver logs en tiempo real
pm2 logs --lines 50

# Ver puertos ocupados
ss -tlnp | grep -E "3847|3848"

# Ver uso de memoria
ps aux | grep node | grep agentes

# Verificar archivos de sesión
ls -la /var/www/agentes/bot_sessions/

# Verificar archivos de datos
ls -la /var/www/agentes/server/data/
```

---

## 📞 ESCALACIÓN

Si después de restaurar el problema persiste:

1. **Revisar logs detallados:**
   ```bash
   pm2 logs agentes-bot --lines 200 > /tmp/logs_bot.txt
   pm2 logs server --lines 200 > /tmp/logs_api.txt
   ```

2. **Verificar configuración:**
   ```bash
   cat /var/www/agentes/.env | grep -v PASSWORD
   ```

3. **Documentar:**
   - ¿Qué backup se restauró?
   - ¿Qué error persiste?
   - ¿Cuándo ocurrió el problema original?

---

**Última actualización:** 22 de Febrero, 2026
