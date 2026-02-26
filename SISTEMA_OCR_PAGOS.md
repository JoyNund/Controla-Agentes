# 📸 SISTEMA OCR DE PAGOS - CONTROLA.agentes

**Fecha de implementación:** 25 de Febrero, 2026  
**Versión:** 1.0.0  
**Estado:** ✅ FUNCIONAL EN PRODUCCIÓN

---

## 📋 DESCRIPCIÓN

Sistema de procesamiento automático de comprobantes de pago mediante OCR (Tesseract.js) integrado con WhatsApp Baileys 7.x.

### **Características principales:**

- ✅ **Detección automática** de imágenes de comprobantes
- ✅ **OCR con Tesseract.js** para extraer texto de imágenes
- ✅ **Patrones amplios** de detección (Yape, Plin, BCP, BBVA, transferencias, etc.)
- ✅ **Validación de montos** (solo considera pago válido si detecta monto > 0)
- ✅ **Organización por cliente** (carpetas separadas por teléfono)
- ✅ **Feature flag** para activar/desactivar sin tocar código
- ✅ **Sin interferencia** con otros procesos del bot
- ✅ **Integración con Monitor de Chats y Citas** (íconos de pago)

---

## 🏗️ ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE PROCESAMIENTO                           │
└─────────────────────────────────────────────────────────────────────┘

1. CLIENTE ENVÍA IMAGEN
   └─→ WhatsApp → Bot Baileys

2. DETECTOR EN app.js
   ├─→ Verifica feature flag (settings.json)
   ├─→ Detecta imagen
   └─→ Procesa con OCR (bloqueante)

3. OCR SERVICE (services/ocrService.js)
   ├─→ Ejecuta Tesseract OCR
   ├─→ Analiza patrones de pago (bancos, apps, montos, etc.)
   ├─→ Si es pago válido (monto > 0):
   │   ├─→ Guarda imagen en /media/pagos/{telefono}/
   │   ├─→ Guarda datos en payments.json
   │   ├─→ Envía mensaje al chat: "IMAGEN PROCESADA CON OCR: ..."
   │   └─→ Reemplaza body del mensaje para el agente
   └─→ Si NO es pago:
       └─→ No envía mensaje, agente responde normal

4. AGENTE IA
   ├─→ Recibe body modificado: "IMAGEN PROCESADA CON OCR: Yape - S/ 20 - PAGO VÁLIDO"
   ├─→ Detecta patrón OCR en el mensaje
   └─→ Responde naturalmente SIN citar la imagen

5. ASESOR REVISA EN WEB APP
   ├─→ /pagos (CRUD de pagos)
   ├─→ Ver comprobante y datos OCR
   ├─→ Confirmar o Rechazar
   └─→ Cliente recibe notificación

6. VINCULACIÓN CON CITAS Y CHATS
   ├─→ Monitor de Chats: ícono 💚 si tiene pagos
   └─→ Citas: ícono 💚 si tiene pagos
       └─→ Click → navega a /pagos?cliente={telefono}
```

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
/var/www/agentes/
├── app.js                          # + Detector OCR bloqueante
├── services/
│   ├── agenteIA.js                 # + Instrucciones manejo de imágenes OCR
│   └── ocrService.js               # Servicio OCR completo (NUEVO)
├── server/
│   ├── data/
│   │   ├── settings.json           # + features.ocrPagos: true
│   │   ├── payments.json           # Base de datos de pagos (NUEVO)
│   │   └── ocr_context.json        # Contexto temporal OCR
│   └── index.js                    # + Endpoints /api/pagos/*
├── media/
│   └── pagos/
│       ├── temp/                   # Temporales (auto-limpieza)
│       ├── procesadas/             # Procesadas exitosamente
│       └── {telefono}/             # Carpetas por cliente
│           └── comprobante_*.jpg
├── tessdata/                       # Archivos de lenguaje Tesseract
│   ├── spa.traineddata
│   └── eng.traineddata
├── logs/
│   └── pagos/                      # Logs del sistema OCR
├── webapp/src/
│   ├── pages/
│   │   ├── Pagos.jsx               # CRUD de pagos (NUEVO)
│   │   ├── Monitor.jsx             # + ícono de pago
│   │   └── Citas.jsx               # + ícono de pago
│   ├── components/
│   │   └── PagoModal.jsx           # Modal de detalle (NUEVO)
│   ├── App.jsx                     # + ruta /pagos
│   └── api.js                      # + paymentsApi
└── scripts/
    └── rollback-ocr.sh             # Script de rollback (NUEVO)
```

---

## 🔧 CONFIGURACIÓN

### **Activar/Desactivar OCR**

Editar `server/data/settings.json`:

