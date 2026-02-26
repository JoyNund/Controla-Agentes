# 🎯 CAPACIDADES DE AGENTES - IMPLEMENTACIÓN

**Fecha:** 25 de Febrero, 2026
**Versión:** 1.0.0
**Estado:** ✅ IMPLEMENTADO

---

## 📋 DESCRIPCIÓN

Sistema de capacidades configurables por agente que permite activar/desactivar individualmente:
- **💰 Procesar Pagos con OCR**: Procesamiento automático de comprobantes de pago (Yape, Plin, BCP, etc.)
- **📅 Agendar Citas**: Gestión completa de citas/reuniones directamente en el chat

Cada agente tiene estas capacidades **por defecto activadas**, pero pueden desactivarse individualmente según las necesidades del cliente o plan de pago.

---

## 🏗️ ARQUITECTURA

### **Niveles de Control:**

```
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 1: FEATURE FLAGS GLOBALES (settings.json)                │
│  - features.ocrPagos: true/false                                │
│  - features.gestionsCitas: true/false                           │
│  → Controla si el sistema está disponible en toda la plataforma │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 2: CAPACIDADES POR AGENTE (agents.json)                  │
│  - capabilities.procesarPagos: true/false                       │
│  - capabilities.agendarCitas: true/false                        │
│  → Controla qué capacidades tiene cada agente individualmente   │
└─────────────────────────────────────────────────────────────────┘
```

### **Jerarquía de Validación:**

```
¿Feature flag global activado? (settings.json)
    ↓ SÍ
¿Capacidad del agente activada? (agent.capabilities)
    ↓ SÍ
Ejecutar funcionalidad (OCR / Citas)
    ↓ NO
Omitir silenciosamente + log en consola
```

---

## 📁 ARCHIVOS MODIFICADOS

### **Backend:**

| Archivo | Cambios |
|---------|---------|
| `server/data/settings.json` | + `features.gestionsCitas: true` |
| `server/data/agents.json` | + `capabilities: { procesarPagos: true, agendarCitas: true }` en cada agente |
| `services/agenteIA.js` | + Verificación de capacidades antes de inyectar instrucciones en system prompt |
| `app.js` | + Verificación de capacidades antes de procesar OCR y citas |
| `app.js` | + `agentCapabilities` en estructura de conexión |
| `app.js` | + Logs de capacidades al iniciar conexión |

### **Frontend:**

| Archivo | Cambios |
|---------|---------|
| `webapp/src/pages/Agentes.jsx` | + Sección "CAPACIDADES DEL AGENTE" con 2 checkboxes |
| `webapp/src/pages/Agentes.jsx` | + Estado `capabilities` en form |
| `webapp/src/pages/Agentes.jsx` | + Valores por defecto en creación de agentes |

---

## 🔧 CONFIGURACIÓN

### **1. Feature Flags Globales (settings.json)**

```json
{
  "features": {
    "ocrPagos": true,        // Si false: NINGÚN agente procesa pagos
    "gestionsCitas": true    // Si false: NINGÚN agente agenda citas
  }
}
```

**Uso:** Desactivar toda la plataforma temporalmente sin tocar cada agente.

### **2. Capacidades por Agente (agents.json)**

```json
{
  "id": "ag_1771820574440_o3932v",
  "name": "CONTROLA",
  "capabilities": {
    "procesarPagos": true,   // Si false: este agente NO procesa pagos
    "agendarCitas": true     // Si false: este agente NO agenda citas
  },
  ...
}
```

**Uso:** Controlar qué capacidades tiene cada agente individualmente.

### **3. UI - Frontend (Agentes.jsx)**

Al editar/crear un agente:

```
⚙️ CAPACIDADES DEL AGENTE
┌────────────────────────────────────────────────────────┐
│ ☑ 💰 Procesar Pagos con OCR                            │
│   Permite al agente recibir y procesar comprobantes    │
│   de pago (Yape, Plin, BCP, etc.) mediante OCR.        │
│                                                        │
│ ☑ 📅 Agendar Citas                                     │
│   Permite al agente agendar, modificar y cancelar      │
│   citas/reuniones directamente en el chat.             │
└────────────────────────────────────────────────────────┘
```

---

## 🎯 FLUJO DE FUNCIONAMIENTO

### **Procesamiento de Pagos (OCR):**

