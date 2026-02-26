/**
 * OCR Service - Sistema de Procesamiento de Pagos
 * 
 * Servicio PERMANENTE que procesa imágenes en segundo plano.
 * Analiza TODAS las imágenes y decide si son comprobantes de pago.
 * 
 * Características:
 * - Procesa cola de imágenes pendientes
 * - OCR con Tesseract.js
 * - Detecta patrones de pago (bancos, monedas, yape, etc.)
 * - Solo guarda como pago si identifica patrones relevantes
 * - Organiza archivos por teléfono de cliente
 */

const fs = require('fs')
const path = require('path')
const Tesseract = require('tesseract.js')
const axios = require('axios')

// Rutas
const DATA_DIR = path.join(__dirname, '../server/data')
const MEDIA_DIR = path.join(__dirname, '../media/pagos')
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json')
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json')
const API_URL = process.env.WEBAPP_API_URL || 'http://127.0.0.1:3847'
const BOT_PORT = process.env.BOT_PORT || 3848
const BOT_TOKEN = process.env.BOT_INTERNAL_TOKEN

// PATRONES PARA DETECTAR PAGOS (case-insensitive, amplios)
const PATRONES_PAGO = {
    // Bancos y entidades peruanas
    bancos: [
        'bcp', 'bbva', 'interbank', 'scotiabank', 'banco de la nación', 'banco nacion', 
        'banbif', 'banco', 'izipay', 'izi pay', 'tunki', 'pagoefectivo', 'pago efectivo'
    ],
    
    // Apps de pago y billeteras digitales
    appsPago: [
        'yape', 'plin', 'bim', 'nequi', 'momo', 'cash', 'wallet', 'billetera',
        'yapeaste', 'yapeé', 'plinaste', 'pliné', 'yapeando', 'plineando'
    ],
    
    // Términos de transacción (muy amplios)
    transaccion: [
        'transferencia', 'transferiste', 'transferí', 'transfirió',
        'depósito', 'deposito', 'depositaste', 'deposité', 'depositó', 'abono', 'abonaste',
        'pago', 'pagaste', 'pagué', 'pagó', 'pagando', 'pagas',
        'enviaste', 'envié', 'envió', 'enviando', 'envio',
        'recibiste', 'recibí', 'recibió', 'recibiendo',
        'transacción', 'transaccion', 'transaction',
        'compra', 'compraste', 'compré', 'compró',
        'venta', 'vendiste', 'vendí', 'vendió',
        'cancelaste', 'cancelé', 'canceló', 'cancelado',
        'saldo', 'saldo disponible', 'disponible',
        'operacion', 'operación', 'nro operacion', 'nro. de operacion', 'numero de operacion',
        'codigo', 'código', 'cod', 'cod.',
        'referencia', 'ref', 'ref.',
        'destino', 'destinatario', 'beneficiario',
        'origen', 'remitente',
        'fecha', 'hora', 'fecha y hora',
        'local', 'tienda', 'comercio', 'negocio', 'establecimiento',
        'cajero', 'agente', 'punto de venta', 'pos',
        'voucher', 'voucher de pago', 'comprobante', 'constancia', 'recibo',
        'exitoso', 'éxito', 'confirmado', 'aprobado', 'realizado',
        'compartir', 'descargar', 'imprimir'
    ],
    
    // Monedas y símbolos (formatos amplios)
    monedas: [
        's/', 's/.', 'soles', 'sol', 'pen', 's.', 's',
        'usd', '$', 'dólares', 'dolares', 'dolar', 'dólar', 'us',
        'eur', '€', 'euros', 'euro',
        'bs.', 'bolivianos', 'gs.', 'guaraníes', 'guaranies',
        'mxn', 'pesos', 'peso', 'cop', 'reales', 'real'
    ],

    // Patrones de montos numéricos
    montos: [
        /[\d,]+\.\d{2}/,  // 150.00, 1,250.00
        /\d+\.\d+/,       // 150.5, 20.0
        /\d+\s*(soles|dolares|euros|usd|pen)/i,  // 150 soles, 20 usd
        /s\/?\s*\d+/,     // S/ 150, S150
        /\$\s*\d+/,       // $ 150, $150
        /s\/?\s*\*+\s*\d+\.?\d*/i,  // S/ ****16.20, S/ ***150, S/****1234.56
        /[sS]\/?\s*[XxKk¥$*]+\s*\d+\.?\d*/  // S/ X¥KKXKK16.20, S/ XXX150, S/ KKKK1234.56 (asteriscos mal interpretados por OCR)
    ],
    
    // Patrones específicos de Yape/Plin
    yapePlin: [
        'yapeaste', 'yapeé', 'yapée', 'yapeando',
        'plinaste', 'pliné', 'pliné', 'plineando',
        'nro celular', 'nro. celular', 'nro de celular', 'numero de celular',
        'recibiste un yape', 'recibiste yape', 'recibiste plin',
        'yape recibido', 'plin recibido',
        'compartir', 'izipay', 'izi pay', 'minimarket', 'supermarket', 'tienda',
        'datos de la transaccion', 'datos de la transacción',
        'sin megas', 'recarga', 'recarga tu cel', 'recarga tu celular',
        'qr', 'código qr', 'codigo qr', 'escanea', 'escanear'
    ]
}

