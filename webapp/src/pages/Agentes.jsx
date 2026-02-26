import { useEffect, useState } from 'react'
import { agentsApi, seedApi } from '../api'
import { 
  Bot, Trash2, Plus, FileText, Upload, Sparkles, MessageSquare, Zap, Globe, 
  Image, Video, File, FolderOpen, Link as LinkIcon, CreditCard, Calendar, 
  ScanLine, Copy
} from 'lucide-react'
import KeywordModal from '../components/KeywordModal'
import QwenOAuth from '../components/QwenOAuth'
import AgentConfigAssistant from '../components/AgentConfigAssistant'

const MOTORES = [
    { id: 'deepseek', name: 'DEEPSEEK' },
    { id: 'openai', name: 'OPENAI' },
    { id: 'qwen', name: 'QWEN (OAuth)' },
    { id: 'gemini', name: 'GOOGLE GEMINI' },
    { id: 'llama', name: 'LLAMA' },
    { id: 'custom', name: 'Personalizado' },
]

const METODOS_CONEXION = [
    { id: 'baileys', name: 'Baileys (WhatsApp Business)' },
    { id: 'whatsapp-web', name: 'WhatsApp Web' },
];

const TIPOS_RESPUESTA = [
    { id: 'ai', name: 'Inteligencia Artificial' },
    { id: 'predefined', name: 'Respuestas Predefinidas' },
];

