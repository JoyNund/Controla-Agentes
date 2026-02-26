import { useEffect, useState } from 'react'
import { agentsApi, connectionsApi } from '../api'
import { Bot, Wifi, WifiOff, MessageSquare, TrendingUp, Activity } from 'lucide-react'

export default function Dashboard() {
    const [agents, setAgents] = useState([])
    const [connections, setConnections] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            agentsApi.list(),
            connectionsApi.list()
        ]).then(([agentsData, connectionsData]) => {
            setAgents(agentsData)
            setConnections(Object.values(connectionsData))
            setLoading(false)
        }).catch(() => {
            setLoading(false)
        })
    }, [])

    const total = agents.length
    const connectedCount = connections.filter(c => c.status === 'connected').length
    const activeConnection = connections.find(c => c.status === 'connected')
    const activeAgent = activeConnection?.agentId ? agents.find(a => a.id === activeConnection.agentId) : null

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <div className="flex flex-col items-center gap-4">
                    <Activity className="w-12 h-12 animate-spin text-primary" />
                    <div>Cargando...</div>
                </div>
            </div>
        )
    }

    return (
        <>
            <h2 style={{ marginBottom: '0.5rem' }}>Métricas de Rendimiento</h2>
            <p className="muted" style={{ marginBottom: '1.5rem' }}>
                Estado actual de tus {total} agente{total !== 1 ? 's' : ''} comercial{total !== 1 ? 'es' : ''}
            </p>

            {total === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                        <Bot className="w-20 h-20 mx-auto opacity-50" />
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem' }}>NO HAY AGENTES CONFIGURADOS</h3>
                    <p className="muted">Ve a Configurar Agente y crea tu primer agente para empezar.</p>
                </div>
            ) : (
                <>
                    <div className="card" style={{ marginBottom: '1rem' }}>
                        <h3 style={{ margin: '0 0 0.5rem' }} className="flex items-center gap-2">
                            <Wifi className="w-5 h-5" /> Conexión actual
                        </h3>
                        {activeConnection ? (
                            <>
                                <p style={{ fontSize: '1.1rem', margin: '0.5rem 0' }} className="flex items-center gap-2">
                                    <span className="inline-flex items-center gap-1" style={{ color: '#059669', fontWeight: 'bold' }}>
                                        <Wifi className="w-4 h-4" /> Conectado
                                    </span>{' '}
                                    {activeConnection.name} - {activeAgent?.name || 'Sin agente'}
                                </p>
                                <p className="muted">
                                    {activeConnection.phoneNumber ? `📱 ${activeConnection.phoneNumber}` : 'WhatsApp vinculado'}
                                </p>
                            </>
                        ) : (
                            <p className="muted flex items-center gap-2">
                                <WifiOff className="w-5 h-5 opacity-50" />
                                No hay conexiones activas. Ve a <a href="/conexion" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>Conexión</a> para vincular WhatsApp.
                            </p>
                        )}
                    </div>
                    
                    <div className="grid2">
                        <div className="card">
                            <h2 className="flex items-center gap-2">
                                <MessageSquare className="w-6 h-6" /> Resumen de Conexiones
                            </h2>
                            <p className="muted">Estado de tus instancias</p>
                            <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                                <div style={{ flex: 1, padding: 12, background: 'rgba(5,150,105,.1)', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }} className="flex items-center justify-center gap-2">
                                        <Wifi className="w-6 h-6" /> {connectedCount}
                                    </div>
                                    <div className="muted" style={{ fontSize: 12 }}>Conectadas</div>
                                </div>
                                <div style={{ flex: 1, padding: 12, background: 'rgba(107,114,128,.1)', borderRadius: 8, textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6b7280' }} className="flex items-center justify-center gap-2">
                                        <WifiOff className="w-6 h-6" /> {connections.length - connectedCount}
                                    </div>
                                    <div className="muted" style={{ fontSize: 12 }}>Inactivas</div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="card">
                            <h2 className="flex items-center gap-2">
                                <Bot className="w-6 h-6" /> Agentes Activos
                            </h2>
                            <p className="muted">Total de agentes configurados</p>
                            <div style={{ marginTop: 12, padding: 12, background: 'rgba(59,130,246,.1)', borderRadius: 8 }}>
                                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }} className="flex items-center gap-2">
                                    <TrendingUp className="w-6 h-6" /> {total}
                                </div>
                                <div className="muted" style={{ fontSize: 12 }}>Agentes disponibles</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    )
}
