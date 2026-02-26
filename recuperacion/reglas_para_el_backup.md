# 📋 Reglas para la Gestión de Backups

## ⚠️ REGLAS CRÍTICAS - LEER ANTES DE CUALQUIER OPERACIÓN

### 🚫 LO QUE NUNCA SE DEBE HACER

1. **NUNCA mover archivos DESDE la carpeta `recuperacion/backups/`**
   - ❌ `mv recuperacion/backups/backup_XXX/app.js .`
   - ❌ `cp recuperacion/backups/backup_XXX/app.js . && rm recuperacion/backups/backup_XXX/app.js`
   
2. **NUNCA editar archivos DENTRO de `recuperacion/backups/`**
   - ❌ `nano recuperacion/backups/backup_XXX/app.js`
   - ❌ Modificar cualquier archivo en esta carpeta

3. **NUNCA eliminar backups existentes**
   - ❌ `rm -rf recuperacion/backups/backup_XXX/`
   - ❌ Eliminar backups "viejos" para ahorrar espacio

4. **NUNCA reemplazar archivos en los backups**
   - ❌ `cp app.js recuperacion/backups/backup_XXX/app.js`
   - ❌ Los backups son INMUTABLES una vez creados

---

### ✅ LO QUE SÍ SE DEBE HACER

1. **SIEMPRE copiar archivos DESDE el backup HACIA el proyecto**
   ```bash
   # CORRECTO: Copiar desde backup hacia proyecto
   cp /var/www/agentes/recuperacion/backups/backup_XXX/app.js /var/www/agentes/app.js
   ```

2. **SIEMPRE crear nuevos directorios para nuevos backups**
   ```bash
   # CORRECTO: Nuevo backup crea nuevo directorio
   mkdir /var/www/agentes/recuperacion/backups/backup_20260222_143000_hot_standby
   cp /var/www/agentes/app.js /var/www/agentes/recuperacion/backups/backup_20260222_143000_hot_standby/
   ```

3. **SIEMPRE verificar que el backup original permanece intacto después de restaurar**
   ```bash
   # CORRECTO: Verificar después de restaurar
   ls -la /var/www/agentes/recuperacion/backups/backup_XXX/
   # Todos los archivos deben seguir ahí
   ```

---

## 📁 ESTRUCTURA DE LA CARPETA `recuperacion/`

```
recuperacion/
├── reglas_para_el_backup.md       # Este archivo (REGLAS)
├── COMO_RECUPERAR_BACKUPS.md      # Guía paso a paso de restauración
├── MANIFIESTO_BACKUPS.md          # Lista de todos los backups creados
└── backups/
    ├── backup_20260222_XXXXXX_descripcion/
    │   ├── app.js                 # ← NUNCA MOVER DE AQUÍ
    │   ├── server/index.js        # ← NUNCA MOVER DE AQUÍ
    │   └── MANIFIESTO.md          # Descripción de este backup específico
    └── backup_YYYYMMDD_HHMMSS_descripcion/
        └── ...
```

---

## 🔄 FLUJO CORRECTO DE RESTAURACIÓN

### Escenario: Algo se rompió y necesitas restaurar

**Paso 1: Identificar el backup a restaurar**
```bash
ls -la /var/www/agentes/recuperacion/backups/
# Ver lista de backups disponibles
```

**Paso 2: Verificar contenido del backup**
```bash
ls -la /var/www/agentes/recuperacion/backups/backup_XXX/
cat /var/www/agentes/recuperacion/backups/backup_XXX/MANIFIESTO.md
```

**Paso 3: Detener servicios activos**
```bash
pm2 stop agentes-bot
pm2 stop server  # o el nombre de tu proceso API
```

**Paso 4: Copiar archivos DESDE el backup (NO MOVER)**
```bash
# CORRECTO: Copiar mantiene el original en el backup
cp /var/www/agentes/recuperacion/backups/backup_XXX/app.js /var/www/agentes/app.js
cp /var/www/agentes/recuperacion/backups/backup_XXX/server/index.js /var/www/agentes/server/index.js
```

