/**
 * Envía mensajes al Monitor de Chats de la web app (CONTROLA.agentes).
 * Si el servidor no está corriendo, se ignora sin error.
 */
const API_URL = process.env.WEBAPP_API_URL || 'http://localhost:3847'

function pushMessage(from, body, fromBot = false) {
    fetch(`${API_URL}/api/conversations/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, body, fromBot }),
    }).catch(() => {})
}

module.exports = { pushMessage }
