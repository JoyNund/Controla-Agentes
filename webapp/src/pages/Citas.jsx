import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { citasApi, paymentsApi } from '../api'
import { Calendar, Clock, CheckCircle, XCircle, Trash2, RefreshCw, BarChart3, Bot, DollarSign } from 'lucide-react'

export default function Citas() {
    const navigate = useNavigate()
    const [citas, setCitas] = useState([])
    const [stats, setStats] = useState(null)
    const [filtro, setFiltro] = useState('activa')
    const [loading, setLoading] = useState(true)
    const [refreshKey, setRefreshKey] = useState(0)
    const [pagosCount, setPagosCount] = useState({})

    useEffect(() => {
        cargarDatos()
        // Auto-refresh cada 60 segundos
        const interval = setInterval(cargarDatos, 60000)
        return () => clearInterval(interval)
    }, [filtro, refreshKey])

    useEffect(() => {
        if (citas.length > 0) {
            loadPagosCount()
        }
    }, [citas])

    const cargarDatos = async () => {
        setLoading(true)
        try {
            const [statsData, todas] = await Promise.all([
                citasApi.getStats(),
                citasApi.getAll()
            ])
            setStats(statsData)

            const filtradas = filtro === 'todas'
                ? todas
                : todas.filter(c => c.estado === filtro)
            setCitas(filtradas)
        } catch (error) {
            console.error('Error cargando citas:', error)
            // Solo mostrar alerta si es un error real de conexión/API
            // Si es solo que no hay citas, no mostrar error
            if (error.message !== 'No hay citas') {
                alert('Error cargando citas: ' + error.message)
            }
        }
        setLoading(false)
    }

    const cancelarCita = async (id) => {
        const motivo = prompt('Motivo de cancelación (opcional):')
        if (!confirm('¿Cancelar esta cita?')) return
        
        try {
            await citasApi.cancelar(id, { canceladoPor: 'agente', motivo: motivo || undefined })
            setRefreshKey(prev => prev + 1)
            alert('Cita cancelada correctamente')
        } catch (error) {
            alert('Error al cancelar: ' + error.message)
        }
    }

    const completarCita = async (id) => {
        if (!confirm('¿Marcar esta cita como completada?')) return
        
        try {
            await citasApi.completar(id)
            setRefreshKey(prev => prev + 1)
            alert('Cita marcada como completada')
        } catch (error) {
            alert('Error: ' + error.message)
        }
    }

    const eliminarCita = async (id) => {
        if (!confirm('¿Eliminar permanentemente esta cita? Esta acción no se puede deshacer.')) return

        try {
            await citasApi.delete(id)
            setRefreshKey(prev => prev + 1)
            alert('Cita eliminada')
        } catch (error) {
            alert('Error: ' + error.message)
        }
    }

    const loadPagosCount = async () => {
        try {
            const counts = {}
            for (const cita of citas) {
                const telefono = cita.cliente
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

    const formatearFecha = (fechaISO) => {
        const fecha = new Date(fechaISO + 'T00:00:00')
        return fecha.toLocaleDateString('es-PE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    const formatearHora = (hora) => {
        const [h, m] = hora.split(':')
        const date = new Date()
        date.setHours(parseInt(h), parseInt(m))
        return date.toLocaleTimeString('es-PE', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        })
    }

    const formatearFechaRelativa = (fechaISO) => {
        const fecha = new Date(fechaISO + 'T00:00:00')
        const ahora = new Date()
        const diffDias = Math.ceil((fecha - ahora) / (1000 * 60 * 60 * 24))
        
        if (diffDias === 0) return 'Hoy'
        if (diffDias === 1) return 'Mañana'
        if (diffDias === -1) return 'Ayer'
        if (diffDias > 0) return `En ${diffDias} días`
        return `Hace ${Math.abs(diffDias)} días`
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-12 h-12 animate-spin text-primary" />
                    <div>Cargando citas...</div>
                </div>
            </div>
        )
    }

    return (
        <div className="citas-page">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h2 style={{ margin: '0 0 0.5rem' }} className="flex items-center gap-2">
                        <Calendar className="w-6 h-6" /> Gestión de Citas
                    </h2>
                    <p className="muted" style={{ margin: 0 }}>
                        Administra las reuniones agendadas con tus clientes
                    </p>
                </div>
                <button
                    onClick={() => setRefreshKey(prev => prev + 1)}
                    className="btn btn-ghost"
                    style={{ color: 'var(--accent)', padding: '0.5rem' }}
                    title="Actualizar"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            </div>

            {/* Estadísticas */}
            {stats && (
                <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: '1.5rem' }}>
                    <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.total}</div>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>Total</div>
                    </div>
                    <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'rgba(5, 150, 105, 0.1)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#059669' }}>{stats.activas}</div>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>Activas</div>
                    </div>
                    <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>{stats.paraRecordatorio}</div>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>Recordatorio</div>
                    </div>
                    <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'rgba(100, 116, 139, 0.1)' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#64748b' }}>{stats.caducadas}</div>
                        <div className="muted" style={{ fontSize: '0.85rem' }}>Caducadas</div>
                    </div>
                </div>
            )}

            {/* Filtros */}
            <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
                {/* Desktop: Pestañas horizontales */}
                <div className="hidden lg:block">
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {[
                            { value: 'activa', label: 'Activas', color: '#059669' },
                            { value: 'cancelada', label: 'Canceladas', color: '#dc2626' },
                            { value: 'completada', label: 'Completadas', color: '#2563eb' },
                            { value: 'todas', label: 'Todas', color: '#64748b' }
                        ].map((tab) => (
                            <button
                                key={tab.value}
                                onClick={() => setFiltro(tab.value)}
                                className={`badge ${filtro === tab.value ? 'active' : ''}`}
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    background: filtro === tab.value 
                                        ? `${tab.color}20` 
                                        : 'var(--bg-secondary)',
                                    color: filtro === tab.value 
                                        ? tab.color 
                                        : 'var(--text-secondary)',
                                    border: `1px solid ${filtro === tab.value ? tab.color : 'var(--border)'}`,
                                    borderRadius: '9999px',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* Mobile: Dropdown */}
                <div className="lg:hidden">
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Filtrar por estado:</span>
                        <select
                            value={filtro}
                            onChange={(e) => setFiltro(e.target.value)}
                            className="select select-bordered"
                            style={{
                                padding: '0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)'
                            }}
                        >
                            <option value="activa">Activas</option>
                            <option value="cancelada">Canceladas</option>
                            <option value="completada">Completadas</option>
                            <option value="todas">Todas</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabla de citas */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {citas.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                        <Calendar className="w-16 h-16 mx-auto opacity-20" style={{ marginBottom: '1rem' }} />
                        <h3>No hay citas {filtro !== 'todas' ? filtro : ''}</h3>
                        <p className="muted">
                            {filtro === 'activa' ? 'Las citas activas aparecerán aquí cuando los clientes las agenden.' : 
                              'No hay citas con este estado.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--secondary)', borderBottom: '1px solid var(--border)' }}>
                                <tr>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Cliente</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Teléfono</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Fecha</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Hora</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Tipo</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Pagos</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Estado</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {citas.map((cita, index) => (
                                    <tr 
                                        key={cita.id} 
                                        style={{ 
                                            borderBottom: index < citas.length - 1 ? '1px solid var(--border)' : 'none',
                                            background: index % 2 === 1 ? 'rgba(0,0,0,0.02)' : 'transparent'
                                        }}
                                    >
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: '500' }}>{cita.nombre}</div>
                                            {cita.descripcion && (
                                                <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                                    {cita.descripcion.substring(0, 50)}{cita.descripcion.length > 50 ? '...' : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>
                                            {cita.telefono}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div>{formatearFecha(cita.fecha)}</div>
                                            <div className="muted" style={{ fontSize: '0.85rem' }}>
                                                {formatearFechaRelativa(cita.fecha)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>
                                            {formatearHora(cita.hora)}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span className="badge" style={{ background: 'var(--primary)', opacity: 0.8 }}>
                                                {cita.tipo}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {pagosCount[cita.telefono] > 0 ? (
                                                <div
                                                    className="tooltip cursor-pointer hover:scale-125 transition-transform"
                                                    data-tip={`${pagosCount[cita.telefono]} pago(s) - Click para ver`}
                                                    onClick={() => {
                                                        navigate(`/pagos?cliente=${cita.telefono}`)
                                                    }}
                                                >
                                                    <span className="text-2xl text-success">💚</span>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {pagosCount[cita.telefono]} pago(s)
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="tooltip" data-tip="Sin pagos registrados">
                                                    <span className="text-xl text-gray-300">⚪</span>
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span className={`badge ${
                                                cita.estado === 'activa' ? 'success' : 
                                                cita.estado === 'cancelada' ? 'error' : 
                                                'secondary'
                                            }`}>
                                                {cita.estado === 'activa' && <CheckCircle className="w-3 h-3" style={{ marginRight: '0.25rem' }} />}
                                                {cita.estado === 'cancelada' && <XCircle className="w-3 h-3" style={{ marginRight: '0.25rem' }} />}
                                                {cita.estado}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {cita.estado === 'activa' && (
                                                    <>
                                                        <button 
                                                            onClick={() => completarCita(cita.id)}
                                                            className="btn-secondary"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                                                            title="Marcar como completada"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => cancelarCita(cita.id)}
                                                            className="btn-secondary"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', color: '#dc2626' }}
                                                            title="Cancelar"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                                <button 
                                                    onClick={() => eliminarCita(cita.id)}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', color: '#64748b' }}
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