// Estado del servicio
let processing = false
let queue = []
let lastCheck = Date.now()

/**
 * Inicializar servicio
 */
function init() {
    console.log('[OCR Service] ====================================')
    console.log('[OCR Service] Iniciando servicio OCR de pagos...')
    console.log('[OCR Service] Ruta de datos:', DATA_DIR)
    console.log('[OCR Service] Ruta de media:', MEDIA_DIR)
    console.log('[OCR Service] Verificando feature flag...')
    
    // Verificar si está habilitado
    const enabled = isFeatureEnabled()
    console.log('[OCR Service] OCR Pagos habilitado:', enabled)
    
    if (!enabled) {
        console.log('[OCR Service] ⚠️  Feature flag desactivado. En espera...')
    }
    
    // Bucle principal - chequear cada 2 segundos
    // Usamos un loop async en lugar de setInterval para poder usar await
    async function processLoop() {
        while (true) {
            if (isFeatureEnabled()) {
                await checkQueue()
            }
            // Esperar 2 segundos
            await new Promise(resolve => setTimeout(resolve, 2000))
        }
    }
    
    processLoop()
    
    console.log('[OCR Service] ✅ Servicio iniciado, escuchando cola...')
    console.log('[OCR Service] ====================================')
}

/**
 * Verificar si el feature flag está activado
 */
function isFeatureEnabled() {
    try {
        if (!fs.existsSync(SETTINGS_FILE)) return false
        const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))
        return settings.features?.ocrPagos === true
    } catch (error) {
        console.error('[OCR Service] Error leyendo settings:', error.message)
        return false
    }
}

/**
 * Encolar un nuevo pago para procesamiento
 * Ahora es async y espera a que se procese
 */
async function enqueue(pagoData) {
    console.log(`[OCR Service] 📥 Encolando pago ${pagoData.id}...`)
    
    return new Promise((resolve, reject) => {
        queue.push({
            ...pagoData,
            enqueuedAt: Date.now(),
            _resolve: resolve,
            _reject: reject
        })
        console.log(`[OCR Service] Cola actual: ${queue.length} elemento(s)`)
    })
}

/**
 * Verificar y procesar cola de pagos
 */
async function checkQueue() {
    // Si ya está procesando o no hay cola, salir
    if (processing || queue.length === 0) {
        return
    }

    processing = true
    const pago = queue.shift()
    const { _resolve, _reject, ...pagoData } = pago

    try {
        console.log(`[OCR Service] 🔍 Procesando ${pagoData.id}...`)
        await procesarOCR(pagoData)
        console.log(`[OCR Service] ✅ ${pagoData.id} completado`)
        if (_resolve) _resolve()
    } catch (error) {
        console.error(`[OCR Service] ❌ Error procesando ${pagoData.id}:`, error.message)
        // Marcar como error técnico
        marcarComoError(pagoData.id, error.message)
        if (_reject) _reject(error)
    } finally {
        processing = false
        lastCheck = Date.now()
    }
}

