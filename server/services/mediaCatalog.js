/**
 * Servicio de Catálogo Multimedia para Agentes
 * Enfoque híbrido: metadata en mediaCatalog + resumen en knowledgeBase
 */

const fs = require('fs')
const path = require('path')
const { readJson, writeJson, DATA_DIR } = require('../store')

const MEDIA_DIR = path.join(__dirname, '..', '..', 'media')

/**
 * Obtiene el catálogo multimedia de un agente
 */
function getMediaCatalog(agentId) {
    const agents = readJson('agents') || []
    const agent = agents.find(a => a.id === agentId)
    return agent?.mediaCatalog || []
}

/**
 * Obtiene un item específico del catálogo
 */
function getMediaItem(agentId, itemId) {
    const catalog = getMediaCatalog(agentId)
    return catalog.find(item => item.id === itemId) || null
}

/**
 * Agrega un item al catálogo y actualiza knowledgeBase
 */
function addMediaItem(agentId, itemData) {
    const agents = readJson('agents') || []
    const agentIndex = agents.findIndex(a => a.id === agentId)

    if (agentIndex === -1) {
        throw new Error('Agente no encontrado')
    }

    const agent = agents[agentIndex]

    // Inicializar mediaCatalog si no existe
    if (!agent.mediaCatalog) {
        agent.mediaCatalog = []
    }

    // Crear nuevo item con estructura completa
    // filePath es opcional para enlaces de WhatsApp
    const newItem = {
        id: 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        title: itemData.title, // Obligatorio
        description: itemData.description || '',
        category: itemData.category || 'general',
        price: itemData.price || null,
        fileName: itemData.fileName || null,
        filePath: itemData.filePath || null,  // Opcional para whatsapp-link
        url: itemData.url,
        type: itemData.type, // 'image', 'video', 'document', 'whatsapp-link'
        mimeType: itemData.mimeType || null,
        fileSize: itemData.fileSize || null,
        tags: itemData.tags || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    }

    // Campos específicos para enlaces de WhatsApp
    if (itemData.type === 'whatsapp-link') {
        newItem.whatsappLink = itemData.whatsappLink
        newItem.productId = itemData.productId
        newItem.phoneNumber = itemData.phoneNumber
    }

    // Agregar al catálogo
    agent.mediaCatalog.push(newItem)

    // Actualizar knowledgeBase con resumen del nuevo item
    agent.knowledgeBase = updateKnowledgeBaseWithItem(agent.knowledgeBase || '', newItem)

    // Guardar cambios
    agents[agentIndex] = agent
    writeJson('agents', agents)

    return newItem
}

/**
 * Actualiza un item del catálogo
 */
function updateMediaItem(agentId, itemId, updates) {
    const agents = readJson('agents') || []
    const agentIndex = agents.findIndex(a => a.id === agentId)
    
    if (agentIndex === -1) {
        throw new Error('Agente no encontrado')
    }
    
    const agent = agents[agentIndex]
    const itemIndex = (agent.mediaCatalog || []).findIndex(item => item.id === itemId)
    
    if (itemIndex === -1) {
        throw new Error('Item no encontrado')
    }
    
    const oldItem = agent.mediaCatalog[itemIndex]
    
    // Actualizar campos permitidos
    const allowedFields = ['title', 'description', 'category', 'price', 'tags']
    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            oldItem[field] = updates[field]
        }
    })
    
    oldItem.updatedAt = new Date().toISOString()
    
    // Actualizar knowledgeBase (remover viejo item y agregar nuevo)
    agent.knowledgeBase = removeItemFromKnowledgeBase(agent.knowledgeBase || '', oldItem)
    agent.knowledgeBase = updateKnowledgeBaseWithItem(agent.knowledgeBase, oldItem)
    
    // Guardar cambios
    agents[agentIndex] = agent
    writeJson('agents', agents)
    
    return oldItem
}

/**
 * Elimina un item del catálogo
 */
function deleteMediaItem(agentId, itemId) {
    const agents = readJson('agents') || []
    const agentIndex = agents.findIndex(a => a.id === agentId)

    if (agentIndex === -1) {
        throw new Error('Agente no encontrado')
    }

    const agent = agents[agentIndex]
    const itemIndex = (agent.mediaCatalog || []).findIndex(item => item.id === itemId)

    if (itemIndex === -1) {
        throw new Error('Item no encontrado')
    }

    const deletedItem = agent.mediaCatalog[itemIndex]

    // Eliminar archivo del filesystem (solo si es tipo archivo, no enlace WhatsApp)
    if (deletedItem.filePath && deletedItem.type !== 'whatsapp-link' && fs.existsSync(deletedItem.filePath)) {
        try {
            fs.unlinkSync(deletedItem.filePath)
        } catch (error) {
            console.error(`Error eliminando archivo ${deletedItem.filePath}:`, error.message)
        }
    }

    // Eliminar de mediaCatalog
    agent.mediaCatalog.splice(itemIndex, 1)

    // Eliminar de knowledgeBase
    agent.knowledgeBase = removeItemFromKnowledgeBase(agent.knowledgeBase || '', deletedItem)

    // Guardar cambios
    agents[agentIndex] = agent
    writeJson('agents', agents)

    return deletedItem
}

