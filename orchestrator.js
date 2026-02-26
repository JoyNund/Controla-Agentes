// Standalone Orchestrator using Direct Baileys Implementation
// Bypassing @bot-whatsapp provider due to compatibility issues

require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const NodeCache = require('node-cache');
const { responderConIA } = require('./services/agenteIA');
const { responderConQwen } = require('./services/qwenIA');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pino = require('pino');

const API_URL = process.env.WEBAPP_API_URL || 'http://127.0.0.1:3847';
const BOT_TOKEN = process.env.BOT_INTERNAL_TOKEN;
const DATA_DIR = path.join(__dirname, 'server', 'data');

const msgRetryCounterCache = new NodeCache();

// Trigger-based response system
class TriggerResponseSystem {
    constructor() {
        this.conversationStates = new Map(); // Track conversation state per user
    }

    findResponseForAgent(message, userId, agentConfig) {
        const lowerMessage = message.toLowerCase();

        // Check if we have a specific conversation state for this user
        const userState = this.conversationStates.get(userId) || null;

        // Get triggers from agent configuration
        const triggers = agentConfig.triggers || [];

        // First, try to match based on current state
        if (userState) {
            // Look for state-specific responses
            const stateTriggers = triggers.filter(t => t.state === userState);
            for (const trigger of stateTriggers) {
                if (lowerMessage.includes(trigger.keyword.toLowerCase())) {
                    if (trigger.nextStep) {
                        this.conversationStates.set(userId, trigger.nextStep);
                    }
                    return {
                        response: trigger.response,
                        nextStep: trigger.nextStep
                    };
                }
            }
        }

        // Find exact matches first
        for (const trigger of triggers) {
            if (lowerMessage.includes(trigger.keyword.toLowerCase())) {
                if (trigger.nextStep) {
                    this.conversationStates.set(userId, trigger.nextStep);
                }
                return {
                    response: trigger.response,
                    nextStep: trigger.nextStep
                };
            }
        }

        // Find partial matches with similarity
        for (const trigger of triggers) {
            if (this.calculateSimilarity(lowerMessage, trigger.keyword.toLowerCase()) > 0.6) {
                if (trigger.nextStep) {
                    this.conversationStates.set(userId, trigger.nextStep);
                }
                return {
                    response: trigger.response,
                    nextStep: trigger.nextStep
                };
            }
        }

        // Default response if no triggers match
        return {
            response: 'Lo siento, no entendí tu mensaje. ¿Puedes reformularlo o indicarme qué necesitas?',
            nextStep: null
        };
    }

    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,     // deletion
                    matrix[j - 1][i] + 1,     // insertion
                    matrix[j - 1][i - 1] + cost // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    resetState(userId) {
        this.conversationStates.delete(userId);
    }
}

// Initialize trigger system
const triggerSystem = new TriggerResponseSystem();

// Function to process message based on agent configuration
async function processMessageWithAgent(message, agentConfig, sender) {
    if (agentConfig.type === 'ai') {
        // Use AI service - check if it's Qwen or other AI
        if (agentConfig.motor === 'qwen') {
            return await processWithQwenAI(message, agentConfig);
        } else {
            return await responderConIA(message, '', agentConfig);
        }
    } else if (agentConfig.type === 'predefined') {
        // Use trigger-based responses from agent configuration
        return triggerSystem.findResponseForAgent(message, sender, agentConfig).response;
    } else {
        // Default to AI if no type specified
        return await responderConIA(message, '', agentConfig);
    }
}

// Function to process with Qwen AI
async function processWithQwenAI(message, agentConfig) {
    try {
        const { responderConQwen } = require('./services/qwenIA');
        return await responderConQwen(message, '', agentConfig);
    } catch (error) {
        console.error('Error processing with Qwen AI:', error);
        return 'Lo siento, hubo un error procesando tu mensaje. Intenta más tarde.';
    }
}

