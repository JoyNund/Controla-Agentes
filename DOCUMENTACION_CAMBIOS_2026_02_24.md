# 📝 Documentación de Cambios - 24 de Febrero, 2026

**Fecha:** 24 de Febrero, 2026  
**Estado:** ✅ Completado

---

## 🐛 Bugs Corregidos

### 1. Asistente de Configuración - Modal "Redactar con IA"

#### Problemas:
- **Bug de interfaz que se limpia**: Al abrir el modal, toda la interfaz se limpiaba y solo se veía un color sólido
- **Botón "Comenzar" no funcionaba**: Al hacer click en la pantalla de introducción, no pasaba nada
- **Botones "Siguiente" no avanzaban**: Las preguntas del modal no permitían avanzar
- **Generación de texto no completaba**: Al finalizar las preguntas, el modal parpadeaba y volvía atrás sin generar texto

#### Solución:
- Aumentado `zIndex` de `9999` a `100000` para el modal
- Agregado `border: '1px solid var(--border)'` para mejor visibilidad
- Corregida lógica de `handleSiguiente()` para manejar correctamente los índices de preguntas
- Agregado logging detallado para depuración
- Mejorada pantalla de error con ícono rojo y mensaje claro

#### Archivos Modificados:
- `webapp/src/components/AgentConfigAssistant.jsx`

---

### 2. Icono del Asistente

#### Problema:
El modal del asistente usaba el ícono `react.svg` en lugar del favicon.svg solicitado.

#### Solución:
- Copiado `favicon.svg` a `webapp/src/assets/logo-icon.svg`
- Reemplazadas todas las referencias del ícono en el modal

#### Archivos Modificados:
- `webapp/src/components/AgentConfigAssistant.jsx`
- `webapp/src/assets/logo-icon.svg` (nuevo)

---

### 3. Sidebar con Altura Fija

#### Problema:
El sidebar no tenía altura fija, la sección de usuario desaparecía al hacer scroll en páginas largas como "Configurar Agentes".

#### Solución:
- Sidebar ahora tiene `height: 100vh` y `position: sticky`
- La navegación (`.sidebar-nav`) es scroleable con scrollbar personalizada
- La sección de usuario (`.sidebar-user`) tiene `flex-shrink: 0` para siempre estar visible
- Scrollbar de la navegación con styling personalizado (6px ancho, colores del tema)

#### Archivos Modificados:
- `webapp/src/index.css`
- `webapp/src/components/Layout.jsx`

---

### 4. Efecto Hover en "Redactar con IA"

#### Problema:
Los botones "Redactar con IA" tenían fondo grisáceo al hacer hover (clase `btn btn-ghost`).

#### Solución:
- Cambiados a botones con estilo inline sin clases DaisyUI
- Estilo: `background: 'transparent', border: 'none', color: 'var(--accent)'`

#### Archivos Modificados:
- `webapp/src/pages/Agentes.jsx`

---

### 5. Asistente de Objeciones - Formato de Salida

#### Problema:
Las objeciones generadas por IA se agregaban como un solo párrafo en lugar de items separados.

#### Solución:
- Mejorado el prompt para generar formato: `Si el cliente dice: "X", respondes: "Y"`
- Actualizado parser para manejar múltiples formatos:
  1. Formato ideal: `Si el cliente dice: "X", respondes: "Y"`
  2. Formato con negritas: `**Objeción:** X` + `**Respuesta:** Y`
  3. Fallback: Separación por párrafos
- Agregada alerta de confirmación con cantidad de objeciones agregadas
- Logging detallado en consola para depuración

#### Archivos Modificados:
- `services/agenteIA.js`
- `webapp/src/pages/Agentes.jsx`

---

### 6. Cambio de Agente en Conexiones Activas

#### Problema:
Al cambiar el agente asignado a una conexión WhatsApp activa, el bot seguía usando el agente anterior.

#### Causa Raíz:
El polling solo verificaba cambios de `status` (`connecting`, `connected`, `disconnected`), pero no detectaba cambios en `agentId`.

