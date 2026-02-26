# 🛠️ Carpeta de Recuperación - CONTROLA.Agentes

## 📁 Propósito

Esta carpeta contiene **todos los backups** y herramientas necesarias para recuperar el sistema en caso de problemas.

---

## 🚀 Uso Rápido

### Método Recomendado: Script Automático

```bash
cd /var/www/agentes/recuperacion

# Listar backups disponibles
./recuperar.sh --list

# Restaurar último backup
./recuperar.sh --latest

# Restaurar backup específico
./recuperar.sh --restore backup_20260222_151500_pre_hot_standby
```

---

## 📂 Estructura de Archivos

```
recuperacion/
├── README.md                        # Este archivo
├── recuperar.sh                     # Script automático de recuperación
├── reglas_para_el_backup.md         # Reglas CRÍTICAS de gestión
├── COMO_RECUPERAR_BACKUPS.md        # Guía completa paso a paso
├── MANIFIESTO_BACKUPS.md            # Lista de todos los backups
└── backups/
    ├── backup_20260222_151500_pre_hot_standby/
    │   ├── app.js                   # Backup del bot orchestrator
    │   ├── index.js                 # Backup de la API
    │   ├── store.js                 # Backup del store
    │   └── MANIFIESTO.md            # Detalles de este backup
    └── backup_20260222_153000_hot_standby_implementado/
        └── ...
```

---

## 🔧 Comandos del Script

| Comando | Descripción |
|---------|-------------|
| `./recuperar.sh` | Lista backups disponibles |
| `./recuperar.sh --list` | Lista backups disponibles |
| `./recuperar.sh --verify ID` | Verifica integridad de un backup |
| `./recuperar.sh --restore ID` | Restaura backup específico |
| `./recuperar.sh --latest` | Restaura el backup más reciente |
| `./recuperar.sh --help` | Muestra ayuda completa |

---

## ⚠️ Reglas Críticas

### 🚫 NUNCA HACER

- ❌ Mover archivos DESDE `backups/`
- ❌ Editar archivos DENTRO de `backups/`
- ❌ Eliminar backups existentes
- ❌ Reemplazar archivos en backups

### ✅ SIEMPRE HACER

- ✅ COPIAR archivos para restaurar
- ✅ Crear nuevos directorios para nuevos backups
- ✅ Verificar integridad antes de restaurar
- ✅ Mantener backups originales intactos

---

## 📚 Documentación Relacionada

| Archivo | Propósito |
|---------|-----------|
| `reglas_para_el_backup.md` | Reglas fundamentales de gestión |
| `COMO_RECUPERAR_BACKUPS.md` | Guía detallada con todos los escenarios |
| `MANIFIESTO_BACKUPS.md` | Lista y estado de todos los backups |
| `backups/XXX/MANIFIESTO.md` | Detalles específicos de cada backup |

---

## 🔍 Verificación Rápida

```bash
# Verificar que todo está en lugar
ls -la

# Verificar backups disponibles
ls -lht backups/

# Verificar script es ejecutable
file recuperar.sh
# Debe decir: "POSIX shell script executable"
```

---

## 🆘 Emergencia

Si el sistema está caído y necesitas restaurar **INMEDIATAMENTE**:

```bash
cd /var/www/agentes/recuperacion
./recuperar.sh --latest
```

El script:
1. Lista el backup más reciente
2. Verifica integridad
3. Detiene servicios
4. Copia archivos
5. Reinicia servicios
6. Muestra estado final

---

## 📞 Soporte

Para más información, consultar:
- `COMO_RECUPERAR_BACKUPS.md` - Guía completa de recuperación
- `reglas_para_el_backup.md` - Reglas de gestión

---

**Última actualización:** 22 de Febrero, 2026
**Versión:** 1.0
