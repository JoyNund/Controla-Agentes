/**
 * Servicio de agente de IA para respuestas conversacionales.
 * Soporta Deepseek, OpenAI, Qwen (OAuth), Google Gemini y Llama.
 */

const axios = require('axios')
const path = require('path')
const fs = require('fs')
const { getValidToken, hasCredentials } = require('./qwenProxy')

const DEFAULT_TEMPERATURE = 0.3

const PROVIDERS = {
    deepseek: { baseUrl: 'https://api.deepseek.com', defaultModel: 'deepseek-chat' },
    openai: { baseUrl: 'https://api.openai.com', defaultModel: 'gpt-4o-mini' },
    qwen: { baseUrl: 'https://portal.qwen.ai/v1', defaultModel: 'coder-model', authType: 'oauth' },
    gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultModel: 'gemini-1.5-pro' },
    llama: { baseUrl: 'https://api.groq.com/openai/v1', defaultModel: 'llama-3.1-70b-versatile' },
    custom: { baseUrl: '', defaultModel: '' },
}

function getActiveAgentConfig() {
    try {
        const file = path.join(__dirname, '..', 'server', 'data', 'active-agent.json')
        if (fs.existsSync(file)) {
            return JSON.parse(fs.readFileSync(file, 'utf8'))
        }
    } catch (_) { }
    return null
}

