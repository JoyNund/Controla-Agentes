import React, { useState } from 'react'
import { 
    X, 
    CheckCircle, 
    XCircle, 
    AlertCircle,
    Image,
    Download,
    ZoomIn
} from 'lucide-react'

export default function PagoModal({ pago, onClose, onConfirmar, onRechazar }) {
    const [showRejectForm, setShowRejectForm] = useState(false)
    const [motivoRechazo, setMotivoRechazo] = useState('')
    
    const imagenUrl = pago.imageBase64 || `/api/pagos/${pago.id}/imagen`
    
    const formatDate = (dateString) => {
        if (!dateString) return ''
        const date = new Date(dateString)
        return date.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }
    
    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-5xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        💰 Detalle de Pago
                    </h3>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Columna izquierda: Datos del pago */}
                    <div className="space-y-4">
                        <div className="card bg-base-200">
                            <div className="card-body p-4">
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    📋 Información del Cliente
                                </h4>
                                
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-sm text-gray-500">Cliente:</span>
                                        <p className="font-medium">{pago.nombreCliente || 'Sin nombre'}</p>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-500">Teléfono:</span>
                                        <p className="font-medium">
                                            <a 
                                                href={`https://wa.me/${pago.cliente}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="link link-primary"
                                            >
                                                {pago.cliente}
                                            </a>
                                        </p>
                                    </div>
                                    {pago.email && (
                                        <div>
                                            <span className="text-sm text-gray-500">Email:</span>
                                            <p className="font-medium">{pago.email}</p>
                                        </div>
                                    )}
                                    {pago.connectionId && (
                                        <div>
                                            <span className="text-sm text-gray-500">Conexión:</span>
                                            <p className="font-medium text-xs">{pago.connectionId}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="card bg-base-200">
                            <div className="card-body p-4">
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    💵 Datos del Pago
                                </h4>
                                
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Servicio:</span>
                                        <span className="font-medium">{pago.tipoServicio || 'No especificado'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Monto total:</span>
                                        <span className="font-medium">S/ {pago.monto?.toFixed(2) || '0.00'}</span>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-sm text-gray-500">Porcentaje pagado:</span>
                                            <span className="font-medium">{pago.porcentajePago || 100}%</span>
                                        </div>
                                        <progress 
                                            className="progress progress-primary w-full" 
                                            value={pago.porcentajePago || 100} 
                                            max="100"
                                        ></progress>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Monto pagado:</span>
                                        <span className="font-bold text-success">
                                            S/ {pago.montoPagado?.toFixed(2) || pago.monto?.toFixed(2) || '0.00'}
                                        </span>
                                    </div>
                                    <div className="divider my-2"></div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Fecha de pago:</span>
                                        <span className="font-medium">
                                            {pago.fechaPago} {pago.horaPago}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Tipo:</span>
                                        <span className="font-medium capitalize">{pago.tipoComprobante || 'No especificado'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-500">Estado:</span>
                                        <div>
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
                                        </div>
                                    </div>
                                    {pago.confirmadoPor && (
                                        <div className="bg-success bg-opacity-10 p-3 rounded">
                                            <div className="text-sm text-success">
                                                <CheckCircle className="w-4 h-4 inline mr-1" />
                                                Confirmado por {pago.confirmadoPor}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                {formatDate(pago.confirmadoEn)}
                                            </div>
                                        </div>
                                    )}
                                    {pago.rechazadoPor && (
                                        <div className="bg-error bg-opacity-10 p-3 rounded">
                                            <div className="text-sm text-error">
                                                <XCircle className="w-4 h-4 inline mr-1" />
                                                Rechazado por {pago.rechazadoPor}
                                            </div>
                                            <div className="text-xs text-gray-500 mb-1">
                                                {formatDate(pago.rechazadoEn)}
                                            </div>
                                            <div className="text-xs">
                                                <strong>Motivo:</strong> {pago.motivoRechazo}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Columna derecha: Comprobante y OCR */}
                    <div className="space-y-4">
                        <div className="card bg-base-200">
                            <div className="card-body p-4">
                                <h4 className="font-semibold mb-3 flex items-center gap-2">
                                    📸 Comprobante
                                </h4>
                                
                                <div className="relative">
                                    <img 
                                        src={imagenUrl} 
                                        alt="Comprobante de pago"
                                        className="w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                        onClick={() => window.open(imagenUrl, '_blank')}
                                    />
                                    <div className="absolute top-2 right-2 flex gap-2">
                                        <button 
                                            className="btn btn-sm btn-primary gap-1"
                                            onClick={() => window.open(imagenUrl, '_blank')}
                                        >
                                            <ZoomIn className="w-4 h-4" />
                                            Ver
                                        </button>
                                        <button 
                                            className="btn btn-sm btn-outline gap-1"
                                            onClick={() => {
                                                const link = document.createElement('a')
                                                link.href = imagenUrl
                                                link.download = `comprobante_${pago.id}.jpg`
                                                link.click()
                                            }}
                                        >
                                            <Download className="w-4 h-4" />
                                            Descargar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {pago.ocrData && (
                            <div className="card bg-base-200">
                                <div className="card-body p-4">
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                        🔍 Datos extraídos (OCR)
                                    </h4>
                                    
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-500">Monto:</span>
                                            <span className="font-medium">
                                                S/ {pago.ocrData.monto?.toFixed(2) || 'No detectado'}
                                                {pago.ocrData.monto === (pago.monto || pago.montoPagado) && (
                                                    <CheckCircle className="w-4 h-4 text-success inline ml-1" />
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-500">Banco:</span>
                                            <span className="font-medium">{pago.ocrData.banco || 'No identificado'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-500">Operación:</span>
                                            <span className="font-medium">{pago.ocrData.operacion || 'No identificado'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-500">Fecha:</span>
                                            <span className="font-medium">{pago.ocrData.fecha || 'No identificada'}</span>
                                        </div>
                                        {pago.confianza && (
                                            <div className="flex justify-between">
                                                <span className="text-sm text-gray-500">Confianza OCR:</span>
                                                <span className={`font-bold ${pago.confianza >= 80 ? 'text-success' : 'text-warning'}`}>
                                                    {pago.confianza}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {pago.ocrData.textoCompleto && (
                                        <details className="mt-3">
                                            <summary className="text-xs text-gray-500 cursor-pointer hover:text-primary">
                                                Ver texto completo extraído
                                            </summary>
                                            <div className="text-xs bg-base-300 p-2 rounded mt-2 max-h-32 overflow-y-auto">
                                                {pago.ocrData.textoCompleto}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Acciones */}
                {pago.estado === 'pendiente_confirmacion_asesor' && (
                    <div className="mt-6">
                        <div className="divider"></div>
                        
                        {!showRejectForm ? (
                            <div className="flex gap-2">
                                <button 
                                    className="btn btn-success flex-1 gap-2"
                                    onClick={() => onConfirmar(pago.id)}
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Confirmar Pago
                                </button>
                                <button 
                                    className="btn btn-error flex-1 gap-2"
                                    onClick={() => setShowRejectForm(true)}
                                >
                                    <XCircle className="w-5 h-5" />
                                    Rechazar Pago
                                </button>
                            </div>
                        ) : (
                            <div className="card bg-error bg-opacity-10">
                                <div className="card-body p-4">
                                    <h5 className="font-bold text-error flex items-center gap-2">
                                        <XCircle className="w-5 h-5" />
                                        Motivo del rechazo
                                    </h5>
                                    <textarea
                                        className="textarea textarea-bordered w-full"
                                        placeholder="Especifica el motivo del rechazo (ej: Monto no coincide, comprobante ilegible, etc.)"
                                        value={motivoRechazo}
                                        onChange={(e) => setMotivoRechazo(e.target.value)}
                                        rows="3"
                                    ></textarea>
                                    <div className="flex gap-2 mt-2">
                                        <button 
                                            className="btn btn-error"
                                            onClick={() => onRechazar(pago.id, motivoRechazo)}
                                            disabled={!motivoRechazo.trim()}
                                        >
                                            Confirmar rechazo
                                        </button>
                                        <button 
                                            className="btn btn-ghost"
                                            onClick={() => setShowRejectForm(false)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                {/* Footer */}
                <div className="modal-action">
                    <button className="btn" onClick={onClose}>
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    )
}
