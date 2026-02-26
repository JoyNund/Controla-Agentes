# 📚 MANIFIESTO GENERAL DE BACKUPS

## Propósito

Este documento registra **todos los backups** creados en la carpeta `recuperacion/backups/`.

---

## 📋 Backups Registrados

| ID | Fecha | Descripción | Estado | Archivos |
|----|-------|-------------|--------|----------|
| `backup_20260222_151500_pre_hot_standby` | 2026-02-22 15:15 | Estado estable antes de Hot Standby | ✅ Disponible | app.js, server/index.js, server/store.js |
| `backup_20260222_153000_hot_standby_implementado` | 2026-02-22 15:30 | Hot Standby implementado | ⚠️ Testing | app.js, server/index.js, server/store.js |

---

## 🔍 Detalle de cada Backup

### backup_20260222_153000_hot_standby_implementado

- **Fecha:** 22 de Febrero, 2026 - 15:30
- **Propósito:** Implementación de Hot Standby completada
- **Archivos:**
  - `app.js` (Bot orchestrator con Hot Standby)
  - `server/index.js` (API + Web App)
  - `server/store.js` (Persistencia)
- **Estado del sistema:** ⚠️ EN TESTING - Requiere validación
- **Cambios principales:**
  - Hot Standby (socket dual primary/standby)
  - Message Queue + Recovery post-failover
  - Heartbeat Activo cada 15s
  - Failover automático < 5 segundos
- **Manifiesto completo:** `backups/backup_20260222_153000_hot_standby_implementado/MANIFIESTO.md`

---

### backup_20260222_151500_pre_hot_standby

- **Fecha:** 22 de Febrero, 2026 - 15:15
- **Propósito:** Punto de restauración antes de implementar Hot Standby
- **Archivos:**
  - `app.js` (Bot orchestrator)
  - `server/index.js` (API + Web App)
  - `server/store.js` (Persistencia)
- **Estado del sistema:** Funcional, con reconexiones de ~3 minutos
- **Manifiesto completo:** `backups/backup_20260222_151500_pre_hot_standby/MANIFIESTO.md`

---

## 📁 Estructura de Directorios

```
recuperacion/
├── reglas_para_el_backup.md       # Reglas CRÍTICAS de gestión
├── COMO_RECUPERAR_BACKUPS.md      # Guía paso a paso
├── MANIFIESTO_BACKUPS.md          # Este archivo
└── backups/
    └── backup_20260222_151500_pre_hot_standby/
        ├── app.js
        ├── server/index.js
        ├── server/store.js
        └── MANIFIESTO.md
```

---

## 🔄 Política de Actualización

Este manifiesto se actualiza cuando:

1. ✅ Se crea un **nuevo backup**
2. ✅ Se **elimina** un backup (solo si está corrupto, excepcional)
3. ✅ Se **modifica** el estado de un backup (ej: de "testing" a "estable")

---

## ⚠️ RECORDATORIO CRÍTICO

> **Los backups en esta carpeta son INMUTABLES**
> 
> - ❌ NUNCA mover archivos DESDE `backups/`
> - ❌ NUNCA editar archivos DENTRO de `backups/`
> - ❌ NUNCA eliminar backups existentes
> - ✅ SIEMPRE copiar para restaurar
> - ✅ SIEMPRE crear nuevos directorios para nuevos backups

---

## 📊 Estadísticas

- **Total de backups:** 2
- **Espacio utilizado:** ~100 KB
- **Backup más reciente:** backup_20260222_153000_hot_standby_implementado
- **Backup más antiguo:** backup_20260222_151500_pre_hot_standby
- **Backups estables:** 1
- **Backups en testing:** 1

---

**Última actualización:** 22 de Febrero, 2026 - 15:30
**Responsable:** Equipo de Desarrollo