/**
 * Actualiza knowledgeBase agregando resumen del item
 * Enfoque híbrido: solo agrega metadata esencial, no todo el contenido
 */
function updateKnowledgeBaseWithItem(knowledgeBase, item) {
    // Verificar si ya existe una sección de catálogo
    const catalogSectionMarker = '=== CATÁLOGO MULTIMEDIA ==='

    let kb = knowledgeBase
    let catalogSection = ''

    if (kb.includes(catalogSectionMarker)) {
        // Ya existe sección de catálogo, extraerla
        const parts = kb.split(catalogSectionMarker)
        kb = parts[0]
        catalogSection = parts[1] || ''
    } else {
        // No existe, crear nueva sección
        kb = kb.trim() + '\n\n'
    }

    // Crear entrada para el nuevo item (diferenciar entre archivo y enlace WhatsApp)
    let itemEntry = ''
    
    if (item.type === 'whatsapp-link') {
        // Entrada especial para enlace de WhatsApp
        itemEntry = `\n- **${item.title}** (enlace WhatsApp): ${item.description || 'Sin descripción'} | Producto ID: ${item.productId || 'N/A'} | Categoría: ${item.category} | Tags: ${item.tags.join(', ') || 'general'}${item.price ? ` | Precio: ${item.price}` : ''} | URL: ${item.whatsappLink || item.url}`
    } else {
        // Entrada tradicional para archivos
        itemEntry = `\n- **${item.title}** (${item.type}): ${item.description || 'Sin descripción'} | Categoría: ${item.category} | Tags: ${item.tags.join(', ') || 'general'}${item.price ? ` | Precio: ${item.price}` : ''}`
    }

    // Agregar entrada a la sección de catálogo
    if (catalogSection.trim()) {
        catalogSection = catalogSection.trimEnd() + itemEntry + '\n'
    } else {
        catalogSection = catalogSectionMarker + '\n' + itemEntry + '\n'
    }

    return kb + catalogSection
}

/**
 * Elimina un item de la knowledgeBase
 */
function removeItemFromKnowledgeBase(knowledgeBase, item) {
    const catalogSectionMarker = '=== CATÁLOGO MULTIMEDIA ==='
    
    if (!knowledgeBase.includes(catalogSectionMarker)) {
        return knowledgeBase
    }
    
    const parts = knowledgeBase.split(catalogSectionMarker)
    const mainKb = parts[0]
    let catalogSection = parts[1] || ''
    
    // Eliminar la línea del item
    const lines = catalogSection.split('\n')
    const filteredLines = lines.filter(line => {
        // Eliminar línea que contenga el título del item
        return !line.includes(`**${item.title}**`)
    })
    
    // Reconstruir sección de catálogo
    if (filteredLines.length > 1) {
        // Aún hay items en el catálogo
        return mainKb + catalogSectionMarker + filteredLines.join('\n')
    } else {
        // No quedan items, eliminar sección completa
        return mainKb.trim()
    }
}

/**
 * Busca items en el catálogo por query (título, tags, categoría, descripción)
 */
function searchMediaCatalog(agentId, query) {
    const catalog = getMediaCatalog(agentId)
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0)

    const resultados = catalog.filter(item => {
        // Buscar en título
        const matchTitle = item.title.toLowerCase().includes(queryLower)

        // Buscar en descripción
        const matchDesc = (item.description || '').toLowerCase().includes(queryLower)

        // Buscar en categoría
        const matchCategory = (item.category || 'general').toLowerCase().includes(queryLower)

        // Buscar en tags
        const matchTags = (item.tags || []).some(tag =>
            queryTerms.some(term => tag.toLowerCase().includes(term))
        )

        // Buscar en precio (si es numérico)
        let matchPrice = false
        if (item.price && !isNaN(parseFloat(query))) {
            matchPrice = item.price.toString().includes(query)
        }

        // Buscar en campos específicos de WhatsApp (si aplica)
        let matchWhatsapp = false
        if (item.type === 'whatsapp-link') {
            matchWhatsapp = (item.productId || '').includes(query) ||
                           (item.phoneNumber || '').includes(query) ||
                           (item.whatsappLink || '').toLowerCase().includes(queryLower)
        }

        return matchTitle || matchDesc || matchCategory || matchTags || matchPrice || matchWhatsapp
    })

    // Ordenar por relevancia (título match primero)
    resultados.sort((a, b) => {
        const aTitleMatch = a.title.toLowerCase().includes(queryLower) ? 1 : 0
        const bTitleMatch = b.title.toLowerCase().includes(queryLower) ? 1 : 0
        return bTitleMatch - aTitleMatch
    })

    return resultados
}