```json
{
  "features": {
    "ocrPagos": true  // ← false = DESACTIVADO, true = ACTIVADO
  },
  ...
}
```

**Ventaja:** Puedes desactivar el OCR sin tocar código, solo cambiando este valor.

---

## 📊 PATRONES DE DETECCIÓN

El sistema detecta pagos basándose en múltiples patrones:

### **Bancos y Entidades (20 pts c/u)**
- BCP, BBVA, Interbank, Scotiabank, Banco de la Nación
- Yape, Plin, Tunki, iZipay, PagoEfectivo, Bim, Nequi

### **Apps de Pago (25 pts c/u)**
- yape, plin, bim, nequi, wallet, billetera
- yapeaste, yapeé, plinaste, pliné, yapeando

### **Patrones Yape/Plin (30 pts c/u)**
- yapeaste, yapeé, plinaste, pliné
- nro celular, recibiste un yape, yape recibido
- izipay, minimarket, datos de la transaccion
- sin megas, recarga, qr, código qr

### **Términos de Transacción (15 pts c/u, máx 60)**
- transferencia, depósito, pago, enviaste, recibiste
- transacción, compra, venta, cancelaste
- saldo, operación, código, referencia
- voucher, comprobante, recibo
- exitoso, confirmado, aprobado

### **Monedas (30 pts c/u)**
- S/, S/., soles, sol, pen
- USD, $, dólares, dolar
- EUR, €, euros

### **Montos Numéricos (50 pts)**
- `[\d,]+\.\d{2}` → 150.00, 1,250.00
- `\d+\.\d+` → 150.5, 20.0
- `\d+\s*(soles|dolares|euros)` → 150 soles
- `S\/?\s*\d+` → S/ 150, S150
- `\$\s*\d+` → $ 150

### **Umbral de Aceptación**
- **PAGO VÁLIDO:** ≥ 60 puntos **CON** monto > 0
- **O:** ≥ 100 puntos sin monto (múltiples patrones fuertes)

**Ejemplos:**
- Yape + S/ 9.50 = 25 + 50 = **75 puntos** ✅ PAGO VÁLIDO
- Yape + "yapeaste" + S/ 20 = 25 + 30 + 50 = **105 puntos** ✅ PAGO VÁLIDO
- Solo "yape" sin monto = 25 puntos ❌ NO ES PAGO
- Captura de pantalla sin patrones = 0 puntos ❌ NO ES PAGO

---

## 📊 ENDPOINTS DE API

### **Listar pagos**
```bash
GET /api/pagos?cliente=51903172378&estado=confirmado
```

### **Detalle de pago**
```bash
GET /api/pagos/{id}
```

### **Imagen de comprobante**
```bash
GET /api/pagos/{id}/imagen
```

### **Confirmar pago**
```bash
POST /api/pagos/{id}/confirmar
{
  "asesorId": "admin"
}
```

### **Rechazar pago**
```bash
POST /api/pagos/{id}/rechazar
{
  "asesorId": "admin",
  "motivo": "Monto no coincide"
}
```

### **Estadísticas**
```bash
GET /api/pagos/estadisticas?desde=2026-02-01&hasta=2026-02-28
```

---

## 💻 FRONTEND

### **Página de Pagos**
- **URL:** `/pagos`
- **Características:**
  - Lista todos los pagos
  - Filtros por cliente, estado, fecha
  - Estadísticas en tiempo real
  - Modal de detalle con imagen y datos OCR
  - Acciones: Confirmar, Rechazar

### **Monitor de Chats**
- Ícono **💚** (DollarSign verde) en conversaciones con pagos
- Click → navega a `/pagos?cliente={telefono}`

### **Citas**
- Columna "Pagos" con ícono **💚** si tiene pagos, **⚪** si no tiene
- Click → navega a `/pagos?cliente={telefono}`

---

## 🎯 FLUJO DE ESTADOS DEL PAGO

```
pendiente_ocr
    ↓
procesando_ocr
    ↓
┌─────────────────────────────────────────────────────────┐
│                                                         │
├─→ pendiente_confirmacion_asesor (confianza >= 70% + monto > 0)
│       ↓
│   ┌───┴───┐
│   │       │
│   ↓       ↓
│ confirmado  rechazado
│
├─→ no_legible (confianza < 70% O monto = 0)
│       ↓
│   (cliente debe reenviar)
│
└─→ error_tecnico
        ↓
    (revisión manual)
```

---

## 🛡️ SEGURIDAD Y AISLAMIENTO

### **No interferencia con otros procesos:**

1. ✅ **Feature flag** - Desactivado por defecto
2. ✅ **Servicio separado** - `ocrService.js` independiente
3. ✅ **Sin puertos nuevos** - Solo lee archivos JSON
4. ✅ **Error handling** - Errores no propagan al bot
5. ✅ **Backups** - Rollback script disponible

