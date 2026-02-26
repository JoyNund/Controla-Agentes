# ⚙️ CAPACIDADES DE AGENTES - GUÍA RÁPIDA

**Para usuarios de CONTROLA.agentes**

---

## 🎯 ¿QUÉ SON LAS CAPACIDADES?

Cada agente de IA ahora tiene **2 capacidades configurables**:

1. **💰 Procesar Pagos con OCR**
   - Permite recibir comprobantes de pago (Yape, Plin, BCP, etc.)
   - Procesa automáticamente con OCR
   - Valida montos y organiza por cliente

2. **📅 Agendar Citas**
   - Permite agendar reuniones directamente en el chat
   - Modifica y cancela citas
   - Envía recordatorios automáticos

---

## 🔧 ¿CÓMO CONFIGURAR?

### **Paso 1: Abrir configuración**
1. Ingresa a tu panel: `http://localhost:3847`
2. Ve a **"Configurar Agentes"**
3. Click en el agente que quieres editar

### **Paso 2: Editar capacidades**
Baja hasta la sección:

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

### **Paso 3: Activar/Desactivar**
- ✅ **Checkbox marcado**: Capacidad ACTIVADA
- ☐ **Checkbox vacío**: Capacidad DESACTIVADA

### **Paso 4: Guardar**
Click en **"GUARDAR CAMBIOS"** y confirma con tu palabra clave.

---

## 📊 ESCENARIOS DE USO

### **Agente de Ventas (solo pagos)**
```
☑ Procesar Pagos con OCR
☐ Agendar Citas
```
**Ideal para:** E-commerce que recibe pagos pero no agenda citas.

---

### **Agente de Reservas (solo citas)**
```
☐ Procesar Pagos con OCR
☑ Agendar Citas
```
**Ideal para:** Servicios profesionales que agendan citas pero no reciben pagos por WhatsApp.

---

### **Agente Completo (ambas)**
```
☑ Procesar Pagos con OCR
☑ Agendar Citas
```
**Ideal para:** Negocios que quieren funcionalidad completa.

---

### **Agente Básico (ninguna)**
```
☐ Procesar Pagos con OCR
☐ Agendar Citas
```
**Ideal para:** Agentes informativos que solo responden preguntas.

---

## 🎓 EJEMPLOS PRÁCTICOS

### **Ejemplo 1: Tienda que vende productos**

**Configuración:**
- ✅ Procesar Pagos: SÍ
- ❌ Agendar Citas: NO

**Flujo:**
```
Cliente: "¿Aceptan Yape?"
Agente: "Sí, aceptamos Yape al número 999-999-999"

Cliente: [Envía comprobante de Yape]
Agente: "¡Perfecto! Recibí tu comprobante de S/ 50. 
         Un asesor lo confirmará en breves momentos."
```

---

### **Ejemplo 2: Consultorio médico**

**Configuración:**
- ❌ Procesar Pagos: NO
- ✅ Agendar Citas: SÍ

**Flujo:**
```
Cliente: "Quiero agendar una cita"
Agente: "Claro, para agendar necesito:
         1️⃣ Tu nombre completo
         2️⃣ Tu número de teléfono
         3️⃣ Fecha preferida
         4️⃣ Hora preferida
         5️⃣ Tipo de consulta
         6️⃣ Breve descripción"

Cliente: "Juan Pérez, 999-999-999, 28-Feb, 15:00, Consulta general"
Agente: "Perfecto, déjame confirmar los datos de tu cita:
         👤 Nombre: Juan Pérez
         📅 Fecha: 28-Feb-2026
         🕐 Hora: 15:00
         💼 Tipo: Consulta general
         
         ¿Confirmas? Responde SI para agendar."

Cliente: "SI"
Agente: "✅ CITA AGENDADA EXITOSAMENTE
         Te enviaré un recordatorio 1 hora antes."
```

---

### **Ejemplo 3: Tienda completa**

**Configuración:**
- ✅ Procesar Pagos: SÍ
- ✅ Agendar Citas: SÍ

**Flujo:**
```
Cliente: "Quiero comprar una casaca y también quiero una cita para medirme"

Agente: "¡Excelente! Podemos hacer ambas cosas.
         
         Para la compra:
         - El precio es S/ 250
         - Aceptamos Yape, Plin, BCP
         
         Para la cita:
         - ¿Qué día prefieres venir?
         - ¿Mañana o tarde?"

[Cliente envía comprobante y agenda cita]

Agente: "✅ Pago recibido: S/ 250
         ✅ Cita agendada: 28-Feb a las 16:00
         
         ¡Todo listo! Te esperamos."
```

---

## ❓ PREGUNTAS FRECUENTES

### **¿Puedo cambiar las capacidades después?**
✅ SÍ. Puedes activar/desactivar cuando quieras. Los cambios son inmediatos.

### **¿Qué pasa si desactivo "Procesar Pagos"?**
El agente ignorará las imágenes de comprobantes. Los clientes podrán enviar igual, pero el bot no las procesará.

### **¿Qué pasa si desactivo "Agendar Citas"?**
El agente no mencionará citas ni podrá agendar. Si un cliente pide cita, el agente responderá que no está disponible.

### **¿Las capacidades afectan otros agentes?**
❌ NO. Cada agente tiene su propia configuración independiente.

### **¿Por defecto vienen activadas?**
✅ SÍ. Todos los agentes nuevos tienen ambas capacidades activadas por defecto.

### **¿Puedo tener un agente con solo una capacidad?**
✅ SÍ. Es común: ventas (solo pagos) o reservas (solo citas).

---

## 🔍 VERIFICAR CONFIGURACIÓN

### **Desde el panel:**
1. Ve a "Configurar Agentes"
2. Edita cualquier agente
3. Revisa la sección "CAPACIDADES DEL AGENTE"

### **Desde terminal (admin):**
```bash
cd /var/www/agentes
node -e "const agents = require('./server/data/agents.json'); agents.forEach(a => console.log(a.name + ':', JSON.stringify(a.capabilities)));"
```

---

## 🚨 SOLUCIÓN DE PROBLEMAS

### **"Mi agente no procesa pagos"**
1. Verifica que el checkbox "Procesar Pagos con OCR" esté marcado
2. Verifica que la imagen tenga monto visible
3. Revisa los logs: `pm2 logs agentes-bot | grep OCR`

### **"Mi agente no agenda citas"**
1. Verifica que el checkbox "Agendar Citas" esté marcado
2. Asegúrate que el cliente siga el flujo completo
3. Revisa los logs: `pm2 logs agentes-bot | grep cita`

### **"Los cambios no se aplican"**
1. Guarda los cambios con tu palabra clave
2. Reinicia el bot: `pm2 restart agentes-bot`
3. Espera 30 segundos y prueba nuevamente

---

## 💡 CONSEJOS

1. **Agentes especializados:** Usa capacidades según el propósito del agente
2. **Prueba antes de usar:** Configura y haz pruebas internas
3. **Monitorea logs:** `pm2 logs agentes-bot` te muestra qué está pasando
4. **Backup:** Los cambios se guardan automáticamente, pero puedes revertir

---

## 📞 SOPORTE

**Documentación completa:** `CAPACIDADES_AGENTES_IMPLEMENTACION.md`

**Comandos útiles:**
```bash
# Ver logs en tiempo real
pm2 logs agentes-bot

# Reiniciar bot
pm2 restart agentes-bot

# Ver estado
pm2 list

# Health check
curl http://localhost:3848/api/health
```

---

**Última actualización:** 25 de Febrero, 2026
**Versión:** 1.0.0
