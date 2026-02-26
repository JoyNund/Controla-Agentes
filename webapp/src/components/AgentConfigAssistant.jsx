import React, { useState } from 'react'
import { agentsApi } from '../api'
import { X, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react'
import LogoIcon from '../assets/logo-icon.svg'

// Configuración de preguntas por tipo
const CONFIGURACION_PREGUNTAS = {
    personalidad: {
        titulo: 'Personalidad y Contexto',
        icono: '🤖',
        preguntas: [
            {
                clave: 'marca',
                label: '¿Cuál es el nombre de tu marca o empresa?',
                placeholder: 'Ej: Controla Digital',
                required: true
            },
            {
                clave: 'rubro',
                label: '¿A qué se dedica tu negocio?',
                placeholder: 'Ej: Desarrollo de páginas web y marketing digital',
                required: true
            },
            {
                clave: 'tono',
                label: '¿Qué tono debe tener tu agente?',
                placeholder: 'Ej: Profesional pero cercano, amigable, formal...',
                required: true,
                tipo: 'select',
                opciones: ['Formal', 'Profesional', 'Amigable', 'Cercano', 'Entusiasta']
            },
            {
                clave: 'extra',
                label: '¿Hay algo específico que deba saber sobre tu empresa?',
                placeholder: 'Ej: Misión, valores, años de experiencia, especialidad...',
                required: false,
                tipo: 'textarea'
            }
        ]
    },
    base_conocimiento: {
        titulo: 'Base de Conocimiento',
        icono: '📚',
        preguntas: [
            {
                clave: 'productos',
                label: '¿Cuáles son tus principales productos o servicios?',
                placeholder: 'Ej: Páginas web, tiendas online, branding, gestión de redes sociales...',
                required: true,
                tipo: 'textarea'
            },
            {
                clave: 'precios',
                label: '¿Tienes información de precios que deba conocer?',
                placeholder: 'Ej: Páginas web desde S/200, tiendas online desde S/500, o "No manejo precios públicos"',
                required: false,
                tipo: 'textarea'
            },
            {
                clave: 'contacto',
                label: '¿Cuáles son tus datos de contacto?',
                placeholder: 'Ej: Teléfono: 999-888-777, Email: hola@empresa.com, Dirección: Av. Principal 123',
                required: false
            },
            {
                clave: 'web',
                label: '¿Tienes sitio web o redes sociales?',
                placeholder: 'Ej: Web: www.empresa.com, Facebook: /empresa, Instagram: @empresa',
                required: false
            },
            {
                clave: 'pagos',
                label: '💳 ¿Cuáles son tus métodos de pago aceptados?',
                placeholder: 'Ej: Yape, Plin, transferencia BCP, Interbank, link de pago MercadoPago, contraentrega...',
                required: false,
                tipo: 'textarea'
            },
            {
                clave: 'politicas',
                label: '¿Hay alguna política importante?',
                placeholder: 'Ej: Envíos gratis en Lima, garantía de 30 días, devoluciones solo sin usar...',
                required: false,
                tipo: 'textarea'
            }
        ]
    },
    saludo: {
        titulo: 'Saludo Inicial',
        icono: '👋',
        preguntas: [
            {
                clave: 'nombre_agente',
                label: '¿Cómo se llama tu agente?',
                placeholder: 'Ej: CONTROLA AI, Ana, Carlos...',
                required: false
            },
            {
                clave: 'estilo',
                label: '¿Cómo quieres que salude?',
                placeholder: 'Ej: Que se presente primero, que ofrezca ayuda inmediatamente...',
                required: true,
                tipo: 'select',
                opciones: [
                    'Presentación + oferta de ayuda',
                    'Solo presentación',
                    'Solo oferta de ayuda',
                    'Saludo casual'
                ]
            }
        ]
    },
    objeciones: {
        titulo: 'Manejo de Objeciones',
        icono: '🛡️',
        preguntas: [
            {
                clave: 'objeciones',
                label: '¿Cuáles son las objeciones más comunes que recibes?',
                placeholder: 'Ej: "Es muy caro", "Lo pienso", "Tengo que consultarlo"...',
                required: true,
                tipo: 'textarea'
            },
            {
                clave: 'promociones',
                label: '¿Tienes alguna promoción o descuento para mencionar?',
                placeholder: 'Ej: 10% de descuento por pago anticipado, 2x1 en el segundo producto...',
                required: false
            },
            {
                clave: 'argumentos',
                label: '¿Cuál es el mejor argumento de venta de tu producto/servicio?',
                placeholder: 'Ej: Calidad garantizada, entrega rápida, soporte 24/7, precios competitivos...',
                required: true,
                tipo: 'textarea'
            }
        ]
    }
}

export default function AgentConfigAssistant({ tipo, onClose, onCompletado }) {
    const [paso, setPaso] = useState(0) // 0 = intro, 1-N = preguntas, N+1 = generando
    const [respuestas, setRespuestas] = useState({})
    const [generando, setGenerando] = useState(false)
    const [error, setError] = useState(null)

    const config = CONFIGURACION_PREGUNTAS[tipo]
    
    // Debug: verificar si el tipo es válido
    if (!config) {
        console.error('[AgentConfigAssistant] Tipo no válido:', tipo)
        console.error('[AgentConfigAssistant] Tipos válidos:', Object.keys(CONFIGURACION_PREGUNTAS))
        return null
    }

    const totalPasos = config.preguntas.length

    const handleSiguiente = () => {
        console.log('[AgentConfigAssistant] handleSiguiente llamado, paso:', paso, 'totalPasos:', totalPasos, 'generando:', generando)

        // No hacer nada si está generando
        if (generando) {
            console.log('[AgentConfigAssistant] Ignorando click, está generando...')
            return
        }

        // Pantalla de introducción (paso 0) - simplemente avanzar
        if (paso === 0) {
            setPaso(1)
            return
        }

        // Pantalla de generación/error (paso > totalPasos) - reintentar
        if (paso > totalPasos) {
            generarConfig()
            return
        }

        // Pantallas de preguntas (1 a totalPasos)
        // La pregunta actual está en el índice paso-1 (porque las preguntas están indexadas desde 0)
        const preguntaActual = config.preguntas[paso - 1]

        // Si estamos en la última pregunta, generar configuración
        if (paso === totalPasos) {
            // Verificar si la última pregunta es requerida y tiene respuesta
            if (preguntaActual?.required && !respuestas[preguntaActual.clave]) {
                console.warn('[AgentConfigAssistant] Pregunta requerida sin respuesta:', preguntaActual.clave)
                return
            }
            generarConfig()
        } else {
            // Verificar si la pregunta actual es requerida y tiene respuesta antes de avanzar
            if (preguntaActual?.required && !respuestas[preguntaActual.clave]) {
                console.warn('[AgentConfigAssistant] Pregunta requerida sin respuesta:', preguntaActual.clave)
                return
            }
            setPaso(paso + 1)
        }
    }

    const handleAtras = () => {
        if (paso > 0) {
            setPaso(paso - 1)
        } else {
            onClose()
        }
    }

    const handleRespuesta = (clave, valor) => {
        setRespuestas(prev => ({ ...prev, [clave]: valor }))
    }

    const generarConfig = async () => {
        console.log('[AgentConfigAssistant] === INICIO generarConfig ===')
        console.log('[AgentConfigAssistant] Tipo:', tipo)
        console.log('[AgentConfigAssistant] Respuestas:', respuestas)
        console.log('[AgentConfigAssistant] paso:', paso, 'totalPasos:', totalPasos)

        setGenerando(true)
        setError(null)
        setPaso(totalPasos + 1) // Pantalla de carga
        console.log('[AgentConfigAssistant] Estado cambiado a pantalla de carga, paso:', totalPasos + 1)

        try {
            console.log('[AgentConfigAssistant] Llamando a agentsApi.generateConfig...')
            const resultado = await agentsApi.generateConfig(tipo, respuestas)
            console.log('[AgentConfigAssistant] Respuesta de API:', resultado)

            if (!resultado?.texto_generado) {
                console.error('[AgentConfigAssistant] La IA no generó texto válido')
                throw new Error('La IA no generó un texto válido')
            }

            console.log('[AgentConfigAssistant] Llamando a onCompletado con:', resultado.texto_generado)
            onCompletado(resultado.texto_generado)
            console.log('[AgentConfigAssistant] onCompletado ejecutado')
        } catch (err) {
            console.error('[AgentConfigAssistant] Error en generarConfig:', err)
            // Mantenerse en pantalla de error (paso > totalPasos)
            // Solo establecemos el error, no cambiamos el paso
            setError(err.message || 'Error al generar la configuración')
            // Forzar re-render manteniendo el paso actual
            setPaso(prev => prev) 
        } finally {
            setGenerando(false)
            console.log('[AgentConfigAssistant] === FIN generarConfig ===')
        }
    }

    const preguntaActual = config.preguntas[paso - 1]
    const progreso = ((paso) / (totalPasos + 1)) * 100

    // Pantalla de introducción
    if (paso === 0) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000
            }} onClick={onClose}>
                <div style={{
                    background: 'var(--bg-primary)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    maxWidth: '500px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    border: '1px solid var(--border)'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            <img src={LogoIcon} alt="Logo" style={{ width: '80px', height: '80px' }} />
                        </div>
                        <h2 style={{ marginBottom: '0.5rem' }}>Asistente de Configuración</h2>
                        <p className="muted" style={{ marginBottom: '1.5rem' }}>
                            Voy a ayudarte a configurar tu agente haciéndote algunas preguntas simples.
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                            <button className="btn btn-primary" onClick={handleSiguiente}>
                                Comenzar →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Pantalla de carga/error
    if (paso > totalPasos) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100000
            }} onClick={onClose}>
                <div style={{
                    background: 'var(--bg-primary)',
                    borderRadius: '12px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    maxWidth: '500px',
                    width: '90%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    border: '1px solid var(--border)'
                }} onClick={e => e.stopPropagation()}>
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }}>
                            {error ? (
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '50%',
                                    background: '#ef4444',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '40px',
                                    color: 'white'
                                }}>!</div>
                            ) : (
                                <img src={LogoIcon} alt="Logo" className="w-16 h-16 mx-auto mb-4 animate-pulse" style={{ width: '80px', height: '80px' }} />
                            )}
                        </div>
                        <h2 style={{ marginBottom: '0.5rem' }}>
                            {error ? 'Error al generar' : 'Generando configuración...'}
                        </h2>
                        <p className="muted" style={{ 
                            color: error ? '#ef4444' : 'var(--text-secondary)',
                            marginBottom: '1.5rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}>
                            {error ? error : 'Redactando texto profesional con IA...'}
                        </p>
                        {error && (
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button className="btn btn-ghost" onClick={onClose}>
                                    Cancelar
                                </button>
                                <button className="btn btn-primary" onClick={handleSiguiente}>
                                    Intentar de nuevo
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Pantalla de pregunta
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-primary)',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid var(--border)'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img src={LogoIcon} alt="Logo" style={{ width: '32px', height: '32px', flexShrink: 0 }} />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{config.titulo}</h3>
                            <small className="muted">Paso {paso} de {totalPasos}</small>
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-circle" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Barra de progreso */}
                <div style={{ height: '4px', background: 'var(--bg-secondary)', width: '100%' }}>
                    <div 
                        style={{ 
                            height: '100%', 
                            width: `${progreso}%`, 
                            background: 'var(--accent)',
                            transition: 'width 0.3s'
                        }}
                    />
                </div>

                {/* Contenido */}
                <div style={{ padding: '1.5rem' }}>
                    {preguntaActual && (
                        <>
                            <label className="label" style={{ marginBottom: '0.5rem' }}>
                                {preguntaActual.label}
                                {preguntaActual.required && <span style={{ color: 'var(--error)' }}>*</span>}
                            </label>
                            
                            {preguntaActual.tipo === 'textarea' ? (
                                <textarea
                                    className="input"
                                    rows={4}
                                    value={respuestas[preguntaActual.clave] || ''}
                                    onChange={e => handleRespuesta(preguntaActual.clave, e.target.value)}
                                    placeholder={preguntaActual.placeholder}
                                    style={{ 
                                        width: '100%', 
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        resize: 'vertical'
                                    }}
                                />
                            ) : preguntaActual.tipo === 'select' ? (
                                <select
                                    className="input"
                                    value={respuestas[preguntaActual.clave] || ''}
                                    onChange={e => handleRespuesta(preguntaActual.clave, e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    <option value="">Seleccionar...</option>
                                    {preguntaActual.opciones.map(op => (
                                        <option key={op} value={op}>{op}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="input"
                                    value={respuestas[preguntaActual.clave] || ''}
                                    onChange={e => handleRespuesta(preguntaActual.clave, e.target.value)}
                                    placeholder={preguntaActual.placeholder}
                                    style={{ 
                                        width: '100%', 
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            )}

                            {/* Tips */}
                            {preguntaActual.placeholder && (
                                <small className="muted" style={{ display: 'block', marginTop: '0.5rem' }}>
                                    💡 Ejemplo: {preguntaActual.placeholder}
                                </small>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <button 
                        className="btn btn-ghost" 
                        onClick={handleAtras}
                        disabled={generando}
                    >
                        <ChevronLeft size={16} style={{ marginRight: '0.25rem' }} />
                        Atrás
                    </button>
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {!preguntaActual?.required && (
                            <button 
                                className="btn btn-ghost" 
                                onClick={handleSiguiente}
                                disabled={generando}
                            >
                                Omitir
                            </button>
                        )}
                        <button 
                            className="btn btn-primary" 
                            onClick={handleSiguiente}
                            disabled={generando || (preguntaActual?.required && !respuestas[preguntaActual.clave])}
                        >
                            {paso === totalPasos ? 'Generar' : 'Siguiente'}
                            {paso < totalPasos && <ChevronRight size={16} style={{ marginLeft: '0.25rem' }} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
