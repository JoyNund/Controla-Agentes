// Dual WhatsApp Integration System - Supporting both Baileys and whatsapp-web.js
// With flexible agent configuration (AI vs Predefined responses)

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const API_URL = process.env.WEBAPP_API_URL || 'http://127.0.0.1:3847';
const BOT_TOKEN = process.env.BOT_INTERNAL_TOKEN;
const DATA_DIR = path.join(__dirname, 'server', 'data');

// Import both connection libraries
const { connectToWhatsApp: connectWithBaileys } = require('./baileys-direct');

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
            const { responderConIA } = require('./services/agenteIA');
            return await responderConIA(message, '', agentConfig);
        }
    } else if (agentConfig.type === 'predefined') {
        // Use trigger-based responses from agent configuration
        return triggerSystem.findResponseForAgent(message, sender, agentConfig).response;
    } else {
        // Default to AI if no type specified
        const { responderConIA } = require('./services/agenteIA');
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

// Function to initialize Baileys connection
async function initializeBaileysConnection(agentConfig) {
    console.log(`Initializing Baileys connection for agent: ${agentConfig.name}`);
    // Ensure agent config has all required properties
    const fullAgentConfig = {
        ...agentConfig,
        phoneNumber: agentConfig.phoneNumber || process.env.WHATSAPP_PHONE_NUMBER
    };
    return await connectWithBaileys(agentConfig.id, fullAgentConfig);
}

// Function to initialize whatsapp-web.js connection
async function initializeWebConnection(agentConfig) {
    console.log(`Initializing whatsapp-web.js connection for agent: ${agentConfig.name}`);
    
    const wwebjs = require('whatsapp-web.js');
    
    // Create whatsapp-web client
    const client = new wwebjs.Client({
        puppeteer: { 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        },
        authStrategy: new wwebjs.LocalAuth({
            clientId: agentConfig.id,
            dataPath: path.join(__dirname, 'web_sessions', agentConfig.id)
        })
    });
    
    client.on('qr', (qr) => {
        console.log('QR received for whatsapp-web:', qr);
        // Save QR to file for web app access
        const qrPath = path.join(DATA_DIR, `qr_${agentConfig.id}.png`);
        require('qr-image').image(qr).pipe(fs.createWriteStream(qrPath));
        
        // Update connection status
        axios.post(`${API_URL}/api/connection`, { 
            agentId: agentConfig.id, 
            status: 'connecting' 
        }, {
            headers: { 'x-bot-token': BOT_TOKEN }
        }).catch(err => console.error('Error updating connection status:', err.message));
    });
    
    client.on('authenticated', () => {
        console.log('Authenticated with whatsapp-web');
    });
    
    client.on('auth_failure', (msg) => {
        console.error('Authentication failed with whatsapp-web:', msg);
        axios.post(`${API_URL}/api/connection`, { 
            agentId: agentConfig.id, 
            status: 'disconnected' 
        }, {
            headers: { 'x-bot-token': BOT_TOKEN }
        }).catch(err => console.error('Error updating connection status:', err.message));
    });
    
    client.on('ready', () => {
        console.log('Client is ready with whatsapp-web!');
        axios.post(`${API_URL}/api/connection`, { 
            agentId: agentConfig.id, 
            status: 'connected' 
        }, {
            headers: { 'x-bot-token': BOT_TOKEN }
        }).catch(err => console.error('Error updating connection status:', err.message));
        
        // Remove QR file after successful connection
        const qrPath = path.join(DATA_DIR, `qr_${agentConfig.id}.png`);
        if (fs.existsSync(qrPath)) {
            fs.unlinkSync(qrPath);
        }
    });
    
    client.on('message', async (message) => {
        if (message.fromMe) return; // Ignore messages sent by the bot itself
        
        console.log(`Received message from ${message.from}: ${message.body}`);
        
        try {
            // Log to web app
            await axios.post(`${API_URL}/api/conversations/push`, { 
                from: message.from, 
                body: message.body, 
                fromBot: false 
            }, {
                headers: { 'x-bot-token': BOT_TOKEN }
            }).catch(err => console.error('Error logging message:', err.message));

            // Process with agent
            const response = await processMessageWithAgent(message.body, agentConfig, message.from);
            
            console.log(`Sending response: ${response}`);
            
            // Send response
            await message.reply(response);
            
            // Log response to web app
            await axios.post(`${API_URL}/api/conversations/push`, { 
                from: message.from, 
                body: response, 
                fromBot: true 
            }, {
                headers: { 'x-bot-token': BOT_TOKEN }
            }).catch(err => console.error('Error logging response:', err.message));
            
        } catch (error) {
            console.error('Error processing message:', error);
            
            // Send error message to user
            try {
                await message.reply('Lo siento, hubo un error procesando tu mensaje. Intenta más tarde.');
            } catch (sendErr) {
                console.error('Error sending error message:', sendErr);
            }
        }
    });
    
    // Start the client
    client.initialize();
    return client;
}

// Function to initialize connection based on agent configuration
async function initializeConnection(agentConfig) {
    if (agentConfig.connectionMethod === 'baileys') {
        return await initializeBaileysConnection(agentConfig);
    } else if (agentConfig.connectionMethod === 'whatsapp-web') {
        return await initializeWebConnection(agentConfig);
    } else {
        console.error(`Unknown connection method: ${agentConfig.connectionMethod}`);
        throw new Error(`Unknown connection method: ${agentConfig.connectionMethod}`);
    }
}

// Main function to start the dual-integration system
async function main() {
    console.log('🚀 Starting Dual WhatsApp Integration System...');
    
    // Load agent configuration
    const agentsFile = path.join(DATA_DIR, 'agents.json');
    if (!fs.existsSync(agentsFile)) {
        console.error('No agents found. Please create an agent first.');
        return;
    }
    
    const agents = JSON.parse(fs.readFileSync(agentsFile, 'utf8'));
    if (agents.length === 0) {
        console.error('No agents found. Please create an agent first.');
        return;
    }
    
    // Initialize each agent based on its configuration
    for (const agent of agents) {
        try {
            console.log(`Initializing agent: ${agent.name} with ${agent.connectionMethod} connection and ${agent.type} responses`);
            await initializeConnection(agent);
        } catch (error) {
            console.error(`Error initializing agent ${agent.name}:`, error.message);
        }
    }
}

main();

module.exports = { initializeConnection, processMessageWithAgent, TriggerResponseSystem };