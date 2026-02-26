## Qwen Added Memories
- El usuario está desarrollando un sistema multi-agente de IA llamado CONTROLA.agentes que se conecta a WhatsApp usando Baileys. El proyecto está en /var/www/agentes

---
- PROYECTO: CONTROLA.agentes - Sistema multi-agente de IA para WhatsApp en /var/www/agentes. Arquitectura: API REST (puerto 3847) + Bot Baileys 7.x (puerto 3848) + Frontend React. Multi-agente: cada agente tiene configuración de IA (Deepseek) y cada conexión WhatsApp tiene socket dual (PRIMARY+STANDBY) con failover automático. Datos en JSON (server/data/). Sesiones en bot_sessions/. Backups en recuperacion/backups/ con script recuperar.sh. Comandos útiles: pm2 restart agentes-bot, curl http://localhost:3848/api/health
- CONTROLA.agentes - Implementación completa al 25 Feb 2026: Hot Standby (failover <5s), Sistema de Palabras Clave (ofuscación HEX), Catálogo Multimedia con envío inteligente contextual (checkbox enableSmartMedia), Multi-motor IA (Deepseek, OpenAI, Qwen OAuth, Gemini, Llama), Verificación de modelo (/modelo), Frontend React con modo oscuro, **Asistente de Configuración con IA** (Redactar con IA para personalidad, base de conocimiento, saludo, objeciones), **Cambio dinámico de agente** en conexiones activas sin reiniciar WhatsApp, **Sidebar con altura fija**, **✅ SISTEMA OCR DE PAGOS** (Tesseract.js, detección automática de comprobantes Yape/Plin/BCP/transferencias, validación de montos > 0, organización por cliente en /media/pagos/{telefono}/, CRUD de pagos en /pagos, íconos en Monitor y Citas, feature flag en settings.json). Archivos clave: app.js (bot + detector OCR), server/index.js (API + endpoints /api/pagos/*), services/ocrService.js (OCR + patrones de detección), services/agenteIA.js (instrucciones manejo de imágenes), webapp/src/pages/Pagos.jsx (CRUD pagos), webapp/src/components/PagoModal.jsx (modal detalle). Comandos útiles: pm2 restart agentes-bot, curl http://localhost:3848/api/health. Ubicación: /var/www/agentes. Backup: /var/www/agentes/recuperacion/backups/backup_20260225_ocr_pagos/
- CONTROLA.agentes - Estado al 25 Feb 2026 21:00: IMPLEMENTACIÓN COMPLETADA: 1) CAPACIDADES POR AGENTE: Todos los agentes tienen campo 'capabilities' con procesarPagos y agendarCitas (default: true). UI en frontend con checkboxes. Backend verifica capacidades antes de procesar OCR/citas. 2) FIX KEYWORD ASIGNACIÓN: Asignar agente a conexión ahora solo valida keyword de la conexión (no del agente). Archivos modificados: server/index.js, webapp/src/pages/Conexion.jsx. 3) AGENTES EXISTENTES: CONTROLA (keyword: John0306, caps: ambas activas), Anandara (keyword: Holistic, caps: ambas activas), Lethal (keyword: JAzz, caps: ambas activas). 4) CONEXIONES: nuevooo (keyword: John0306, agente: Lethal), every (keyword: Cata), anandara (keyword: Holistic). 5) FEATURE FLAGS: settings.json con features.ocrPagos=true, features.gestionsCitas=true. 6) BACKUP: recuperacion/backups/backup_20260225_capacidades_agentes/
- CONTROLA.agentes - Sistema de Pagos Fase 1 (25 Feb 2026 21:30): UI de capacidades actualizada con switches modernos tipo toggle. Default para nuevos agentes: procesarPagos=false, agendarCitas=false (requieren plan de pago). Agentes existentes mantienen sus capacidades actuales. UI muestra indicador "💎 Requiere plan de pago". Cada capacidad tiene card individual con feedback visual (✅ Habilitado / ⚠️ Deshabilitado). Archivo modificado: webapp/src/pages/Agentes.jsx. Próximo: Implementar estructura de planes y validación (Fase 2).

## 📚 CONTEXTO GENERAL DEL PROYECTO

### CONTROLA.agentes - Sistema Multi-Agente de IA para WhatsApp

**Ubicación:** `/var/www/agentes`

**Arquitectura:**
```
┌─────────────────────────────────────────────────────────┐
│  WEB APP (React + Vite)  →  http://localhost:3847      │
│  - Gestión de Agentes (plantillas de IA)                │
│  - Gestión de Conexiones (dispositivos WhatsApp)        │
│  - Monitor de Chats                                     │
├─────────────────────────────────────────────────────────┤
│  API (Express + Session) → server/index.js              │
│  - CRUD Agentes, Conexiones, Conversaciones             │
├─────────────────────────────────────────────────────────┤
│  BOT ORCHESTRATOR (app.js) → Puerto 3848                │
│  - Baileys 7.x con HOT STANDBY (dual socket)            │
│  - Multi-instancias por conexión                        │
│  - Message Queue + Recovery                             │
├─────────────────────────────────────────────────────────┤
│  IA SERVICE (services/agenteIA.js)                      │
│  - Deepseek (default) / OpenAI                          │
│  - Contexto de conversación (últimos 10 mensajes)       │
└─────────────────────────────────────────────────────────┘
```

**Conceptos Clave:**
- **Agente ≠ Conexión**: Agente es plantilla de IA, Conexión es dispositivo WhatsApp
- **Hot Standby**: Cada conexión tiene 2 sockets (PRIMARY + STANDBY) para failover < 5s
- **Persistencia**: Sesiones en `bot_sessions/{connectionId}/creds.json`
- **Datos**: JSON files en `server/data/` (agents.json, connections.json, conversations.json)

**Comandos Útiles:**
```bash
# Reiniciar bot
pm2 restart agentes-bot

# Ver health check
curl http://localhost:3848/api/health | python3 -m json.tool

# Ver logs
pm2 logs agentes-bot --lines 50

# Restaurar backup
cd /var/www/agentes/recuperacion && ./recuperar.sh --restore <ID>
```

---

## 📋 CONTEXTO ACTUAL - Sistema de Palabras Clave Implementado

**Última sesión:** 23 de Febrero, 2026
**Estado:** ✅ KEYWORDS SEGURIDAD IMPLEMENTADO

### Lo que se hizo (23 Feb 2026):

1. **Sistema de Palabras Clave de Seguridad**:
   - Ofuscación HEX simple para almacenamiento
   - Master Keyword global (default: `John0306`)
   - Keywords individuales por agente y conexión
   - Modales de confirmación en frontend

2. **Acciones Protegidas**:
   - ✅ Crear/Editar/Eliminar Agentes
   - ✅ Crear Conexiones
   - ✅ Asignar Agente a Conexión
   - ✅ Logout/Restart/Delete Conexión

3. **Archivos Actualizados**:
   - `server/data/settings.json` → sección `security.keywords`
   - `server/data/agents.json` → campo `keyword` por agente
   - `server/data/connections.json` → campo `keyword` por conexión
   - `server/index.js` → validación `requireKeyword()`
   - `webapp/src/components/KeywordModal.jsx` → NUEVO componente
   - `webapp/src/pages/Configuraciones.jsx` → gestión Master Keyword

4. **Keywords Actuales**:
   | Elemento | Nombre | Keyword |
   |----------|--------|---------|
   | Agente | CONTROLA | `John0306` |
   | Agente | Anandara | `Holistic` |
   | Conexión | nuevooo | `John0306` |
   | Conexión | every | `Cata` |
   | Conexión | anandara | `Holistic` |

5. **Documentación Creada**:
   - `SISTEMA_KEYWORDS_SEGURIDAD.md` - Guía completa del sistema

### Estado verificado:

```
✅ Master Keyword: configurada (John0306)
✅ Agentes existentes: keywords asignadas
✅ Conexiones existentes: keywords asignadas
✅ Endpoints protegidos: validación activa
✅ Frontend: modales de confirmación
```

---

## 📋 CONTEXTO ANTERIOR - Hot Standby Implementado

**Sesión:** 22 de Febrero, 2026 - 16:00

1. **Implementación de Hot Standby** en `app.js`:
   - Cada conexión ahora tiene 2 sockets: PRIMARY (activo) + STANDBY (respaldo)
   - Failover automático < 5 segundos cuando PRIMARY falla
   - Message Queue para recuperar mensajes perdidos durante failover
   - Heartbeat activo: 15s (primary) y 20s (standby) con ping real

2. **Backups creados** en `/var/www/agentes/recuperacion/`:
   - `backup_20260222_151500_pre_hot_standby` - Versión estable anterior
   - `backup_20260222_153000_hot_standby_implementado` - Versión actual con Hot Standby
   - Script automático: `recuperar.sh` (lista, verifica, restaura backups)

3. **Documentación creada**:
   - `ESTADO_ACTUAL_2026_02_22.md` - Estado completo del sistema
   - `IMPLEMENTACION_HOT_STANDBY.md` - Detalles técnicos
   - `recuperacion/README.md` - Guía rápida de recuperación
   - `recuperacion/reglas_para_el_backup.md` - Reglas críticas
   - `recuperacion/COMO_RECUPERAR_BACKUPS.md` - Guía completa

### Estado verificado:

```
✅ PRIMARY: true (ambas conexiones)
✅ STANDBY: true (ambas conexiones)
✅ Heartbeats: Ping OK cada 15s/20s
✅ Failovers: 0 (sin caídas durante testing)
✅ Sesiones WhatsApp: Activas (no requiere re-vincular)
```

---

## ⏳ PENDIENTES PARA PRÓXIMA SESIÓN

### Monitoreo (24-48 horas post-implementación):

1. **Verificar en producción:**
   - [ ] No hay pérdida de mensajes durante fallas
   - [ ] Failovers automáticos < 5 por día
   - [ ] Uso de memoria estable (< 800MB)
   - [ ] Heartbeats estables sin falsos positivos
   - [ ] Clientes no reportan interrupciones

2. **Comandos de verificación:**
   ```bash
   # Health check
   curl http://localhost:3848/api/health | python3 -m json.tool
   
   # Ver failovers
   pm2 logs agentes-bot | grep -i failover
   
   # Ver memoria
   pm2 list | grep agentes-bot
   
   # Ver heartbeats
   pm2 logs agentes-bot | grep -E "Ping OK|Standby OK"
   ```

3. **Prueba opcional de failover:**
   ```bash
   # Forzar failover manual para testing
   curl -X POST http://localhost:3848/api/command \
     -H "x-bot-token: TU_TOKEN" \
     -d '{"command":"force-failover","connectionId":"conn_XXX"}'
   ```

### Posibles ajustes:

- Si hay **falsos positivos** (failovers muy frecuentes):
  - Aumentar threshold de 3 a 5 fallos en `app.js` línea ~230
  - O aumentar intervalo de heartbeat de 15s a 20s

- Si hay **alto consumo de memoria** (> 1GB):
  - Considerar reducir a 1 socket (rollback parcial)
  - Aumentar `max_memory_restart` en PM2 a 1GB

### Rollback (si hay problemas críticos):

```bash
cd /var/www/agentes/recuperacion
./recuperar.sh --restore backup_20260222_151500_pre_hot_standby
```

---

## 📊 MÉTRICAS ACTUALES

| Métrica | Valor Actual | Objetivo |
|---------|--------------|----------|
| Tiempo recuperación | < 5s | < 10s ✅ |
| Mensajes perdidos | 0 (teórico) | 0 ✅ |
| Detección de caída | 45s | < 60s ✅ |
| Memoria | ~24MB por instancia | < 800MB ⏳ |
| Failovers | 0 | < 5/hora ⏳ |

---

## 🆕 CAMBIOS 24 FEB 2026

### Bugs Corregidos:
1. **Asistente "Redactar con IA"** - Modal ahora funciona correctamente (zIndex, lógica de pasos, generación de texto)
2. **Icono del asistente** - Cambiado de react.svg a favicon.svg
3. **Sidebar altura fija** - Ahora tiene 100vh, navegación scroleable, usuario siempre visible
4. **Efecto hover "Redactar con IA"** - Eliminado fondo grisáceo
5. **Objeciones - Formato** - Ahora genera items separados: `Si el cliente dice: "X", respondes: "Y"`
6. **Cambio de agente en conexiones activas** - Detecta cambio de agentId en polling, recarga configuración sin reiniciar WhatsApp
7. **Keyword opcional al crear agente** - Modal permite omitir palabra clave al crear agente nuevo

### Archivos Modificados:
| Archivo | Cambio |
|---------|--------|
| `app.js` | Detección de cambio de agente en polling |
| `server/index.js` | Endpoint generate-config movido antes de rutas dinámicas |
| `services/agenteIA.js` | Prompt mejorado para objeciones |
| `webapp/src/components/AgentConfigAssistant.jsx` | Icono, zIndex, lógica, logging |
| `webapp/src/components/KeywordModal.jsx` | allowEmpty, botón "Omitir" |
| `webapp/src/pages/Agentes.jsx` | Parsing objeciones, keyword opcional |
| `webapp/src/index.css` | Sidebar altura fija |

### Backup:
- `recuperacion/backups/backup_20260224_mejoras_asistente/`

---

## 📁 ARCHIVOS CLAVE

| Archivo | Estado | Nota |
|---------|--------|------|
| `app.js` | ✅ Modificado | Hot Standby + Cambio dinámico de agente |
| `recuperacion/recuperar.sh` | ✅ Creado | Script de recuperación |
| `ESTADO_ACTUAL_2026_02_22.md` | ✅ Creado | Estado completo |
| `DOCUMENTACION_CAMBIOS_2026_02_24.md` | ✅ Creado | Cambios sesión actual |

---

**PRÓXIMA REVISIÓN:** 25 de Febrero, 2026 (24 horas post-implementación)

**NOTA PARA PRÓXIMA SESIÓN:**
El sistema está funcionando con todas las mejoras activas:
- ✅ Hot Standby activo
- ✅ Asistente "Redactar con IA" funcional (personalidad, base conocimiento, saludo, objeciones)
- ✅ Cambio dinámico de agente sin reiniciar conexión WhatsApp
- ✅ Sidebar con altura fija y usuario siempre visible
- ✅ Keyword opcional al crear agentes nuevos

**Verificar en producción:**
- [ ] Generación de objeciones crea items separados
- [ ] Cambio de agente funciona en < 3 segundos
- [ ] No hay errores en consola del navegador
