const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, 'data')

function readJson(name) {
    const file = path.join(DATA_DIR, `${name}.json`)
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
        if (e.code === 'ENOENT') return null
        throw e
    }
}

function writeJson(name, data) {
    const file = path.join(DATA_DIR, `${name}.json`)
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
    return data
}

const agents = {
    list: () => readJson('agents') || [],
    get: (id) => (readJson('agents') || []).find((a) => a.id === id),
    save: (agent) => {
        const list = agents.list()
        const idx = list.findIndex((a) => a.id === agent.id)
        if (idx >= 0) list[idx] = agent
        else list.push(agent)
        writeJson('agents', list)
        return agent
    },
    delete: (id) => {
        const list = (agents.list() || []).filter((a) => a.id !== id)
        writeJson('agents', list)
        return true
    },
}

const settings = {
    get: () => readJson('settings') || { darkMode: false, defaultModel: 'deepseek', branding: {} },
    save: (data) => writeJson('settings', data),
}

const connections = {
    // Nueva estructura: las conexiones son entidades independientes
    // { connectionId: { id, name, status, agentId, phoneNumber, logs, createdAt, updatedAt } }
    list: () => readJson('connections') || {},
    get: (connectionId) => {
        const all = readJson('connections') || {}
        return all[connectionId] || null
    },
    set: (connectionId, data) => {
        const all = readJson('connections') || {}
        all[connectionId] = { ...(all[connectionId] || {}), ...data, updatedAt: new Date().toISOString() }
        writeJson('connections', all)
        return all[connectionId]
    },
    create: (data) => {
        const all = readJson('connections') || {}
        const connectionId = 'conn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        all[connectionId] = {
            id: connectionId,
            name: data.name || 'Conexión ' + connectionId.slice(-4),
            status: 'disconnected',
            agentId: data.agentId || null,
            phoneNumber: null,
            logs: [],
            keyword: data.keyword ? Buffer.from(data.keyword).toString('hex') : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
        writeJson('connections', all)
        return all[connectionId]
    },
    delete: (connectionId) => {
        const all = readJson('connections') || {}
        delete all[connectionId]
        writeJson('connections', all)
        return true
    },
    appendLog: (connectionId, line) => {
        const all = readJson('connections') || {}
        const c = all[connectionId] || { status: 'disconnected', logs: [], id: connectionId }
        c.logs = (c.logs || []).concat({ time: new Date().toISOString(), text: line })
        if (c.logs.length > 500) c.logs = c.logs.slice(-500)
        all[connectionId] = c
        writeJson('connections', all)
        return c
    },
    updateStatus: (connectionId, status, phoneNumber = null) => {
        const all = readJson('connections') || {}
        if (!all[connectionId]) return null
        all[connectionId].status = status
        if (phoneNumber) all[connectionId].phoneNumber = phoneNumber
        all[connectionId].updatedAt = new Date().toISOString()
        writeJson('connections', all)
        return all[connectionId]
    },
    assignAgent: (connectionId, agentId) => {
        const all = readJson('connections') || {}
        if (!all[connectionId]) return null
        all[connectionId].agentId = agentId
        all[connectionId].updatedAt = new Date().toISOString()
        writeJson('connections', all)
        return all[connectionId]
    }
}

const conversations = {
    list: () => readJson('conversations') || [],
    get: (id) => (readJson('conversations') || []).find((c) => c.id === id),
    save: (conv) => {
        const list = conversations.list()
        const idx = list.findIndex((c) => c.id === conv.id)
        if (idx >= 0) list[idx] = conv
        else list.push(conv)
        writeJson('conversations', list)
        return conv
    },
    addMessage: (convId, msg) => {
        const list = conversations.list()
        const c = list.find((x) => x.id === convId)
        if (!c) return null
        c.messages = c.messages || []
        c.messages.push(msg)
        c.updatedAt = new Date().toISOString()
        writeJson('conversations', list)
        return c
    },
    delete: (id) => {
        const list = conversations.list().filter(c => c.id !== id)
        writeJson('conversations', list)
        return true
    },
}

const blockedNumbers = {
    list: () => readJson('blockedNumbers') || [],
    add: (number) => {
        const list = blockedNumbers.list()
        if (!list.includes(number)) {
            list.push(number)
            writeJson('blockedNumbers', list)
        }
        return list
    },
    remove: (number) => {
        const list = blockedNumbers.list().filter(n => n !== number)
        writeJson('blockedNumbers', list)
        return list
    },
    isBlocked: (number) => blockedNumbers.list().includes(number)
}

module.exports = { agents, settings, connections, conversations, blockedNumbers, readJson, writeJson, DATA_DIR }