/**
 * Detectar si el texto extraído parece un comprobante de pago
 */
function esComprobantePago(texto) {
    const textoLower = texto.toLowerCase()
    let puntaje = 0
    let coincidencias = []
    let montoDetectado = null

    // Buscar bancos (20 puntos cada uno)
    for (const banco of PATRONES_PAGO.bancos) {
        if (textoLower.includes(banco.toLowerCase())) {
            puntaje += 20
            coincidencias.push(`Banco: ${banco}`)
        }
    }

    // Buscar apps de pago (25 puntos cada una)
    for (const app of PATRONES_PAGO.appsPago) {
        if (textoLower.includes(app.toLowerCase())) {
            puntaje += 25
            coincidencias.push(`App: ${app}`)
        }
    }

    // Buscar patrones Yape/Plin (30 puntos cada uno) - MÁS IMPORTANTES
    for (const patron of PATRONES_PAGO.yapePlin) {
        if (textoLower.includes(patron.toLowerCase())) {
            puntaje += 30
            coincidencias.push(`Yape/Plin: ${patron}`)
        }
    }

    // Buscar términos de transacción (15 puntos cada uno, máximo 60 puntos)
    let puntosTransaccion = 0
    for (const termino of PATRONES_PAGO.transaccion) {
        if (textoLower.includes(termino.toLowerCase())) {
            puntosTransaccion += 15
            coincidencias.push(`Término: ${termino}`)
            if (puntosTransaccion >= 60) break  // Máximo 4 términos
        }
    }
    puntaje += puntosTransaccion

    // Buscar monedas (30 puntos cada una)
    for (const moneda of PATRONES_PAGO.monedas) {
        if (textoLower.includes(moneda.toLowerCase())) {
            puntaje += 30
            coincidencias.push(`Moneda: ${moneda}`)
        }
    }

    // Buscar patrones de montos numéricos (50 puntos si encuentra monto válido)
    for (const patron of PATRONES_PAGO.montos) {
        const match = texto.match(patron)
        if (match) {
            puntaje += 50
            coincidencias.push(`Monto: ${match[0]}`)
            // Extraer monto numérico
            const montoStr = match[0].replace(/[^\d.]/g, '')
            const montoNum = parseFloat(montoStr)
            if (montoNum && montoNum > 0 && !montoDetectado) {
                montoDetectado = montoNum
            }
        }
    }

    // Umbral mínimo: 60 puntos con monto > 0 (ej: Yape + monto = 80 puntos)
    // O 100 puntos sin monto (múltiples patrones fuertes)
    const esPago = (puntaje >= 60 && montoDetectado && montoDetectado > 0) || puntaje >= 100

    return {
        esPago,
        puntaje,
        coincidencias,
        texto: texto.substring(0, 200),
        montoDetectado
    }
}


/**
 * Procesar imagen con OCR y devolver resultado (síncrono)
 */
