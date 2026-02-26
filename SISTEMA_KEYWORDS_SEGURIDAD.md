# 🔒 SISTEMA DE PALABRAS CLAVE DE SEGURIDAD

**Fecha de implementación:** 23 de Febrero, 2026
**Versión:** 1.0.0
**Estado:** ✅ IMPLEMENTADO

---

## 📋 RESUMEN

Se implementó un sistema de **palabras clave de seguridad** para proteger acciones críticas en la GUI. Este sistema proporciona una capa de confirmación que da la sensación de seguridad sin ser criptográficamente seguro.

---

## 🎯 OBJETIVO

Prevenir acciones accidentales o no autorizadas en la interfaz gráfica, requiriendo una palabra clave para:

- ✅ Crear nuevos agentes
- ✅ Editar agentes existentes
- ✅ Eliminar agentes
- ✅ Crear nuevas conexiones
- ✅ Asignar agente a conexión
- ✅ Cerrar sesión en conexión (logout)
- ✅ Reiniciar conexión
- ✅ Eliminar conexión

---

## 🔐 ARQUITECTURA

### Encriptación

Las palabras clave se almacenan con **ofuscación hexadecimal simple**:

```javascript
// Texto plano → Hex
"John0306" → "4a6f686e30333036"
"Cata" → "43617461"
"Holistic" → "486f6c6973746963"
```

**Nota:** Esto NO es seguridad criptográfica real, solo ofuscación visual para que las palabras clave no sean legibles directamente en los archivos JSON.

### Estructura de Datos

#### 1. Settings (server/data/settings.json)

```json
{
  "security": {
    "masterKeyword": "4a6f686e30333036",
    "keywords": {
      "agent_create": "4a6f686e30333036",
      "agent_edit": "4a6f686e30333036",
      "agent_delete": "4a6f686e30333036",
      "connection_create": "4a6f686e30333036",
      "connection_toggle": "4a6f686e30333036",
      "connection_delete": "4a6f686e30333036",
      "connection_assign_agent": "4a6f686e30333036"
    }
  }
}
```

#### 2. Agentes (server/data/agents.json)

Cada agente tiene su propia keyword:

```json
{
  "id": "ag_XXX",
  "name": "CONTROLA",
  "keyword": "4a6f686e30333036",
  ...
}
```

#### 3. Conexiones (server/data/connections.json)

Cada conexión tiene su propia keyword:

```json
{
  "id": "conn_XXX",
  "name": "nuevooo",
  "keyword": "4a6f686e30333036",
  ...
}
```

---

## 🔄 FLUJO DE VALIDACIÓN

### Para Acciones Generales

```
┌─────────────────────────────────┐
│  Usuario hace acción crítica    │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Modal solicita palabra clave   │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend valida:                │
│  1. Keyword específica de acción│
│  2. O Master Keyword            │
└──────────────┬──────────────────┘
               │
         ┌─────┴─────┐
         │           │
         ▼           ▼
      ✅ Válida   ❌ Inválida
         │           │
         ▼           ▼
    Ejecuta     Error 403
    acción      "Palabra clave
                incorrecta"
```

### Para Eliminar/Editar Agente

```
┌─────────────────────────────────┐
│  Usuario elimina agente         │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend valida:                │
│  1. Keyword del agente ESPECÍFICA│
│  2. O Master Keyword            │
└──────────────┬──────────────────┘
```

### Para Asignar Agente a Conexión

```
┌─────────────────────────────────┐
│  Usuario asigna agente          │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Backend valida AMBAS:          │
│  1. Keyword de la conexión      │
│  2. Keyword del agente (si tiene)│
└──────────────┬──────────────────┘
```

---

## 📁 ARCHIVOS MODIFICADOS

### Backend

| Archivo | Cambios |
|---------|---------|
| `server/index.js` | + Funciones `hexToString()`, `validateKeyword()`, `requireKeyword()` |
| `server/index.js` | Endpoints protegidos: agents CRUD, connections CRUD, assign-agent, logout, restart |
| `server/store.js` | `connections.create()` ahora guarda keyword |
| `server/data/settings.json` | Nueva sección `security.keywords` y `security.masterKeyword` |
| `server/data/agents.json` | Campo `keyword` en cada agente |
| `server/data/connections.json` | Campo `keyword` en cada conexión |

### Frontend

| Archivo | Cambios |
|---------|---------|
| `webapp/src/components/KeywordModal.jsx` | **NUEVO** - Componente de modal para ingresar keyword |
| `webapp/src/pages/Agentes.jsx` | + Campo keyword en formulario, + Modal para eliminar |
| `webapp/src/pages/Conexion.jsx` | + Campo keyword en creación, + Modales para logout/restart/delete/assign |
| `webapp/src/pages/Configuraciones.jsx` | + Sección para gestionar Master Keyword |
| `webapp/src/api.js` | Funciones actualizadas para enviar keyword |

---

## 🔑 PALABRAS CLAVE ACTUALES

### Agentes

| Agente | ID | Palabra Clave | Hex |
|--------|-----|---------------|-----|
| CONTROLA | `ag_1770876627427_3rxa1w` | `John0306` | `4a6f686e30333036` |
| Anandara | `ag_1771716619160_g57ihv` | `Holistic` | `486f6c6973746963` |
| lol test | `ag_1771619969896_bzbrns` | *(sin keyword)* | - |
| qwen | `ag_1771751273756_z8xdv2` | *(sin keyword)* | - |

