// Prueba de integración completa para identificar el problema exacto
const { responderConIA } = require('./services/agenteIA');

// Simular la llamada exacta que se hace en el socket
async function testIntegration() {
    console.log('=== PRUEBA DE INTEGRACIÓN COMPLETA ===');
    
    // Configuración del agente CONTROLA tal como se obtiene del sistema
    const agentConfig = {
        id: "ag_1770876627427_3rxa1w",
        name: "CONTROLA",
        isPrimary: false,
        systemPrompt: "Principios obligatorios:\\n\\n• Conversaciones breves, claras y orientadas a acción.\\n• Máximo 3 a 5 líneas por mensaje.\\n• Máximo 2 preguntas por mensaje.\\n• No más de 8 a 10 intercambios antes de proponer cierre o derivación.\\n• No envíes audios.\\n• No uses emojis en exceso.\\n• No des explicaciones largas.\\n• No debates.\\n• No eduques extensamente.\\n\\nTu flujo obligatorio:\\n\\nCalificar tipo de proyecto y estado del negocio.\\n\\nDetectar dolor principal.\\n\\nPresentar solución concreta.\\n\\nMencionar inversión sin rodeos.\\n\\nValidar interés.\\n\\nCerrar o derivar.\\n\\nNunca envíes precio sin contexto previo, salvo que ya esté calificado.\\nSi el cliente escribe mensajes largos, resume en una línea y redirige con una pregunta concreta.\\n\\nTu servicio principal es la creación e implementación de páginas web.\\nServicios secundarios: marketing digital y digitalización de procesos.\\n\\nCada mensaje debe cumplir uno de estos cuatro objetivos:\\n• Obtener información.\\n• Confirmar decisión.\\n• Avanzar al pago.\\n• Derivar.\\n\\nSi no cumple uno de esos cuatro, no lo envíes.",
        knowledgeBase: "PROTOCOLO ESTRICTO DE CONVERSACIÓN RÁPIDA Y CIERRE EFICIENTE...",
        rules: {
            saludoInicial: "Hola, soy CONTROLA AI ¿En qué puedo ayudarte?"
        },
        objections: [
            "Respuesta modelo:  “Entiendo. La inversión incluye diseño profesional y estructura optimizada para generar clientes. ¿Estabas considerando algo más básico o tienes un presupuesto definido?”",
            // ... más objeciones
        ],
        motor: "deepseek",
        model: "deepseek-chat",
        temperature: 0.3,
        active: true,
        type: "ai",
        connectionMethod: "baileys-qr",
        triggers: [],
        createdAt: "2026-02-12T06:10:27.427Z",
        updatedAt: "2026-02-12T06:14:24.048Z",
        apiKey: "sk-8928b7e8f33a4fc4be6d5471af00fa50"
    };

    console.log('Configuración del agente cargada, probando con mensaje...');
    
    try {
        // Este es el llamado exacto que se hace en el socket
        const result = await responderConIA('Hola', '', agentConfig);
        console.log('✅ RESPUESTA EXITOSA:', result);
    } catch (error) {
        console.log('❌ ERROR EN LA RESPUESTA:', error.message);
        console.log('Stack:', error.stack);
    }

    // Tambien probar sin pasar la configuración para ver qué sucede
    console.log('\\n--- PROBANDO SIN CONFIGURACIÓN (usando archivo) ---');
    try {
        const result2 = await responderConIA('Hola');
        console.log('Respuesta sin config:', result2);
    } catch (error) {
        console.log('Error sin config:', error.message);
    }
}

testIntegration();