async function procesarImagenDirecta(pago) {
    const { id, from, imagePath, connectionId, caption, sock } = pago

    console.log(`[OCR Service] 🔍 Procesando imagen directa...`)

    // 1. Ejecutar OCR
    let text = ''
    let confidence = 0

    try {
        const imageBuffer = fs.readFileSync(imagePath)
        const { data } = await Tesseract.recognize(imageBuffer, 'spa')
        text = data.text
        confidence = data.confidence
        console.log(`[OCR Service] ✅ OCR: ${confidence}% - "${text.substring(0, 100)}"`)
    } catch (error) {
        console.error(`[OCR Service] ❌ Error OCR:`, error.message)
    }

    // 2. Analizar patrones
    const analisis = esComprobantePago(text + ' ' + caption)
    console.log(`[OCR Service] 📊 Puntaje: ${analisis.puntaje} - ¿Pago?: ${analisis.esPago}`)

    // 3. Extraer datos
    const ocrData = extraerDatos(text)

    // 4. Determinar estado - DEBE TENER MONTO > 0 PARA SER PAGO VÁLIDO
    const confianzaFinal = calcularConfianza(ocrData, confidence)
    const estado = (confianzaFinal >= 70 && ocrData.monto && ocrData.monto > 0)
        ? 'pendiente_confirmacion_asesor'
        : 'no_legible'

    // 5. Guardar pago
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    // Extraer número de teléfono limpio
    // from puede ser: 51903172378@s.whatsapp.net, 51903172378@lid, o ID de grupo
    let clienteNumero = from
    
    // Intentar extraer número real
    if (from) {
        // Remover sufijos de Baileys
        clienteNumero = from
            .replace('@s.whatsapp.net', '')
            .replace('@lid', '')
            .replace('@c.us', '')
            .replace('@g.us', '')
        
        // Si tiene más de 15 dígitos, es un ID interno, intentar obtener del message
        if (clienteNumero.length > 15 && message?.key?.remoteJid) {
            const remoteJid = message.key.remoteJid
                .replace('@s.whatsapp.net', '')
                .replace('@lid', '')
                .replace(/\D/g, '')
            
            if (remoteJid.length <= 15 && remoteJid.length >= 9) {
                clienteNumero = remoteJid
            }
        }
    }
    
    const clientDir = path.join(MEDIA_DIR, clienteNumero)
    
    if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir, { recursive: true })
    }

    const newImagePath = path.join(clientDir, `comprobante_${timestamp}_${randomId}.jpg`)
    fs.writeFileSync(newImagePath, fs.readFileSync(imagePath))

    const pagoData = {
        id: `pago_${timestamp}_${randomId}`,
        cliente: clienteNumero,  // Usar número limpio en lugar de from
        connectionId,
        monto: ocrData.monto || 0,
        moneda: 'PEN',
        tipoServicio: 'No especificado',
        porcentajePago: 100,
        montoPagado: ocrData.monto || 0,
        tipoComprobante: detectarTipoComprobante(text),
        comprobantePath: newImagePath,
        estado,
        fechaPago: ocrData.fecha || new Date().toISOString().split('T')[0],
        ocrData: { ...ocrData, textoCompleto: text },
        confianza: Math.round(confianzaFinal),
        createdAt: new Date().toISOString()
    }

    guardarPago(pagoData)

    // 6. Enviar mensaje OCR al chat SOLO si detecta pago VÁLIDO (monto > 0)
    if (sock && analisis.esPago && ocrData.monto && ocrData.monto > 0) {
        const ocrMensaje = `IMAGEN PROCESADA CON OCR: ${ocrData.banco || 'Banco no identificado'} - S/ ${ocrData.monto.toFixed(2)} - PAGO VÁLIDO`

        try {
            await sock.sendMessage(from, { text: ocrMensaje })
            console.log(`[OCR Service] 📤 Mensaje OCR enviado: ${ocrMensaje}`)
        } catch (error) {
            console.error(`[OCR Service] Error enviando:`, error.message)
        }
    } else if (sock) {
        console.log(`[OCR Service] No es pago válido (monto: ${ocrData.monto}), no enviar mensaje OCR`)
    }

    // 7. Limpiar temporal
    try {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath)
        }
    } catch (error) {}

    return {
        esPago: analisis.esPago && ocrData.monto && ocrData.monto > 0,  // Solo es pago si hay monto
        monto: ocrData.monto,
        banco: ocrData.banco,
        estado,
        mensaje: (analisis.esPago && ocrData.monto && ocrData.monto > 0) 
            ? `IMAGEN PROCESADA CON OCR: ${ocrData.banco || 'Banco'} - S/ ${ocrData.monto.toFixed(2)} - PAGO VÁLIDO` 
            : null
    }
}
/**
 * Procesar un pago con OCR
 */
