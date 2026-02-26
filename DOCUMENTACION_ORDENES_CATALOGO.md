# 🛒 SISTEMA DE ÓRDENES DE CATÁLOGO - WhatsApp Business

**Fecha de implementación:** 26 de Febrero, 2026  
**Ubicación:** `/var/www/agentes/app.js` (línea ~506)

---

## 📋 DESCRIPCIÓN

Baileys detecta automáticamente cuando un cliente envía un **pedido desde el catálogo de WhatsApp Business**. El sistema:

1. **Detecta** el mensaje tipo `orderMessage`
2. **Extrae** la información del pedido (ID, total, items, etc.)
3. **Guarda** la orden en `server/data/orders.json`
4. **Notifica** al agente para que responda al cliente

---

## 🔍 ESTRUCTURA DEL orderMessage

```javascript
{
  message: {
    orderMessage: {
      orderId: '1234567890',           // ID único de WhatsApp
      orderTitle: 'Producto Principal', // Título del pedido
      itemCount: 3,                     // Cantidad de productos
      message: 'Quisiera información...', // Mensaje del cliente
      totalAmount1000: 150000,          // Total en milésimas (150.00)
      currency: 'PEN',                  // Moneda
      status: 'INQUIRY',                // Estado (INQUIRY/ACCEPTED/DECLINED)
      thumbnail: <Buffer>,              // Miniatura del producto
      orderRequestMessageId: '...'      // ID para consultar detalle completo
    }
  }
}
```

---

## ⚠️ IMPORTANTE: Formato del Total

El campo `totalAmount1000` viene en **milésimas de unidad monetaria**:

```javascript
// Ejemplos de conversión:
150000 / 1000 = 150.00 PEN
  50000 / 1000 =  50.00 PEN
 100000 / 1000 = 100.00 USD
```

---

## 📊 DATOS QUE SE GUARDAN

Cada orden se guarda en `server/data/orders.json` con esta estructura:

```json
{
  "id": "order_1708912345678",
  "orderId": "1234567890",
  "connectionId": "conn_XXX",
  "from": "51987654321@s.whatsapp.net",
  "fromMe": false,
  "messageId": "ABC123DEF456",
  "orderTitle": "Producto Principal",
  "itemCount": 3,
  "totalAmount1000": 150000,
  "total": 150.00,
  "currency": "PEN",
  "status": "INQUIRY",
  "message": "Quisiera información sobre envío",
  "thumbnail": "disponible",
  "orderRequestMessageId": null,
  "receivedAt": 1708912345678,
  "processed": false
}
```

---

## 💬 RESPUESTA AUTOMÁTICA AL CLIENTE

Cuando se detecta una orden, el sistema:

1. **Cambia el body del mensaje** para que el agente IA lo priorice
2. **Genera un mensaje estructurado** con los datos del pedido
3. **El agente responde** contextualmente al pedido

### Mensaje que recibe el agente:
```
🛒 *¡Nuevo pedido recibido!*

*Pedido:* Producto Principal
*Items:* 3
*Total:* 150.00 PEN
*Mensaje:* Quisiera información sobre envío

¿Cómo quieres proceder con este pedido?
```

### Respuesta típica del agente:
```
¡Gracias por tu pedido! 🎉

Veo que estás interesado en 3 productos por un total de S/ 150.00.

Para coordinar el envío, ¿podrías indicarme tu dirección completa?

También puedo ayudarte con:
• Métodos de pago disponibles
• Tiempos de entrega
• Consultas sobre los productos
```

---

## 📁 ARCHIVO DE ÓRDENES

**Ubicación:** `/var/www/agentes/server/data/orders.json`

### Comandos para gestionar órdenes:

```bash
# Ver todas las órdenes
cat server/data/orders.json | python3 -m json.tool

# Ver órdenes no procesadas
cat server/data/orders.json | jq '.[] | select(.processed == false)'

# Contar órdenes por estado
cat server/data/orders.json | jq '[.[] | .status] | group_by(.) | map({status: .[0], count: length})'

# Ver órdenes de hoy
cat server/data/orders.json | jq --arg today "$(date +%Y-%m-%d)" '[.[] | select(.receivedAt | strftime("%Y-%m-%d") == $today)]'
```

---

## 🔗 ENDPOINTS API SUGERIDOS (Para implementar)

### Listar órdenes
```bash
GET /api/orders              # Todas las órdenes
GET /api/orders?status=INQUIRY  # Filtrar por estado
GET /api/orders/cliente/:tel    # Por teléfono de cliente
GET /api/orders/hoy             # Órdenes del día
```

### Detalle de orden
```bash
GET /api/orders/:id          # Detalle de orden específica
```

### Actualizar estado
```bash
PUT /api/orders/:id/status
Body: { "status": "ACCEPTED" }  // ACCEPTED | DECLINED | COMPLETED
```

