import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { DollarSign, Filter, Search, X, Eye, CheckCircle, XCircle, AlertCircle, RefreshCw, Trash2, ChevronDown, CheckSquare, Square } from 'lucide-react'
import { paymentsApi } from '../api'
import PagoModal from '../components/PagoModal'

export default function Pagos() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const [pagos, setPagos] = useState([])
    const [loading, setLoading] = useState(true)
    const [filtroCliente, setFiltroCliente] = useState('')
    const [filtroEstado, setFiltroEstado] = useState('todos')
    const [filtroFecha, setFiltroFecha] = useState({ desde: '', hasta: '' })
    const [filtroAgente, setFiltroAgente] = useState('todos')
    const [agentes, setAgentes] = useState([])
    const [selectedPago, setSelectedPago] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [showMassDeleteConfirm, setShowMassDeleteConfirm] = useState(false)
    const [deleteConfirmText, setDeleteConfirmText] = useState('')

    // Si viene de Citas o Monitor con ?cliente=51903172378
    useEffect(() => {
        const clienteParam = searchParams.get('cliente')
        if (clienteParam) {
            setFiltroCliente(clienteParam)
        }
    }, [searchParams])

    // Cargar lista de agentes
    useEffect(() => {
        fetch('/api/agents', { credentials: 'include' })
            .then(r => r.json())
            .then(data => setAgentes(data || []))
            .catch(err => console.error('Error cargando agentes:', err))
    }, [])

    useEffect(() => {
        cargarPagos()
        // Auto-refresh cada 30 segundos
        const interval = setInterval(cargarPagos, 30000)
        return () => clearInterval(interval)
    }, [filtroCliente, filtroEstado, filtroFecha, filtroAgente, refreshKey])

    const cargarPagos = async () => {
        setLoading(true)
        try {
            const params = {}
            if (filtroCliente) params.cliente = filtroCliente
            if (filtroEstado !== 'todos') params.estado = filtroEstado
            if (filtroFecha.desde) params.desde = filtroFecha.desde
            if (filtroFecha.hasta) params.hasta = filtroFecha.hasta
            if (filtroAgente && filtroAgente !== 'todos') params.agentId = filtroAgente

            console.log('[Pagos] Cargando con params:', params)

            const data = await paymentsApi.list(params)

            console.log('[Pagos] Pagos recibidos:', data.length)
            if (data.length > 0) {
                console.log('[Pagos] Primer pago:', data[0])
            }

            setPagos(data || [])
        } catch (error) {
            console.error('Error cargando pagos:', error)
            setPagos([])
            alert('Error cargando pagos: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerDetalle = (pago) => {
        console.log('[Pagos] Viendo detalle:', pago.id)
        setSelectedPago(pago)
        setShowModal(true)
    }

    const handleConfirmar = async (pagoId) => {
        try {
            console.log('[Pagos] Confirmando pago:', pagoId)
            await paymentsApi.confirmar(pagoId, { asesorId: 'admin' })
            setRefreshKey(prev => prev + 1)
            setShowModal(false)
            alert('Pago confirmado')
        } catch (error) {
            console.error('Error confirmando pago:', error)
            alert('Error al confirmar pago: ' + error.message)
        }
    }

    const handleRechazar = async (pagoId, motivo) => {
        try {
            console.log('[Pagos] Rechazando pago:', pagoId, motivo)
            await paymentsApi.rechazar(pagoId, { asesorId: 'admin', motivo })
            setRefreshKey(prev => prev + 1)
            setShowModal(false)
            alert('Pago rechazado')
        } catch (error) {
            console.error('Error rechazando pago:', error)
            alert('Error al rechazar pago: ' + error.message)
        }
    }

    // ELIMINAR PAGO INDIVIDUAL
    const handleEliminarPago = async (pagoId, monto) => {
        // Doble confirmación con énfasis en información financiera
        const primeraConfirmacion = confirm(
            `⚠️ ELIMINACIÓN DE PAGO ⚠️\n\n` +
            `¿Estás SEGURO de eliminar este pago de S/ ${monto?.toFixed(2) || '0.00'}?\n\n` +
            `Esta acción eliminará permanentemente el registro financiero.`
        )
        
        if (!primeraConfirmacion) return
        
        const segundaConfirmacion = confirm(
            `🚨 ÚLTIMA ADVERTENCIA - INFORMACIÓN FINANCIERA 🚨\n\n` +
            `Estás a punto de ELIMINAR PERMANENTEMENTE un registro de pago.\n\n` +
            `❌ Esta acción NO SE PUEDE DESHACER\n` +
            `❌ Se perderá toda la información financiera\n` +
            `❌ No habrá forma de recuperar los datos\n\n` +
            `¿Confirmas que deseas ELIMINAR este pago de forma IRREVERSIBLE?`
        )
        
        if (!segundaConfirmacion) return
        
        try {
            console.log('[Pagos] Eliminando pago:', pagoId)
            await paymentsApi.delete(pagoId)
            setRefreshKey(prev => prev + 1)
            alert('✅ Pago eliminado correctamente')
        } catch (error) {
            console.error('Error eliminando pago:', error)
            alert('❌ Error al eliminar pago: ' + error.message)
        }
    }

    // SELECCIÓN MÚLTIPLE
    const toggleSeleccion = (pagoId) => {
        const nuevosSeleccionados = new Set(selectedIds)
        if (nuevosSeleccionados.has(pagoId)) {
            nuevosSeleccionados.delete(pagoId)
        } else {
            nuevosSeleccionados.add(pagoId)
        }
        setSelectedIds(nuevosSeleccionados)
    }

    const toggleSeleccionTodos = () => {
        if (selectedIds.size === pagos.length) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(pagos.map(p => p.id)))
        }
    }

    const limpiarSeleccion = () => {
        setSelectedIds(new Set())
    }

    // ELIMINACIÓN MASIVA
    const handleEliminarMasivo = () => {
        if (selectedIds.size === 0) {
            alert('⚠️ Selecciona al menos un pago para eliminar')
            return
        }
        setShowMassDeleteConfirm(true)
    }

    const confirmarEliminacionMasiva = async () => {
        // Verificar texto de confirmación
        if (deleteConfirmText !== 'ELIMINAR PERMANENTEMENTE') {
            alert('⚠️ Escribe "ELIMINAR PERMANENTEMENTE" para confirmar')
            return
        }
        
        try {
            console.log('[Pagos] Eliminando masivamente:', Array.from(selectedIds))
            await Promise.all(
                Array.from(selectedIds).map(id => paymentsApi.delete(id))
            )
            setRefreshKey(prev => prev + 1)
            setSelectedIds(new Set())
            setShowMassDeleteConfirm(false)
            setDeleteConfirmText('')
            alert(`✅ Se eliminaron ${selectedIds.size} pago(s) permanentemente`)
        } catch (error) {
            console.error('Error en eliminación masiva:', error)
            alert('❌ Error al eliminar pagos: ' + error.message)
        }
    }

    // Estadísticas rápidas
    const totalPagos = pagos.length
    const totalConfirmados = pagos.filter(p => p.estado === 'confirmado').length
    const totalPendientes = pagos.filter(p =>
        p.estado === 'pendiente_confirmacion_asesor' ||
        p.estado === 'no_legible' ||
        p.estado === 'pendiente_ocr'
    ).length
    const totalRechazados = pagos.filter(p => p.estado === 'rechazado').length
    const montoTotal = pagos
        .filter(p => p.estado === 'confirmado')
        .reduce((sum, p) => sum + (p.montoPagado || 0), 0)

    const formatDate = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        return date.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        })
    }

    const formatTime = (timeString) => {
        if (!timeString) return ''
        return timeString
    }

    // Formatear número de teléfono (limpiar @lid, @s.whatsapp.net, etc.)
    const formatPhone = (phone) => {
        if (!phone) return 'Sin teléfono'
        
        // Remover sufijos de Baileys
        let clean = phone
            .replace('@lid', '')
            .replace('@s.whatsapp.net', '')
            .replace('@c.us', '')
            .replace('@g.us', '')
        
        // Remover caracteres no numéricos
        clean = clean.replace(/\D/g, '')
        
        // Si el número es muy largo (>15 dígitos), es un ID interno, no un teléfono
        if (clean.length > 15) {
            return `ID: ${clean.slice(0, 8)}...`
        }
        
        // Si tiene más de 10 dígitos, probablemente tiene código de país
        if (clean.length > 10 && clean.length <= 15) {
            // Intentar extraer número peruano (código 51)
            if (clean.startsWith('51') && clean.length === 12) {
                return `+51 ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`
            }
            // Otros códigos de país comunes
            if (clean.length >= 12) {
                return `+${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 8)} ${clean.slice(8)}`
            }
            // Si no coincide, mostrar con + al inicio
            return `+${clean}`
        }
        
        // Formato local (asumiendo Perú, 9 dígitos)
        if (clean.length === 9) {
            return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6)}`
        }
        
        // Si no coincide con ningún formato, devolver limpio
        return clean
    }

    // Obtener teléfono limpio para enlaces de WhatsApp
    const getCleanPhone = (phone) => {
        if (!phone) return ''
        
        let clean = phone
            .replace('@lid', '')
            .replace('@s.whatsapp.net', '')
            .replace('@c.us', '')
            .replace('@g.us', '')
            .replace(/\D/g, '')
        
        // Si es un ID muy largo, no crear enlace
        if (clean.length > 15) return ''
        
        return clean
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <DollarSign className="w-8 h-8 text-success" />
                    Gestión de Pagos
                </h1>
                <div className="text-sm opacity-70">
                    {totalPagos} pago(s) registrado(s)
                </div>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="card bg-base-200">
                    <div className="card-body p-4">
                        <h3 className="text-sm text-gray-500">Total Pagos</h3>
                        <p className="text-2xl font-bold">{totalPagos}</p>
                    </div>
                </div>
                <div className="card bg-base-200">
                    <div className="card-body p-4">
                        <h3 className="text-sm text-gray-500">Confirmados</h3>
                        <p className="text-2xl font-bold text-success">{totalConfirmados}</p>
                    </div>
                </div>
                <div className="card bg-base-200">
                    <div className="card-body p-4">
                        <h3 className="text-sm text-gray-500">Pendientes</h3>
                        <p className="text-2xl font-bold text-warning">{totalPendientes}</p>
                    </div>
                </div>
                <div className="card bg-base-200">
                    <div className="card-body p-4">
                        <h3 className="text-sm text-gray-500">Monto Total</h3>
                        <p className="text-2xl font-bold text-primary">S/ {montoTotal.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="card bg-base-200">
                <div className="card-body p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter className="w-5 h-5 opacity-50" />
                        <span className="font-semibold">Filtros</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="label">
                                <span className="label-text">Cliente (teléfono)</span>
                            </label>
                            <input
                                type="text"
                                className="input input-bordered w-full"
                                placeholder="51903172378"
                                value={filtroCliente}
                                onChange={(e) => setFiltroCliente(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">
                                <span className="label-text">Agente</span>
                            </label>
                            <select
                                className="select select-bordered w-full"
                                value={filtroAgente}
                                onChange={(e) => setFiltroAgente(e.target.value)}
                            >
                                <option value="todos">Todos los agentes</option>
                                {agentes.map((agente) => (
                                    <option key={agente.id} value={agente.id}>
                                        {agente.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">
                                <span className="label-text">Estado</span>
                            </label>
                            <select
                                className="select select-bordered w-full"
                                value={filtroEstado}
                                onChange={(e) => setFiltroEstado(e.target.value)}
                            >
                                <option value="todos">Todos</option>
                                <option value="confirmado">Confirmados</option>
                                <option value="pendiente_confirmacion_asesor">Pendientes</option>
                                <option value="no_legible">No legibles</option>
                                <option value="rechazado">Rechazados</option>
                                <option value="error_tecnico">Error técnico</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">
                                <span className="label-text">Desde</span>
                            </label>
                            <input
                                type="date"
                                className="input input-bordered w-full"
                                value={filtroFecha.desde}
                                onChange={(e) => setFiltroFecha({...filtroFecha, desde: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="label">
                                <span className="label-text">Hasta</span>
                            </label>
                            <input
                                type="date"
                                className="input input-bordered w-full"
                                value={filtroFecha.hasta}
                                onChange={(e) => setFiltroFecha({...filtroFecha, hasta: e.target.value})}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 mt-4 justify-between items-center">
                        <div className="flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={() => setRefreshKey(prev => prev + 1)}>
                                <RefreshCw className="w-4 h-4" />
                                Refrescar
                            </button>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                    setFiltroCliente('')
                                    setFiltroEstado('todos')
                                    setFiltroFecha({ desde: '', hasta: '' })
                                    setFiltroAgente('todos')
                                    limpiarSeleccion()
                                }}
                            >
                                <X className="w-4 h-4" />
                                Limpiar
                            </button>
                        </div>
                        {selectedIds.size > 0 && (
                            <div className="flex gap-2 items-center">
                                <span className="text-sm font-bold text-warning">
                                    {selectedIds.size} pago(s) seleccionado(s)
                                </span>
                                <button className="btn btn-ghost btn-sm text-error" onClick={limpiarSeleccion}>
                                    <X className="w-4 h-4" />
                                    Deseleccionar
                                </button>
                                <button className="btn btn-error btn-sm" onClick={handleEliminarMasivo}>
                                    <Trash2 className="w-4 h-4" />
                                    Eliminar ({selectedIds.size})
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabla de pagos */}
            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th className="w-12">
                                <label className="cursor-pointer flex items-center justify-center" onClick={toggleSeleccionTodos}>
                                    {selectedIds.size === pagos.length && pagos.length > 0 ? (
                                        <CheckSquare className="w-5 h-5 text-primary" />
                                    ) : (
                                        <Square className="w-5 h-5" />
                                    )}
                                </label>
                            </th>
                            <th>Fecha</th>
                            <th>Cliente</th>
                            <th>Teléfono</th>
                            <th>Servicio</th>
                            <th>Monto</th>
                            <th>% Pago</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="9" className="text-center">
                                    <span className="loading loading-spinner"></span>
                                </td>
                            </tr>
                        ) : pagos.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="text-center text-gray-500 py-8">
                                    <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>No se encontraron pagos</p>
                                    <p className="text-sm">Los pagos aparecerán aquí cuando los clientes envíen comprobantes</p>
                                </td>
                            </tr>
                        ) : (
                            pagos.map((pago, index) => (
                                <tr key={pago.id || index} className={`hover:bg-base-200 ${selectedIds.has(pago.id) ? 'bg-warning/20' : ''}`}>
                                    <td className="text-center">
                                        <label className="cursor-pointer flex items-center justify-center" onClick={(e) => { e.stopPropagation(); toggleSeleccion(pago.id); }}>
                                            {selectedIds.has(pago.id) ? (
                                                <CheckSquare className="w-5 h-5 text-primary" />
                                            ) : (
                                                <Square className="w-5 h-5" />
                                            )}
                                        </label>
                                    </td>
                                    <td>
                                        <div className="font-medium">{formatDate(pago.fechaPago)}</div>
                                        <div className="text-xs text-gray-500">{formatTime(pago.horaPago)}</div>
                                    </td>
                                    <td>
                                        <div className="font-medium">{pago.nombreCliente || 'Sin nombre'}</div>
                                        {pago.email && (
                                            <div className="text-xs text-gray-500">{pago.email}</div>
                                        )}
                                    </td>
                                    <td>
                                        {(() => {
                                            const cleanPhone = getCleanPhone(pago.cliente)
                                            const formattedPhone = formatPhone(pago.cliente)
                                            
                                            // Si es un ID largo, no mostrar enlace
                                            if (!cleanPhone) {
                                                return (
                                                    <span className="text-sm text-gray-500">
                                                        {formattedPhone}
                                                    </span>
                                                )
                                            }
                                            
                                            // Si es un número válido, mostrar enlace
                                            return (
                                                <a
                                                    href={`https://wa.me/${cleanPhone}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="link link-primary text-sm hover:underline"
                                                >
                                                    {formattedPhone}
                                                </a>
                                            )
                                        })()}
                                    </td>
                                    <td>{pago.tipoServicio || 'No especificado'}</td>
                                    <td className="font-bold text-primary">
                                        S/ {(pago.montoPagado || pago.monto || 0).toFixed(2)}
                                    </td>
                                    <td>
                                        <div className="badge badge-primary badge-sm">
                                            {pago.porcentajePago || 100}%
                                        </div>
                                    </td>
                                    <td>
                                        {pago.estado === 'confirmado' && (
                                            <span className="badge badge-success gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                Confirmado
                                            </span>
                                        )}
                                        {pago.estado === 'pendiente_confirmacion_asesor' && (
                                            <span className="badge badge-warning gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Pendiente
                                            </span>
                                        )}
                                        {pago.estado === 'no_legible' && (
                                            <span className="badge badge-warning gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                No legible
                                            </span>
                                        )}
                                        {pago.estado === 'rechazado' && (
                                            <span className="badge badge-error gap-1">
                                                <XCircle className="w-3 h-3" />
                                                Rechazado
                                            </span>
                                        )}
                                        {pago.estado === 'error_tecnico' && (
                                            <span className="badge badge-error gap-1">
                                                <XCircle className="w-3 h-3" />
                                                Error
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="flex flex-col gap-1">
                                            <button
                                                className="btn btn-sm btn-outline gap-1"
                                                onClick={() => handleVerDetalle(pago)}
                                            >
                                                <Eye className="w-4 h-4" />
                                                Ver
                                            </button>
                                            <button
                                                className="btn btn-sm btn-error gap-1"
                                                onClick={() => handleEliminarPago(pago.id, pago.montoPagado || pago.monto)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de detalle */}
            {showModal && selectedPago && (
                <PagoModal
                    pago={selectedPago}
                    onClose={() => setShowModal(false)}
                    onConfirmar={handleConfirmar}
                    onRechazar={handleRechazar}
                />
            )}

            {/* Modal de confirmación de eliminación masiva */}
            {showMassDeleteConfirm && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="card bg-base-100 w-full max-w-lg shadow-2xl border-4 border-error">
                        <div className="card-body">
                            <div className="flex items-center gap-3 text-error mb-4">
                                <AlertCircle className="w-10 h-10" />
                                <h2 className="text-2xl font-bold">🚨 ELIMINACIÓN MASIVA DE PAGOS</h2>
                            </div>

                            <div className="bg-error/10 p-4 rounded-lg border border-error">
                                <p className="text-lg font-bold text-error mb-2">
                                    ⚠️ INFORMACIÓN FINANCIERA CRÍTICA ⚠️
                                </p>
                                <p className="text-sm">
                                    Estás a punto de eliminar <strong className="text-error">{selectedIds.size} pago(s)</strong> de forma permanente.
                                </p>
                            </div>

                            <div className="my-4 space-y-3">
                                <div className="flex items-start gap-2 text-error">
                                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm">Esta acción <strong>NO SE PUEDE DESHACER</strong></p>
                                </div>
                                <div className="flex items-start gap-2 text-error">
                                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm">Se perderá <strong>toda la información financiera</strong> permanentemente</p>
                                </div>
                                <div className="flex items-start gap-2 text-error">
                                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm">No habrá forma de <strong>recuperar los datos eliminados</strong></p>
                                </div>
                                <div className="flex items-start gap-2 text-error">
                                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm">Esto puede afectar reportes y auditorías futuras</p>
                                </div>
                            </div>

                            <div className="form-control my-4">
                                <label className="label">
                                    <span className="label-text font-bold">
                                        Para confirmar, escribe exactamente:
                                    </span>
                                </label>
                                <div className="bg-base-200 p-2 rounded text-center font-mono text-error font-bold select-all">
                                    ELIMINAR PERMANENTEMENTE
                                </div>
                                <input
                                    type="text"
                                    className="input input-bordered input-error w-full mt-2 font-bold"
                                    placeholder="Escribe la frase de confirmación"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="card-actions justify-end gap-2 mt-4">
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => {
                                        setShowMassDeleteConfirm(false)
                                        setDeleteConfirmText('')
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="btn btn-error"
                                    onClick={confirmarEliminacionMasiva}
                                    disabled={deleteConfirmText !== 'ELIMINAR PERMANENTEMENTE'}
                                >
                                    <Trash2 className="w-5 h-5" />
                                    SÍ, ELIMINAR PERMANENTEMENTE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
