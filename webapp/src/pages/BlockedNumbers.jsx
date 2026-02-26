import { useEffect, useState } from 'react';

export default function BlockedNumbers() {
    const [numbers, setNumbers] = useState([]);
    const [newNumber, setNewNumber] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBlockedNumbers();
    }, []);

    const fetchBlockedNumbers = () => {
        setLoading(true);
        fetch('/api/blocked-numbers', {
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => {
            if (res.status === 401) {
                window.location.href = '/login';
                throw new Error('No autorizado');
            }
            return res.json();
        })
        .then(setNumbers)
        .catch(err => console.error('Error fetching blocked numbers:', err))
        .finally(() => setLoading(false));
    };

    const addNumber = () => {
        if (!newNumber.trim()) return;
        
        fetch('/api/blocked-numbers', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: newNumber.trim() })
        })
        .then(res => {
            if (res.status === 401) {
                window.location.href = '/login';
                throw new Error('No autorizado');
            }
            return res.json();
        })
        .then(() => {
            setNewNumber('');
            fetchBlockedNumbers();
        })
        .catch(err => console.error('Error adding blocked number:', err));
    };

    const removeNumber = (number) => {
        fetch(`/api/blocked-numbers/${encodeURIComponent(number)}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(res => {
            if (res.status === 401) {
                window.location.href = '/login';
                throw new Error('No autorizado');
            }
            return res.json();
        })
        .then(fetchBlockedNumbers)
        .catch(err => console.error('Error removing blocked number:', err));
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <div>Cargando números bloqueados...</div>
            </div>
        );
    }

    return (
        <div>
            <h2>Números Bloqueados</h2>
            <div className="card">
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <input 
                        className="input" 
                        placeholder="Número a bloquear (ej: +51999888777)" 
                        value={newNumber} 
                        onChange={(e) => setNewNumber(e.target.value)} 
                        onKeyPress={(e) => e.key === 'Enter' && addNumber()}
                    />
                    <button className="btn btn-primary" onClick={addNumber}>
                        Bloquear
                    </button>
                </div>
                
                <h3 style={{ marginTop: 0 }}>Números bloqueados ({numbers.length})</h3>
                {numbers.length === 0 ? (
                    <p className="muted">No hay números bloqueados aún</p>
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {numbers.map((number, index) => (
                            <li key={index} style={{ 
                                padding: '0.5rem', 
                                marginBottom: '0.5rem', 
                                background: '#f8f9fa', 
                                borderRadius: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span>{number}</span>
                                <button 
                                    className="btn"
                                    style={{ 
                                        background: '#dc3545', 
                                        color: 'white',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.875rem'
                                    }}
                                    onClick={() => removeNumber(number)}
                                >
                                    Desbloquear
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <p className="muted" style={{ marginTop: '1rem' }}>
                Los números bloqueados no podrán interactuar con el bot. 
                El bot ignorará cualquier mensaje proveniente de estos números.
            </p>
        </div>
    );
}