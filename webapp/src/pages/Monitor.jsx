import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { conversationsApi, connectionsApi, paymentsApi } from '../api'
import {
    Search,
    MessageSquare,
    Trash2,
    Tag,
    Thermometer,
    User,
    Clock,
    Filter,
    X,
    Moon,
    Zap,
    Flame,
    Circle,
    Smartphone,
    DollarSign
} from 'lucide-react'

const TAGS = [
    { id: null, label: 'Sin etiqueta', color: '#94a3b8', icon: Circle },
    { id: 'frio', label: 'Frío', color: '#94a3b8', icon: Moon },
    { id: 'tibio', label: 'Tibio', color: '#f59e0b', icon: Zap },
    { id: 'caliente', label: 'Caliente', color: '#ef4444', icon: Flame },
]

const TAG_FILTERS = [
    { id: 'all', label: 'Todos' },
    { id: 'frio', label: 'Fríos' },
    { id: 'tibio', label: 'Tibios' },
    { id: 'caliente', label: 'Calientes' },
    { id: 'untagged', label: 'Sin etiqueta' },
]

export default function Monitor() {
    const navigate = useNavigate()
    const [list, setList] = useState([])
    const [allConnections, setAllConnections] = useState([])
    const [selectedConnection, setSelectedConnection] = useState('all') // 'all' o connectionId
    const [selected, setSelected] = useState(null)
    const [search, setSearch] = useState('')
    const [tagFilter, setTagFilter] = useState('all')
    const [customNames, setCustomNames] = useState({})
    const [pagosCount, setPagosCount] = useState({})

    useEffect(() => {
        loadConversations()
        loadCustomNames()
        loadConnections()
        loadPagosCount()
    }, [])

    useEffect(() => {
        if (!selected?.id) return
        conversationsApi.get(selected.id).then(setSelected)
    }, [selected?.id])

    const loadConnections = async () => {
        try {
            const connections = await connectionsApi.list()
            setAllConnections(Object.values(connections))
        } catch (error) {
            console.error('Error loading connections:', error)
        }
    }

    const loadConversations = async () => {
        try {
            let conversations = await conversationsApi.list()
            console.log('[Monitor] Total conversaciones desde API:', conversations.length)
            console.log('[Monitor] Conexión seleccionada:', selectedConnection)
            console.log('[Monitor] Todas las conexiones:', allConnections)

            // Si hay una conexión seleccionada, filtrar por esa conexión
            if (selectedConnection !== 'all') {
                const conn = allConnections.find(c => c.id === selectedConnection)
                console.log('[Monitor] Conexión encontrada:', conn)
                
                if (conn?.phoneNumber) {
                    const beforeFilter = conversations.length
                    conversations = conversations.filter(c => {
                        const convNumber = c.id?.split('@')[0]
                        const match = convNumber === conn.phoneNumber
                        console.log(`[Monitor] Comparando ${convNumber} === ${conn.phoneNumber} = ${match}`)
                        return match
                    })
                    console.log(`[Monitor] Conversaciones después de filtrar: ${conversations.length} (antes: ${beforeFilter})`)
                }
            }

            setList(conversations)
        } catch (error) {
            console.error('Error loading conversations:', error)
            setList([])
        }
    }

    // Recargar conversaciones cuando cambia la conexión seleccionada O cuando se cargan las conexiones
    useEffect(() => {
        // Solo cargar si ya tenemos conexiones cargadas
        if (selectedConnection !== 'all' && allConnections.length === 0) {
            return // Esperar a que se carguen las conexiones
        }
        loadConversations()
    }, [selectedConnection, allConnections])

    const loadCustomNames = () => {
        const saved = localStorage.getItem('conversation_names')
        if (saved) {
            try {
                setCustomNames(JSON.parse(saved))
            } catch (e) {
                console.error('Error loading custom names:', e)
            }
        }
    }

    const loadPagosCount = async () => {
        try {
            const counts = {}
            for (const conv of list) {
                const telefono = conv.contact?.replace(/@.*$/, '') || conv.id?.replace(/@.*$/, '')
                if (telefono) {
                    try {
                        const pagos = await paymentsApi.list({ cliente: telefono })
                        counts[telefono] = pagos.length
                    } catch (error) {
                        counts[telefono] = 0
                    }
                }
            }
            setPagosCount(counts)
        } catch (error) {
            console.error('Error loading pagos count:', error)
        }
    }

    const saveCustomName = (convId, name) => {
        const updated = { ...customNames, [convId]: name }
        setCustomNames(updated)
        localStorage.setItem('conversation_names', JSON.stringify(updated))
        
        // Update selected conversation if it's the one being edited
        if (selected?.id === convId) {
            setSelected({ ...selected, customName: name })
        }
    }

    const setTag = (convId, tag) => {
        conversationsApi.setTag(convId, tag).then(() => {
            setList((prev) => prev.map((c) => (c.id === convId ? { ...c, tag } : c)))
            if (selected?.id === convId) setSelected((s) => (s ? { ...s, tag } : s))
        })
    }

    const deleteConversation = async (convId) => {
        const conv = list.find(c => c.id === convId)
        const displayName = getDisplayName(conv)

        if (window.confirm(`¿Estás seguro de que deseas eliminar la conversación con ${displayName}?`)) {
            try {
                await conversationsApi.delete(convId)
                // Refrescar la lista desde el servidor
                loadConversations()
                // Cerrar detalle si estaba seleccionado
                if (selected?.id === convId) setSelected(null)
            } catch (error) {
                console.error('Error deleting conversation:', error)
                alert('Error al eliminar: ' + (error.message || 'Error desconocido'))
            }
        }
    }

    const getDisplayName = (conv) => {
        if (!conv) return ''
        if (customNames[conv.id]) return customNames[conv.id]
        if (conv.contact) {
            // Extract phone number from contact (remove @s.whatsapp.net or @lid)
            const phone = conv.contact.replace(/@.*$/, '')
            return phone
        }
        return conv.id.replace(/@.*$/, '')
    }

    const getFilteredConversations = () => {
        return list.filter((c) => {
            // Search filter
            const displayName = getDisplayName(c)
            const matchesSearch = !search || displayName.toLowerCase().includes(search.toLowerCase())
            
            // Tag filter
            let matchesTag = true
            if (tagFilter === 'untagged') {
                matchesTag = !c.tag
            } else if (tagFilter !== 'all') {
                matchesTag = c.tag === tagFilter
            }
            
            return matchesSearch && matchesTag
        })
    }

    const getTagInfo = (tagId) => {
        return TAGS.find(t => t.id === tagId) || TAGS[0]
    }

    const formatDate = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        return date.toLocaleDateString('es-ES', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const filtered = getFilteredConversations()

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <MessageSquare className="w-6 h-6" />
                    Monitor de Chats
                </h2>
                <div className="text-sm opacity-70">
                    {filtered.length} de {list.length} conversaciones
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex flex-col gap-4">
                    {/* Connection Filter Dropdown */}
                    <div className="flex items-center gap-4">
                        <Smartphone className="w-5 h-5 opacity-50" />
                        <label className="label">
                            <span className="label-text font-semibold">Filtrar por conexión:</span>
                        </label>
                        <select 
                            className="select select-bordered select-sm flex-1 max-w-xs"
                            value={selectedConnection}
                            onChange={(e) => setSelectedConnection(e.target.value)}
                        >
                            <option value="all">Todas las conexiones</option>
                            {allConnections.map(conn => (
                                <option key={conn.id} value={conn.id}>
                                    {conn.name} ({conn.phoneNumber || 'Sin número'})
                                </option>
                            ))}
                        </select>
                        {selectedConnection !== 'all' && (
                            <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setSelectedConnection('all')}
                                title="Mostrar todas"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    
                    {/* Search and Tag Filter */}
                    <div className="flex flex-col md:flex-row gap-4">
                        {/* Search */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-50" />
                            <input
                                className="input input-bordered w-full pl-10"
                                placeholder="Buscar por número o nombre..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            {search && (
                                <button
                                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
                                    onClick={() => setSearch('')}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>

                        {/* Tag Filter */}
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 opacity-50" />
                            <div className="flex gap-1 flex-wrap">
                                {TAG_FILTERS.map((filter) => (
                                    <button
                                        key={filter.id}
                                        className={`btn btn-sm ${tagFilter === filter.id ? 'btn-primary' : 'btn-ghost'}`}
                                        onClick={() => setTagFilter(filter.id)}
                                    >
                                        {filter.id === 'frio' && <Moon className="w-3 h-3" />}
                                        {filter.id === 'tibio' && <Zap className="w-3 h-3" />}
                                        {filter.id === 'caliente' && <Flame className="w-3 h-3" />}
                                        {filter.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
                {/* Conversations List */}
                <div className="card p-0 overflow-hidden lg:col-span-1">
                    <div className="p-4 border-b bg-base-200">
                        <h3 className="font-semibold">Conversaciones</h3>
                    </div>
                    <div className="overflow-y-auto max-h-[600px]">
                        {filtered.length === 0 ? (
                            <div className="p-8 text-center opacity-50">
                                <MessageSquare className="w-12 h-12 mx-auto mb-2" />
                                <p>No hay conversaciones</p>
                            </div>
                        ) : (
                            filtered.map((c) => {
                                const tagInfo = getTagInfo(c.tag)
                                const displayName = getDisplayName(c)
                                const isSelected = selected?.id === c.id
                                const telefono = c.contact?.replace(/@.*$/, '') || c.id?.replace(/@.*$/, '')

                                return (
                                    <div
                                        key={c.id}
                                        className={`p-3 border-b hover:bg-base-200 cursor-pointer transition-colors ${isSelected ? 'bg-primary bg-opacity-10' : ''}`}
                                        onClick={() => setSelected(c)}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className="avatar placeholder">
                                                    <div className="bg-neutral text-neutral-content rounded-full w-10">
                                                        <span className="text-xs font-bold">
                                                            {displayName.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">
                                                        {displayName}
                                                        {customNames[c.id] && (
                                                            <span className="text-xs opacity-50 ml-2">
                                                                ({c.contact?.replace(/@.*$/, '')})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs opacity-70 flex items-center gap-2">
                                                        <span>{c.messages?.length || 0} mensajes</span>
                                                        <span>•</span>
                                                        <span>{formatDate(c.updatedAt)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {/* Ícono de Pago */}
                                                {pagosCount[telefono] > 0 && (
                                                    <div
                                                        className="tooltip cursor-pointer hover:scale-125 transition-transform"
                                                        data-tip={`${pagosCount[telefono]} pago(s) registrado(s)`}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            navigate(`/pagos?cliente=${telefono}`)
                                                        }}
                                                    >
                                                        <DollarSign className="w-5 h-5 text-success" />
                                                    </div>
                                                )}
                                                {/* Tag Badge */}
                                                {c.tag && (
                                                    <span
                                                        className="badge badge-sm flex items-center gap-1"
                                                        style={{
                                                            backgroundColor: tagInfo.color,
                                                            color: 'white'
                                                        }}
                                                        title={`Etiqueta: ${tagInfo.label}`}
                                                    >
                                                        <tagInfo.icon className="w-3 h-3" />
                                                        {tagInfo.label}
                                                    </span>
                                                )}
                                                {/* Delete Button */}
                                                <button
                                                    className="btn btn-ghost btn-xs text-error"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteConversation(c.id)
                                                    }}
                                                    title="Eliminar conversación"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* Conversation Detail */}
                <div className="card p-0 overflow-hidden lg:col-span-2">
                    {!selected ? (
                        <div className="flex-1 flex items-center justify-center p-8 opacity-50">
                            <div className="text-center">
                                <MessageSquare className="w-16 h-16 mx-auto mb-4" />
                                <p className="text-lg">Selecciona una conversación para ver los detalles</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            {/* Header */}
                            <div className="p-4 border-b bg-base-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className="avatar placeholder">
                                            <div className="bg-primary text-primary-content rounded-full w-12">
                                                <span className="text-lg font-bold">
                                                    {getDisplayName(selected).charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1">
                                            {/* Custom Name Input */}
                                            <div className="flex items-center gap-2 mb-1">
                                                <User className="w-4 h-4 opacity-50" />
                                                <input
                                                    className="input input-sm input-bordered flex-1"
                                                    placeholder="Asignar nombre..."
                                                    value={customNames[selected.id] || ''}
                                                    onChange={(e) => saveCustomName(selected.id, e.target.value)}
                                                    onBlur={(e) => {
                                                        if (!e.target.value.trim()) {
                                                            saveCustomName(selected.id, '')
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div className="text-sm opacity-70">
                                                {selected.contact?.replace(/@.*$/, '')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Tag Selector */}
                                        <div className="dropdown dropdown-end">
                                            <div tabIndex={0} role="button" className="btn btn-sm btn-ghost">
                                                <Tag className="w-4 h-4" />
                                                {getTagInfo(selected.tag).label}
                                            </div>
                                            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40">
                                                {TAGS.map((tag) => (
                                                    <li key={tag.id || 'none'}>
                                                        <a
                                                            onClick={() => setTag(selected.id, tag.id)}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <tag.icon className="w-4 h-4" style={{ color: tag.color }} />
                                                            <span style={{ color: tag.color }}>{tag.label}</span>
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[400px]">
                                {(!selected.messages || selected.messages.length === 0) ? (
                                    <div className="text-center opacity-50 py-8">
                                        <MessageSquare className="w-12 h-12 mx-auto mb-2" />
                                        <p>Sin mensajes</p>
                                    </div>
                                ) : (
                                    selected.messages.map((msg, idx) => (
                                        <div
                                            key={idx}
                                            className={`chat ${msg.from === 'bot' ? 'chat-end' : 'chat-start'}`}
                                        >
                                            <div className="chat-bubble">
                                                {msg.body}
                                            </div>
                                            <div className="chat-footer opacity-50 text-xs">
                                                {new Date(msg.at).toLocaleTimeString('es-ES', { 
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                })}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Info Footer */}
                            <div className="p-4 border-t bg-base-200 text-sm opacity-70">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <span>Creado: {formatDate(selected.createdAt)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Thermometer className="w-4 h-4" />
                                        <span>
                                            Estado: <strong style={{ color: getTagInfo(selected.tag).color }}>
                                                {getTagInfo(selected.tag).label}
                                            </strong>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