```
1. Cliente envía imagen de comprobante
   ↓
2. app.js detecta imagen
   ↓
3. VERIFICAR: settings.features.ocrPagos === true
   ↓ SÍ
4. VERIFICAR: agent.capabilities.procesarPagos !== false
   ↓ SÍ
5. Ejecutar OCR Service
   ↓
6. Si es pago válido → modificar body del mensaje
   ↓
7. Agente IA responde naturalmente al OCR
```

### **Agendamiento de Citas:**

```
1. Cliente solicita agendar cita
   ↓
2. app.js verifica capacidad: agent.capabilities.agendarCitas !== false
   ↓ SÍ
3. Inyectar contexto de citas en el prompt de IA
   ↓
4. IA genera JSON de confirmación: __CITA_CONFIRMADA__{...}__FIN_CITA__
   ↓
5. app.js detecta JSON y crea cita en backend
   ↓
6. Enviar confirmación al cliente
```

---

## 📊 EJEMPLOS DE USO

### **Escenario 1: Agente básico (sin capacidades)**

```json
{
  "name": "Agente Básico",
  "capabilities": {
    "procesarPagos": false,
    "agendarCitas": false
  }
}
```

**Comportamiento:**
- ❌ No procesa pagos (ignora imágenes de comprobantes)
- ❌ No agenda citas (no inyecta contexto de citas)
- ✅ Responde preguntas generales normalmente

### **Escenario 2: Agente de ventas (solo pagos)**

```json
{
  "name": "Agente Ventas",
  "capabilities": {
    "procesarPagos": true,
    "agendarCitas": false
  }
}
```

**Comportamiento:**
- ✅ Procesa pagos con OCR
- ❌ No agenda citas
- ✅ Ideal para e-commerce que solo recibe pagos

### **Escenario 3: Agente de reservas (solo citas)**

```json
{
  "name": "Agente Reservas",
  "capabilities": {
    "procesarPagos": false,
    "agendarCitas": true
  }
}
```

**Comportamiento:**
- ❌ No procesa pagos
- ✅ Agenda citas/reuniones
- ✅ Ideal para servicios profesionales

### **Escenario 4: Agente completo (ambas capacidades)**

```json
{
  "name": "CONTROLA",
  "capabilities": {
    "procesarPagos": true,
    "agendarCitas": true
  }
}
```

**Comportamiento:**
- ✅ Procesa pagos con OCR
- ✅ Agenda citas/reuniones
- ✅ Funcionalidad completa

---

## 🔍 LOGS Y DEBUGGING

### **Logs al iniciar conexión:**

```
[conn_XXX] === INICIANDO CONEXIÓN RÁPIDA ===
[conn_XXX] Agente: CONTROLA
[conn_XXX] Capacidades: procesarPagos=true, agendarCitas=true
```

### **Logs al procesar imagen:**

```
[conn_XXX] 📸 [OCR] Imagen detectada, procesando...
[conn_XXX] [OCR] Resultado: { esPago: true, monto: 50, banco: 'Yape' }
[conn_XXX] [OCR] Body reemplazado con mensaje OCR para que el agente responda
```

### **Logs cuando capacidad está desactivada:**

```
[conn_XXX] ⚠️ [OCR] Imagen ignorada - capacidad procesarPagos desactivada para este agente
[conn_XXX] ⚠️ Citas desactivadas - capacidad agendarCitas=false
[conn_XXX] ⚠️ Cita ignorada - capacidad agendarCitas desactivada
```

---

## 🛡️ SEGURIDAD

### **Validaciones en Cascada:**

1. **Feature flag global** → Evita procesamiento si está desactivado
2. **Capacidad del agente** → Verifica permisos individuales
3. **Validación de datos** → JSON de citas debe tener campos requeridos
4. **Error handling** → Errores no propagan, se loguean y continúan

### **Backup Automático:**

Antes de implementar cambios:
```bash
/var/www/agentes/recuperacion/backups/backup_20260225_capacidades_agentes/
├── agents.json.pre-capacidades
├── settings.json.pre-capacidades
├── agenteIA.js.pre-capacidades
└── Agentes.jsx.pre-capacidades
```

---

## 🧪 TESTING

### **Procesar Pagos:**

1. **Activar capacidad:**
   ```json
   "capabilities": { "procesarPagos": true }
   ```

2. **Enviar comprobante:**
   - Enviar imagen de Yape/Plin/BCP con monto visible

