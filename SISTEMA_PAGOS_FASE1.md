# 💎 SISTEMA DE PAGOS PARA CAPACIDADES - FASE 1

**Fecha:** 25 de Febrero, 2026
**Estado:** ✅ UI IMPLEMENTADA
**Fase:** 1 de 3

---

## 🎯 OBJETIVO

Implementar un sistema de pagos que permita desbloquear las capacidades avanzadas de los agentes:
- 💰 Procesar Pagos con OCR
- 📅 Agendar Citas

---

## 📊 FASES DE IMPLEMENTACIÓN

### **Fase 1: UI de Habilitación** ✅ COMPLETADA
- Switches visuales para activar/desactivar capacidades
- Indicador de "Requiere plan de pago"
- Feedback visual del estado (habilitado/deshabilitado)

### **Fase 2: Validación de Plan** ⏳ PENDIENTE
- Agregar campo `plan` a conexiones/agentes
- Validar plan antes de permitir activar capacidades
- Endpoint para verificar estado del plan

### **Fase 3: Integración con Pagos** ⏳ PENDIENTE
- Endpoints para crear/cancelar suscripciones
- Webhook de confirmación de pago
- Actualización automática de capacidades

---

## 🎨 CAMBIOS EN LA UI

### **Nuevo Diseño de Capacidades:**

```
┌─────────────────────────────────────────────────────────┐
│ ⚙️ CAPACIDADES DEL AGENTE        💎 Requiere plan de pago │
├─────────────────────────────────────────────────────────┤
│ Habilita capacidades avanzadas para este agente.        │
│ Estas funciones están disponibles según el plan         │
│ contratado.                                             │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 💰 Procesar Pagos con OCR          [OFF/ON]    │   │
│ │    Recibe comprobantes de Yape, Plin, BCP      │   │
│ │    automáticamente                             │   │
│ │                                                │   │
│ │    ✅ Habilitado - Los pagos se procesarán     │   │
│ │       automáticamente                          │   │
│ └─────────────────────────────────────────────────┘   │
│                                                         │
│ ┌─────────────────────────────────────────────────┐   │
│ │ 📅 Agendar Citas                   [OFF/ON]    │   │
│ │    Gestiona reuniones directamente en el chat  │   │
│ │                                                │   │
│ │    ⚠️ Deshabilitado - El agente no podrá      │   │
│ │       gestionar citas                          │   │
│ └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### **Características del Nuevo Diseño:**

1. **Switches Modernos:** Toggle switches en lugar de checkboxes
2. **Cards Separadas:** Cada capacidad en su propia tarjeta
3. **Feedback Visual:** Mensaje de estado debajo de cada switch
4. **Indicador Premium:** Badge "💎 Requiere plan de pago"
5. **Default Deshabilitado:** Nuevos agentes comienzan con capacidades OFF

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `webapp/src/pages/Agentes.jsx` | + UI de switches moderna<br>+ Default capabilities: false<br>+ Feedback visual de estado |

---

## 🔧 COMPORTAMIENTO ACTUAL

### **Para Agentes Existentes:**
- Mantienen sus capacidades actuales (si ya tenían `true`)
- Pueden ser editados desde la UI

### **Para Nuevos Agentes:**
- Default: `procesarPagos: false`, `agendarCitas: false`
- Usuario debe activar manualmente (próximamente: requerirá pago)

---

## 🎯 PRÓXIMOS PASOS (Fase 2)

### **1. Estructura de Planes:**

```json
{
  "plans": {
    "free": {
      "name": "Gratuito",
      "price": 0,
      "capabilities": {
        "procesarPagos": false,
        "agendarCitas": false
      }
    },
    "basic": {
      "name": "Básico",
      "price": 29.90,
      "capabilities": {
        "procesarPagos": true,
        "agendarCitas": false
      }
    },
    "pro": {
      "name": "Profesional",
      "price": 59.90,
      "capabilities": {
        "procesarPagos": true,
        "agendarCitas": true
      }
    }
  }
}
```

### **2. Campos a Agregar:**

**En agents.json:**
```json
{
  "id": "ag_XXX",
  "name": "Agente",
  "plan": "free",  // ← NUEVO
  "capabilities": { ... },
  "planExpiresAt": null  // ← NUEVO (fecha de expiración del plan)
}
```

**En connections.json:**
```json
{
  "id": "conn_XXX",
  "name": "Conexión",
  "plan": "free",  // ← NUEVO
  "planExpiresAt": null  // ← NUEVO
}
```

### **3. Validaciones:**

**Backend (server/index.js):**
```javascript
// Al activar capacidad, verificar plan
function validateCapability(agentId, capability) {
    const agent = agents.get(agentId);
    const plan = plans[agent.plan];
    
    if (!plan.capabilities[capability]) {
        throw new Error('Esta capacidad requiere un plan superior');
    }
    
    if (agent.planExpiresAt && new Date() > new Date(agent.planExpiresAt)) {
        throw new Error('Plan expirado. Renueva para continuar usando esta capacidad.');
    }
    
    return true;
}
```

---

## 🧪 TESTING

### **Probar Nueva UI:**

1. **Abrir panel:** `http://localhost:3847`
2. **Ir a:** Configurar Agentes
3. **Editar agente existente:**
   - Ver switches en posición actual (ON si ya estaban activas)
   - Ver indicador "💎 Requiere plan de pago"
   
4. **Crear agente nuevo:**
   - Ver switches en OFF por defecto
   - Activar manualmente para probar

---

## 📊 ESTADO ACTUAL DE AGENTES

| Agente | procesarPagos | agendarCitas | Estado |
|--------|---------------|--------------|--------|
| CONTROLA | true → ✅ | true → ✅ | Mantener actuales |
| Anandara | true → ✅ | true → ✅ | Mantener actuales |
| Lethal | true → ✅ | true → ✅ | Mantener actuales |

**Nota:** Los agentes existentes mantienen sus capacidades. Solo los nuevos comienzan deshabilitados.

---

## 💡 DECISIONES DE DISEÑO

### **¿Por qué default OFF?**

1. **Modelo Freemium:** Permite tener agentes básicos gratis
2. **Upsell Visual:** El usuario ve lo que está perdiendo
3. **Control Total:** El admin decide qué capacidades dar

### **¿Por qué switches en lugar de checkboxes?**

1. **Más moderno:** Mejor experiencia de usuario
2. **Más claro:** Estado ON/OFF es más evidente
3. **Premium feel:** Se siente como una característica premium

---

## 🔍 CAPTURES DE PANTALLA (Descripción)

### **Estado Deshabilitado:**
```
┌─────────────────────────────────────────┐
│ 💰 Procesar Pagos con OCR    ⚪──○     │
│    Recibe comprobantes...              │
│                                        │
│ ⚠️ Deshabilitado - El agente no podrá │
│    procesar pagos                      │
└─────────────────────────────────────────┘
```

### **Estado Habilitado:**
```
┌─────────────────────────────────────────┐
│ 💰 Procesar Pagos con OCR    ○──● ✅   │
│    Recibe comprobantes...              │
│                                        │
│ ✅ Habilitado - Los pagos se procesarán│
│    automáticamente                     │
└─────────────────────────────────────────┘
```

---

**Fecha:** 25 de Febrero, 2026  
**Fase:** 1/3 Completa  
**Próximo:** Implementar validación de planes (Fase 2)