async function connectToWhatsApp(agentId, agentConfig) {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'bot_sessions', agentId));

    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Disable QR printing since we're using pairing
        browser: ['Ubuntu', 'Chrome', '22.0.1220.1'], // Even more generic browser signature
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        msgRetryCounterCache,
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: undefined,
        syncFullHistory: false, // Reduce sync to avoid detection
    });

    // Request pairing code for registration
    setTimeout(async () => {
        if (!state.creds.me) {
            const phoneNumber = agentConfig.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER;
            if (phoneNumber) {
                try {
                    console.log('Requesting pairing code...');
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`[${agentId}] Pairing code: ${code}`);
                    
                    // Update connection status to show pairing code is needed
                    await axios.post(`${API_URL}/api/connection`, { 
                        agentId, 
                        status: 'awaiting_pairing_code',
                        pairingCode: code 
                    }, {
                        headers: { 'x-bot-token': BOT_TOKEN }
                    }).catch(err => console.error('Error updating connection status:', err.message));
                } catch (error) {
                    console.error(`[${agentId}] Error requesting pairing code:`, error.message);
                }
            }
        }
    }, 2000); // Delay to allow connection to establish

    // Track connection state to prevent duplicate status updates
    let currentConnectionState = null;
    
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('QR RECEIVED:', qr);
            // Save QR code to file for web app access
            const qrPath = path.join(DATA_DIR, `qr_${agentId}.png`);
            require('qr-image').image(qr).pipe(fs.createWriteStream(qrPath));

            // Update connection status
            axios.post(`${API_URL}/api/connection`, { agentId, status: 'connecting' }, {
                headers: { 'x-bot-token': BOT_TOKEN }
            }).catch(err => console.error('Error updating connection status:', err.message));
        }

        if (connection === 'close') {
            if (currentConnectionState !== 'close') {
                currentConnectionState = 'close';
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`[${agentId}] Connection closed due to `, lastDisconnect?.error?.output?.statusCode, ', reconnecting ', shouldReconnect);

                // Clear instance to allow reconnection
                instances.delete(agentId);

                if (shouldReconnect) {
                    // Reconnect with delay to avoid rapid reconnection attempts
                    setTimeout(() => {
                        connectToWhatsApp(agentId, agentConfig);
                    }, 15000); // Increased delay to 15 seconds
                } else {
                    console.log(`[${agentId}] Logged out, please scan QR again or use pairing code`);
                    axios.post(`${API_URL}/api/connection`, { agentId, status: 'disconnected' }, {
                        headers: { 'x-bot-token': BOT_TOKEN }
                    }).catch(err => console.error('Error updating connection status:', err.message));
                }
            }
        } else if (connection === 'open') {
            if (currentConnectionState !== 'open') {
                currentConnectionState = 'open';
                console.log(`[${agentId}] Connection opened successfully`);

                // Update connection status to connected
                axios.post(`${API_URL}/api/connection`, { agentId, status: 'connected' }, {
                    headers: { 'x-bot-token': BOT_TOKEN }
                }).catch(err => console.error('Error updating connection status:', err.message));

                // Remove QR file after successful connection
                const qrPath = path.join(DATA_DIR, `qr_${agentId}.png`);
                if (fs.existsSync(qrPath)) {
                    fs.unlinkSync(qrPath);
                }
            }
        }
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
    });

    // Track recently processed messages to prevent duplicates
    const recentMessages = new Set();
    
    sock.ev.on('messages.upsert', async (m) => {
        const { messages } = m;
        for (const msg of messages) {
            if (!msg.key.fromMe && msg.message) { // Only process messages not sent by us
                const sender = jidNormalizedUser(msg.key.remoteJid);
                
                // Extract message content
                const messageContent = msg.message.conversation ||
                                      (msg.message.extendedTextMessage?.text) ||
                                      (msg.message.imageMessage?.caption) ||
                                      (msg.message.videoMessage?.caption) ||
                                      (msg.message.documentMessage?.caption) ||
                                      (msg.message.audioMessage?.caption) ||
                                      (msg.message.stickerMessage?.caption) ||
                                      'Mensaje no reconocido';

                // Create unique message identifier to prevent duplicates
                const messageId = `${sender}_${msg.key.id}`;
                
                // Skip if this message was recently processed
                if (recentMessages.has(messageId)) {
                    continue;
                }
                
                // Add to recent messages and set cleanup timer
                recentMessages.add(messageId);
                setTimeout(() => {
                    recentMessages.delete(messageId);
                }, 30000); // Remove after 30 seconds

                console.log(`[${agentId}] Received message from ${sender}: ${messageContent.substring(0, 50)}...`);

                try {
                    // Log to web app
                    await axios.post(`${API_URL}/api/conversations/push`, {
                        from: sender,
                        body: messageContent,
                        fromBot: false
                    }, {
                        headers: { 'x-bot-token': BOT_TOKEN }
                    }).catch(err => console.error('Error logging message:', err.message));

                    // Process with agent
                    let respuestaIA;
                    try {
                        if (agentConfig.type === 'ai') {
                            if (agentConfig.motor === 'qwen') {
                                respuestaIA = await responderConQwen(messageContent, '', agentConfig);
                            } else {
                                respuestaIA = await responderConIA(messageContent, '', agentConfig);
                            }
                        } else if (agentConfig.type === 'predefined') {
                            // Use trigger-based responses
                            const responseObj = triggerSystem.findResponseForAgent(messageContent, sender, agentConfig);
                            respuestaIA = responseObj.response;
                        } else {
                            // Default to AI
                            respuestaIA = await responderConIA(messageContent, '', agentConfig);
                        }
                        
                        // Validate response is not empty
                        if (!respuestaIA || respuestaIA.trim() === '') {
                            respuestaIA = 'Lo siento, no pude generar una respuesta adecuada.';
                        }
                    } catch (aiError) {
                        console.error(`[${agentId}] Error in AI processing:`, aiError.message);
                        respuestaIA = 'Lo siento, hubo un error procesando tu mensaje. Intenta más tarde.';
                    }

                    console.log(`[${agentId}] AI response: ${respuestaIA.substring(0, 50)}...`);

                    // Send response
                    await sock.sendMessage(sender, { text: respuestaIA });

                    console.log(`[${agentId}] Response sent to ${sender}`);

                    // Log response to web app
                    await axios.post(`${API_URL}/api/conversations/push`, {
                        from: sender,
                        body: respuestaIA,
                        fromBot: true
                    }, {
                        headers: { 'x-bot-token': BOT_TOKEN }
                    }).catch(err => console.error('Error logging response:', err.message));

                } catch (error) {
                    console.error(`[${agentId}] Error processing message:`, error);

                    // Send error message to user
                    try {
                        await sock.sendMessage(sender, { text: 'Lo siento, hubo un error procesando tu mensaje. Intenta más tarde.' });
                    } catch (sendErr) {
                        console.error(`[${agentId}] Error sending error message:`, sendErr);
                    }
                }
            }
        }
    });

    return sock;
}