3. **Verificar:**
   ```bash
   pm2 logs agentes-bot | grep -E "OCR|pago|Puntaje"
   ```

4. **Desactivar capacidad:**
   ```json
   "capabilities": { "procesarPagos": false }
   ```

5. **Verificar que ignora:**
   ```bash
   pm2 logs agentes-bot | grep "procesarPagos desactivada"
   ```

### **Agendar Citas:**

1. **Activar capacidad:**
   ```json
   "capabilities": { "agendarCitas": true }
   ```

2. **Solicitar cita en WhatsApp:**
   - "Quiero agendar una cita"

3. **Verificar:**
   ```bash
   pm2 logs agentes-bot | grep "Cita creada"
   ```

4. **Desactivar capacidad:**
   ```json
   "capabilities": { "agendarCitas": false }
   ```

5. **Verificar que no inyecta contexto:**
   ```bash
   pm2 logs agentes-bot | grep "agendarCitas=false"
   ```

---

## 📈 MÉTRICAS

| Métrica | Antes | Ahora |
|---------|-------|-------|
| Capacidades por agente | 0 (fijas) | 2 configurables |
| Feature flags globales | 1 (ocrPagos) | 2 (ocrPagos, gestionsCitas) |
| Líneas de código | ~1727 | ~1757 (+30) |
| Archivos modificados | - | 6 |

---

## 🔄 MIGRACIÓN DE AGENTES EXISTENTES

### **Script de migración automática:**

```javascript
const agents = JSON.parse(fs.readFileSync('server/data/agents.json', 'utf8'));

agents.forEach(agent => {
    if (!agent.capabilities) {
        agent.capabilities = {
            procesarPagos: true,
            agendarCitas: true
        };
        agent.updatedAt = new Date().toISOString();
    }
});

fs.writeFileSync('server/data/agents.json', JSON.stringify(agents, null, 2));
```

**Resultado:** Todos los agentes existentes tienen ambas capacidades activadas por defecto.

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### **OCR no procesa pagos:**

1. Verificar feature flag global:
   ```bash
   cat server/data/settings.json | grep ocrPagos
   ```

2. Verificar capacidad del agente:
   ```bash
   cat server/data/agents.json | grep -A2 capabilities
   ```

3. Verificar logs:
   ```bash
   pm2 logs agentes-bot | grep -E "OCR|procesarPagos"
   ```

### **Citas no se agendan:**

1. Verificar feature flag global:
   ```bash
   cat server/data/settings.json | grep gestionsCitas
   ```

2. Verificar capacidad del agente:
   ```bash
   cat server/data/agents.json | grep -A2 capabilities
   ```

3. Verificar logs:
   ```bash
   pm2 logs agentes-bot | grep -E "cita|agendarCitas"
   ```

### **Frontend no muestra checkboxes:**

1. Limpiar caché del navegador
2. Verificar build de React:
   ```bash
   cd webapp && npm run build
   ```

---

## 📝 NOTAS IMPORTANTES

1. **Valores por defecto:** Nuevos agentes tienen ambas capacidades **activadas** por defecto
2. **Retrocompatibilidad:** Agentes sin campo `capabilities` se tratan como si tuvieran ambas activadas
3. **Feature flags:** Si un feature flag global está en `false`, ninguna capacidad funciona aunque esté activada
4. **Logs:** Todas las omisiones por capacidades desactivadas se loguean para debugging
5. **Tier de pago:** La infraestructura está lista para integrar con sistema de planes (pendiente)

---

## 🔮 PRÓXIMOS PASOS (Tier de Pago)

### **Pendiente de implementación:**

```json
{
  "plans": {
    "basic": {
      "procesarPagos": false,
      "agendarCitas": false,
      "maxAgents": 1
    },
    "pro": {
      "procesarPagos": true,
      "agendarCitas": false,
      "maxAgents": 3
    },
    "enterprise": {
      "procesarPagos": true,
      "agendarCitas": true,
      "maxAgents": 10
    }
  }
}
```

**Requerimientos:**
- [ ] Agregar campo `plan` a conexiones
- [ ] Validar plan antes de activar capacidades
- [ ] UI para upgrade de plan
- [ ] Sistema de facturación

---

**Última actualización:** 25 de Febrero, 2026
**Versión:** 1.0.0
**Estado:** ✅ FUNCIONAL EN PRODUCCIÓN
**Responsable:** Asistente de IA