function buildSystemPrompt(agent) {
    const parts = []
    if (agent.systemPrompt) parts.push(agent.systemPrompt)
    if (agent.rules?.saludoInicial) parts.push(`Saludo inicial que puedes usar: "${agent.rules.saludoInicial}"`)
    if (agent.knowledgeBase) {
        parts.push('\n\nBASE DE CONOCIMIENTO (respeta estrictamente esta información, no inventes nada que no esté aquí):')
        parts.push(agent.knowledgeBase)
    }

    // Agregar instrucciones del catálogo multimedia si existe y está habilitado
    if (agent.mediaCatalog && agent.mediaCatalog.length > 0 && agent.enableSmartMedia !== false) {
        parts.push('\n\n=== CATÁLOGO MULTIMEDIA DISPONIBLE ===')
        parts.push('TIENES ARCHIVOS MULTIMEDIA PARA ENVIAR CUANDO SEA RELEVANTE Y CONTEXTUALMENTE APROPIADO.')
        parts.push('')
        parts.push('ARCHIVOS DISPONIBLES:')

        agent.mediaCatalog.forEach((item, index) => {
            parts.push(`${index + 1}. ID: ${item.id} | Título: ${item.title} | Tipo: ${item.type}`)
            parts.push(`   Tags: ${(item.tags || []).join(', ') || 'general'}`)
            parts.push(`   Descripción: ${item.description || 'Sin descripción'}`)
            if (item.price) {
                parts.push(`   Precio: ${item.price}`)
            }
            parts.push('')
        })

        parts.push('CUÁNDO ENVIAR ARCHIVOS (ANÁLISIS CONTEXTUAL):')
        parts.push('')
        parts.push('ENVÍA UN ARCHIVO SOLO SI:')
        parts.push('1. El usuario está EXPLÍCITAMENTE preguntando por ver, conocer o recibir información visual')
        parts.push('2. El usuario muestra INTERÉS REAL en un producto/servicio (no solo menciona la palabra)')
        parts.push('3. El contexto de la conversación INDICA que el usuario quiere ver ejemplos o detalles')
        parts.push('')
        parts.push('NO ENVÍES ARCHIVOS SI:')
        parts.push('1. El usuario solo menciona una palabra clave sin contexto (ej: "página web" solo)')
        parts.push('2. El usuario está haciendo una pregunta general sin mostrar interés de compra')
        parts.push('3. La conversación aún está en etapa inicial y no hay confianza establecida')
        parts.push('4. El usuario ya recibió información similar recientemente')
        parts.push('')
        parts.push('EJEMPLOS DE CUÁNDO SÍ ENVIAR:')
        parts.push('Usuario: "¿Puedo ver ejemplos de páginas web que han hecho?" → ENVÍA (interés explícito)')
        parts.push('Usuario: "Me interesa, ¿tienen catálogo o algo para ver?" → ENVÍA (solicitud directa)')
        parts.push('Usuario: "¿Qué precios manejan? ¿Tienen lista?" → ENVÍA (pregunta específica de precios)')
        parts.push('')
        parts.push('EJEMPLOS DE CUÁNDO NO ENVIAR:')
        parts.push('Usuario: "página web" → NO ENVÍES (solo mencionó la palabra, sin contexto)')
        parts.push('Usuario: "hola" → NO ENVÍES (saludo inicial, muy temprano)')
        parts.push('Usuario: "¿hacen páginas web?" → NO ENVÍES (pregunta general, aún no hay interés real)')
        parts.push('')
        parts.push('FORMATO PARA ENVIAR:')
        parts.push('1. Explica brevemente (1-2 líneas)')
        parts.push('2. Luego responde SOLAMENTE con este JSON:')
        parts.push('   {"tipo": "enviar_archivo", "archivoId": "media_XXX", "caption": "texto breve"}')
        parts.push('3. Asegúrate que el archivo sea RELEVANTE para lo que preguntó')
        parts.push('')
        parts.push('IMPORTANTE: Usa tu criterio. Mejor NO enviar que enviar de más.')
        parts.push('========================================\n')
    } else if (agent.mediaCatalog && agent.mediaCatalog.length > 0 && agent.enableSmartMedia === false) {
        // Catálogo existe pero envío inteligente está deshabilitado
        parts.push('\n\n=== CATÁLOGO MULTIMEDIA (DESHABILITADO) ===')
        parts.push('TIENES ARCHIVOS MULTIMEDIA PERO NO DEBES ENVIARLOS.')
        parts.push('El envío automático de imágenes está desactivado para este agente.')
        parts.push('Responde solo con texto, incluso si el usuario pide ver algo.')
        parts.push('========================================\n')
    }

    parts.push('\n\nINSTRUCCIONES DE FORMATO:')
    parts.push('- Responde en máximo 3 a 5 líneas')
    parts.push('- No uses emojis en exceso')
    parts.push('- Mantén un tono profesional pero amable')
    parts.push('')
    parts.push('MANEJO DE IMÁGENES:')
    parts.push('- Si recibes "[Imagen adjunta]" → El usuario envió una imagen sin texto. Respondé: "Veo que enviaste una imagen. ¿Podrías contarme qué es o en qué puedo ayudarte con ella?"')
    parts.push('- Si recibes "[Imagen con texto: \"...\"]" → El usuario envió una imagen con un caption. Usá el contexto del caption para responder.')
    
    // Instrucciones de OCR SOLO si la capacidad está activada
    const capacidadPagosActiva = agent.capabilities?.procesarPagos !== false
    if (capacidadPagosActiva) {
        parts.push('- Si el mensaje del usuario es "IMAGEN PROCESADA CON OCR: [BANCO] - S/ [MONTO] - PAGO VÁLIDO" → Respondé naturalmente como si el cliente te hubiera dicho eso: "¡Perfecto! Recibí tu comprobante de {monto} de {banco}. Un asesor lo confirmará en breves momentos. ¿Necesitás algo más?"')
        parts.push('- Si el mensaje del usuario es "IMAGEN PROCESADA CON OCR: ... REQUIERE REVISIÓN" → Respondé: "Veo que enviaste una imagen pero no pudimos leerla claramente. ¿Podés reenviarla asegurándote de que se vea bien el monto y el banco?"')
    }
    
    parts.push('- Prioriza precisión sobre creatividad')
    parts.push('- Si no sabes algo, dilo honestamente')
    parts.push('- Nunca inventes información que no esté en la base de conocimiento')

    // Agregar instrucciones para gestión de citas SOLO si la capacidad está activada
    const capacidadCitasActiva = agent.capabilities?.agendarCitas !== false
    if (capacidadCitasActiva) {
        parts.push('\n\n=== GESTIÓN DE CITAS/REUNIONES ===')
        parts.push('TIENES LA CAPACIDAD DE AGENDAR CITAS DIRECTAMENTE SIN DERIVAR A ASESOR HUMANO.')
        parts.push('')
        parts.push('🔒 REGLA OBLIGATORIA - VERIFICACIÓN EN BACKEND:')
        parts.push('En el contexto de la conversación recibirás información entre [CONTEXTO: ...] sobre el estado de citas del cliente.')
        parts.push('')
        parts.push('USA esa información SOLO cuando:')
        parts.push('✅ El cliente pregunte directamente sobre sus citas ("tengo cita?", "cuándo es?", "mi cita", "tienes algo agendado")')
        parts.push('✅ El cliente quiera cancelar o modificar ("quiero cancelar", "ya no puedo ir", "cambia la hora")')
        parts.push('✅ El cliente esté agendando una nueva cita')
        parts.push('')
        parts.push('NO menciones citas cuando:')
        parts.push('❌ El cliente solo salude ("hola", "buenos días", "qué tal")')
        parts.push('❌ El cliente agradezca ("gracias", "thank you")')
        parts.push('❌ El cliente hable de temas no relacionados')
        parts.push('❌ El cliente se despida ("adiós", "hasta luego", "nos vemos")')
        parts.push('')
        parts.push('EJEMPLOS DE COMPORTAMIENTO CORRECTO:')
        parts.push('')
        parts.push('Cliente: "Hola, ¿qué tal?"')
        parts.push('Tú: "Hola! Todo bien por aquí. ¿En qué puedo ayudarte hoy?" (NO mencionar citas)')
        parts.push('')
        parts.push('Cliente: "¿Tengo alguna cita agendada?"')
        parts.push('Tú: "Sí, tienes una cita agendada para el [fecha] a las [hora]..." (USAR datos del contexto)')
        parts.push('')
        parts.push('Cliente: "Quiero cancelar mi cita"')
        parts.push('Tú: "Entiendo, quieres cancelar tu cita del [fecha]. Para confirmar, escribe CANCELAR" (USAR datos + JSON)')
        parts.push('')
        parts.push('Cliente: "Gracias por todo"')
        parts.push('Tú: "Con gusto! Estoy aquí para ayudarte cuando lo necesites." (NO mencionar citas)')
        parts.push('')
        parts.push('CUÁNDO EL CLIENTE QUIERA AGENDAR UNA CITA:')
        parts.push('')
        parts.push('PASO 1 - OBTENER DATOS:')
        parts.push('Pide al cliente que confirme:')
        parts.push('')
        parts.push('📋 *Datos para tu cita*:')
        parts.push('1️⃣ Tu *nombre completo*')
        parts.push('2️⃣ Tu *número de teléfono*')
        parts.push('3️⃣ *Fecha* que prefiere')
        parts.push('4️⃣ *Hora* preferida')
        parts.push('5️⃣ *Tipo de proyecto*')
        parts.push('6️⃣ *Breve descripción* de lo que necesita')
        parts.push('')
        parts.push('PASO 2 - VERIFICAR CITA PREVIA (BACKEND):')
        parts.push('El sistema automáticamente verifica en el backend si el cliente YA TIENE una cita activa.')
        parts.push('La búsqueda se hace por:')
        parts.push('- Número de teléfono (principal)')
        parts.push('- conversationId (secundario)')
        parts.push('Si ya tiene una cita, el backend retorna error 409 y el bot informa que debe cancelar la actual.')
        parts.push('')
        parts.push('PASO 3 - CONFIRMAR DATOS:')
        parts.push('Cuando el cliente responda con los datos, confirma:')
        parts.push('')
        parts.push('"Perfecto, déjame confirmar los datos de tu cita:')
        parts.push('')
        parts.push('👤 *Nombre:* [nombre]')
        parts.push('📅 *Fecha:* [fecha]')
        parts.push('🕐 *Hora:* [hora]')
        parts.push('💼 *Tipo:* [tipo]')
        parts.push('📝 *Descripción:* [descripción]')
        parts.push('')
        parts.push('¿Confirmas? Responde SI para agendar."')
        parts.push('')
        parts.push('PASO 4 - AGENDAR (SOLO SI CONFIRMA):')
        parts.push('Si el cliente responde "SI", "sí", "confirmo" o similar, agenda la cita.')
        parts.push('')
        parts.push('Para agendar, responde EXACTAMENTE con este formato JSON:')
        parts.push('')
        parts.push('__CITA_CONFIRMADA__')
        parts.push('{')
        parts.push('  "nombre": "[Nombre Completo del Cliente]",')
        parts.push('  "telefono": "[51903172378 - solo números, sin espacios ni símbolos]",')
        parts.push('  "fecha": "[YYYY-MM-DD - ej: 2026-02-25]",')
        parts.push('  "hora": "[HH:MM - ej: 15:00]",')
        parts.push('  "tipo": "[Tipo de proyecto]",')
        parts.push('  "descripcion": "[Descripción breve]"')
        parts.push('}')
        parts.push('__FIN_CITA__')
        parts.push('')
        parts.push('⚠️ El JSON debe estar SOLO, sin texto adicional antes o después.')
        parts.push('')
        parts.push('PASO 5 - MENSAJE DE CONFIRMACIÓN:')
        parts.push('Después del JSON, el sistema mostrará automáticamente:')
        parts.push('"✅ *CITA AGENDADA EXITOSAMENTE*"')
        parts.push('')
        parts.push('Y le informará que recibirá un recordatorio 1 hora antes.')
        parts.push('')
        parts.push('CUÁNDO EL CLIENTE QUIERA CANCELAR:')
        parts.push('- Si el cliente pide cancelar su cita, confirma los datos y luego genera el JSON de cancelación')
        parts.push('- Formato de cancelación:')
        parts.push('  __CITA_CANCELADA__')
        parts.push('  {"citaId": "[ID de la cita]"}')
        parts.push('  __FIN_CANCELACION__')
        parts.push('- El sistema cancelará automáticamente en el backend')
        parts.push('')
        parts.push('RECORDATORIO FINAL:')
        parts.push('- NUNCA derives a asesor humano para agendar citas')
        parts.push('- TÚ MISMO/A gestionas la cita completa')
        parts.push('- El backend SIEMPRE verifica en la base de datos real')
        parts.push('- El historial del chat es SOLO contexto, NO es la fuente de verdad')
        parts.push('- El objetivo es que el cliente quede SATISFECHO con la atención rápida')
        parts.push('========================================\n')
    }

    return parts.join('\n')
}