// Main orchestrator
const instances = new Map();
const apiHeaders = { headers: { 'x-bot-token': BOT_TOKEN } };

async function startBot(agentId, agentConfig) {
    if (instances.has(agentId)) {
        console.log(`[${agentId}] Bot instance already running`);
        return;
    }

    console.log(`[${agentId}] Starting bot for agent: ${agentConfig.name}`);

    try {
        const baileysInstance = await connectToWhatsApp(agentId, agentConfig);
        instances.set(agentId, baileysInstance);
        console.log(`[${agentId}] Bot started successfully`);
    } catch (error) {
        console.error(`[${agentId}] Error starting bot:`, error.message);
        
        // Update status to disconnected on error
        await axios.post(`${API_URL}/api/connection`, { agentId, status: 'disconnected' }, apiHeaders).catch(() => { });
    }
}

async function stopBot(agentId) {
    const instance = instances.get(agentId);
    if (instance) {
        console.log(`[${agentId}] Stopping instance...`);
        
        try {
            // Attempt to close the connection gracefully
            if (instance.logout) {
                await instance.logout();
            }
        } catch (e) {
            console.error(`[${agentId}] Error during logout:`, e.message);
        }
        
        instances.delete(agentId);
        
        // Update status in API
        await axios.post(`${API_URL}/api/connection`, { agentId, status: 'disconnected' }, apiHeaders).catch(() => { });
        console.log(`[${agentId}] Instance stopped`);
    }
}

async function main() {
    console.log('🚀 Starting Direct Baileys Orchestrator...');

    // Initial load of agents
    try {
        const connectionsRes = await axios.get(`${API_URL}/api/connection`, apiHeaders);
        const connections = connectionsRes.data;
        const agentsRes = await axios.get(`${API_URL}/api/agents`, apiHeaders);
        const agents = agentsRes.data;

        // Start bots for connected agents
        for (const agentId in connections) {
            const conn = connections[agentId];
            const agent = agents.find(a => a.id === agentId);

            if ((conn.status === 'connecting' || conn.status === 'awaiting_pairing_code' || conn.status === 'connected') && !instances.has(agentId) && agent) {
                await startBot(agentId, agent);
            }
        }
    } catch (e) {
        console.error('Error during initial load:', e.message);
    }

    // Polling for status changes
    setInterval(async () => {
        try {
            const connectionsRes = await axios.get(`${API_URL}/api/connection`, apiHeaders);
            const connections = connectionsRes.data;
            const agentsRes = await axios.get(`${API_URL}/api/agents`, apiHeaders);
            const agents = agentsRes.data;

            for (const agentId in connections) {
                const conn = connections[agentId];
                const agent = agents.find(a => a.id === agentId);

                if ((conn.status === 'connecting' || conn.status === 'awaiting_pairing_code' || conn.status === 'connected') && !instances.has(agentId) && agent) {
                    await startBot(agentId, agent);
                } else if (conn.status === 'disconnected' && instances.has(agentId)) {
                    await stopBot(agentId);
                }
            }
        } catch (e) {
            console.error('Error in polling:', e.message);
        }
    }, 5000);
}

main();

module.exports = { connectToWhatsApp, processMessageWithAgent, TriggerResponseSystem };