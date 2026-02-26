// Qwen AI Service Integration with OAuth support
const axios = require('axios');

const QWEN_API_URL = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

async function responderConQwen(mensajeUsuario, historial = '', config = null) {
    // For now, using the existing AI service as fallback until OAuth is fully implemented
    // In a complete implementation, you would use the OAuth token to access Qwen API
    const { responderConIA } = require('./agenteIA');
    
    // If the agent has an OAuth token stored, use it for Qwen API calls
    if (config && config.qwenOAuthToken) {
        try {
            // In a real implementation, you would use the OAuth token to call Qwen
            // This is a placeholder implementation using the existing AI service
            // until the full OAuth integration is set up
            return await responderConIA(mensajeUsuario, historial, config);
        } catch (error) {
            console.error('Error with Qwen OAuth implementation:', error);
            // Fallback to existing AI service
            return await responderConIA(mensajeUsuario, historial, config);
        }
    } else {
        // If no OAuth token, fall back to existing AI service
        return await responderConIA(mensajeUsuario, historial, config);
    }
}

module.exports = { responderConQwen };