/**
 * Obtiene una respuesta del agente de IA.
 * @param {string} mensajeUsuario - El mensaje actual del usuario
 * @param {string} historial - Historial de conversación (últimos N mensajes)
 * @param {object} config - Configuración del agente
 */
async function responderConIA(mensajeUsuario, historial = '', config = null) {
    let agent = config || getActiveAgentConfig()

    // ============================================
    // VERIFICAR CONTEXTO OCR PARA IMÁGENES
    // ============================================
    let ocrContext = null
    try {
        const ocrContextPath = path.join(__dirname, '..', 'server', 'data', 'ocr_context.json')
        if (fs.existsSync(ocrContextPath)) {
            const context = JSON.parse(fs.readFileSync(ocrContextPath, 'utf8'))
            
            // Extraer ID completo del cliente (puede ser largo, 15+ dígitos para @lid)
            const idMatch = historial.match(/\[CLIENTE TELÉFONO:\s*(\d+)\]/i)
            if (idMatch) {
                const clientId = idMatch[1]
                console.log('[agenteIA] 🔍 Buscando contexto OCR para ID:', clientId)
                
                if (context[clientId]) {
                    const ocrData = context[clientId]
                    
                    // Verificar si no expiró (1 minuto)
                    if (Date.now() < ocrData.expiraEn) {
                        ocrContext = ocrData
                        console.log('[agenteIA] 📝 Contexto OCR encontrado:', ocrContext)
                        
                        // Limpiar contexto después de usar
                        delete context[clientId]
                        fs.writeFileSync(ocrContextPath, JSON.stringify(context, null, 2))
                    } else {
                        console.log('[agenteIA] ⏰ Contexto OCR expirado')
                    }
                } else {
                    console.log('[agenteIA] ❌ No hay contexto OCR para', clientId)
                    // Debug: mostrar qué IDs hay en el contexto
                    console.log('[agenteIA] IDs en contexto:', Object.keys(context))
                }
            } else {
                console.log('[agenteIA] ❌ No se encontró [CLIENTE TELÉFONO:] en el historial')
            }
        } else {
            console.log('[agenteIA] ❌ No existe archivo de contexto OCR')
        }
    } catch (error) {
        console.error('[agenteIA] Error leyendo contexto OCR:', error.message)
    }
    
    // Si hay contexto OCR, modificar el mensaje del usuario
    if (ocrContext) {
        if (ocrContext.esPago) {
            // El OCR detectó un pago - el agente debe responder naturalmente
            mensajeUsuario = `[El cliente envió un comprobante de pago. OCR detectó: Banco=${ocrContext.banco}, Monto=S/ ${ocrContext.monto}] ${mensajeUsuario}`
            console.log('[agenteIA] 💰 Pago detectado por OCR, mensaje modificado')
        } else {
            // No es pago - preguntar amablemente
            mensajeUsuario = `[El cliente envió una imagen pero el OCR no identificó un pago] ${mensajeUsuario}`
            console.log('[agenteIA] 📸 Imagen sin pago detectado')
        }
    }
    // ============================================

    if (!agent) {
        const apiKey = process.env.DEEPSEEK_API_KEY || 
                       process.env.OPENAI_API_KEY || 
                       process.env.GEMINI_API_KEY || 
                       process.env.LLAMA_API_KEY || 
                       process.env.GROQ_API_KEY
        if (!apiKey) {
            console.error('[agenteIA] No API key configured')
            return '⚠️ No está configurada la API de IA. Configura DEEPSEEK_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, o LLAMA_API_KEY en .env.'
        }
        agent = {
            motor: 'deepseek',
            model: 'deepseek-chat',
            apiKey,
            systemPrompt: 'Eres un asistente útil.',
            knowledgeBase: '',
            temperature: DEFAULT_TEMPERATURE,
        }
    }

    const provider = PROVIDERS[agent.motor]
    const baseUrl = agent.apiBaseUrl || provider?.baseUrl
    const model = agent.model || provider?.defaultModel
    const authType = provider?.authType || 'apikey'
    
    let apiKey = null
    let accessToken = null

    // Manejar autenticación según el proveedor
    if (agent.motor === 'qwen' && authType === 'oauth') {
        // Qwen con OAuth via proxy local (lee ~/.qwen/oauth_creds.json)
        const tokenResult = await getValidToken()
        
        if (!tokenResult.success) {
            console.error('[agenteIA] Qwen OAuth error:', tokenResult.error)
            return `⚠️ Qwen OAuth: ${tokenResult.error}`
        }

        accessToken = tokenResult.access_token
        console.log('[agenteIA] Token Qwen obtenido via proxy local')
    } else {
        // API Key tradicional (Deepseek, OpenAI, Gemini, Llama, etc.)
        apiKey = agent.apiKey || 
                 process.env.DEEPSEEK_API_KEY || 
                 process.env.OPENAI_API_KEY || 
                 process.env.GEMINI_API_KEY || 
                 process.env.LLAMA_API_KEY || 
                 process.env.GROQ_API_KEY ||
                 ''
    }

    const temperature = typeof agent.temperature === 'number' ? agent.temperature : DEFAULT_TEMPERATURE

    if (!apiKey && !accessToken) {
        console.error('[agenteIA] API Key o Access Token missing')
        return '⚠️ Este agente no tiene credenciales configuradas.'
    }

    // Construir system prompt
    const systemContent = buildSystemPrompt(agent)

    // Construir mensajes para la API
    // Si hay historial, lo incluimos como mensajes previos
    const messages = [
        { role: 'system', content: systemContent }
    ]

    // Si hay historial de conversación, agregarlo como contexto
    if (historial && historial.trim()) {
        messages.push({
            role: 'system',
            content: `\n\nCONVERSACIÓN RECIENTE (contexto para entender el diálogo):\n${historial}\n\n`
        })
    }

    // Mensaje actual del usuario
    messages.push({ role: 'user', content: mensajeUsuario })

    // Construir URL - usar baseUrl del proveedor
    let url
    if (baseUrl) {
        if (agent.motor === 'gemini') {
            // Gemini usa un endpoint diferente
            url = `${baseUrl.replace(/\/$/, '')}/models/${model}:generateContent?key=${apiKey}`
        } else {
            url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
        }
    } else if (agent.motor === 'qwen') {
        url = 'https://portal.qwen.ai/v1/chat/completions'
    } else {
        url = 'https://api.deepseek.com/v1/chat/completions'
    }

    console.log('[agenteIA] Llamando a API:', {
        provider: agent.motor,
        model,
        apiKeyLength: apiKey ? apiKey.length : (accessToken ? 'oauth' : 0),
        hasHistorial: !!historial,
        mensajeLength: mensajeUsuario.length
    })

    try {
        const headers = {
            'Content-Type': 'application/json',
        }

        // Autenticación según el proveedor
        if (accessToken) {
            // Qwen OAuth
            headers['Authorization'] = `Bearer ${accessToken}`
        } else if (apiKey && agent.motor !== 'gemini') {
            // API Key tradicional (excepto Gemini que va en la URL)
            headers['Authorization'] = `Bearer ${apiKey.trim()}`
        }

        // Construir body según el proveedor
        let requestBody
        if (agent.motor === 'gemini') {
            // Gemini usa formato diferente
            requestBody = {
                contents: [{
                    parts: [{
                        text: messages.map(m => m.content).join('\n\n')
                    }]
                }],
                generationConfig: {
                    maxOutputTokens: 600,
                    temperature,
                }
            }
        } else {
            // Formato estándar OpenAI (Deepseek, OpenAI, Qwen, Llama)
            requestBody = {
                model,
                messages,
                max_tokens: 600,
                temperature,
            }
        }

        const response = await axios.post(url, requestBody, {
            headers,
            timeout: 45000
        })

        console.log('[agenteIA] Respuesta API:', {
            status: response.status,
            choices: response.data?.choices?.length || response.data?.candidates?.length,
            hasContent: !!response.data?.choices?.[0]?.message?.content || !!response.data?.candidates?.[0]?.content
        })

        // Parsear respuesta según el proveedor
        let texto
        if (agent.motor === 'gemini') {
            // Gemini devuelve candidates[].content.parts[].text
            texto = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        } else {
            // Formato estándar OpenAI
            texto = response.data?.choices?.[0]?.message?.content?.trim()
        }

        if (!texto) {
            console.warn('[agenteIA] Respuesta vacía de la API')
            return 'No pude generar una respuesta.'
        }

        // Agregar firma del modelo para debugging (solo en modo debug)
        if (process.env.DEBUG_MODE === 'true') {
            const firma = `\n\n---\n*🤖 Respondido por: ${agent.motor} (${agent.model})*`
            texto = texto + firma
        }

        console.log(`[agenteIA] ✅ Respuesta generada con ${agent.motor} (${agent.model})`)
        return texto
    } catch (error) {
        if (error.response) {
            console.error('[agenteIA] Error API:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            })
            
            // Errores específicos
            if (error.response.status === 401) {
                return '❌ Error de autenticación con la API. Verifica tu API Key.'
            } else if (error.response.status === 429) {
                return '⏳ Demasiadas solicitudes. Por favor espera un momento e intenta de nuevo.'
            } else if (error.response.status === 500) {
                return '❌ Error interno del servidor de IA. Intenta más tarde.'
            }
        } else if (error.code === 'ECONNABORTED') {
            console.error('[agenteIA] Timeout de conexión')
            return '⏱️ La respuesta está tardando más de lo esperado. Intenta de nuevo.'
        } else {
            console.error('[agenteIA] Error de red:', error.message)
        }
        
        return '❌ Hubo un error al procesar tu mensaje. Intenta más tarde.'
    }
}

/**
 * Genera configuración de agente (prompt, base de conocimiento, saludo, objeciones)
 * basado en respuestas simples del usuario.
 * @param {string} tipo - 'personalidad' | 'base_conocimiento' | 'saludo' | 'objeciones'
 * @param {Object} respuestas - Respuestas del usuario a las preguntas del asistente
 * @param {string} apiKey - API Key de DeepSeek
 * @returns {Promise<string>} Texto generado por IA
 */
async function generarConfiguracionAgente(tipo, respuestas, apiKey) {
    const axios = require('axios')
    
    // Prompts específicos por tipo de configuración
    const prompts = {
        personalidad: `Eres un experto en configuración de agentes de IA para WhatsApp.

Tu tarea es transformar las respuestas del usuario en un texto profesional para la sección "Personalidad y Contexto" de su agente.

RESPUESTAS DEL USUARIO:
${Object.entries(respuestas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

INSTRUCCIONES:
1. Crea un texto que defina claramente la personalidad del agente
2. Incluye el nombre de la marca y su rol
3. Define el tono de comunicación (formal, amigable, profesional, cercano)
4. Especifica el estilo de respuesta (breve, detallado, etc.)
5. Menciona valores a transmitir
6. El texto debe ser claro, directo y listo para usar como system prompt

FORMATO DE SALIDA:
Solo el texto de la personalidad, sin títulos ni explicaciones adicionales.
Máximo 150 palabras.`,

        base_conocimiento: `Eres un experto en configuración de agentes de IA para WhatsApp.

Tu tarea es transformar las respuestas del usuario en una base de conocimiento estructurada para su agente.

RESPUESTAS DEL USUARIO:
${Object.entries(respuestas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

INSTRUCCIONES:
1. Organiza la información en secciones claras
2. Incluye: productos/servicios, precios, contacto, web/redes, métodos de pago, políticas
3. Usa formato fácil de leer (viñetas, negritas)
4. El agente debe poder usar esta información para responder preguntas
5. Sé específico con los datos (números, URLs, nombres)

FORMATO DE SALIDA:
Texto estructurado con secciones claras.
Máximo 300 palabras.`,

        saludo: `Eres un experto en configuración de agentes de IA para WhatsApp.

Tu tarea es crear un saludo inicial profesional y amable para el agente del usuario.

RESPUESTAS DEL USUARIO:
${Object.entries(respuestas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

INSTRUCCIONES:
1. Crea un saludo cálido y profesional
2. Incluye el nombre del agente si se proporcionó
3. Menciona brevemente en qué puede ayudar
4. El saludo debe invitar a la conversación
5. Máximo 3-4 líneas

FORMATO DE SALIDA:
Solo el texto del saludo, listo para copiar y pegar.`,

        objeciones: `Eres un experto en ventas y configuración de agentes de IA para WhatsApp.

Tu tarea es crear respuestas efectivas para manejar objeciones comunes de clientes.

RESPUESTAS DEL USUARIO:
${Object.entries(respuestas).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

INSTRUCCIONES:
1. Identifica 3-5 objeciones comunes basadas en la información proporcionada
2. Para cada objeción, crea una respuesta persuasiva pero no agresiva
3. Incluye argumentos de venta si se proporcionaron
4. Menciona promociones o descuentos si existen
5. Incluye llamados a la acción claros
6. Cada respuesta debe ser breve (2-3 líneas)

FORMATO DE SALIDA - INSTRUCCIONES CRÍTICAS:
- NO uses negritas (NO uses **)
- NO uses "Objeción:" ni "Respuesta:"
- NO uses títulos ni encabezados
- USA EXACTAMENTE este formato, una línea por objeción:

Si el cliente dice: "[texto de la objeción]", respondes: "[texto de la respuesta]"

Ejemplo de salida CORRECTA (esto es lo que debes generar):
Si el cliente dice: "Es muy caro", respondes: "Entiendo tu preocupación. Nuestro producto incluye garantía de 2 años y soporte 24/7. ¿Te gustaría ver las opciones de pago?"
Si el cliente dice: "Lo tengo que pensar", respondes: "¡Claro! Es una decisión importante. ¿Hay algo específico que te genere dudas? Tenemos 10% de descuento esta semana."`
    }

    const prompt = prompts[tipo]
    
    if (!prompt) {
        throw new Error(`Tipo de configuración no válido: ${tipo}`)
    }

    try {
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: 'Eres un asistente experto en configuración de agentes de WhatsApp para negocios. Tu trabajo es transformar respuestas simples en textos profesionales listos para usar.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500,
            temperature: 0.7
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            timeout: 30000
        })

        const textoGenerado = response.data?.choices?.[0]?.message?.content?.trim()
        
        if (!textoGenerado) {
            throw new Error('La IA no generó texto válido')
        }

        return textoGenerado
    } catch (error) {
        console.error('[agenteIA] Error generando configuración:', error.message)
        
        if (error.response) {
            if (error.response.status === 401) {
                throw new Error('API Key inválida o expirada')
            } else if (error.response.status === 429) {
                throw new Error('Demasiadas solicitudes. Intenta en un momento.')
            }
        }
        
        throw new Error('Error al generar la configuración. Verifica tu conexión e intenta nuevamente.')
    }
}

module.exports = { responderConIA, getActiveAgentConfig, buildSystemPrompt, generarConfiguracionAgente }
