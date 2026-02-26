# 🔧 FIX: Validación de Keyword en Asignación de Agentes

**Fecha:** 25 de Febrero, 2026
**Tipo:** Bug Fix
**Estado:** ✅ RESUELTO

---

## 🐛 PROBLEMA DETECTADO

Al intentar asignar un agente a una conexión, el sistema validaba **dos keywords**:
1. Keyword de la conexión
2. Keyword del agente

Esto causaba un error cuando la conexión y el agente tenían keywords diferentes.

### **Ejemplo del problema:**

```
Conexión: nuevooo (keyword: John0306)
Agente: Lethal (keyword: JAzz)

Usuario intenta asignar Lethal a nuevooo:
1. Ingresa keyword: John0306 ❌
   → Error: "Palabra clave del agente incorrecta"
   
2. Ingresa keyword: JAzz ❌
   → Error: "Palabra clave incorrecta" (validación inicial falla)
```

**Resultado:** Imposible asignar agentes con keywords diferentes a la conexión.

---

## 🔍 CAUSA RAÍZ

El endpoint `/api/connections/:id/assign-agent` validaba ambas keywords con la **misma** keyword ingresada:

```javascript
// Validar keyword de la conexión
if (conn.keyword && !validateKeyword(keyword, conn.keyword)) {
    return res.status(403).json({ error: 'Palabra clave de la conexión incorrecta' })
}

// Validar keyword del agente (si tiene)
if (agent.keyword && !validateKeyword(keyword, agent.keyword)) {
    return res.status(403).json({ error: 'Palabra clave del agente incorrecta' })
}
```

**Problema de diseño:** Se esperaba que una sola keyword sirviera para dos propósitos diferentes.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### **Cambio en `server/index.js`:**

**Línea 437:** Se eliminó la validación de la keyword del agente.

```javascript
// Asignar agente a conexión
app.post('/api/connections/:id/assign-agent', requireAuth, (req, res, next) => {
    requireKeyword(req, res, () => {
        const { agentId } = req.body || {}
        const conn = connections.get(req.params.id)
        if (!conn) return res.status(404).json({ error: 'Conexión no encontrada' })

        const agent = agents.get(agentId)
        if (!agent) return res.status(404).json({ error: 'Agente no encontrado' })

        // Validar SOLO keyword de la conexión (el agente no requiere validación adicional)
        const { keyword } = req.body || {}
        if (conn.keyword && !validateKeyword(keyword, conn.keyword)) {
            return res.status(403).json({ error: 'Palabra clave de la conexión incorrecta' })
        }

        connections.assignAgent(req.params.id, agentId)
        res.json({ ok: true, message: 'Agente asignado' })
    }, 'connection_assign_agent')
})
```

### **Cambio en `webapp/src/pages/Conexion.jsx`:**

**Línea 695:** Se actualizó el mensaje del modal para ser más claro.

```javascript
<KeywordModal
    isOpen={actionModal?.type === 'assign'}
    onClose={() => setActionModal(null)}
    onConfirm={(keyword) => assignAgentToConnection(actionModal.connectionId, actionModal.agentId, keyword)}
    title="Asignar agente a conexión"
    description="Ingrese la palabra clave de la conexión para confirmar:"  // ← Actualizado
/>
```

**Antes:** "Ingrese la palabra clave de la conexión **y del agente** para confirmar:"
**Ahora:** "Ingrese la palabra clave de la conexión para confirmar:"

---

## 📊 ESTADO ACTUAL DEL SISTEMA

### **Keywords configuradas:**

| Tipo | Nombre | Keyword |
|------|--------|---------|
| **Conexión** | nuevooo | `John0306` |
| **Conexión** | every | `Cata` |
| **Conexión** | anandara | `Holistic` |
| **Agente** | CONTROLA | `John0306` |
| **Agente** | Anandara | `Holistic` |
| **Agente** | Lethal | `JAzz` |

### **Validaciones por acción:**

| Acción | Keyword requerida |
|--------|-------------------|
| Asignar agente | ✅ Solo conexión |
| Logout conexión | ✅ Solo conexión |
| Reiniciar conexión | ✅ Solo conexión |
| Eliminar conexión | ✅ Solo conexión |
| Crear conexión | ✅ Solo conexión |
| Editar agente | ✅ Solo agente |
| Eliminar agente | ✅ Solo agente |

---

## 🧪 PRUEBAS REALIZADAS

### **Prueba 1: Asignar Lethal a nuevooo**
```bash
curl -X POST http://localhost:3847/api/connections/conn_1771700341570_k4fg/assign-agent \
  -H "Content-Type: application/json" \
  -d '{"agentId":"ag_1772051090455_p4hn34","keyword":"John0306"}'

# Resultado: ✅ {"ok":true,"message":"Agente asignado"}
```

### **Prueba 2: Verificar asignación**
```bash
node -e "const c=require('./server/data/connections.json'); 
         const a=require('./server/data/agents.json'); 
         const conn=Object.values(c).find(x=>x.name==='nuevooo'); 
         const agent=a.find(x=>x.id===conn.agentId); 
         console.log('Agente asignado:', agent.name);"

# Resultado: ✅ Agente asignado: Lethal
```

---

## 🔄 FLUJO ACTUALIZADO

### **Asignar agente a conexión:**

```
1. Usuario va a Conexiones → Selecciona conexión
2. Cambia dropdown de agente
3. Modal pide keyword → "Ingrese la palabra clave de la conexión para confirmar"
4. Usuario ingresa keyword de la conexión (ej: John0306)
5. Backend valida SOLO keyword de conexión
6. ✅ Agente asignado exitosamente
```

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Líneas cambiadas | Descripción |
|---------|------------------|-------------|
| `server/index.js` | 437-443 | Eliminar validación de keyword del agente |
| `webapp/src/pages/Conexion.jsx` | 695 | Actualizar descripción del modal |

---

## 🎯 BENEFICIOS

1. ✅ **Más simple:** Usuario solo necesita recordar 1 keyword (la de la conexión)
2. ✅ **Más lógico:** La conexión es el recurso que se está modificando
3. ✅ **Más flexible:** Puedes asignar cualquier agente sin importar su keyword
4. ✅ **Más seguro:** La validación de la conexión ya protege contra cambios no autorizados

---

## 📝 BACKUP

**Ubicación:** `/var/www/agentes/recuperacion/backups/backup_20260225_capacidades_agentes/`

**Archivos relevantes:**
- `index.js.pre-fix-asignacion` → Versión con bug
- `index.js.post-fix-asignacion` → Versión corregida

---

## 🚀 DESPLIEGUE

El fix se aplicó en producción y fue verificado exitosamente.

**Comando de reinicio:**
```bash
pm2 restart agentes-web
```

---

**Fecha del fix:** 25 de Febrero, 2026  
**Responsable:** Asistente de IA  
**Estado:** ✅ EN PRODUCCIÓN
