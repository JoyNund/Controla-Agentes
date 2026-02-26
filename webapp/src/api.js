const API = '/api'

async function request(path, options = {}) {
    const res = await fetch(API + path, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    if (res.status === 401) {
        window.location.href = '/login'
        throw new Error('No autorizado')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || res.statusText)
    return data
}

export const auth = {
    login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
}

export const agentsApi = {
    list: () => request('/agents'),
    get: (id) => request(`/agents/${id}`),
    create: (body, keyword) => request('/agents', { 
        method: 'POST', 
        body: JSON.stringify({ ...body, keyword }) 
    }),
    update: (id, body, keyword) => request(`/agents/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify({ ...body, keyword }) 
    }),
    delete: (id, keyword) => request(`/agents/${id}`, { 
        method: 'DELETE',
        body: JSON.stringify({ keyword })
    }),
    uploadKnowledge: async (file) => {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch(API + '/agents/upload-knowledge', { method: 'POST', credentials: 'include', body: form })
        if (!res.ok) {
            const d = await res.json().catch(() => ({}))
            throw new Error(d.error || res.statusText)
        }
        return res.json()
    },
    // Asistente de configuración con IA
    generateConfig: (tipo, respuestas) => request('/agents/generate-config', {
        method: 'POST',
        body: JSON.stringify({ tipo, respuestas })
    }),
}

// NEW: Conexiones como entidades independientes
export const connectionsApi = {
    list: () => request('/connections'),
    get: (id) => request(`/connections/${id}`),
    create: (body, keyword) => request('/connections', { 
        method: 'POST', 
        body: JSON.stringify({ ...body, keyword }) 
    }),
    update: (id, body) => request(`/connections/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id, keyword) => request(`/connections/${id}`, { 
        method: 'DELETE',
        body: JSON.stringify({ keyword })
    }),
    assignAgent: (id, agentId, keyword) => request(`/connections/${id}/assign-agent`, { 
        method: 'POST', 
        body: JSON.stringify({ agentId, keyword }) 
    }),
    logout: (id, keyword) => request(`/connections/${id}/logout`, { 
        method: 'POST',
        body: JSON.stringify({ keyword })
    }),
    restart: (id, keyword) => request(`/connections/${id}/restart`, { 
        method: 'POST',
        body: JSON.stringify({ keyword })
    }),
    logs: (id) => request(`/connections/${id}/logs`),
    qrUrl: (id) => `/api/connections/${id}/qr`,
}

// Legacy: para compatibilidad
export const connectionApi = {
    get: (agentId) => request(`/connection/${agentId}`),
    getAll: () => request('/connection'),
    set: (body) => request('/connection', { method: 'POST', body: JSON.stringify(body) }),
    logs: (agentId) => request(`/connection/logs/${agentId}`),
    logout: (agentId) => request('/connection/logout', { method: 'POST', body: JSON.stringify({ agentId }) }),
    restart: (agentId) => request('/connection/restart', { method: 'POST', body: JSON.stringify({ agentId }) }),
}

export const conversationsApi = {
    list: () => request('/conversations'),
    get: (id) => request(`/conversations/${id}`),
    setTag: (id, tag) => request(`/conversations/${id}/tag`, { method: 'PUT', body: JSON.stringify({ tag }) }),
    delete: (id) => request(`/conversations/${id}`, { method: 'DELETE' })
        .then(data => {
            if (data.ok) return data
            throw new Error(data.error || 'Error al eliminar')
        }),
}

// Citas / Reuniones
export const citasApi = {
    getAll: () => request('/citas'),
    getStats: () => request('/citas/stats'),
    getById: (id) => request(`/citas/${id}`),
    getByConversation: (conversationId) => request(`/citas/conversation/${conversationId}/activa`),
    create: (body) => request('/citas', { method: 'POST', body: JSON.stringify(body) }),
    cancelar: (id, body) => request(`/citas/${id}/cancelar`, { method: 'POST', body: JSON.stringify(body) }),
    completar: (id) => request(`/citas/${id}/completar`, { method: 'POST' }),
    update: (id, body) => request(`/citas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id) => request(`/citas/${id}`, { method: 'DELETE' }),
}

export const settingsApi = {
    get: () => request('/settings'),
    update: (body) => request('/settings', { method: 'PUT', body: JSON.stringify(body) }),
    getMasterKeyword: () => request('/settings')
        .then(data => data.security?.masterKeyword || null),
    updateMasterKeyword: (keyword) => request('/settings', { 
        method: 'PUT', 
        body: JSON.stringify({ 
            security: { masterKeyword: keyword ? Buffer.from(keyword).toString('hex') : '' } 
        }) 
    }),
}

export const seedApi = {
    defaultAgent: () => request('/seed-default-agent', { method: 'POST' }),
}

// Pagos - Sistema OCR
export const paymentsApi = {
    list: (params = {}) => {
        const queryString = new URLSearchParams(params).toString()
        return request(`/pagos${queryString ? '?' + queryString : ''}`)
    },
    get: (id) => request(`/pagos/${id}`),
    delete: (id) => request(`/pagos/${id}`, {
        method: 'DELETE'
    }),
    confirmar: (id, body) => request(`/pagos/${id}/confirmar`, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    rechazar: (id, body) => request(`/pagos/${id}/rechazar`, {
        method: 'POST',
        body: JSON.stringify(body)
    }),
    getImagen: (id) => `${API}/pagos/${id}/imagen`,
    getEstadisticas: (params = {}) => {
        const queryString = new URLSearchParams(params).toString()
        return request(`/pagos/estadisticas${queryString ? '?' + queryString : ''}`)
    },
}

// Qwen OAuth
export const qwenOAuthApi = {
    start: (agentId) => request(`/agents/${agentId}/qwen/oauth/start`, { method: 'POST' }),
    poll: (agentId) => request(`/agents/${agentId}/qwen/oauth/poll`, { method: 'POST' }),
    status: (agentId) => request(`/agents/${agentId}/qwen/oauth/status`),
    revoke: (agentId) => request(`/agents/${agentId}/qwen/oauth/revoke`, { method: 'POST' }),
}
