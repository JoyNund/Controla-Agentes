import { useEffect, useState } from 'react'
import { connectionsApi, agentsApi } from '../api'
import { Wifi, WifiOff, Smartphone, Bot, RotateCcw, LogOut, Power, Trash2, QrCode, CheckCircle, Signal } from 'lucide-react'
import KeywordModal from '../components/KeywordModal'

export default function Conexion() {
    const [agents, setAgents] = useState([])
    const [connections, setConnections] = useState([])
    const [logs, setLogs] = useState({})
    const [selectedConnectionId, setSelectedConnectionId] = useState(null)
    const [connectionMethods, setConnectionMethods] = useState({}) // { connectionId: 'qr' | 'phone' }
    const [phoneNumbers, setPhoneNumbers] = useState({}) // { connectionId: phoneNumber }
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [newConnectionName, setNewConnectionName] = useState('')
    const [newConnectionAgentId, setNewConnectionAgentId] = useState('')
    const [newConnectionKeyword, setNewConnectionKeyword] = useState('')
    const [createModalOpen, setCreateModalOpen] = useState(false)

    // Modales de confirmación con keyword
    const [actionModal, setActionModal] = useState(null) // { type: 'logout'|'restart'|'delete'|'assign', connectionId, agentId? }

    // Cargar agentes y conexiones al montar
    useEffect(() => {
        agentsApi.list().then(setAgents)
        loadConnections()
    }, [])

    const loadConnections = async () => {
        try {
            const allConnections = await connectionsApi.list()
            const connectionsArray = Object.values(allConnections)
            setConnections(connectionsArray)
            
            // Inicializar métodos de conexión
            connectionsArray.forEach(conn => {
                setConnectionMethods(prev => ({ 
                    ...prev, 
                    [conn.id]: 'qr' 
                }))
            })
        } catch (error) {
            console.error('Error loading connections:', error)
        }
    }

    // Polling para actualizaciones
    useEffect(() => {
        const pollConnections = async () => {
            try {
                const allConnections = await connectionsApi.list()
                const connectionsArray = Object.values(allConnections)
                setConnections(connectionsArray)
            } catch (error) {
                console.error('Error polling connections:', error)
            }
        }

        pollConnections()
        const t = setInterval(pollConnections, 3000)
        return () => clearInterval(t)
    }, [])

    // Cargar logs para la conexión seleccionada
    useEffect(() => {
        if (!selectedConnectionId) {
            setLogs(prev => ({ ...prev, [selectedConnectionId]: [] }))
            return
        }
        
        const loadLogs = () => {
            connectionsApi.logs(selectedConnectionId).then((newLogs) => {
                setLogs(prev => ({ ...prev, [selectedConnectionId]: newLogs }))
            })
        }
        
        loadLogs()
        const t = setInterval(loadLogs, 2000)
        return () => clearInterval(t)
    }, [selectedConnectionId])

    const handleSelectConnection = (connectionId) => {
        setSelectedConnectionId(connectionId)
    }

    const handleMethodChange = (connectionId, method) => {
        setConnectionMethods(prev => ({ ...prev, [connectionId]: method }))
    }

    const handlePhoneNumberChange = (connectionId, phone) => {
        setPhoneNumbers(prev => ({ ...prev, [connectionId]: phone }))
    }

    const startConnection = async (connectionId) => {
        try {
            await connectionsApi.update(connectionId, { status: 'connecting' })
            setConnections(prev => prev.map(c => 
                c.id === connectionId ? { ...c, status: 'connecting' } : c
            ))
        } catch (error) {
            console.error('Error starting connection:', error)
            alert('Error al iniciar conexión: ' + error.message)
        }
    }

    const stopConnection = async (connectionId) => {
        try {
            await connectionsApi.update(connectionId, { status: 'disconnected' })
            setConnections(prev => prev.map(c => 
                c.id === connectionId ? { ...c, status: 'disconnected' } : c
            ))
        } catch (error) {
            console.error('Error stopping connection:', error)
        }
    }

    const logoutConnection = async (connectionId, keyword) => {
        try {
            await connectionsApi.logout(connectionId, keyword)
            setConnections(prev => prev.map(c =>
                c.id === connectionId ? { ...c, status: 'disconnected' } : c
            ))
            setLogs(prev => ({
                ...prev,
                [connectionId]: [...(prev[connectionId] || []), { time: new Date().toISOString(), text: 'Logout forzado por usuario' }]
            }))
            setActionModal(null)
        } catch (error) {
            console.error('Error logging out:', error)
            throw error
        }
    }

    const restartConnection = async (connectionId, keyword) => {
        try {
            await connectionsApi.restart(connectionId, keyword)
            setConnections(prev => prev.map(c =>
                c.id === connectionId ? { ...c, status: 'restart' } : c
            ))
            setActionModal(null)
        } catch (error) {
            console.error('Error restarting:', error)
            throw error
        }
    }

    const deleteConnection = async (connectionId, keyword) => {
        try {
            await connectionsApi.delete(connectionId, keyword)
            setConnections(prev => prev.filter(c => c.id !== connectionId))
            if (selectedConnectionId === connectionId) {
                setSelectedConnectionId(null)
            }
            setActionModal(null)
        } catch (error) {
            console.error('Error deleting connection:', error)
            throw error
        }
    }

    const assignAgentToConnection = async (connectionId, agentId, keyword) => {
        try {
            await connectionsApi.assignAgent(connectionId, agentId, keyword)
            setConnections(prev => prev.map(c =>
                c.id === connectionId ? { ...c, agentId } : c
            ))
            setActionModal(null)
        } catch (error) {
            console.error('Error assigning agent:', error)
            throw error
        }
    }

    const createConnection = async () => {
        if (!newConnectionName.trim()) {
            alert('Por favor ingresa un nombre para la conexión')
            return
        }

        // Cerrar el modal de creación y abrir el de keyword
        setShowCreateModal(false)
        setCreateModalOpen(true)
    }

    const confirmCreateConnection = async (keyword) => {
        try {
            await connectionsApi.create({
                name: newConnectionName,
                agentId: newConnectionAgentId || null
            }, keyword)
            setNewConnectionName('')
            setNewConnectionAgentId('')
            setNewConnectionKeyword('')
            setCreateModalOpen(false)
            loadConnections()
        } catch (error) {
            console.error('Error creating connection:', error)
            throw error // El modal mostrará el error
        }
    }

    const copyLogs = (connectionId) => {
        const connectionLogs = logs[connectionId] || []
        const text = connectionLogs.map((l) => `[${new Date(l.time).toLocaleTimeString()}] ${l.text}`).join('\n')
        navigator.clipboard.writeText(text || 'Sin logs')
    }

    const getStatusLabel = (status) => {
        switch (status) {
            case 'connected': return 'CONECTADO'
            case 'connecting': return 'CONECTANDO...'
            case 'awaiting_pairing_code': return 'EMPAREJANDO...'
            case 'awaiting_phone_link': return 'VINCULANDO...'
            case 'restart': return 'REINICIANDO...'
            default: return 'DESCONECTADO'
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return '#059669'
            case 'connecting': return '#f59e0b'
            case 'awaiting_pairing_code': return '#f59e0b'
            case 'awaiting_phone_link': return '#f59e0b'
            case 'restart': return '#8b5cf6'
            default: return '#6b7280'
        }
    }

    const selectedConnection = connections.find(c => c.id === selectedConnectionId)
    const selectedAgent = selectedConnection?.agentId ? agents.find(a => a.id === selectedConnection.agentId) : null

    return (
        <>
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2>Gestión de Conexiones</h2>
                    <button 
                        className="btn btn-primary" 
                        onClick={() => setShowCreateModal(true)}
                    >
                        + Nueva Conexión
                    </button>
                </div>
                
                <p className="muted">
                    Cada conexión es un dispositivo WhatsApp independiente. Puedes asignar un agente diferente a cada uno.
                </p>
                
                {/* Lista de conexiones como tarjetas */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                    gap: '1rem',
                    marginTop: '1rem'
                }}>
                    {connections.map(conn => {
                        const isSelected = selectedConnectionId === conn.id
                        const agent = conn.agentId ? agents.find(a => a.id === conn.agentId) : null

                        return (
                            <div
                                key={conn.id}
                                onClick={() => handleSelectConnection(conn.id)}
                                style={{
                                    border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                                    borderRadius: '12px',
                                    padding: '1rem',
                                    cursor: 'pointer',
                                    background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{conn.name}</h3>
                                    <span 
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '99px',
                                            fontSize: '10px',
                                            fontWeight: 'bold',
                                            background: getStatusColor(conn.status),
                                            color: '#fff'
                                        }}
                                    >
                                        {getStatusLabel(conn.status)}
                                    </span>
                                </div>
                                
                                {conn.phoneNumber && (
                                    <p style={{ fontSize: '12px', margin: '0.5rem 0' }} className="flex items-center gap-1">
                                        <Smartphone className="w-3 h-3" /> {conn.phoneNumber}
                                    </p>
                                )}

                                {agent ? (
                                    <p style={{ fontSize: '12px', margin: '0.5rem 0' }} className="flex items-center gap-1">
                                        <Bot className="w-3 h-3" /> Agente: <strong>{agent.name}</strong>
                                    </p>
                                ) : (
                                    <p className="muted" style={{ fontSize: '12px', margin: '0.5rem 0' }}>
                                        <WifiOff className="w-3 h-3 inline" /> Sin agente asignado
                                    </p>
                                )}

                                {/* Controles rápidos */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '1rem', flexWrap: 'wrap' }}>
                                    {conn.status === 'disconnected' ? (
                                        <button
                                            className="btn btn-primary"
                                            style={{ fontSize: '12px', padding: '6px 12px' }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                startConnection(conn.id)
                                            }}
                                        >
                                            <Power className="w-3 h-3" /> Encender
                                        </button>
                                    ) : conn.status === 'connected' ? (
                                        <>
                                            <button
                                                className="btn"
                                                style={{ fontSize: '12px', padding: '6px 12px', background: '#f59e0b', color: '#fff' }}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setActionModal({ type: 'restart', connectionId: conn.id })
                                                }}
                                            >
                                                <RotateCcw className="w-3 h-3" /> Reiniciar
                                            </button>
                                            <button
                                                className="btn"
                                                style={{ fontSize: '12px', padding: '6px 12px', background: '#ef4444', color: '#fff' }}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setActionModal({ type: 'logout', connectionId: conn.id })
                                                }}
                                            >
                                                <LogOut className="w-3 h-3" /> Cerrar Sesión
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="btn"
                                            style={{ fontSize: '12px', padding: '6px 12px', background: '#6b7280', color: '#fff' }}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                stopConnection(conn.id)
                                            }}
                                        >
                                            <WifiOff className="w-3 h-3" /> Detener
                                        </button>
                                    )}
                                </div>

                                {/* Botón eliminar */}
                                <button
                                    className="btn"
                                    style={{ fontSize: '11px', padding: '4px 8px', background: '#7f1d1d', color: '#fff', marginTop: '8px' }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setActionModal({ type: 'delete', connectionId: conn.id })
                                    }}
                                >
                                    <Trash2 className="w-3 h-3" /> Eliminar Conexión
                                </button>
                            </div>
                        )
                    })}
                </div>

                {connections.length === 0 && (
                    <p className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                        No hay conexiones configuradas. Haz clic en <strong>+ Nueva Conexión</strong> para crear una.
                    </p>
                )}
            </div>

            {/* Panel detallado de la conexión seleccionada */}
            {selectedConnection && (
                <div className="grid2">
                    <div className="card">
                        <h2>Configuración de Conexión</h2>
                        {(() => {
                            const method = connectionMethods[selectedConnectionId] || 'qr'
                            const conn = selectedConnection

                            return (
                                <>
                                    {/* Selector de agente */}
                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label className="label">Agente asignado</label>
                                        <select
                                            className="input"
                                            value={conn.agentId || ''}
                                            onChange={(e) => {
                                                const newAgentId = e.target.value
                                                if (newAgentId) {
                                                    setActionModal({ type: 'assign', connectionId: selectedConnectionId, agentId: newAgentId })
                                                } else {
                                                    // Si se quita el agente, no se requiere keyword
                                                    assignAgentToConnection(selectedConnectionId, '')
                                                }
                                            }}
                                        >
                                            <option value="">— Sin agente —</option>
                                            {agents.map((a) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.name}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="muted" style={{ fontSize: '12px', marginTop: '5px' }}>
                                            El agente determina el comportamiento de la IA para esta conexión
                                        </p>
                                    </div>

                                    {/* Método de conexión */}
                                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                                        <label className="label">Método de conexión</label>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                                <input
                                                    type="radio"
                                                    name={`connectionMethod-${selectedConnectionId}`}
                                                    value="qr"
                                                    checked={method === 'qr'}
                                                    onChange={() => handleMethodChange(selectedConnectionId, 'qr')}
                                                    style={{ marginRight: '5px' }}
                                                />
                                                QR Code
                                            </label>
                                        </div>
                                        <p className="muted" style={{ fontSize: '12px', marginTop: '5px' }}>
                                            Actualmente solo se soporta conexión por QR
                                        </p>
                                    </div>

                                    {/* Estado visual */}
                                    <div style={{
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 12,
                                        padding: '1rem',
                                        textAlign: 'center',
                                        minHeight: '200px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {(conn.status === 'connecting' || conn.status === 'restart') && method === 'qr' ? (
                                            <div>
                                                <div style={{ fontWeight: 'bold', marginBottom: 8, color: 'var(--text-primary)' }} className="flex items-center justify-center gap-2">
                                                    <QrCode className="w-5 h-5" /> ESCANEA EL QR
                                                </div>
                                                <img
                                                    src={connectionsApi.qrUrl(selectedConnectionId) + `?t=${Date.now()}`}
                                                    alt="WhatsApp QR"
                                                    style={{ maxWidth: '200px', border: '4px solid var(--bg-secondary)', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3)' }}
                                                    onError={(e) => {
                                                        e.target.style.display = 'none'
                                                        e.target.nextSibling.style.display = 'block'
                                                    }}
                                                />
                                                <p className="muted" style={{ fontSize: 11, marginTop: 8, display: 'none' }}>
                                                    Cargando QR...
                                                </p>
                                                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                                                    Abre WhatsApp → Ajustes → Dispositivos vinculados → Escanear código QR
                                                </p>
                                            </div>
                                        ) : conn.status === 'connected' ? (
                                            <div>
                                                <div style={{ fontSize: 48, marginBottom: 8, color: '#059669' }}>
                                                    <CheckCircle className="w-12 h-12 mx-auto" />
                                                </div>
                                                <strong style={{ color: '#059669' }} className="flex items-center justify-center gap-2">
                                                    <Signal className="w-4 h-4" /> CONEXIÓN ACTIVA
                                                </strong>
                                                <p className="muted" style={{ fontSize: 12 }}>
                                                    {conn.phoneNumber || 'Número vinculado'}
                                                </p>
                                            </div>
                                        ) : conn.status === 'connecting' ? (
                                            <div>
                                                <div style={{ fontSize: 48, marginBottom: 8, color: '#f59e0b' }}>
                                                    <RotateCcw className="w-12 h-12 mx-auto animate-spin" />
                                                </div>
                                                <strong style={{ color: '#f59e0b' }}>CONECTANDO...</strong>
                                                <p className="muted" style={{ fontSize: 12 }}>
                                                    Esperando código QR
                                                </p>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ fontSize: 48, marginBottom: 8, color: '#6b7280' }}>
                                                    <WifiOff className="w-12 h-12 mx-auto" />
                                                </div>
                                                <strong>INSTANCIA DETENIDA</strong>
                                                <p className="muted" style={{ fontSize: 12 }}>
                                                    Presiona "Encender" para iniciar
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Controles */}
                                    <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                                        {conn.status === 'disconnected' ? (
                                            <button
                                                className="btn btn-primary"
                                                onClick={() => startConnection(selectedConnectionId)}
                                                style={{ flex: 1 }}
                                            >
                                                ENCENDER
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    className="btn"
                                                    style={{ background: '#f59e0b', color: '#fff', flex: 1 }}
                                                    onClick={() => setActionModal({ type: 'restart', connectionId: selectedConnectionId })}
                                                >
                                                    🔄 REINICIAR
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ background: '#ef4444', color: '#fff', flex: 1 }}
                                                    onClick={() => setActionModal({ type: 'logout', connectionId: selectedConnectionId })}
                                                >
                                                    🚪 CERRAR SESIÓN
                                                </button>
                                                <button
                                                    className="btn"
                                                    style={{ background: '#6b7280', color: '#fff', flex: 1 }}
                                                    onClick={() => stopConnection(selectedConnectionId)}
                                                >
                                                    DETENER
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )
                        })()}
                    </div>

                    <div className="card">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="inline-flex items-center gap-2">
                                SYSTEM_CONSOLE_V1.0
                                <span className="inline-flex items-center justify-center" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }}>
                                    <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-current" />
                                </span>
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>LIVE</span>
                        </h2>
                        <div style={{ 
                            background: '#1a1d21', 
                            color: '#e5e7eb', 
                            borderRadius: 8, 
                            padding: 12, 
                            fontFamily: 'monospace', 
                            fontSize: 12, 
                            maxHeight: 320, 
                            overflowY: 'auto' 
                        }}>
                            {(() => {
                                const connectionLogs = logs[selectedConnectionId] || []
                                return connectionLogs.length === 0 ? (
                                    <div style={{ color: '#6b7280' }}>No hay logs aún. Inicia la conexión para ver el estado.</div>
                                ) : (
                                    connectionLogs.slice(-50).map((l, i) => (
                                        <div key={i}>
                                            [{new Date(l.time).toLocaleTimeString()}] $ {l.text}
                                        </div>
                                    ))
                                )
                            })()}
                        </div>
                        <button 
                            className="btn btn-secondary" 
                            style={{ marginTop: 8 }} 
                            onClick={() => copyLogs(selectedConnectionId)}
                        >
                            Copiar logs
                        </button>
                        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                            ORQUESTADOR_ACTIVO • {selectedConnection.name}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para crear conexión */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="card" style={{ maxWidth: '500px', width: '90%' }}>
                        <h3>Nueva Conexión</h3>
                        <p className="muted">Crea una nueva conexión para vincular un dispositivo WhatsApp</p>
                        
                        <div className="form-group">
                            <label className="label">Nombre de la conexión</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Ej: Ventas 1, Soporte, etc."
                                value={newConnectionName}
                                onChange={(e) => setNewConnectionName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="label">Agente inicial (opcional)</label>
                            <select
                                className="input"
                                value={newConnectionAgentId}
                                onChange={(e) => setNewConnectionAgentId(e.target.value)}
                            >
                                <option value="">— Sin agente —</option>
                                {agents.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name}
                                    </option>
                                ))}
                            </select>
                            <p className="muted" style={{ fontSize: '12px', marginTop: '5px' }}>
                                Puedes cambiar el agente después
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
                            <button
                                className="btn btn-primary"
                                onClick={createConnection}
                                style={{ flex: 1 }}
                            >
                                Crear Conexión
                            </button>
                            <button
                                className="btn"
                                onClick={() => {
                                    setShowCreateModal(false)
                                    setNewConnectionName('')
                                    setNewConnectionAgentId('')
                                }}
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modales de acción con keyword */}
            <KeywordModal
                isOpen={actionModal?.type === 'logout'}
                onClose={() => setActionModal(null)}
                onConfirm={(keyword) => logoutConnection(actionModal.connectionId, keyword)}
                title="Cerrar sesión de conexión"
                description="Ingrese la palabra clave de la conexión para confirmar:"
            />

            <KeywordModal
                isOpen={actionModal?.type === 'restart'}
                onClose={() => setActionModal(null)}
                onConfirm={(keyword) => restartConnection(actionModal.connectionId, keyword)}
                title="Reiniciar conexión"
                description="Ingrese la palabra clave de la conexión para confirmar:"
            />

            <KeywordModal
                isOpen={actionModal?.type === 'delete'}
                onClose={() => setActionModal(null)}
                onConfirm={(keyword) => deleteConnection(actionModal.connectionId, keyword)}
                title="Eliminar conexión"
                description="Ingrese la palabra clave de la conexión para confirmar la eliminación:"
            />

            <KeywordModal
                isOpen={actionModal?.type === 'assign'}
                onClose={() => setActionModal(null)}
                onConfirm={(keyword) => assignAgentToConnection(actionModal.connectionId, actionModal.agentId, keyword)}
                title="Asignar agente a conexión"
                description="Ingrese la palabra clave de la conexión para confirmar:"
            />

            {/* Modal para Crear Conexión - Pedir keyword */}
            <KeywordModal
                isOpen={createModalOpen}
                onClose={() => {
                    setCreateModalOpen(false)
                    setNewConnectionKeyword('')
                }}
                onConfirm={(keyword) => confirmCreateConnection(keyword)}
                title="Crear nueva conexión"
                description="Ingrese una palabra clave para proteger esta conexión:"
            />

            <p className="muted" style={{ marginTop: '1rem' }}>
                💡 <strong>Consejo:</strong> Cada conexión es un dispositivo WhatsApp independiente. 
                Puedes tener múltiples números atendiendo clientes simultáneamente, cada uno con su propio agente.
            </p>
        </>
    )
}
