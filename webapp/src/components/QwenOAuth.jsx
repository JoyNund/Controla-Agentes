import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Link, Settings, RefreshCw, LogOut, Sparkles } from 'lucide-react'

/**
 * Componente de Autenticación Qwen OAuth
 * Muestra el estado de la conexión con Qwen y permite gestionar la autenticación
 */
export default function QwenOAuth({ onAuthChange }) {
    const [status, setStatus] = useState(null)
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState(false)

    // Verificar estado al montar
    useEffect(() => {
        checkStatus()
    }, [])

    const checkStatus = async () => {
        setChecking(true)
        try {
            const res = await fetch('/api/qwen/auth/status', {
                credentials: 'include'
            })
            const data = await res.json()
            setStatus(data)
            onAuthChange?.(data)
        } catch (err) {
            console.error('Error checking Qwen status:', err)
            setStatus({
                success: false,
                connected: false,
                error: 'No se pudo verificar el estado'
            })
        } finally {
            setChecking(false)
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div style={{
                padding: '1.5rem',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                background: 'var(--bg-secondary)',
                textAlign: 'center'
            }}>
                <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--accent)', margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Verificando Qwen...</p>
            </div>
        )
    }

    return (
        <div style={{
            padding: '1.5rem',
            border: `2px solid ${status?.connected ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: '12px',
            background: status?.connected 
                ? 'rgba(34,197,94,0.05)' 
                : 'rgba(239,68,68,0.05)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '1.5rem',
                paddingBottom: '1rem',
                borderBottom: '1px solid var(--border)'
            }}>
                <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: status?.connected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {status?.connected ? (
                        <CheckCircle className="w-6 h-6" style={{ color: '#22c55e' }} />
                    ) : (
                        <AlertCircle className="w-6 h-6" style={{ color: '#ef4444' }} />
                    )}
                </div>
                <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                        Qwen OAuth
                    </h4>
                    <p style={{ 
                        margin: '4px 0 0 0', 
                        fontSize: '13px',
                        color: status?.connected ? '#22c55e' : '#ef4444'
                    }}>
                        {status?.connected ? 'Conectado' : 'No conectado'}
                    </p>
                </div>
            </div>

            {status?.connected ? (
                // ✅ ESTADO: CONECTADO
                <div>
                    {/* Token Info */}
                    <div style={{
                        padding: '1rem',
                        background: 'rgba(34,197,94,0.1)',
                        border: '1px solid rgba(34,197,94,0.3)',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Sparkles className="w-5 h-5" style={{ color: '#22c55e' }} />
                            <strong style={{ color: '#22c55e' }}>Token Activo</strong>
                        </div>
                        <div style={{ fontSize: '14px', color: 'var(--text)' }}>
                            {status.message || `Válido por ${status.expiresInFormatted}`}
                        </div>
                        {status.expiresIn && status.expiresIn < 300 && (
                            <div style={{ 
                                marginTop: '8px', 
                                fontSize: '12px', 
                                color: '#f59e0b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <AlertCircle className="w-4 h-4" />
                                Token por expirar pronto
                            </div>
                        )}
                    </div>

                    {/* Modelo Actual */}
                    <div style={{
                        padding: '1rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <Settings className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                            <strong>Modelo Configurado</strong>
                        </div>
                        <div style={{ 
                            fontSize: '20px', 
                            fontWeight: 'bold',
                            color: 'var(--accent)',
                            fontFamily: 'monospace'
                        }}>
                            {status.model || 'coder-model'}
                        </div>
                        <p style={{ 
                            fontSize: '12px', 
                            marginTop: '8px', 
                            color: 'var(--text-muted)',
                            lineHeight: '1.5'
                        }}>
                            💡 Para cambiar el modelo, ejecuta en terminal:<br/>
                            <code style={{ 
                                display: 'inline-block',
                                background: 'rgba(0,0,0,0.2)', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                marginTop: '4px',
                                fontFamily: 'monospace',
                                fontSize: '11px'
                            }}>qwen /model</code>
                        </p>
                    </div>

                    {/* Acciones */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            className="btn"
                            onClick={checkStatus}
                            disabled={checking}
                            style={{ flex: 1, fontSize: '13px' }}
                        >
                            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                            {checking ? 'Verificando...' : 'Actualizar'}
                        </button>
                        <button
                            className="btn"
                            onClick={() => {
                                alert('Para desvincular Qwen:\n\n1. Abre una terminal\n2. Ejecuta: rm ~/.qwen/oauth_creds.json\n3. Vuelve a esta página y haz click en "Actualizar"')
                            }}
                            style={{ flex: 1, fontSize: '13px', background: '#ef4444', color: '#fff' }}
                        >
                            <LogOut className="w-4 h-4" />
                            Desvincular
                        </button>
                    </div>
                </div>
            ) : (
                // ❌ ESTADO: NO CONECTADO
                <div>
                    {/* Mensaje de Error */}
                    {status?.error && (
                        <div style={{
                            padding: '1rem',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
                                <AlertCircle className="w-5 h-5" />
                                <strong>{status.error}</strong>
                            </div>
                            {status.installCommand && (
                                <pre style={{
                                    margin: '8px 0 0 0',
                                    padding: '8px',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    overflow: 'auto',
                                    color: '#fca5a5'
                                }}>
                                    {status.installCommand}
                                </pre>
                            )}
                        </div>
                    )}

                    {/* Instrucciones */}
                    <div style={{
                        padding: '1rem',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '8px',
                        marginBottom: '1rem'
                    }}>
                        <h5 style={{ margin: '0 0 1rem 0', fontSize: '14px', fontWeight: '600' }}>
                            ¿Cómo conectar con Qwen?
                        </h5>
                        <ol style={{ 
                            margin: 0, 
                            paddingLeft: '1.25rem',
                            fontSize: '13px',
                            lineHeight: '1.8',
                            color: 'var(--text)'
                        }}>
                            <li>
                                <strong>Verifica que Qwen CLI esté instalado</strong>
                                <br/>
                                <code style={{ 
                                    display: 'block',
                                    background: 'rgba(0,0,0,0.2)', 
                                    padding: '6px', 
                                    marginTop: '4px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace'
                                }}>qwen --version</code>
                            </li>
                            <li style={{ marginTop: '0.75rem' }}>
                                <strong>Abre la página de autorización</strong>
                                <br/>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    Se abrirá en una nueva ventana
                                </span>
                            </li>
                            <li style={{ marginTop: '0.75rem' }}>
                                <strong>Inicia sesión y autoriza</strong>
                                <br/>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    Usa tu cuenta de Qwen
                                </span>
                            </li>
                            <li style={{ marginTop: '0.75rem' }}>
                                <strong>Vuelve aquí y verifica</strong>
                                <br/>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                    Click en "Verificar Estado"
                                </span>
                            </li>
                        </ol>
                    </div>

                    {/* Botón de Autorizar */}
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            // Abrir página de Qwen para autorizar
                            window.open('https://chat.qwen.ai', '_blank')
                            // Enfocar la ventana
                            setTimeout(() => {
                                alert('✅ Después de autorizar en Qwen, haz click en "Verificar Estado"')
                            }, 500)
                        }}
                        style={{ width: '100%', marginBottom: '8px' }}
                    >
                        <Link className="w-4 h-4" />
                        Abrir Qwen para Autorizar
                    </button>

                    {/* Botón Verificar */}
                    <button
                        className="btn"
                        onClick={checkStatus}
                        disabled={checking}
                        style={{ width: '100%' }}
                    >
                        <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                        {checking ? 'Verificando...' : 'Verificar Estado'}
                    </button>

                    {/* Nota */}
                    <p style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        marginTop: '1rem'
                    }}>
                        🔒 La autenticación se guarda localmente en el servidor
                    </p>
                </div>
            )}
        </div>
    )
}
