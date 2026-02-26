# 🔗 ENLACES DE CATÁLOGO WHATSAPP - Nueva Funcionalidad Multimedia

**Fecha:** 26 de Febrero, 2026  
**Versión:** 2.6.0

---

## 📋 DESCRIPCIÓN

Ahora el **Catálogo Multimedia** de los agentes permite agregar productos mediante **enlaces de catálogo de WhatsApp Business**, además de la subida tradicional de archivos.

### Tipos de Elementos Soportados

| Tipo | Icono | Descripción | Ejemplo |
|------|-------|-------------|---------|
| 📄 **Archivo Multimedia** | `<File />` | Subida tradicional de imágenes, videos, documentos | `imagen.jpg`, `catalogo.pdf` |
| 🔗 **Enlace WhatsApp** | `<LinkIcon />` | Enlace directo a producto del catálogo WhatsApp | `https://wa.me/p/...` |

---

## 📝 NORMAS DE DESARROLLO - IMPORTANTE

### ⚠️ NUNCA USAR EMOJIS COMO ICONOS

**Regla:** Está estrictamente prohibido usar emojis (📁, 🔗, 💰, 📅, etc.) como iconos en la interfaz de usuario.

**Motivo:**
- Los emojis se ven diferentes según el sistema operativo (Windows, macOS, Linux, iOS, Android)
- No son accesibles para lectores de pantalla
- No se pueden personalizar (color, tamaño, stroke)
- Se ven poco profesionales en una interfaz moderna

**Alternativa correcta:**
Usar iconos de la librería **lucide-react** (ya instalada en el proyecto):

```javascript
// ❌ INCORRECTO - Usar emojis
<button>📁 Archivo Multimedia</button>
<div>💰 Procesar Pagos</div>

// ✅ CORRECTO - Usar lucide-react
import { File, CreditCard } from 'lucide-react'

<button><File className="w-4 h-4" /> Archivo Multimedia</button>
<div><CreditCard className="w-5 h-5" /> Procesar Pagos</div>
```

**Iconos disponibles para capacidades:**
| Funcionalidad | Icono | Componente |
|---------------|-------|------------|
| Procesar Pagos | 💳 | `<CreditCard />` |
| Agendar Citas | 📅 | `<Calendar />` |
| Envío Inteligente | 🔍 | `<ScanLine />` |
| Catálogo Multimedia | 📂 | `<FolderOpen />` |
| Archivo Multimedia | 📄 | `<File />` |
| Enlace WhatsApp | 🔗 | `<LinkIcon />` |
| Ver Archivos | 🖼️ | `<Image />` |
| Subir Archivo | ⬆️ | `<Upload />` |

**Capacidades del Agente:**
- Título de sección: `<Zap className="w-4 h-4" /> CAPACIDADES DEL AGENTE`
- Procesar Pagos: `<CreditCard className="w-5 h-5" />`
- Agendar Citas: `<Calendar className="w-5 h-5" />`
- Texto de estado: Sin emojis (solo texto "Habilitado" / "Deshabilitado")

---

## 🎯 FORMATO DE ENLACE VÁLIDO

### Estructura Requerida
```
https://wa.me/p/NUMERODEPRODUCTO/NUMERODETELEFONO
```

### Ejemplo Válido
```
https://wa.me/p/7710668912292847/51936956306
```

### Componentes del Enlace
| Parte | Descripción | Ejemplo |
|-------|-------------|---------|
| `https://wa.me/p/` | Prefijo fijo de catálogo WhatsApp | Obligatorio |
| `NUMERODEPRODUCTO` | ID único del producto en WhatsApp | `7710668912292847` |
| `NUMERODETELEFONO` | Número del negocio (con código país) | `51936956306` |

### Regex de Validación
```javascript
/^https?:\/\/(www\.)?wa\.me\/p\/(\d+)\/(\d+)(\?.*)?$/i
```