export default function Agentes() {
    const [list, setList] = useState([])
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState({
        name: '',
        systemPrompt: 'Eres un asistente de ventas amable.',
        knowledgeBase: '',
        rules: { saludoInicial: 'Hola! ¿En qué puedo ayudarte?' },
        objections: [],
        motor: 'deepseek',
        model: 'deepseek-chat',
        apiKey: '',
        temperature: 0.3,
        active: true,
        connectionMethod: 'baileys',
        type: 'ai',
        triggers: [],
        keyword: '',
    })
    const [objectionText, setObjectionText] = useState('')
    const [uploading, setUploading] = useState(false)
    const [deleteModalOpen, setDeleteModalOpen] = useState(false)
    const [agentToDelete, setAgentToDelete] = useState(null)
    const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
    const [agentToDuplicate, setAgentToDuplicate] = useState(null)
    const [duplicateName, setDuplicateName] = useState('')
    const [saveModalOpen, setSaveModalOpen] = useState(false)
    const [saveKeyword, setSaveKeyword] = useState('')
    const [asistenteAbierto, setAsistenteAbierto] = useState(null) // { tipo: 'personalidad' | 'base_conocimiento' | 'saludo' | 'objeciones' }
    
    // Estados para Multimedia
    const [mediaTab, setMediaTab] = useState('list') // 'list' o 'upload'
    const [mediaList, setMediaList] = useState([])
    const [uploadingMedia, setUploadingMedia] = useState(false)
    const [mediaType, setMediaType] = useState('file') // 'file' o 'whatsapp-link'
    const [mediaForm, setMediaForm] = useState({
        title: '',
        description: '',
        category: '',
        price: '',
        tags: '',
        file: null,
        whatsappLink: ''
    })
    const [selectedMedia, setSelectedMedia] = useState(null)
    const [toast, setToast] = useState(null) // Toast para notificaciones

    const load = () => agentsApi.list().then(setList)

    useEffect(() => {
        load()
    }, [])

    useEffect(() => {
        if (list.length === 0) {
            seedApi.defaultAgent().then(() => load()).catch(() => load())
        }
    }, [list.length])

    // Función para mostrar toast
    const showToast = (message, type = 'info') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }

    useEffect(() => {
        if (selected) {
            setForm({
                ...selected,
                // Si apiKeyExists es true, significa que hay una API Key guardada (enmascarada)
                // La dejamos vacía para que el usuario sepa que puede cambiarla si quiere
                apiKey: selected.apiKeyExists ? '' : (selected.apiKey || ''),
                enableSmartMedia: selected.enableSmartMedia ?? true,  // Por defecto activado
                capabilities: selected.capabilities || {  // Por defecto DESHABILITADAS (premium)
                    procesarPagos: false,
                    agendarCitas: false
                },
                keyword: '' // Reset keyword field for security
            })
            // Cargar lista de multimedia
            loadMediaList()
        }
        else
            setForm({
                name: '',
                systemPrompt: 'Eres un asistente de ventas amable.',
                knowledgeBase: '',
                rules: { saludoInicial: 'Hola! ¿En qué puedo ayudarte?' },
                objections: [],
                motor: 'deepseek',
                model: 'deepseek-chat',
                apiKey: '',
                temperature: 0.3,
                active: true,
                enableSmartMedia: true,  // Por defecto activado para nuevos agentes
                capabilities: {  // Por defecto DESHABILITADAS (requieren plan de pago)
                    procesarPagos: false,
                    agendarCitas: false
                },
                keyword: '',
            })
    }, [selected])

    const save = () => {
        // Abrir modal para pedir keyword
        setSaveModalOpen(true)
    }

    const confirmSave = (keyword) => {
        const formData = { ...form };

        // Asegurar que capabilities exista con valores por defecto (deshabilitados por defecto)
        if (!formData.capabilities) {
            formData.capabilities = {
                procesarPagos: false,
                agendarCitas: false
            };
        }

        if (formData.type === 'predefined') {
            delete formData.motor;
            delete formData.model;
            delete formData.apiKey;
        }

        if (formData.type === 'ai') {
            delete formData.triggers;
        }

        if (selected) {
            // Editar agente existente - keyword requerida
            return agentsApi.update(selected.id, formData, keyword).then(() => {
                load()
                setSelected(null)
                setSaveKeyword('')
            })
        } else {
            // Crear agente nuevo - keyword OPCIONAL
            return agentsApi.create(formData, keyword || '').then(() => {
                load()
                setForm({
                    ...form,
                    name: '',
                    knowledgeBase: '',
                    apiKey: '',
                    triggers: [],
                    triggerKeyword: '',
                    triggerResponse: '',
                    triggerNextStep: '',
                    keyword: '',
                    capabilities: {
                        procesarPagos: false,
                        agendarCitas: false
                    },
                })
                setSaveKeyword('')
            })
        }
    }

    // Función para abrir modal de duplicar agente
    const openDuplicateModal = (agent) => {
        setAgentToDuplicate(agent)
        setDuplicateName(`${agent.name} (Copia)`)
        setDuplicateModalOpen(true)
    }

    // Función para confirmar duplicación de agente
    const confirmDuplicate = (keyword) => {
        if (!duplicateName.trim()) {
            alert('El nombre del agente es requerido')
            return
        }

        // Crear nuevo agente con configuración del original
        const duplicateData = {
            ...agentToDuplicate,
            name: duplicateName.trim(),
            id: undefined, // Para que se genere uno nuevo
            isPrimary: false // El duplicado nunca es primario por defecto
        }

        // Asegurar que capabilities exista
        if (!duplicateData.capabilities) {
            duplicateData.capabilities = {
                procesarPagos: false,
                agendarCitas: false
            }
        }

        // Eliminar campos que no deben copiarse
        delete duplicateData.id
        delete duplicateData.isPrimary
        delete duplicateData.createdAt
        delete duplicateData.updatedAt

        return agentsApi.create(duplicateData, keyword || '').then(() => {
            load()
            setDuplicateModalOpen(false)
            setAgentToDuplicate(null)
            setDuplicateName('')
            alert(`✅ Agente "${duplicateName.trim()}" creado exitosamente como copia de "${agentToDuplicate.name}"`)
        })
    }

    const addObjection = () => {
        if (!objectionText.trim()) return
        setForm((f) => ({ ...f, objections: [...(f.objections || []), objectionText.trim()] }))
        setObjectionText('')
    }

    const removeObjection = (i) => {
        setForm((f) => ({ ...f, objections: (f.objections || []).filter((_, j) => j !== i) }))
    }

    const onFile = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        agentsApi
            .uploadKnowledge(file)
            .then(({ text }) => setForm((f) => ({ ...f, knowledgeBase: (f.knowledgeBase || '') + '\n\n' + text })))
            .finally(() => setUploading(false))
    }

    // Funciones para Multimedia
    const loadMediaList = () => {
        if (!selected) return
        fetch(`/api/agents/${selected.id}/media`, {
            credentials: 'include'
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setMediaList(data.catalog || [])
                }
            })
            .catch(err => console.error('Error loading media:', err))
    }

    const uploadMedia = () => {
        // Validar según el tipo de medio
        if (mediaType === 'file') {
            if (!mediaForm.file || !mediaForm.title.trim()) {
                alert('Archivo y título son requeridos')
                return
            }
        } else if (mediaType === 'whatsapp-link') {
            if (!mediaForm.whatsappLink.trim() || !mediaForm.title.trim()) {
                alert('El enlace de WhatsApp y el título son requeridos')
                return
            }
            
            // Validar estructura del enlace: https://wa.me/p/PRODUCTO/TELEFONO
            const whatsappPattern = /^https?:\/\/(www\.)?wa\.me\/p\/(\d+)\/(\d+)(\?.*)?$/i
            const match = mediaForm.whatsappLink.match(whatsappPattern)
            
            if (!match) {
                alert('El enlace no tiene un formato válido. Debe ser: https://wa.me/p/NUMERODEPRODUCTO/NUMERODETELEFONO\n\nEjemplo: https://wa.me/p/7710668912292847/51936956306')
                return
            }
            
            const [, , productId, phoneNumber] = match
            console.log('Producto ID:', productId, 'Teléfono:', phoneNumber)
        }

        const formData = new FormData()
        formData.append('title', mediaForm.title)
        formData.append('description', mediaForm.description || '')
        formData.append('category', mediaForm.category || 'general')
        formData.append('price', mediaForm.price || '')
        formData.append('tags', mediaForm.tags || '')
        formData.append('mediaType', mediaType) // 'file' o 'whatsapp-link'
        
        if (mediaType === 'file' && mediaForm.file) {
            formData.append('file', mediaForm.file)
        } else if (mediaType === 'whatsapp-link') {
            formData.append('whatsappLink', mediaForm.whatsappLink)
        }

        setUploadingMedia(true)
        fetch(`/api/agents/${selected.id}/media`, {
            method: 'POST',
            credentials: 'include',
            body: formData
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    alert('Archivo subido exitosamente')
                    setMediaForm({
                        title: '',
                        description: '',
                        category: '',
                        price: '',
                        tags: '',
                        file: null,
                        whatsappLink: ''
                    })
                    setMediaTab('list')
                    loadMediaList()
                } else {
                    alert('Error: ' + (data.errors ? data.errors.join(', ') : data.error))
                }
            })
            .catch(err => alert('Error al subir: ' + err.message))
            .finally(() => setUploadingMedia(false))
    }

    const deleteMedia = (itemId) => {
        if (!confirm('¿Eliminar este archivo? Esta acción no se puede deshacer.')) return
        
        fetch(`/api/agents/${selected.id}/media/${itemId}`, {
            method: 'DELETE',
            credentials: 'include'
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    alert('Archivo eliminado')
                    loadMediaList()
                } else {
                    alert('Error: ' + data.error)
                }
            })
            .catch(err => alert('Error al eliminar: ' + err.message))
    }

    const openMediaTab = (tab) => {
        setMediaTab(tab)
        if (tab === 'list') {
            loadMediaList()
        }
    }

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0 }}>Configurar Agente</h2>
                {selected && (
                    <button className="btn btn-primary" onClick={save}>
                        GUARDAR CAMBIOS
                    </button>
                )}
            </div>

            {/* Layout responsive: columna única en móvil, 2 columnas en desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
                {/* Sidebar de agentes - ocupa 1 columna en desktop */}
                <div className="card lg:col-span-1">
                    <h2 className="flex items-center gap-2">
                        <Bot className="w-5 h-5" /> MIS AGENTES ({list.length}/5)
                    </h2>
                    <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }} onClick={() => setSelected(null)}>
                        <Plus className="w-4 h-4" /> NUEVO
                    </button>
                    {list.map((a) => (
                        <div
                            key={a.id}
                            style={{
                                padding: '0.75rem',
                                borderRadius: 8,
                                marginBottom: 4,
                                cursor: 'pointer',
                                background: selected?.id === a.id ? 'var(--accent)' : 'transparent',
                                color: selected?.id === a.id ? '#fff' : 'inherit',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <div onClick={() => setSelected(a)} style={{ flex: 1 }}>
                                {a.name} {a.isPrimary ? '(Principal)' : ''}
                            </div>
                            {!a.isPrimary && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {/* Botón Duplicar */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openDuplicateModal(a);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#3b82f6',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            padding: '0.25rem',
                                            marginLeft: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                        title="Duplicar agente"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                    {/* Botón Eliminar */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAgentToDelete(a);
                                            setDeleteModalOpen(true);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            padding: '0.25rem',
                                            marginLeft: '0.5rem'
                                        }}
                                        title="Eliminar agente"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Panel de configuración - ocupa 3 columnas en desktop */}
                <div className="card lg:col-span-3">
                    <>
                            <h2 style={{ marginTop: 0 }}>{selected ? selected.name : 'Nuevo agente'}</h2>
                            {selected?.isPrimary && <span className="badge" style={{ marginLeft: 8 }}>PRINCIPAL</span>}

                            <div className="form-group">
                                <label className="label">Nombre del agente</label>
                                <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Agente Ventas" />
                            </div>

                            <h3 style={{ marginTop: '1.5rem' }}>PERSONALIDAD Y CONTEXTO</h3>
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="label">Prompt de sistema</label>
                                    <button
                                        type="button"
                                        onClick={() => setAsistenteAbierto({ tipo: 'personalidad' })}
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--accent)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        <Sparkles size={14} />
                                        Redactar con IA
                                    </button>
                                </div>
                                <textarea className="textarea" value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))} rows={3} />
                            </div>
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="label">Base de conocimiento</label>
                                    <button
                                        type="button"
                                        onClick={() => setAsistenteAbierto({ tipo: 'base_conocimiento' })}
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--accent)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        <Sparkles size={14} />
                                        Redactar con IA
                                    </button>
                                </div>
                                <textarea className="textarea" value={form.knowledgeBase} onChange={(e) => setForm((f) => ({ ...f, knowledgeBase: e.target.value }))} rows={6} placeholder="Texto o protocolo que debe seguir el agente" />
                                <button type="button" className="btn btn-secondary" style={{ marginTop: 8 }} disabled={uploading} onClick={() => document.getElementById('file-kb').click()}>
                                    <Upload className="w-4 h-4 mr-2" /> ADJUNTAR DOCUMENTO (.txt, .md, .pdf, .doc, .docx)
                                </button>
                                <input id="file-kb" type="file" accept=".txt,.md,.pdf,.doc,.docx" hidden onChange={onFile} />
                            </div>

                            <h3 style={{ marginTop: '1.5rem' }} className="flex items-center gap-2">
                                <Globe className="w-5 h-5" /> MÉTODO DE CONEXIÓN
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {METODOS_CONEXION.map((method) => {
                                    const isWhatsappWeb = method.id === 'whatsapp-web'
                                    const isDisabled = isWhatsappWeb
                                    
                                    return (
                                        <button
                                            key={method.id}
                                            type="button"
                                            className="btn flex-1 min-w-[140px]"
                                            style={{ 
                                                background: isDisabled 
                                                    ? '#d1d5db' 
                                                    : form.connectionMethod === method.id 
                                                        ? 'var(--accent)' 
                                                        : '#e5e7eb', 
                                                color: isDisabled 
                                                    ? '#9ca3af' 
                                                    : form.connectionMethod === method.id 
                                                        ? '#fff' 
                                                        : '#374151',
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                opacity: isDisabled ? 0.6 : 1
                                            }}
                                            onClick={() => {
                                                if (isDisabled) {
                                                    showToast('❌ No disponible - Deprecado', 'error')
                                                } else {
                                                    setForm((f) => ({ ...f, connectionMethod: method.id }))
                                                }
                                            }}
                                            disabled={isDisabled}
                                        >
                                            {method.name} {isWhatsappWeb && '(Deprecado)'}
                                        </button>
                                    )
                                })}
                            </div>

                            <h3 style={{ marginTop: '1.5rem' }} className="flex items-center gap-2">
                                <Zap className="w-5 h-5" /> TIPO DE RESPUESTA
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {TIPOS_RESPUESTA.map((type) => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        className="btn flex-1 min-w-[140px]"
                                        style={{ background: form.type === type.id ? 'var(--accent)' : '#e5e7eb', color: form.type === type.id ? '#fff' : '#374151' }}
                                        onClick={() => setForm((f) => ({ ...f, type: type.id }))}
                                    >
                                        {type.name}
                                    </button>
                                ))}
                            </div>

                            {/* Show AI configuration only if type is 'ai' */}
                            {form.type === 'ai' && (
                                <>
                                    <h3 style={{ marginTop: '1.5rem' }} className="flex items-center gap-2">
                                        <Sparkles className="w-5 h-5" /> MOTOR DE IA
                                    </h3>
                                    <div className="flex flex-wrap gap-2">
                                        {MOTORES.map((m) => (
                                            <button
                                                key={m.id}
                                                type="button"
                                                className="btn flex-1 min-w-[120px]"
                                                style={{ background: form.motor === m.id ? 'var(--accent)' : '#e5e7eb', color: form.motor === m.id ? '#fff' : '#374151' }}
                                                onClick={() => setForm((f) => ({ ...f, motor: m.id }))}
                                            >
                                                {m.name}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Modelo</label>
                                        <input className="input" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="deepseek-chat" />
                                        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                            Deepseek: deepseek-chat, deepseek-coder | OpenAI: gpt-4o, gpt-3.5-turbo | Gemini: gemini-1.5-pro | Llama: llama-3-70b
                                        </p>
                                    </div>

                                    {/* API Key para Deepseek/OpenAI/Custom - NO mostrar para Qwen */}
                                    {form.motor !== 'qwen' && (
                                        <div className="form-group">
                                            <label className="label">
                                                API Key
                                                {selected?.apiKeyExists && (
                                                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--accent)' }}>
                                                        🔒 Configurada (deja vacío para mantener la actual)
                                                    </span>
                                                )}
                                            </label>
                                            <input
                                                className="input"
                                                type="password"
                                                value={form.apiKey || ''}
                                                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                                                placeholder={selected?.apiKeyExists ? '************ (o ingresa nueva)' : 'sk-...'}
                                            />
                                            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                                                {form.motor === 'deepseek'
                                                    ? 'Tu API Key de Deepseek'
                                                    : form.motor === 'openai'
                                                        ? 'Tu API Key de OpenAI'
                                                        : form.motor === 'gemini'
                                                            ? 'Tu API Key de Google AI Studio'
                                                            : form.motor === 'llama'
                                                                ? 'Tu API Key (Groq, Together, o similar)'
                                                                : 'Tu API Key para el modelo personalizado'}
                                            </p>
                                        </div>
                                    )}

                                    {/* OAuth para Qwen - Solo mostrar cuando el motor es Qwen */}
                                    {form.motor === 'qwen' && (
                                        <div className="form-group">
                                            <label className="label">Autorización Qwen (OAuth)</label>
                                            
                                            <QwenOAuth
                                                onAuthChange={(data) => {
                                                    console.log('Qwen auth state:', data)
                                                }}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Show predefined triggers configuration only if type is 'predefined' */}
                            {form.type === 'predefined' && (
                                <>
                                    <h3 style={{ marginTop: '1.5rem' }}>RESPUESTAS PREDEFINIDAS</h3>
                                    <div className="form-group">
                                        <label className="label">Palabra clave</label>
                                        <input className="input" value={form.triggerKeyword || ''} onChange={(e) => setForm((f) => ({ ...f, triggerKeyword: e.target.value }))} placeholder="Ej: hola, pagina web, seo" />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Respuesta</label>
                                        <textarea className="textarea" value={form.triggerResponse || ''} onChange={(e) => setForm((f) => ({ ...f, triggerResponse: e.target.value }))} rows={3} placeholder="Respuesta que se enviará cuando se detecte la palabra clave" />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Siguiente paso</label>
                                        <input className="input" value={form.triggerNextStep || ''} onChange={(e) => setForm((f) => ({ ...f, triggerNextStep: e.target.value }))} placeholder="Estado siguiente en la conversación (opcional)" />
                                    </div>
                                    <button 
                                        type="button" 
                                        className="btn btn-secondary" 
                                        onClick={() => {
                                            if (form.triggerKeyword && form.triggerResponse) {
                                                const newTrigger = {
                                                    keyword: form.triggerKeyword,
                                                    response: form.triggerResponse,
                                                    nextStep: form.triggerNextStep || null
                                                };
                                                setForm(f => ({
                                                    ...f,
                                                    triggers: [...(f.triggers || []), newTrigger],
                                                    triggerKeyword: '',
                                                    triggerResponse: '',
                                                    triggerNextStep: ''
                                                }));
                                            }
                                        }}
                                    >
                                        Añadir Disparador
                                    </button>

                                    {/* Display existing triggers */}
                                    {(form.triggers || []).length > 0 && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <h4>Disparadores Actuales:</h4>
                                            <ul style={{ listStyle: 'none', padding: 0 }}>
                                                {(form.triggers || []).map((trigger, index) => (
                                                    <li key={index} style={{ 
                                                        padding: '0.5rem', 
                                                        border: '1px solid #ddd', 
                                                        borderRadius: '4px', 
                                                        marginBottom: '0.5rem',
                                                        backgroundColor: '#f9f9f9'
                                                    }}>
                                                        <strong>{trigger.keyword}</strong>: {trigger.response}
                                                        {trigger.nextStep && <span style={{ fontSize: '0.8rem', color: '#666' }}> → {trigger.nextStep}</span>}
                                                        <button 
                                                            type="button" 
                                                            style={{ 
                                                                float: 'right', 
                                                                background: 'none', 
                                                                border: 'none', 
                                                                color: 'red', 
                                                                cursor: 'pointer' 
                                                            }}
                                                            onClick={() => {
                                                                setForm(f => ({
                                                                    ...f,
                                                                    triggers: f.triggers.filter((_, i) => i !== index)
                                                                }));
                                                            }}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )}

                            <h3 style={{ marginTop: '1.5rem' }}>REGLAS AVANZADAS</h3>
                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <label className="label">Saludo inicial</label>
                                    <button
                                        type="button"
                                        onClick={() => setAsistenteAbierto({ tipo: 'saludo' })}
                                        style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--accent)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 8px',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        <Sparkles size={14} />
                                        Redactar con IA
                                    </button>
                                </div>
                                <input className="input" value={form.rules?.saludoInicial || ''} onChange={(e) => setForm((f) => ({ ...f, rules: { ...f.rules, saludoInicial: e.target.value } }))} />
                            </div>

                            <h3 style={{ marginTop: '1.5rem' }}>OBJECIONES</h3>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span className="muted" style={{ fontSize: '0.875rem' }}>Respuestas para manejar objeciones comunes</span>
                                <button
                                    type="button"
                                    onClick={() => setAsistenteAbierto({ tipo: 'objeciones' })}
                                    style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--accent)',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 8px',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <Sparkles size={14} />
                                    Redactar con IA
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <input className="input" value={objectionText} onChange={(e) => setObjectionText(e.target.value)} placeholder="Añadir objeción y respuesta" onKeyDown={(e) => e.key === 'Enter' && addObjection()} />
                                <button type="button" className="btn btn-primary" onClick={addObjection}>+</button>
                            </div>
                            <ul style={{ margin: 0, paddingLeft: 20 }}>
                                {(form.objections || []).map((o, i) => (
                                    <li key={i} style={{ marginBottom: 4 }}>
                                        {o} <button type="button" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => removeObjection(i)}>Eliminar</button>
                                    </li>
                                ))}
                            </ul>

                            <div className="form-group" style={{ marginTop: '1.5rem' }}>
                                <label className="label">Temperatura (baja = menos alucinaciones)</label>
                                <div className="flex items-center gap-4">
                                    <input type="range" className="flex-1" min="0" max="1" step="0.1" value={form.temperature} onChange={(e) => setForm((f) => ({ ...f, temperature: +e.target.value }))} />
                                    <span className="font-mono w-12 text-center">{form.temperature}</span>
                                </div>
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
                                    <span className="font-semibold">ESTADO ACTIVO</span>
                                </label>
                            </div>

                            {/* Envío Inteligente de Multimedia */}
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={form.enableSmartMedia ?? true}
                                        onChange={(e) => setForm((f) => ({ ...f, enableSmartMedia: e.target.checked }))}
                                    />
                                    <ScanLine className="w-5 h-5" />
                                    <span className="font-semibold">Envío Inteligente de Imágenes</span>
                                </label>
                                <p className="muted" style={{ fontSize: '12px', marginTop: '4px', marginLeft: '28px' }}>
                                    Cuando está activado, el agente enviará automáticamente imágenes del catálogo cuando sea relevante.
                                </p>
                            </div>

                            {/* CAPACIDADES DEL AGENTE */}
                            <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '2px solid var(--border)', paddingTop: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px' }}>
                                        <Zap className="w-4 h-4" style={{ display: 'inline', marginRight: '4px' }} />
                                        CAPACIDADES DEL AGENTE
                                    </h3>
                                    <span className="muted" style={{ fontSize: '11px', fontStyle: 'italic' }}>
                                        Requiere plan de pago
                                    </span>
                                </div>
                                <p className="muted" style={{ fontSize: '12px', marginBottom: '1rem' }}>
                                    Habilita capacidades avanzadas para este agente. Estas funciones están disponibles según el plan contratado.
                                </p>

                                {/* Switch Procesar Pagos */}
                                <div style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginBottom: '12px',
                                    background: 'var(--bg-secondary)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <CreditCard className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '14px' }}>Procesar Pagos con OCR</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    Recibe comprobantes de Yape, Plin, BCP automáticamente
                                                </div>
                                            </div>
                                        </div>
                                        <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                                            <input
                                                type="checkbox"
                                                checked={form.capabilities?.procesarPagos ?? false}
                                                onChange={(e) => setForm((f) => ({ ...f, capabilities: { ...f.capabilities, procesarPagos: e.target.checked } }))}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute',
                                                cursor: 'pointer',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                backgroundColor: form.capabilities?.procesarPagos ? 'var(--accent)' : '#ccc',
                                                borderRadius: '26px',
                                                transition: '0.3s'
                                            }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    height: '20px',
                                                    width: '20px',
                                                    left: form.capabilities?.procesarPagos ? '26px' : '3px',
                                                    bottom: '3px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '50%',
                                                    transition: '0.3s'
                                                }} />
                                            </span>
                                        </label>
                                    </div>
                                    {form.capabilities?.procesarPagos && (
                                        <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '8px', paddingLeft: '28px' }}>
                                            Habilitado - Los pagos se procesarán automáticamente
                                        </div>
                                    )}
                                    {!form.capabilities?.procesarPagos && (
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', paddingLeft: '28px' }}>
                                            Deshabilitado - El agente no podrá procesar pagos
                                        </div>
                                    )}
                                </div>

                                {/* Switch Agendar Citas */}
                                <div style={{
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    background: 'var(--bg-secondary)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Calendar className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '14px' }}>Agendar Citas</div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                    Gestiona reuniones directamente en el chat
                                                </div>
                                            </div>
                                        </div>
                                        <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                                            <input
                                                type="checkbox"
                                                checked={form.capabilities?.agendarCitas ?? false}
                                                onChange={(e) => setForm((f) => ({ ...f, capabilities: { ...f.capabilities, agendarCitas: e.target.checked } }))}
                                                style={{ opacity: 0, width: 0, height: 0 }}
                                            />
                                            <span style={{
                                                position: 'absolute',
                                                cursor: 'pointer',
                                                top: 0,
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                backgroundColor: form.capabilities?.agendarCitas ? 'var(--accent)' : '#ccc',
                                                borderRadius: '26px',
                                                transition: '0.3s'
                                            }}>
                                                <span style={{
                                                    position: 'absolute',
                                                    height: '20px',
                                                    width: '20px',
                                                    left: form.capabilities?.agendarCitas ? '26px' : '3px',
                                                    bottom: '3px',
                                                    backgroundColor: 'white',
                                                    borderRadius: '50%',
                                                    transition: '0.3s'
                                                }} />
                                            </span>
                                        </label>
                                    </div>
                                    {form.capabilities?.agendarCitas && (
                                        <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '8px', paddingLeft: '28px' }}>
                                            ✅ Habilitado - El agente puede agendar y cancelar citas
                                        </div>
                                    )}
                                    {!form.capabilities?.agendarCitas && (
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', paddingLeft: '28px' }}>
                                            ⚠️ Deshabilitado - El agente no podrá gestionar citas
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* SECCIÓN DE MULTIMEDIA - Solo para agentes existentes */}
                            {selected && (
                                <div style={{ marginTop: '2rem', borderTop: '2px solid var(--border)', paddingTop: '1.5rem' }}>
                                    <h2 className="flex items-center gap-2" style={{ marginTop: 0 }}>
                                        <FolderOpen className="w-5 h-5" /> CATÁLOGO MULTIMEDIA
                                    </h2>
                                    <p className="muted" style={{ marginBottom: '1rem' }}>
                                        Sube imágenes, videos o documentos que el agente podrá enviar automáticamente cuando los usuarios pregunten por productos/servicios.
                                    </p>

                                    {/* Pestañas */}
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                                        <button
                                            className={`btn flex-1 ${mediaTab === 'list' ? 'btn-primary' : ''}`}
                                            onClick={() => openMediaTab('list')}
                                        >
                                            <Image className="w-4 h-4" /> Ver Archivos
                                        </button>
                                        <button
                                            className={`btn flex-1 ${mediaTab === 'upload' ? 'btn-primary' : ''}`}
                                            onClick={() => openMediaTab('upload')}
                                        >
                                            <Upload className="w-4 h-4" /> Subir Archivo
                                        </button>
                                    </div>

                                    {/* Lista de archivos */}
                                    {mediaTab === 'list' && (
                                        <div>
                                            {mediaList.length === 0 ? (
                                                <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                                                    No hay archivos subidos. Click en "Subir Archivo" para agregar.
                                                </p>
                                            ) : (
                                                <div style={{ display: 'grid', gap: '8px' }}>
                                                    {mediaList.map((item) => (
                                                        <div
                                                            key={item.id}
                                                            style={{
                                                                padding: '1rem',
                                                                border: '1px solid var(--border)',
                                                                borderRadius: '8px',
                                                                background: 'var(--bg-secondary)',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                                                {item.type === 'image' && <Image className="w-8 h-8" style={{ color: 'var(--accent)' }} />}
                                                                {item.type === 'video' && <Video className="w-8 h-8" style={{ color: 'var(--accent)' }} />}
                                                                {item.type === 'document' && <File className="w-8 h-8" style={{ color: 'var(--accent)' }} />}
                                                                <div>
                                                                    <strong style={{ display: 'block' }}>{item.title}</strong>
                                                                    <span className="muted" style={{ fontSize: '12px' }}>
                                                                        {item.type} • {item.category || 'general'} • {(item.fileSize / 1024 / 1024).toFixed(2)} MB
                                                                    </span>
                                                                    {item.price && (
                                                                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--accent)' }}>
                                                                            Precio: {item.price}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                className="btn"
                                                                style={{ background: '#ef4444', color: '#fff' }}
                                                                onClick={() => deleteMedia(item.id)}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Formulario de subida */}
                                    {mediaTab === 'upload' && (
                                        <div className="card">
                                            {/* Selector de tipo de medio */}
                                            <div className="form-group">
                                                <label className="label">Tipo de elemento *</label>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        className={`btn flex-1 ${mediaType === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => setMediaType('file')}
                                                    >
                                                        <File className="w-4 h-4" style={{ marginRight: '4px' }} /> Archivo Multimedia
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`btn flex-1 ${mediaType === 'whatsapp-link' ? 'btn-primary' : 'btn-secondary'}`}
                                                        onClick={() => setMediaType('whatsapp-link')}
                                                    >
                                                        <LinkIcon className="w-4 h-4" style={{ marginRight: '4px' }} /> Enlace de Catálogo WhatsApp
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Campo de archivo (solo para tipo file) */}
                                            {mediaType === 'file' && (
                                                <div className="form-group">
                                                    <label className="label">Archivo *</label>
                                                    <input
                                                        type="file"
                                                        className="input"
                                                        accept="image/*,video/*,application/pdf,.doc,.docx"
                                                        onChange={(e) => setMediaForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
                                                    />
                                                    <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                                                        Máx 20 MB. Imágenes (JPG, PNG, WebP), Videos (MP4, MOV), Documentos (PDF, DOCX)
                                                    </p>
                                                </div>
                                            )}

                                            {/* Campo de enlace WhatsApp (solo para tipo whatsapp-link) */}
                                            {mediaType === 'whatsapp-link' && (
                                                <div className="form-group">
                                                    <label className="label">Enlace de Producto WhatsApp *</label>
                                                    <input
                                                        className="input"
                                                        value={mediaForm.whatsappLink}
                                                        onChange={(e) => setMediaForm(f => ({ ...f, whatsappLink: e.target.value }))}
                                                        placeholder="https://wa.me/p/7710668912292847/51936956306"
                                                    />
                                                    <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                                                        Formato: https://wa.me/p/NUMERODEPRODUCTO/NUMERODETELEFONO
                                                    </p>
                                                    <p className="muted" style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px' }}>
                                                        💡 Ejemplo: https://wa.me/p/7710668912292847/51936956306
                                                    </p>
                                                </div>
                                            )}

                                            <div className="form-group">
                                                <label className="label">Título *</label>
                                                <input
                                                    className="input"
                                                    value={mediaForm.title}
                                                    onChange={(e) => setMediaForm(f => ({ ...f, title: e.target.value }))}
                                                    placeholder={mediaType === 'file' ? "Ej: Catálogo de Servicios 2026" : "Ej: Producto Destacado - Oferta"}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label className="label">Descripción</label>
                                                <textarea
                                                    className="textarea"
                                                    value={mediaForm.description}
                                                    onChange={(e) => setMediaForm(f => ({ ...f, description: e.target.value }))}
                                                    rows={3}
                                                    placeholder={mediaType === 'file' ? "Describe el contenido del archivo" : "Describe el producto, incluye características principales"}
                                                />
                                            </div>

                                            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                                                <div className="form-group">
                                                    <label className="label">Categoría</label>
                                                    <input
                                                        className="input"
                                                        value={mediaForm.category}
                                                        onChange={(e) => setMediaForm(f => ({ ...f, category: e.target.value }))}
                                                        placeholder="Ej: servicios, productos, precios"
                                                    />
                                                </div>

                                                <div className="form-group">
                                                    <label className="label">Precio (opcional)</label>
                                                    <input
                                                        className="input"
                                                        value={mediaForm.price}
                                                        onChange={(e) => setMediaForm(f => ({ ...f, price: e.target.value }))}
                                                        placeholder="Ej: 200 soles"
                                                    />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="label">Tags (separados por coma)</label>
                                                <input
                                                    className="input"
                                                    value={mediaForm.tags}
                                                    onChange={(e) => setMediaForm(f => ({ ...f, tags: e.target.value }))}
                                                    placeholder="Ej: web, seo, tienda, catalogo"
                                                />
                                                <p className="muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                                                    La IA usará estas tags para encontrar el archivo cuando el usuario pregunte
                                                </p>
                                            </div>

                                            <button
                                                className="btn btn-primary w-full"
                                                onClick={uploadMedia}
                                                disabled={
                                                    uploadingMedia || 
                                                    !mediaForm.title.trim() ||
                                                    (mediaType === 'file' && !mediaForm.file) ||
                                                    (mediaType === 'whatsapp-link' && !mediaForm.whatsappLink.trim())
                                                }
                                            >
                                                {uploadingMedia ? 'Subiendo...' : (mediaType === 'file' ? 'Subir Archivo' : 'Agregar Enlace')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button className="btn btn-primary w-full" onClick={save}>
                                {selected ? 'Guardar cambios' : 'Crear agente'}
                            </button>
                        </>
                </div>
            </div>

            {/* Modal para Crear/Editar Agente - Pedir keyword */}
            <KeywordModal
                isOpen={saveModalOpen}
                onClose={() => {
                    setSaveModalOpen(false)
                    setSaveKeyword('')
                }}
                onConfirm={(keyword) => {
                    return confirmSave(keyword)
                }}
                title={selected ? `Editar agente "${selected.name}"` : 'Crear nuevo agente'}
                description={
                    selected
                        ? "Ingrese la palabra clave del agente para confirmar los cambios:"
                        : "Ingrese una palabra clave para proteger este nuevo agente (opcional, puede dejar vacío):"
                }
                allowEmpty={selected ? false : true}
            />

            <KeywordModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false)
                    setAgentToDelete(null)
                }}
                onConfirm={(keyword) => {
                    return agentsApi.delete(agentToDelete.id, keyword).then(() => {
                        load()
                        if (selected?.id === agentToDelete.id) {
                            setSelected(null)
                        }
                    })
                }}
                title={`Eliminar agente "${agentToDelete?.name}"`}
                description="Ingrese la palabra clave del agente para confirmar la eliminación:"
            />

            {/* Modal para Duplicar Agente - Pedir keyword */}
            <KeywordModal
                isOpen={duplicateModalOpen}
                onClose={() => {
                    setDuplicateModalOpen(false)
                    setAgentToDuplicate(null)
                    setDuplicateName('')
                }}
                onConfirm={(keyword) => {
                    return confirmDuplicate(keyword)
                }}
                title={`Duplicar agente "${agentToDuplicate?.name}"`}
                description="Ingrese una palabra clave para proteger este nuevo agente (opcional):"
                allowEmpty={true}
                customField={{
                    label: 'Nombre del nuevo agente',
                    value: duplicateName,
                    onChange: setDuplicateName,
                    placeholder: 'Ej: Agente Ventas (Copia)',
                    type: 'text'
                }}
            />

            {/* Asistente de Configuración con IA */}
            {asistenteAbierto && (
                <AgentConfigAssistant
                    tipo={asistenteAbierto.tipo}
                    onClose={() => setAsistenteAbierto(null)}
                    onCompletado={(textoGenerado) => {
                        console.log('[Agentes] onCompletado llamado con tipo:', asistenteAbierto.tipo)
                        console.log('[Agentes] Texto generado:', textoGenerado)
                        
                        // Insertar texto en el campo correspondiente
                        if (asistenteAbierto.tipo === 'personalidad') {
                            setForm(f => ({ ...f, systemPrompt: textoGenerado }))
                            console.log('[Agentes] systemPrompt actualizado')
                        } else if (asistenteAbierto.tipo === 'base_conocimiento') {
                            setForm(f => ({ ...f, knowledgeBase: textoGenerado }))
                            console.log('[Agentes] knowledgeBase actualizado')
                        } else if (asistenteAbierto.tipo === 'saludo') {
                            setForm(f => ({ ...f, rules: { ...f.rules, saludoInicial: textoGenerado } }))
                            console.log('[Agentes] saludoInicial actualizado')
                        } else if (asistenteAbierto.tipo === 'objeciones') {
                            // Para objeciones, parsear el texto con formato "Si el cliente dice: X, respondes: Y"
                            console.log('[Agentes] === PARSEANDO OBJECIONES ===')
                            console.log('[Agentes] Texto generado:', textoGenerado)
                            
                            const lineas = textoGenerado.split('\n').filter(l => l.trim())
                            console.log('[Agentes] Líneas encontradas:', lineas.length)
                            
                            const nuevasObjeciones = []
                            let objeccionActual = null
                            let respuestaActual = null
                            
                            // Método 1: Buscar formato "Si el cliente dice: X, respondes: Y"
                            lineas.forEach((linea, idx) => {
                                const lineaTrim = linea.trim()
                                console.log(`[Agentes] Procesando línea ${idx + 1}:`, lineaTrim.substring(0, 80))
                                
                                // Intentar parsear formato: "Si el cliente dice: X, respondes: Y"
                                const match = lineaTrim.match(/Si el cliente dice:\s*["']?(.+?)["']?\s*,\s*respondes:\s*["']?(.+?)["']?/i)
                                
                                if (match) {
                                    console.log('[Agentes] ✅ Match encontrado:', match)
                                    const objecion = match[1].trim().replace(/^["']|["']$/g, '')
                                    const respuesta = match[2].trim().replace(/^["']|["']$/g, '')
                                    if (objecion && respuesta) {
                                        const objecionFormateada = `Si el cliente dice: "${objecion}", respondes: "${respuesta}"`
                                        nuevasObjeciones.push(objecionFormateada)
                                        console.log('[Agentes] Objeción agregada:', objecionFormateada)
                                    }
                                }
                                // Método 2: Buscar formato con negritas "**Objeción:** X" seguido de "**Respuesta:** Y"
                                else if (lineaTrim.includes('**Objeción:**') || lineaTrim.includes('**Respuesta:**')) {
                                    if (lineaTrim.includes('**Objeción:**')) {
                                        objeccionActual = lineaTrim.replace(/\*\*Objeción:\*\*/i, '').trim()
                                        console.log('[Agentes] Objeción detectada (formato negrita):', objeccionActual)
                                    }
                                    if (lineaTrim.includes('**Respuesta:**') && objeccionActual) {
                                        respuestaActual = lineaTrim.replace(/\*\*Respuesta:\*\*/i, '').trim()
                                        console.log('[Agentes] Respuesta detectada (formato negrita):', respuestaActual)
                                        if (respuestaActual) {
                                            nuevasObjeciones.push(`Si el cliente dice: "${objeccionActual}", respondes: "${respuestaActual}"`)
                                            objeccionActual = null
                                            respuestaActual = null
                                        }
                                    }
                                }
                                else if (lineaTrim.toLowerCase().startsWith('si el cliente dice')) {
                                    // Formato alternativo sin regex
                                    console.log('[Agentes] ✅ Formato alternativo detectado')
                                    nuevasObjeciones.push(lineaTrim)
                                }
                                else {
                                    console.log('[Agentes] ⚠️ Línea no coincide con ningún formato')
                                }
                            })
                            
                            console.log('[Agentes] Total objeciones parseadas:', nuevasObjeciones.length)
                            console.log('[Agentes] Objeciones actuales en form:', form.objections?.length || 0)
                            
                            // Si no se encontraron objeciones con formato, intentar separar por párrafos
                            if (nuevasObjeciones.length === 0) {
                                console.log('[Agentes] Intentando separar por párrafos...')
                                const parrafos = textoGenerado.split(/\n\n+/).filter(p => p.trim())
                                parrafos.forEach(parrafo => {
                                    const limpio = parrafo.replace(/\*\*/g, '').replace(/Objeción:/i, '').replace(/Respuesta:/i, '').trim()
                                    if (limpio) {
                                        nuevasObjeciones.push(limpio)
                                    }
                                })
                            }
                            
                            // Si todavía no hay nada, usar el texto completo
                            if (nuevasObjeciones.length === 0) {
                                console.log('[Agentes] No se encontraron objeciones con formato, usando texto completo')
                                nuevasObjeciones.push(textoGenerado.trim())
                            }
                            
                            console.log('[Agentes] === RESULTADO FINAL ===')
                            console.log('[Agentes] Objeciones a agregar:', nuevasObjeciones)
                            
                            // Actualizar form con nuevas objeciones
                            setForm(f => {
                                const nuevas = [...(f.objections || []), ...nuevasObjeciones]
                                console.log('[Agentes] ✅ Form actualizado con', nuevas.length, 'objeciones:', nuevas)
                                return { ...f, objections: nuevas }
                            })
                            
                            // Mostrar mensaje de confirmación
                            alert(`✅ Se agregaron ${nuevasObjeciones.length} objeción(es) exitosamente.\n\nLas objeciones aparecen en la lista debajo del campo de texto.`)
                        }
                        setAsistenteAbierto(null)
                        console.log('[Agentes] asistenteAbierto cerrado')
                    }}
                />
            )}

            {/* Toast Notification */}
            {toast && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        padding: '12px 20px',
                        borderRadius: '8px',
                        background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#22c55e' : '#3b82f6',
                        color: '#fff',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        zIndex: 9999,
                        animation: 'slideIn 0.3s ease-out',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}
                >
                    {toast.message}
                </div>
            )}
        </>
    )
}

// Agregar estilos para animación de spinner y toast
const style = document.createElement('style')
style.textContent = `
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`
if (!document.getElementById('qwen-oauth-styles')) {
    style.id = 'qwen-oauth-styles'
    document.head.appendChild(style)
}