#### Solución:
Agregada detección de cambio de agente en el polling:
```javascript
// DETECTAR CAMBIO DE AGENTE
if (instance && conn.agentId && conn.agentId !== instance.agentId) {
    console.log(`[${connectionId}] 🔄 Agente cambió: ${instance.agentId} → ${conn.agentId}`)
    instance.agentId = conn.agentId
    instance.agent = agent
    console.log(`[${connectionId}] ✅ Nueva configuración cargada`)
}
```

#### Comportamiento:
1. Usuario cambia agente en UI → API actualiza `connections.json`
2. Polling detecta cambio (cada 3 segundos)
3. Actualiza `instance.agentId` y `instance.agent` en memoria
4. Próximo mensaje usa configuración del nuevo agente
5. **Sin reiniciar conexión WhatsApp**

#### Archivos Modificados:
- `app.js`

---

### 7. Palabra Clave Opcional al Crear Agente

#### Problema:
Al crear un agente nuevo, el modal pedía palabra clave obligatoria, lo cual no tenía sentido para agentes nuevos.

#### Solución:
- Agregada propiedad `allowEmpty` al `KeywordModal`
- Al crear agente: `allowEmpty={true}` → keyword opcional, botón "Omitir" disponible
- Al editar agente: `allowEmpty={false}` → keyword requerida
- Backend ya soportaba keyword vacía desde antes

#### Archivos Modificados:
- `webapp/src/components/KeywordModal.jsx`
- `webapp/src/pages/Agentes.jsx`

---

## 📁 Archivos Modificados

### Frontend:
| Archivo | Cambios |
|---------|---------|
| `webapp/src/components/AgentConfigAssistant.jsx` | Icono, zIndex, lógica de pasos, logging |
| `webapp/src/pages/Agentes.jsx` | Botones "Redactar con IA", parsing de objeciones, keyword opcional |
| `webapp/src/components/Layout.jsx` | Comentarios sidebar |
| `webapp/src/components/KeywordModal.jsx` | Propiedad `allowEmpty`, botón "Omitir" |
| `webapp/src/index.css` | Sidebar altura fija, scrollbar personalizada |
| `webapp/src/assets/logo-icon.svg` | Nuevo archivo |

### Backend:
| Archivo | Cambios |
|---------|---------|
| `app.js` | Detección de cambio de agente en polling |
| `server/index.js` | Endpoint `generate-config` movido antes de rutas dinámicas |
| `services/agenteIA.js` | Prompt mejorado para objeciones |

---

## 🔧 Comandos Útiles

### Ver logs del asistente de objeciones:
```bash
# Frontend: Abrir consola del navegador (F12)
# Filtrar por: [Agentes]
```

### Ver logs de cambio de agente:
```bash
pm2 logs agentes-bot --lines 100 | grep "🔄 Agente"
```

### Probar endpoint de objeciones:
```bash
curl -X POST http://localhost:3847/api/agents/generate-config \
  -H "Content-Type: application/json" \
  -d '{"tipo":"objeciones","respuestas":{"objeciones":"Es caro, Lo pienso","argumentos":"Calidad","promociones":"10%"}}'
```

---

## 📊 Estado del Sistema

| Componente | Estado | Nota |
|------------|--------|------|
| Asistente "Redactar con IA" | ✅ Funcional | Todos los bugs corregidos |
| Formato de Objeciones | ✅ Funcional | Items separados, eliminables individualmente |
| Cambio de Agente | ✅ Funcional | Sin reiniciar conexión |
| Sidebar | ✅ Funcional | Altura fija, usuario siempre visible |
| Keyword en Agentes Nuevos | ✅ Funcional | Opcional al crear |

---

## 🎯 Próximos Pasos (Recomendados)

1. **Monitorear** generación de objeciones por 24-48 horas
2. **Verificar** que cambio de agente funciona en producción
3. **Considerar** agregar mensaje de confirmación visual (toast) en lugar de alert()

---

**Última actualización:** 24 de Febrero, 2026  
**Documentado por:** Asistente de Desarrollo