/**
 * Genera texto formateado para el system prompt de IA
 */
function generateCatalogPrompt(agentId) {
    const catalog = getMediaCatalog(agentId)

    if (catalog.length === 0) {
        return ''
    }

    let prompt = '\n\n=== CATÁLOGO MULTIMEDIA DISPONIBLE ===\n'
    prompt += 'Tienes acceso a los siguientes archivos multimedia para enviar:\n\n'

    catalog.forEach(item => {
        prompt += `ID: ${item.id}\n`
        prompt += `  Título: ${item.title}\n`
        prompt += `  Tipo: ${item.type}\n`
        
        // Si es enlace de WhatsApp, mostrar información específica
        if (item.type === 'whatsapp-link') {
            prompt += `  Producto ID: ${item.productId || 'N/A'}\n`
            prompt += `  Teléfono: ${item.phoneNumber || 'N/A'}\n`
            prompt += `  URL: ${item.whatsappLink || item.url}\n`
        } else {
            prompt += `  Categoría: ${item.category}\n`
            prompt += `  Descripción: ${item.description || 'Sin descripción'}\n`
            prompt += `  Tags: ${(item.tags || []).join(', ')}\n`
            if (item.price) {
                prompt += `  Precio: ${item.price}\n`
            }
        }
        prompt += '\n'
    })

    prompt += 'INSTRUCCIONES:\n'
    prompt += '- Si el usuario quiere ver algún producto/servicio específico, puedes enviar el archivo correspondiente\n'
    prompt += '- Para archivos, usa este formato JSON para enviar: {"tipo": "enviar_archivo", "archivoId": "media_XXX", "caption": "texto explicativo"}\n'
    prompt += '- Para enlaces de WhatsApp, puedes compartir la URL directamente: {"tipo": "mensaje", "texto": "Mira este producto: " + item.whatsappLink}\n'
    prompt += '========================================\n'

    return prompt
}

/**
 * Valida los datos de un item antes de crearlo
 */
function validateMediaItem(itemData) {
    const errors = []

    // Título es obligatorio
    if (!itemData.title || !itemData.title.trim()) {
        errors.push('El título es obligatorio')
    }

    // Tipo es obligatorio (incluye whatsapp-link)
    if (!itemData.type || !['image', 'video', 'document', 'whatsapp-link'].includes(itemData.type)) {
        errors.push('El tipo debe ser image, video, document o whatsapp-link')
    }

    // Validar tamaño de archivo (máx 20 MB) - solo para archivos
    const MAX_SIZE = 20 * 1024 * 1024 // 20 MB
    if (itemData.fileSize && itemData.fileSize > MAX_SIZE) {
        errors.push('El archivo no puede superar los 20 MB')
    }

    // Validar MIME type - solo para archivos
    const allowedMimes = {
        image: ['image/jpeg', 'image/png', 'image/webp'],
        video: ['video/mp4', 'video/quicktime'],
        document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    }

    if (itemData.mimeType && itemData.type && itemData.type !== 'whatsapp-link') {
        const typeMimes = allowedMimes[itemData.type] || []
        if (!typeMimes.includes(itemData.mimeType)) {
            errors.push(`MIME type no permitido para ${itemData.type}`)
        }
    }

    return {
        valid: errors.length === 0,
        errors
    }
}

/**
 * Asegura que la carpeta media exista
 */
function ensureMediaDir() {
    if (!fs.existsSync(MEDIA_DIR)) {
        fs.mkdirSync(MEDIA_DIR, { recursive: true })
    }
    
    // Crear carpeta específica para cada agente si no existe
    const agents = readJson('agents') || []
    agents.forEach(agent => {
        const agentMediaDir = path.join(MEDIA_DIR, agent.id)
        if (!fs.existsSync(agentMediaDir)) {
            fs.mkdirSync(agentMediaDir, { recursive: true })
        }
    })
}

module.exports = {
    getMediaCatalog,
    getMediaItem,
    addMediaItem,
    updateMediaItem,
    deleteMediaItem,
    searchMediaCatalog,
    generateCatalogPrompt,
    validateMediaItem,
    ensureMediaDir
}