async function procesarOCR(pago) {
    const { id, from, imagePath, connectionId, caption, sock } = pago

    console.log(`[OCR Service] 🔍 Analizando imagen de ${from}...`)

    // 1. Ejecutar OCR primero para obtener texto
    console.log(`[OCR Service] 🖼️  Procesando imagen con OCR...`)
    let text = ''
    let confidence = 0
    
    try {
        const imageBuffer = fs.readFileSync(imagePath)
        console.log(`[OCR Service] Buffer leído: ${imageBuffer.length} bytes`)
        
        // OCR directo con Tesseract.js SIN logger (evita DataCloneError)
        console.log(`[OCR Service] Iniciando Tesseract...`)
        
        const { data } = await Tesseract.recognize(imageBuffer, 'spa')
        
        text = data.text
        confidence = data.confidence
        
        console.log(`[OCR Service] ✅ OCR completado - Confianza: ${confidence}%`)
        console.log(`[OCR Service] 📝 Texto: "${text.substring(0, 500)}"`)
        
    } catch (error) {
        console.error(`[OCR Service] ❌ Error en OCR:`, error.message)
        console.error(`[OCR Service] Stack:`, error.stack)
        text = ''
        confidence = 0
    }

    console.log(`[OCR Service] 📝 Texto extraído: "${text.substring(0, 300)}${text.length > 300 ? '...' : ''}"`)
    console.log(`[OCR Service] 📝 Caption: "${caption.substring(0, 100)}"`)
    console.log(`[OCR Service] 📝 Texto completo para analizar: "${(text + ' ' + caption).substring(0, 300)}"`)

    // 2. Analizar si el texto sugiere un pago
    console.log(`[OCR Service] 🔍 Analizando patrones de pago...`)
    const analisis = esComprobantePago(text + ' ' + caption)
    
    console.log(`[OCR Service] 📊 Puntaje: ${analisis.puntaje} puntos`)
    console.log(`[OCR Service] 📊 Coincidencias:`, analisis.coincidencias)
    console.log(`[OCR Service] 📊 ¿Es pago?: ${analisis.esPago}`)

    // 3. Si NO es pago, limpiar y responder
    if (!analisis.esPago) {
        console.log(`[OCR Service] ❌ No es comprobante de pago (puntaje: ${analisis.puntaje})`)
        console.log(`[OCR Service] Coincidencias:`, analisis.coincidencias)

        // Limpiar temporal
        try {
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath)
            }
        } catch (error) {}

        // Responder al cliente que no reconocemos la imagen como pago
        try {
            const apiHeaders = {
                headers: {
                    'Content-Type': 'application/json',
                    'x-bot-token': BOT_TOKEN
                }
            }

            const mensajeRespuesta = `📸 *Imagen recibida*\n\n` +
                `No reconozco esta imagen como un comprobante de pago.\n\n` +
                `Si es un pago, por favor asegurate de que se vea:\n` +
                `• El monto (ej: S/ 50)\n` +
                `• El banco (Yape, Plin, BCP, etc.)\n` +
                `• El código de operación\n\n` +
                `¿Es un comprobante de pago? Si es así, volvé a enviarla.`

            await axios.post(`http://127.0.0.1:${BOT_PORT}/api/command`, {
                command: 'send-message-auto',
                connectionId,
                to: from,
                message: { text: mensajeRespuesta }
            }, apiHeaders)

            console.log(`[OCR Service] ℹ️  Respondido que no es pago`)

        } catch (error) {
            console.error(`[OCR Service] Error enviando respuesta:`, error.message)
        }

        return
    }

    // 4. ¡ES PAGO! Continuar con procesamiento completo
    console.log(`[OCR Service] ✅ Comprobante de pago detectado, procesando...`)

    // Crear carpeta del cliente
    const clientDir = path.join(MEDIA_DIR, from)
    if (!fs.existsSync(clientDir)) {
        fs.mkdirSync(clientDir, { recursive: true })
    }

    // Mover imagen a carpeta del cliente
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 8)
    const newImagePath = path.join(clientDir, `comprobante_${timestamp}_${randomId}.jpg`)
    
    const imageBuffer = fs.readFileSync(imagePath)
    fs.writeFileSync(newImagePath, imageBuffer)

    // Extraer datos estructurados
    const ocrData = extraerDatos(text)
    console.log(`[OCR Service] 📊 Datos extraídos:`, ocrData)

    // Calcular confianza
    const confianzaFinal = calcularConfianza(ocrData, confidence)
    const estado = confianzaFinal >= 70 && ocrData.monto 
        ? 'pendiente_confirmacion_asesor' 
        : 'no_legible'

    console.log(`[OCR Service] 🏷️  Estado: ${estado} (confianza: ${Math.round(confianzaFinal)}%)`)

    // Extraer número de teléfono limpio
    let clienteNumero = from
    if (from) {
        clienteNumero = from
            .replace('@s.whatsapp.net', '')
            .replace('@lid', '')
            .replace('@c.us', '')
            .replace('@g.us', '')
        
        // Si tiene más de 15 dígitos, intentar obtener del message
        if (clienteNumero.length > 15 && message?.key?.remoteJid) {
            const remoteJid = message.key.remoteJid
                .replace('@s.whatsapp.net', '')
                .replace('@lid', '')
                .replace(/\D/g, '')
            
            if (remoteJid.length <= 15 && remoteJid.length >= 9) {
                clienteNumero = remoteJid
            }
        }
    }

    // 5. Guardar en payments.json
    const pagoData = {
        id: `pago_${timestamp}_${randomId}`,
        cliente: clienteNumero,  // Usar número limpio
        connectionId,
        monto: ocrData.monto || 0,
        moneda: ocrData.moneda || 'PEN',
        tipoServicio: 'No especificado',
        porcentajePago: 100,
        montoPagado: ocrData.monto || 0,
        tipoComprobante: detectarTipoComprobante(text),
        comprobantePath: newImagePath,
        estado,
        fechaPago: ocrData.fecha || new Date().toISOString().split('T')[0],
        horaPago: ocrData.hora || new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        ocrData: {
            ...ocrData,
            textoCompleto: text,
            analisisPatrones: analisis.coincidencias,
            puntajePatrones: analisis.puntaje
        },
        confianza: Math.round(confianzaFinal),
        procesadoEn: Date.now(),
        confirmadoPor: null,
        confirmadoEn: null,
        rechazadoPor: null,
        rechazadoEn: null,
        motivoRechazo: null,
        notas: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }
    
    guardarPago(pagoData)

    // 6. Enviar resultado del OCR al chat (para que el agente lo vea)
    try {
        if (pago.sock) {
            // Mensaje técnico que el agente puede leer en el historial
            const ocrMensaje = `IMAGEN PROCESADA CON OCR: ${ocrData.banco || 'Banco no identificado'} - S/ ${ocrData.monto || '0.00'} - ${estado === 'pendiente_confirmacion_asesor' ? 'PAGO VÁLIDO' : 'REQUIERE REVISIÓN'}`
            
            // Enviar como mensaje del sistema (no se muestra al cliente, solo va al historial)
            await pago.sock.sendMessage(from, { 
                text: ocrMensaje,
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 1
                }
            })
            console.log(`[OCR Service] 📤 Mensaje OCR enviado: ${ocrMensaje}`)
        }
    } catch (error) {
        console.error(`[OCR Service] Error enviando mensaje OCR:`, error.message)
    }

    // 7. NO responder directamente - el agente responderá basado en el mensaje OCR
    console.log(`[OCR Service] ✅ Pago procesado, agente debería responder`)

    // 7. Limpiar archivo temporal
    try {
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath)
        }
    } catch (error) {}
}