### Marcar como procesada
```bash
PUT /api/orders/:id/process
Body: { "processed": true, "notes": "..." }
```

---

## 🧪 TESTING - Cómo probar el detector

### Opción 1: Simular orderMessage en logs
```bash
# Ver logs de detección
pm2 logs agentes-bot | grep -E "ORDEN|catalogo|🛒"
```

### Opción 2: Enviar pedido real desde WhatsApp Business
1. Configurar catálogo en WhatsApp Business
2. Agregar productos al catálogo
3. Desde otro número, abrir el catálogo
4. Seleccionar productos
5. Presionar "Enviar pedido"
6. Ver logs del bot

### Opción 3: Mock manual (desarrollo)
```javascript
// En app.js, línea ~506, agregar temporalmente:
if (from === '51987654321@s.whatsapp.net' && body === '!test-order') {
    const order = {
        orderId: 'TEST123456',
        orderTitle: 'Producto Test',
        itemCount: 2,
        message: 'Pedido de prueba',
        totalAmount1000: 50000,
        currency: 'PEN',
        status: 'INQUIRY'
    }
    // Ejecutar lógica de orden...
}
```

---

## ⚠️ LIMITACIONES CONOCIDAS

### 1. **Detalle de items no siempre disponible**
Baileys detecta la orden pero **no siempre descarga el detalle completo de cada producto** (SKUs individuales).

**Solución parcial:** Usar `orderRequestMessageId` para consultar el catálogo y obtener el detalle.

### 2. **Solo WhatsApp Business**
Las órdenes de catálogo solo funcionan con:
- ✅ WhatsApp Business API
- ✅ WhatsApp Business App con catálogo configurado
- ❌ WhatsApp normal (no tiene catálogos)

### 3. **El cliente debe usar botón oficial**
No es un mensaje de texto. El cliente debe:
1. Abrir el catálogo del negocio
2. Seleccionar productos
3. Presionar **"Enviar pedido"** (botón oficial de WhatsApp)

---

## 📊 ESTADOS DE ORDEN

| Estado | Descripción | Acción sugerida |
|--------|-------------|-----------------|
| `INQUIRY` | Cliente envió pedido, pendiente de respuesta | Contactar al cliente |
| `ACCEPTED` | Negocio aceptó el pedido | Coordinar pago/envío |
| `DECLINED` | Negocio rechazó el pedido | Notificar al cliente |
| `COMPLETED` | Pedido completado/entregado | Archivar orden |

---

## 🔧 CONFIGURACIÓN

### Habilitar/Deshabilitar detector
El detector está **siempre activo** cuando hay un `orderMessage`. No requiere feature flag.

### Personalizar respuesta
Modificar el mensaje en `app.js`, línea ~560:

```javascript
body = `🛒 *¡Nuevo pedido recibido!*\n\n` +
       `*Pedido:* ${order.orderTitle}\n` +
       `*Items:* ${order.itemCount}\n` +
       `*Total:* ${total.toFixed(2)} ${order.currency || 'PEN'}\n` +
       `${order.message ? `*Mensaje:* ${order.message}\n\n` : ''}` +
       `¿Cómo quieres proceder con este pedido?`  // ← Personalizar esta línea
```

---

## 📝 EJEMPLOS DE LOGS

### Orden detectada exitosamente:
```
[conn_XXX] 🛒 === ORDEN DE CATÁLOGO DETECTADA ===
[conn_XXX] 🛒 ID del pedido: 1234567890
[conn_XXX] 🛒 Título: Producto Principal
[conn_XXX] 🛒 Cantidad de items: 3
[conn_XXX] 🛒 Mensaje del cliente: Quisiera información
[conn_XXX] 🛒 Total: 150.00 PEN
[conn_XXX] 🛒 Estado: INQUIRY
[conn_XXX] 🛒 Thumbnail: Disponible
[conn_XXX] 🛒 ✅ Orden guardada en orders.json
```

### Error al guardar:
```
[conn_XXX] 🛒 Error guardando orden: ENOENT: no such file or directory
```
**Solución:** Crear directorio `server/data/` si no existe.

---

## 🎯 PRÓXIMAS MEJORAS

### Fase 1 - Gestión básica
- [ ] Endpoint API `/api/orders` para listar órdenes
- [ ] Endpoint PUT para actualizar estado
- [ ] UI en frontend para gestionar pedidos

### Fase 2 - Automatización
- [ ] Respuestas automáticas según estado
- [ ] Notificaciones push al cliente
- [ ] Integración con sistema de inventario

### Fase 3 - Analytics
- [ ] Dashboard de ventas por período
- [ ] Productos más vendidos
- [ ] Ticket promedio por pedido
- [ ] Exportación a CSV/Excel

---

**Implementado:** 26 de Febrero, 2026  
**Archivo:** `/var/www/agentes/app.js` (línea ~506)  
**Estado:** ✅ Activo en producción
