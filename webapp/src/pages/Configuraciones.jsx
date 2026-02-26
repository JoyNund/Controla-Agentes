import { useEffect, useState } from 'react'
import { settingsApi } from '../api'
import { Lock } from 'lucide-react'

export default function Configuraciones() {
    const [s, setS] = useState(null)
    const [masterKeyword, setMasterKeyword] = useState('')
    const [showKeyword, setShowKeyword] = useState(false)
    const [keywordSaved, setKeywordSaved] = useState(false)

    useEffect(() => {
        settingsApi.get().then(setS)
    }, [])

    const update = (patch) => {
        const next = { ...s, ...patch }
        setS(next)
        settingsApi.update(patch)
    }

    const saveMasterKeyword = () => {
        if (!masterKeyword.trim()) {
            alert('La palabra clave no puede estar vacía')
            return
        }
        settingsApi.updateMasterKeyword(masterKeyword)
            .then(() => {
                setKeywordSaved(true)
                setMasterKeyword('')
                setTimeout(() => setKeywordSaved(false), 3000)
            })
            .catch(err => alert('Error al guardar: ' + err.message))
    }

    if (!s) return null

    return (
        <>
            <h2 style={{ marginBottom: '1rem' }}>Configuraciones</h2>
            
            {/* Seguridad - Palabra Clave Maestra */}
            <div className="card">
                <h3 className="flex items-center gap-2">
                    <Lock className="w-5 h-5" /> Seguridad - Palabra Clave Maestra
                </h3>
                <p className="muted" style={{ marginBottom: '1rem' }}>
                    🔒 La palabra clave maestra funciona como respaldo para todas las acciones protegidas.
                    Si un agente o conexión no tiene su propia palabra clave, se usará esta.
                </p>
                
                <div className="form-group">
                    <label className="label">Nueva Palabra Clave Maestra</label>
                    <input
                        type={showKeyword ? 'text' : 'password'}
                        className="input"
                        value={masterKeyword}
                        onChange={(e) => setMasterKeyword(e.target.value)}
                        placeholder="Dejar en blanco para mantener la actual"
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '14px' }}>
                            <input
                                type="checkbox"
                                checked={showKeyword}
                                onChange={(e) => setShowKeyword(e.target.checked)}
                            />
                            Mostrar palabra clave
                        </label>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={saveMasterKeyword}
                        disabled={!masterKeyword.trim()}
                        style={{ marginTop: '1rem' }}
                    >
                        {keywordSaved ? '✅ Guardada' : 'Guardar Palabra Clave Maestra'}
                    </button>
                </div>
            </div>

            <div className="card">
                <h3>Apariencia</h3>
                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={s.darkMode} onChange={(e) => update({ darkMode: e.target.checked })} />
                        Modo oscuro
                    </label>
                </div>
            </div>
            <div className="card">
                <h3>Modelo por defecto</h3>
                <div className="form-group">
                    <label className="label">Motor de IA por defecto para nuevos agentes</label>
                    <select className="input" value={s.defaultModel} onChange={(e) => update({ defaultModel: e.target.value })}>
                        <option value="deepseek">Deepseek</option>
                        <option value="openai">OpenAI</option>
                    </select>
                </div>
            </div>
            <div className="card">
                <h3>Branding</h3>
                <div className="form-group">
                    <label className="label">Título de la app</label>
                    <input className="input" value={s.branding?.appTitle || ''} onChange={(e) => update({ branding: { ...s.branding, appTitle: e.target.value } })} />
                </div>
                <div className="form-group">
                    <label className="label">URL del logotipo</label>
                    <input className="input" value={s.branding?.logoUrl || ''} onChange={(e) => update({ branding: { ...s.branding, logoUrl: e.target.value } })} placeholder="https://..." />
                </div>
                <div className="form-group">
                    <label className="label">Color de acento</label>
                    <input type="color" value={s.branding?.accentColor || '#2563eb'} onChange={(e) => update({ branding: { ...s.branding, accentColor: e.target.value } })} style={{ width: 60, height: 36, padding: 2, border: '1px solid #d1d5db', borderRadius: 8 }} />
                    <span style={{ marginLeft: 8 }}>{s.branding?.accentColor || '#2563eb'}</span>
                </div>
            </div>
        </>
    )
}