/**
 * Extraer datos del texto OCR
 */
function extraerDatos(texto) {
    const datos = {
        monto: null,
        moneda: 'PEN',
        fecha: null,
        hora: null,
        banco: null,
        operacion: null,
        textoCompleto: texto
    }

    // Extraer monto con patrones MUY amplios
    // Buscar cualquier número decimal que parezca monto (ej: 9.50, 20.00, 150.5)
    const patronesMonto = [
        /S\/\s*([\d,]+\.\d{2})/i,  // S/ 150.00
        /S\.\s*([\d,]+\.\d{2})/i,  // S. 150.00
        /Total:\s*([\d,]+\.\d{2})/i,  // Total: 150.00
        /Importe:\s*([\d,]+\.\d{2})/i,  // Importe: 150.00
        /USD\s*([\d.]+)/i,  // USD 150
        /Dóla?res?\s*([\d.]+)/i,  // Dólares 150
        /\$([\d.]+)/i,  // $150
        /([\d,]+\.\d{2})\s*(soles|dolares|euros)/i,  // 150.00 soles
        /([\d]+\.\d{2})/,  // 9.50, 20.00 (genérico - DEBE IR AL FINAL)
        // Patrones para asteriscos mal interpretados por OCR (X, K, ¥, etc.)
        /[sS]\/?\s*[XxKk¥$*]+([\d,]+\.?\d*)/i,  // S/ X¥KKXKK16.20, S/ XXX150.00
    ]

    for (const patron of patronesMonto) {
        const match = texto.match(patron)
        if (match) {
            // Extraer solo el número
            let montoStr = match[1] || match[0]
            montoStr = montoStr.replace(',', '')  // Quitar comas
            const montoNum = parseFloat(montoStr)
            
            // Solo aceptar si es un monto razonable (0.01 a 999999)
            if (montoNum && montoNum > 0.009 && montoNum < 1000000) {
                datos.monto = montoNum
                
                // Detectar moneda
                if (texto.toLowerCase().includes('usd') || texto.toLowerCase().includes('dólar') || texto.toLowerCase().includes('dolar')) {
                    datos.moneda = 'USD'
                } else if (texto.toLowerCase().includes('euro') || texto.toLowerCase().includes('eur')) {
                    datos.moneda = 'EUR'
                }
                break
            }
        }
    }

    // Extraer fecha
    const fechaMatch = texto.match(/(\d{2}[-/]\d{2}[-/]\d{4})|(\d{2}[-/]\d{2}[-/]\d{2})/i)
    if (fechaMatch) {
        datos.fecha = parsearFecha(fechaMatch[0])
    }

    // Extraer hora
    const horaMatch = texto.match(/(\d{1,2}:\d{2}\s*[ap]?m?)/i)
    if (horaMatch) {
        datos.hora = horaMatch[0].trim()
    }

    // Extraer banco (ampliado)
    const bancosAmplio = ['BCP', 'BBVA', 'Interbank', 'Scotiabank', 'Banco de la Nación', 'Banco Nacion',
                          'Yape', 'Plin', 'Tunki', 'iZipay', 'Izi Pay', 'PagoEfectivo', 'Bim', 'Nequi']
    for (const banco of bancosAmplio) {
        if (texto.toLowerCase().includes(banco.toLowerCase())) {
            datos.banco = banco
            break
        }
    }

    // Si no encontró banco específico, buscar patrón "banco" + palabras (ej: "banco pichincha", "BANCO PICHINCHA")
    if (!datos.banco) {
        const bancoGenericoMatch = texto.match(/banco\s+([a-zA-Z0-9\s]+)/i)
        if (bancoGenericoMatch) {
            // Extraer nombre del banco (palabras después de "banco", hasta 3 palabras)
            const nombreBanco = bancoGenericoMatch[1].trim().split(/\s+/).slice(0, 3).join(' ')
            // Capitalizar primera letra de cada palabra
            const nombreCapitalizado = nombreBanco.replace(/\b\w/g, l => l.toUpperCase())
            datos.banco = `Banco ${nombreCapitalizado}`
        }
    }

    // Extraer número de operación (patrones amplios)
    const operacionMatch = texto.match(/Operación:\s*([A-Z0-9]{6,20})|Código:\s*([A-Z0-9]{6,20})|Nro[:.\s]*([A-Z0-9]{6,20})|Codigo:\s*([A-Z0-9]{6,20})/i)
    if (operacionMatch) {
        datos.operacion = operacionMatch.slice(1).find(x => x)
    }

    return datos
}

