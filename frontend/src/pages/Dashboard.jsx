import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
    const [sessions, setSessions] = useState([])
    const [activeSession, setActiveSession] = useState(null)
    const [gameName, setGameName] = useState('')
    const token = localStorage.getItem('token')
    const username = localStorage.getItem('username')
    const navigate = useNavigate()

    const headers = { Authorization: `Bearer ${token}` }

    useEffect(() => {
        fetchSessions()
    }, [])

    const fetchSessions = async () => {
        const res = await axios.get('http://localhost:3001/api/sessions', { headers })
        setSessions(res.data)
        const active = res.data.find(s => !s.endedAt)
        setActiveSession(active || null)
    }

    const startSession = async () => {
        const res = await axios.post('http://localhost:3001/api/sessions/start', { gameName: gameName || 'Gaming Session' }, { headers })
        setActiveSession(res.data)
        fetchSessions()
    }

    const stopSession = async () => {
        await axios.put(`http://localhost:3001/api/sessions/stop/${activeSession._id}`, {}, { headers })
        setActiveSession(null)
        fetchSessions()
    }

    const logout = () => {
        localStorage.clear()
        navigate('/login')
    }

    const todayMinutes = sessions
        .filter(s => s.endedAt && new Date(s.startedAt).toDateString() === new Date().toDateString())
        .reduce((sum, s) => sum + s.durationMinutes, 0)

    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h1>GoAFK 🎮</h1>
            <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
        <h2>Welcome, {username}!</h2>

        <div style={{ background: '#f0f0f0', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>Today's Gaming Time: {todayMinutes} minutes</h3>
        </div>

        {!activeSession ? (
            <div style={{ marginBottom: '20px' }}>
            <input placeholder="What are you playing?" value={gameName} onChange={e => setGameName(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <button onClick={startSession} style={{ width: '100%', padding: '12px', background: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                Start Session 🎮
            </button>
            </div>
        ) : (
            <div style={{ marginBottom: '20px' }}>
            <p style={{ color: 'green' }}>▶ Currently playing: {activeSession.gameName}</p>
            <button onClick={stopSession} style={{ width: '100%', padding: '12px', background: '#f44336', color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                Stop Session ⏹
            </button>
            </div>
        )}

        <h3>Recent Sessions</h3>
        {sessions.filter(s => s.endedAt).slice(0, 5).map(s => (
            <div key={s._id} style={{ background: '#f9f9f9', padding: '10px', marginBottom: '8px', borderRadius: '4px' }}>
            <strong>{s.gameName}</strong> — {s.durationMinutes} minutes
            <br />
            <small>{new Date(s.startedAt).toLocaleDateString()}</small>
            </div>
        ))}
        </div>
    )
}