**Paso 5: Verificar que el backup sigue intacto**
```bash
# El backup debe tener los mismos archivos
ls -la /var/www/agentes/recuperacion/backups/backup_XXX/
# ✅ Los archivos originales deben seguir ahí
```

**Paso 6: Reiniciar servicios**
```bash
pm2 start agentes-bot
pm2 start server
```

**Paso 7: Verificar funcionamiento**
```bash
pm2 status
curl http://localhost:3847/api/health
curl http://localhost:3848/api/health
```

---

## 📝 CUÁNDO ACTUALIZAR LOS BACKUPS

Los backups en `recuperacion/backups/` **SOLO** se actualizan cuando:

1. ✅ **Se llega a un estado estable mejor** que el actual
2. ✅ **Se prueba en producción** por al menos 24-48 horas sin problemas
3. ✅ **Se documenta** el cambio en el MANIFIESTO del nuevo backup

**Ejemplo de flujo de actualización:**

```bash
# 1. Crear nuevo backup con versión mejorada
mkdir /var/www/agentes/recuperacion/backups/backup_20260225_090000_hot_standby_estable
cp /var/www/agentes/app.js /var/www/agentes/recuperacion/backups/backup_20260225_090000_hot_standby_estable/
cp /var/www/agentes/server/index.js /var/www/agentes/recuperacion/backups/backup_20260225_090000_hot_standby_estable/

# 2. Crear manifiesto describiendo los cambios
nano /var/www/agentes/recuperacion/backups/backup_20260225_090000_hot_standby_estable/MANIFIESTO.md

# 3. Actualizar manifiesto general
nano /var/www/agentes/recuperacion/MANIFIESTO_BACKUPS.md

# 4. Los backups anteriores PERMANECEN INTACTOS
# NO eliminar backups anteriores, mantener histórico
```

---

## 🆘 EMERGENCIA: Restauración Rápida

Si el sistema está roto y necesitas restaurar **INMEDIATAMENTE**:

```bash
cd /var/www/agentes

# 1. Detener todo
pkill -9 -f "node /var/www/agentes"

# 2. Encontrar el último backup estable
LATEST_BACKUP=$(ls -td recuperacion/backups/backup_*/ | head -1)

# 3. Copiar archivos CRÍTICOS (NO MOVER)
cp $LATEST_BACKUP/app.js app.js
cp $LATEST_BACKUP/server/index.js server/index.js

# 4. Iniciar
pm2 restart all

# 5. Verificar
pm2 status
```

---

## 📊 POLÍTICA DE RETENCIÓN

| Tipo de Backup | Retención | Justificación |
|----------------|-----------|---------------|
| Backups de versiones estables | **PERMANENTE** | Puntos de restauración confiables |
| Backups de desarrollo/testing | 7 días | Solo para rollback inmediato |
| Backups corruptos/inválidos | **NUNCA ELIMINAR** | Mantener como referencia histórica |

**Regla de oro:** Es mejor tener 100 backups que ocupar 10GB de disco, que necesitar 1 backup que no existe.

---

## 🔐 VERIFICACIÓN DE INTEGRIDAD

Periódicamente (recomendado: semanal), verificar que los backups son válidos:

```bash
# Verificar que los archivos existen y tienen tamaño razonable
for backup in /var/www/agentes/recuperacion/backups/*/; do
    echo "=== $backup ==="
    ls -lh $backup/*.js 2>/dev/null || echo "Sin archivos JS"
done

# Verificar sintaxis de los archivos backup
for backup in /var/www/agentes/recuperacion/backups/*/; do
    echo "=== Verificando $backup ==="
    node -c $backup/app.js 2>&1 || echo "⚠️ ERROR en $backup"
done
```

---

## 📞 CONTACTO EN CASO DE DUDAS

Si tienes dudas sobre si una operación es segura:

1. **Preguntar antes de ejecutar** comandos que modifiquen `recuperacion/backups/`
2. **Verificar dos veces** que estás copiando (no moviendo)
3. **Documentar** cualquier cambio en el MANIFIESTO

---

**Última actualización:** 22 de Febrero, 2026
**Versión:** 1.0