/**
 * Calcular confianza final del OCR
 */
function calcularConfianza(ocrData, ocrConfidence) {
    let confianza = ocrConfidence
    
    // Bonificaciones
    if (ocrData.monto) confianza += 10
    if (ocrData.banco) confianza += 5
    if (ocrData.fecha) confianza += 5
    if (ocrData.operacion) confianza += 5
    
    // Penalizaciones
    if (!ocrData.monto) confianza -= 30
    
    return Math.min(Math.max(confianza, 0), 100)
}

/**
 * Detectar tipo de comprobante
 */
function detectarTipoComprobante(texto) {
    const textoLower = texto.toLowerCase()
    
    if (textoLower.includes('yape')) return 'yape'
    if (textoLower.includes('plin')) return 'plin'
    if (textoLower.includes('transferencia')) return 'transferencia'
    if (textoLower.includes('depósito') || textoLower.includes('deposito')) return 'deposito'
    if (textoLower.includes('efectivo')) return 'efectivo'
    
    return 'otro'
}

/**
 * Parsear fecha a formato YYYY-MM-DD
 */
function parsearFecha(fechaStr) {
    try {
        // Intentar varios formatos
        const formatos = [
            /(\d{2})[-/](\d{2})[-/](\d{4})/,  // DD/MM/YYYY
            /(\d{2})[-/](\d{2})[-/](\d{2})/   // DD/MM/YY
        ]
        
        for (const formato of formatos) {
            const match = fechaStr.match(formato)
            if (match) {
                let dia = match[1]
                let mes = match[2]
                let anio = match[3]
                
                // Si año es de 2 dígitos, asumir 20XX
                if (anio.length === 2) {
                    anio = '20' + anio
                }
                
                return `${anio}-${mes}-${dia}`
            }
        }
        
        return null
    } catch (error) {
        console.error('[OCR Service] Error parseando fecha:', error.message)
        return null
    }
}