### Conexiones

| Conexión | ID | Teléfono | Palabra Clave | Hex |
|----------|-----|----------|---------------|-----|
| nuevooo | `conn_1771700341570_k4fg` | 51903172378 | `John0306` | `4a6f686e30333036` |
| every | `conn_1771700517574_e3p2` | 51933902835 | `Cata` | `43617461` |
| anandara | `conn_1771716632752_hy1q` | 51903291831 | `Holistic` | `486f6c6973746963` |

### Master Keyword

| Valor | Hex |
|-------|-----|
| `John0306` | `4a6f686e30333036` |

---

## 🧪 PRUEBAS

### Casos de Prueba

| Acción | Keyword Requerida | Estado |
|--------|------------------|--------|
| Crear agente | Master o específica | ✅ Funcional |
| Editar agente | Master o del agente | ✅ Funcional |
| Eliminar agente | Master o del agente | ✅ Funcional |
| Crear conexión | Master o específica | ✅ Funcional |
| Asignar agente | Master + agente (si tiene) | ✅ Funcional |
| Logout conexión | Master o de conexión | ✅ Funcional |
| Restart conexión | Master o de conexión | ✅ Funcional |
| Eliminar conexión | Master o de conexión | ✅ Funcional |

### Comandos de Verificación

```bash
# Health check
curl http://localhost:3848/api/health | python3 -m json.tool

# Probar endpoint protegido (sin keyword - debe fallar)
curl -X DELETE http://localhost:3848/api/agents/XXX \
  -H "Content-Type: application/json" \
  -H "Cookie: session=XXX" \
  -d '{}'

# Probar endpoint protegido (con keyword - debe funcionar)
curl -X DELETE http://localhost:3848/api/agents/XXX \
  -H "Content-Type: application/json" \
  -H "Cookie: session=XXX" \
  -d '{"keyword": "John0306"}'
```

---

## ⚠️ ADVERTENCIAS DE SEGURIDAD

### Esto NO es seguridad criptográfica

- ⚠️ Las palabras clave están encriptadas en HEX simple (fácil de revertir)
- ⚠️ Cualquier persona con acceso al servidor puede leer los archivos JSON
- ⚠️ No protege contra ataques reales, solo previene acciones accidentales

### Propósito Real

- ✅ Prevenir clicks accidentales
- ✅ Dar sensación de seguridad al usuario
- ✅ Añadir paso de confirmación consciente
- ✅ **NO** reemplaza autenticación real

---

## 🔄 MIGRACIÓN DE DATOS EXISTENTES

Las conexiones y agentes creados antes de esta implementación ya tienen sus palabras clave asignadas:

```bash
# No se requiere migración manual
# Los datos existentes fueron actualizados automáticamente
```

### Para Nuevos Elementos

- **Nuevos agentes:** Se debe establecer keyword al crear (opcional, pero recomendado)
- **Nuevas conexiones:** Se debe establecer keyword al crear (opcional, pero recomendado)
- **Si no se establece keyword:** Solo se podrá usar la Master Keyword

---

## 📝 NOTAS DE USO

### Para Usuarios

1. **Al crear un agente/conexión:**
   - Establece una palabra clave única y memorable
   - Anótala en un lugar seguro
   - Usa la Master Keyword si no quieres una específica

2. **Al realizar acciones críticas:**
   - El modal te pedirá la palabra clave
   - Puedes usar la keyword específica del elemento O la Master Keyword
   - Si fallas 3 veces, el sistema se bloqueará temporalmente (futuro)

3. **Olvidaste tu keyword:**
   - Usa la Master Keyword (por defecto: `John0306`)
   - Un administrador puede resetearla en Configuraciones

### Para Administradores

1. **Cambiar Master Keyword:**
   - Ve a Configuraciones → Seguridad
   - Ingresa la nueva palabra clave
   - Guarda los cambios

2. **Resetear keyword de agente/conexión:**
   - Edita el archivo JSON correspondiente
   - O elimina y vuelve a crear el elemento

---

## 🚨 ROLLBACK

Si hay problemas críticos:

```bash
# 1. Detener el servidor
pm2 stop agentes-api

# 2. Restaurar archivos originales
cp /var/www/agentes/recuperacion/backups/backup_20260222_151500_pre_hot_standby/server/data/settings.json /var/www/agentes/server/data/settings.json
cp /var/www/agentes/recuperacion/backups/backup_20260222_151500_pre_hot_standby/server/data/agents.json /var/www/agentes/server/data/agents.json
cp /var/www/agentes/recuperacion/backups/backup_20260222_151500_pre_hot_standby/server/data/connections.json /var/www/agentes/server/data/connections.json

# 3. Reiniciar
pm2 start agentes-api
```

---

## 📚 DOCUMENTACIÓN RELACIONADA

| Archivo | Propósito |
|---------|-----------|
| `QWEN.md` | Contexto general del proyecto |
| `ESTADO_ACTUAL_2026_02_22.md` | Estado del sistema Hot Standby |
| `recuperacion/README.md` | Guía de recuperación |

---

**Última actualización:** 23 de Febrero, 2026
**Responsable:** Asistente de IA
**Estado:** ✅ FUNCIONAL
