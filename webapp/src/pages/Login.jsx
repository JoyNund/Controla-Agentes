import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../api'

export default function Login() {
    const [email, setEmail] = useState('admin@controla.digital')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()

    const submit = (e) => {
        e.preventDefault()
        setError('')
        auth.login(email, password)
            .then(() => navigate('/'))
            .catch((err) => setError(err.message || 'Error al iniciar sesión'))
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1d21' }}>
            <div className="card" style={{ width: '100%', maxWidth: 380 }}>
                <h1 style={{ marginBottom: '0.5rem', color: '#1f2937' }}>CONTROLA.agentes</h1>
                <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Inicia sesión para acceder</p>
                <form onSubmit={submit}>
                    <div className="form-group">
                        <label className="label">Correo</label>
                        <input
                            type="email"
                            className="input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="label">Contraseña</label>
                        <input
                            type="password"
                            className="input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            required
                        />
                    </div>
                    {error && <p style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</p>}
                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    )
}