/**
 * Guardar pago en payments.json
 */
function guardarPago(pago) {
    try {
        // Leer payments.json existente
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }
        
        // Agregar nuevo pago
        payments[pago.id] = pago
        
        // Guardar
        fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2))
        
        console.log(`[OCR Service] 💾 Pago ${pago.id} guardado en payments.json`)
    } catch (error) {
        console.error('[OCR Service] Error guardando pago:', error.message)
        throw error
    }
}

/**
 * Marcar pago como error técnico
 */
function marcarComoError(pagoId, errorMessage) {
    try {
        let payments = {}
        if (fs.existsSync(PAYMENTS_FILE)) {
            const content = fs.readFileSync(PAYMENTS_FILE, 'utf8')
            if (content.trim()) {
                payments = JSON.parse(content)
            }
        }
        
        if (payments[pagoId]) {
            payments[pagoId].estado = 'error_tecnico'
            payments[pagoId].error = errorMessage
            payments[pagoId].updatedAt = new Date().toISOString()
            
            fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(payments, null, 2))
        }
    } catch (error) {
        console.error('[OCR Service] Error marcando como error:', error.message)
    }
}

// Manejo de errores globales
process.on('uncaughtException', (err) => {
    console.error('[OCR Service] ❌ Error no capturado:', err.message)
    // NO morir - continuar ejecutando
})

process.on('SIGTERM', () => {
    console.log('[OCR Service] Terminando servicio...')
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('[OCR Service] Interrupción recibida...')
    process.exit(0)
})

// Iniciar servicio
init()

// Exportar para uso desde app.js
module.exports = {
    enqueue,
    init,
    isFeatureEnabled,
    procesarImagenDirecta
}