### **Puertos usados:**
- **3847** - API (existente)
- **3848** - Bot (existente)
- **Ninguno nuevo** - OCR no usa puertos

### **Otras apps en el servidor:**
- ⚠️ **app-center** (3000-3003) - NO TOCADA
- ⚠️ **microclass** (3456, 6547) - NO TOCADA
- ⚠️ **vesanico-radio** (37421) - NO TOCADA

---

## 🔄 ROLLBACK

Si hay problemas, ejecutar:

```bash
cd /var/www/agentes
./scripts/rollback-ocr.sh
```

Esto:
1. Crea backup del estado actual
2. Restaura `app.js` desde backup original
3. Reinicia el bot
4. Verifica logs

---

## 📊 MÉTRICAS Y KPIs

| Métrica | Objetivo | Cómo medir |
|---------|----------|------------|
| Tiempo promedio OCR | < 10 segundos | Logs del bot |
| Tasa de éxito OCR | > 85% | `confianza >= 70` / total |
| Pagos confirmados/día | Variable | `/api/pagos/estadisticas` |
| Monto total procesado | Variable | Dashboard de Pagos |

---

## 🧪 TESTING

### **Probar el sistema:**

1. **Verificar feature flag:**
   ```bash
   cat /var/www/agentes/server/data/settings.json | grep ocrPagos
   ```

2. **Verificar logs:**
   ```bash
   pm2 logs agentes-bot --lines 100 | grep -i ocr
   ```

3. **Enviar comprobante desde WhatsApp:**
   - Enviar imagen de Yape/BCP/transferencia
   - Debe tener monto visible (ej: S/ 20.00)

4. **Verificar en Web App:**
   - Ir a `/pagos`
   - Ver pago pendiente
   - Click en "Ver"
   - Confirmar o rechazar

5. **Verificar en Monitor/Citas:**
   - Ir a `/monitor` o `/citas`
   - Buscar cliente por teléfono
   - Ver ícono 💚 si tiene pagos

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### **OCR no procesa pagos:**

1. Verificar feature flag:
   ```bash
   cat /var/www/agentes/server/data/settings.json | grep ocrPagos
   ```

2. Verificar logs:
   ```bash
   pm2 logs agentes-bot --lines 100 | grep -E "OCR|pago|Puntaje"
   ```

3. Verificar dependencias:
   ```bash
   npm list tesseract.js jimp
   ```

### **Error "Cannot find module tesseract.js":**

```bash
cd /var/www/agentes
npm install tesseract.js jimp --save
pm2 restart agentes-bot
```

### **OCR detecta pero no responde:**

1. Verificar que el agente tenga instrucciones OCR en system prompt
2. Verificar logs de agenteIA:
   ```bash
   pm2 logs agentes-bot | grep agenteIA
   ```

### **Pagos no aparecen en Web App:**

1. Verificar API:
   ```bash
   curl http://localhost:3847/api/pagos | python3 -m json.tool
   ```

2. Verificar frontend:
   - Abrir DevTools en navegador
   - Ver consola por errores
   - Ver network por requests fallidas

---

## 📞 SOPORTE

**Archivos clave para debugging:**

| Archivo | Propósito |
|---------|-----------|
| `services/ocrService.js` | Lógica principal de OCR |
| `app.js` (línea ~510) | Detector OCR bloqueante |
| `server/data/payments.json` | Base de datos de pagos |
| `media/pagos/{telefono}/` | Imágenes por cliente |
| `webapp/src/pages/Pagos.jsx` | Frontend de pagos |

**Logs:**
```bash
# Logs del bot (incluye OCR)
pm2 logs agentes-bot

# Solo errores OCR
pm2 logs agentes-bot | grep -i "ocr"

# Ver servicio OCR
pm2 logs agentes-bot | grep "OCR Service"

# Ver puntajes de detección
pm2 logs agentes-bot | grep "Puntaje"
```

---

## 📈 HISTORIAL DE CAMBIOS

### **v1.0.0 - 25 Feb 2026**
- ✅ Implementación inicial del sistema OCR
- ✅ Integración con Tesseract.js
- ✅ Patrones amplios de detección de pagos
- ✅ Validación de montos > 0
- ✅ Respuesta natural del agente
- ✅ CRUD de pagos en frontend
- ✅ Íconos en Monitor y Citas
- ✅ Documentación completa

---

**Última actualización:** 25 de Febrero, 2026  
**Versión:** 1.0.0  
**Estado:** ✅ FUNCIONAL EN PRODUCCIÓN  
**Responsable:** Asistente de IA