### Ejemplos
| Enlace | Válido |
|--------|--------|
| `https://wa.me/p/7710668912292847/51936956306` | ✅ Sí |
| `http://wa.me/p/1234567890/51987654321` | ✅ Sí (http también) |
| `https://www.wa.me/p/7710668912292847/51936956306?ref=xyz` | ✅ Sí (con query params) |
| `https://whatsapp.com/p/...` | ❌ No |
| `wa.me/p/123/456` | ❌ No (falta https://) |
| `https://wa.me/p/abc/def` | ❌ No (deben ser números) |

---

## 🖥️ INTERFAZ DE USUARIO

### Nueva Sección en Catálogo Multimedia

Al ir a **Agentes → [Seleccionar Agente] → CATÁLOGO MULTIMEDIA → Subir**:

```
┌─────────────────────────────────────────────────┐
│ Tipo de elemento *                              │
│ ┌─────────────────┐ ┌─────────────────────────┐ │
│ │ 📁 Archivo      │ │ 🔗 Enlace WhatsApp      │ │
│ └─────────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Si seleccionas "Archivo Multimedia":
- Campo para subir archivo (imagen, video, documento)
- Máx 20 MB
- Formatos: JPG, PNG, WebP, MP4, MOV, PDF, DOC, DOCX

### Si seleccionas "Enlace de Catálogo WhatsApp":
- Campo de texto para URL
- Placeholder: `https://wa.me/p/7710668912292847/51936956306`
- Validación automática de formato
- Mensaje de error si el formato es inválido

### Campos Comunes (ambos tipos)
- **Título** * (obligatorio)
- **Descripción**
- **Categoría**
- **Precio** (opcional)
- **Tags** (separados por coma)

---

## 📁 ESTRUCTURA DE DATOS

### Item Tradicional (Archivo)
```json
{
  "id": "media_1708912345678_abc123",
  "title": "Catálogo de Servicios 2026",
  "description": "Lista completa de servicios",
  "category": "servicios",
  "price": "150.00",
  "type": "image",
  "fileName": "catalogo.jpg",
  "filePath": "/var/www/agentes/media/agent_XXX/media_XXX.jpg",
  "url": "/api/agents/agent_XXX/media/1708912345678/file",
  "mimeType": "image/jpeg",
  "fileSize": 245678,
  "tags": ["servicios", "precios", "2026"],
  "createdAt": "2026-02-26T21:00:00.000Z",
  "updatedAt": "2026-02-26T21:00:00.000Z"
}
```

### Item de Enlace WhatsApp
```json
{
  "id": "media_1708912345679_def456",
  "title": "Producto Destacado - Oferta Especial",
  "description": "Producto premium con descuento del 20%",
  "category": "productos",
  "price": "299.00",
  "type": "whatsapp-link",
  "whatsappLink": "https://wa.me/p/7710668912292847/51936956306",
  "productId": "7710668912292847",
  "phoneNumber": "51936956306",
  "url": "https://wa.me/p/7710668912292847/51936956306",
  "fileName": null,
  "filePath": null,
  "mimeType": null,
  "fileSize": null,
  "tags": ["oferta", "producto", "premium"],
  "createdAt": "2026-02-26T21:05:00.000Z",
  "updatedAt": "2026-02-26T21:05:00.000Z"
}
```

---

## 🔧 ENDPOINT API

### POST /api/agents/:id/media

#### Body (FormData)

**Para archivo tradicional:**
```javascript
{
  file: <File>,              // Archivo binario
  title: "Catálogo 2026",
  description: "...",
  category: "servicios",
  price: "150.00",
  tags: "servicios,precios",
  mediaType: "file"          // Opcional, default: "file"
}
```

**Para enlace WhatsApp:**
```javascript
{
  title: "Producto Oferta",
  description: "...",
  category: "productos",
  price: "299.00",
  tags: "oferta,producto",
  mediaType: "whatsapp-link",
  whatsappLink: "https://wa.me/p/7710668912292847/51936956306"
}
```

#### Respuesta Exitosa
```json
{
  "success": true,
  "item": {
    "id": "media_1708912345679_def456",
    "title": "Producto Destacado - Oferta Especial",
    "type": "whatsapp-link",
    "whatsappLink": "https://wa.me/p/7710668912292847/51936956306",
    "productId": "7710668912292847",
    "phoneNumber": "51936956306",
    ...
  }
}
```

#### Respuesta de Error
```json
{
  "success": false,
  "error": "El enlace no tiene un formato válido. Debe ser: https://wa.me/p/NUMERODEPRODUCTO/NUMERODETELEFONO"
}
```

---

## 🤖 INTEGRACIÓN CON IA

### Knowledge Base Actualizada

Cuando se agrega un enlace de WhatsApp, el sistema actualiza automáticamente la `knowledgeBase` del agente:

```
=== CATÁLOGO MULTIMEDIA ===
- **Producto Oferta** (enlace WhatsApp): Producto premium con descuento | Producto ID: 7710668912292847 | Categoría: productos | Tags: oferta, producto, premium | Precio: 299.00 | URL: https://wa.me/p/7710668912292847/51936956306
```

### System Prompt para IA

La IA recibe instrucciones específicas para manejar enlaces de WhatsApp:

```javascript
INSTRUCCIONES:
- Si el usuario quiere ver algún producto/servicio específico, puedes enviar el archivo correspondiente
- Para archivos, usa este formato JSON para enviar: {"tipo": "enviar_archivo", "archivoId": "media_XXX", "caption": "texto explicativo"}
- Para enlaces de WhatsApp, puedes compartir la URL directamente: {"tipo": "mensaje", "texto": "Mira este producto: " + item.whatsappLink}
```

### Ejemplo de Respuesta de IA

**Cliente:** "¿Tienen productos en oferta?"

**IA:** 
```
¡Sí! Tenemos una oferta especial que te va a encantar:

🔥 *Producto Premium con 20% de descuento*

Precio normal: S/ 374.00
**Precio oferta: S/ 299.00**

Mira todos los detalles aquí: https://wa.me/p/7710668912292847/51936956306

¿Te gustaría que te cuente más sobre este producto?
```

---

## 🔍 BÚSQUEDA Y FILTRADO

La función `searchMediaCatalog` ahora también busca en campos de WhatsApp:

### Campos Buscables
- ✅ `title`
- ✅ `description`
- ✅ `category`
- ✅ `tags`
- ✅ `price`
- ✅ `productId` (solo whatsapp-link)
- ✅ `phoneNumber` (solo whatsapp-link)
- ✅ `whatsappLink` (solo whatsapp-link)

### Ejemplo de Búsqueda
```javascript
// Buscar por ID de producto
searchMediaCatalog(agentId, '7710668912292847')
// → Retorna items con ese productId

// Buscar por número de teléfono
searchMediaCatalog(agentId, '51936956306')
// → Retorna items con ese phoneNumber

// Buscar por término en URL
searchMediaCatalog(agentId, 'wa.me')
// → Retorna todos los enlaces de WhatsApp
```

---

## 🗑️ ELIMINACIÓN

### Item Tradicional (Archivo)
1. Elimina de `mediaCatalog` en JSON
2. **Elimina archivo físico** del filesystem
3. Elimina de `knowledgeBase`

### Item Enlace WhatsApp
1. Elimina de `mediaCatalog` en JSON
2. **NO elimina archivo** (no existe archivo físico)
3. Elimina de `knowledgeBase`

---

## 📊 ESTADÍSTICAS DE USO

### Comandos para Verificar

```bash
# Ver todos los items de tipo whatsapp-link
cat server/data/agents.json | jq '.[].mediaCatalog[] | select(.type == "whatsapp-link")'

# Contar items por tipo
cat server/data/agents.json | jq '[.[].mediaCatalog[] | .type] | group_by(.) | map({type: .[0], count: length})'

# Ver enlaces de WhatsApp agregados
cat server/data/agents.json | jq '.[].mediaCatalog[] | select(.type == "whatsapp-link") | {title, whatsappLink, productId}'
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### 1. **Los enlaces no se validan con WhatsApp**
- El sistema solo valida el **formato** del enlace
- No verifica si el producto realmente existe en WhatsApp
- Es responsabilidad del usuario verificar el enlace antes de agregarlo

### 2. **Requiere WhatsApp Business**
- Los enlaces de catálogo solo funcionan con cuentas **WhatsApp Business**
- El negocio debe tener un **catálogo configurado** en WhatsApp Business

### 3. **Los enlaces pueden expirar**
- Si WhatsApp cambia la estructura de URLs, los enlaces podrían dejar de funcionar
- Se recomienda verificar periódicamente los enlaces guardados

### 4. **No se descarga thumbnail automático**
- A diferencia de los archivos, no se descarga ninguna imagen del enlace
- El thumbnail se muestra directamente desde WhatsApp cuando se comparte el enlace

---

## 🎯 CASOS DE USO

### 1. **Tienda con catálogo WhatsApp existente**
```
Situación: Tienda ya tiene catálogo en WhatsApp Business
Solución: Agregar enlaces en lugar de subir archivos duplicados
Beneficio: Los clientes ven el catálogo oficial con precios actualizados
```

### 2. **Productos con stock variable**
```
Situación: Productos que cambian frecuentemente
Solución: Enlace apunta al catálogo siempre actualizado
Beneficio: No hay que actualizar archivos constantemente
```

### 3. **Catálogos de terceros**
```
Situación: Quieres compartir productos de proveedores
Solución: Agregar enlaces a sus catálogos WhatsApp
Beneficio: Redirección directa al proveedor
```

---

## 🧪 TESTING

### Probar la Funcionalidad

1. **Frontend:**
   ```
   - Ir a Agentes → [Seleccionar Agente] → CATÁLOGO MULTIMEDIA
   - Click en "Subir"
   - Seleccionar "🔗 Enlace de Catálogo WhatsApp"
   - Ingresar URL válida: https://wa.me/p/7710668912292847/51936956306
   - Completar título y demás campos
   - Click en "Agregar Enlace"
   ```

2. **Verificar en Backend:**
   ```bash
   # Ver último item agregado
   tail -100 server/data/agents.json | python3 -m json.tool
   ```

3. **Probar validación de error:**
   ```
   - Intentar agregar: https://whatsapp.com/p/123/456
   - Debe mostrar error: "El enlace no tiene un formato válido"
   ```

4. **Probar búsqueda:**
   ```bash
   # En la API o frontend
   GET /api/agents/:id/media/search?q=7710668912292847
   ```

---

## 📝 ARCHIVOS MODIFICADOS

| Archivo | Cambios |
|---------|---------|
| `webapp/src/pages/Agentes.jsx` | UI con selector de tipo, validación de enlace, campos condicionales |
| `server/index.js` | Endpoint POST maneja ambos tipos (file y whatsapp-link) |
| `server/services/mediaCatalog.js` | Funciones actualizadas para soportar whatsapp-link |

---

## 🚀 PRÓXIMAS MEJORAS

### Fase 1 - Validación Avanzada
- [ ] Verificar si el enlace realmente existe (HEAD request)
- [ ] Extraer thumbnail automático del enlace
- [ ] Extraer título y precio desde WhatsApp

### Fase 2 - Analytics
- [ ] Tracking de clicks en enlaces
- [ ] Estadísticas de productos más compartidos
- [ ] Conversión de enlaces a ventas

### Fase 3 - Sincronización
- [ ] Sync automático con catálogo WhatsApp Business API
- [ ] Actualización automática de precios y stock
- [ ] Detección de productos eliminados/descontinuados

---

**Implementado:** 26 de Febrero, 2026  
**Archivos:** `webapp/src/pages/Agentes.jsx`, `server/index.js`, `server/services/mediaCatalog.js`  
**Estado:** ✅ Activo en producción
