import { useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function Dashboard({ setToken }) {
    const BREAK_REMINDER_INTERVAL_SECONDS = 10

    const [sessions, setSessions] = useState([])
    const [activeSession, setActiveSession] = useState(null)
    const [gameName, setGameName] = useState('')
    const [dailyLimit, setDailyLimit] = useState(120)
    const [elapsed, setElapsed] = useState(0)
    const [showBreakReminder, setShowBreakReminder] = useState(false)
    const token = localStorage.getItem('token')
    const username = localStorage.getItem('username')
    const navigate = useNavigate()

    // break management states
    const [breakMode, setBreakMode] = useState(null) // null, 'taking', 'countdown'
    const [breakDuration, setBreakDuration] = useState(0)
    const [breakTimeLeft, setBreakTimeLeft] = useState(0)
    const [sessionPaused, setSessionPaused] = useState(false)
    const [pausedAt, setPausedAt] = useState(null)
    const [totalPausedSeconds, setTotalPausedSeconds] = useState(0)
    const [nextBreakReminderAt, setNextBreakReminderAt] = useState(BREAK_REMINDER_INTERVAL_SECONDS)

    const headers = { Authorization: `Bearer ${token}` }

    useEffect(() => { fetchSessions() }, [])

    const resetBreakState = () => {
        setShowBreakReminder(false)
        setBreakMode(null)
        setBreakDuration(0)
        setBreakTimeLeft(0)
        setSessionPaused(false)
        setPausedAt(null)
        setTotalPausedSeconds(0)
        setNextBreakReminderAt(BREAK_REMINDER_INTERVAL_SECONDS)
    }

    const pauseForBreak = (mode, durationSeconds = 0) => {
        setBreakDuration(durationSeconds)
        setBreakTimeLeft(durationSeconds)
        setBreakMode(mode)
        setSessionPaused(true)
        setPausedAt(new Date())
    }

    const getCurrentBreakPausedSeconds = () => {
        if (!sessionPaused || !pausedAt) return 0
        return Math.max(0, Math.floor((new Date() - new Date(pausedAt)) / 1000))
    }

    const getEffectivePausedSeconds = () => totalPausedSeconds + getCurrentBreakPausedSeconds()

    const continueGamingAfterBreak = () => {
        const newTotalPausedSeconds = getEffectivePausedSeconds()
        const resumeElapsed = activeSession
            ? Math.max(
                0,
                Math.floor((new Date() - new Date(activeSession.startedAt)) / 1000) - newTotalPausedSeconds
            )
            : elapsed

        setTotalPausedSeconds(newTotalPausedSeconds)
        setElapsed(resumeElapsed)
        setPausedAt(null)
        setSessionPaused(false)
        setShowBreakReminder(false)
        setBreakMode(null)
        setBreakDuration(0)
        setBreakTimeLeft(0)
        setNextBreakReminderAt(resumeElapsed + BREAK_REMINDER_INTERVAL_SECONDS)
    }

    // Live timer
    useEffect(() => {
        if (!activeSession) return
        const interval = setInterval(() => {
            const secs = Math.max(
                0,
                Math.floor((new Date() - new Date(activeSession.startedAt)) / 1000) - getEffectivePausedSeconds()
            )
            setElapsed(secs)
            if (!sessionPaused && !showBreakReminder && !breakMode && secs >= nextBreakReminderAt) {
                setShowBreakReminder(true)
            }
        }, 1000)
        return () => clearInterval(interval)
    }, [activeSession, sessionPaused, pausedAt, totalPausedSeconds, showBreakReminder, breakMode, nextBreakReminderAt])

    useEffect(() => {
        if (breakMode !== 'countdown' || breakTimeLeft <= 0) return
        const interval = setInterval(() => {
            setBreakTimeLeft(t => t - 1)
        }, 1000)
        return () => clearInterval(interval)
    }, [breakMode, breakTimeLeft])

    const fetchSessions = async () => {
        const res = await axios.get('http://localhost:3001/api/sessions', { headers })
        setSessions(res.data)
        const active = res.data.find(s => !s.endedAt)
        setActiveSession(active || null)
        if (!active) {
            resetBreakState()
            setElapsed(0)
        }
    }

    const startSession = async () => {
        resetBreakState()
        setElapsed(0)
        const res = await axios.post('http://localhost:3001/api/sessions/start', { gameName: gameName || 'Gaming Session' }, { headers })
        setActiveSession(res.data)
        fetchSessions()
    }

    const stopSession = async () => {
        const pausedSeconds = getEffectivePausedSeconds()
        await axios.put(
            `http://localhost:3001/api/sessions/stop/${activeSession._id}`,
            { pausedSeconds },
            { headers }
        )
        setActiveSession(null)
        setElapsed(0)
        resetBreakState()
        fetchSessions()
    }

    const logout = () => {
        localStorage.clear()
        setToken(null)
        navigate('/login')
    }

    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        const s = secs % 60
        return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`
    }

    const completedTodaySeconds = sessions
        .filter(s => s.endedAt && new Date(s.startedAt).toDateString() === new Date().toDateString())
        .reduce((sum, s) => sum + (s.durationSeconds || 0), 0)

    const todayTotalSeconds = completedTodaySeconds + elapsed
    const todayMinutes = Math.floor(todayTotalSeconds / 60)
    const todaySeconds = todayTotalSeconds % 60

    const weekMinutes = sessions
        .filter(s => {
        if (!s.endedAt) return false
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
        return new Date(s.startedAt) > weekAgo
        })
        .reduce((sum, s) => sum + s.durationMinutes, 0)

    const dailyProgress = Math.min((todayTotalSeconds / (dailyLimit * 60)) * 100, 100)
    const progressColor = dailyProgress < 60 ? '#4CAF50' : dailyProgress < 90 ? '#FF9800' : '#f44336'

    return (
        <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', fontFamily: 'Arial, sans-serif' }}>
        {/* Break Reminder Popup */}
        {showBreakReminder && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ background: '#16213e', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                
                {/* Initial prompt */}
                {!breakMode && (
                    <>
                    <div style={{ fontSize: '48px' }}>⏰</div>
                    <h2 style={{ color: '#e94560' }}>Time for a Break!</h2>
                    <p>You've been gaming for a while. Remember to rest your eyes, drink water, and stretch!</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                        <button onClick={() => { setShowBreakReminder(false); setBreakMode(null); setNextBreakReminderAt(elapsed + BREAK_REMINDER_INTERVAL_SECONDS) }}
                        style={{ padding: '12px', background: '#0f3460', color: 'white', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
                        No, I want to keep playing
                        </button>
                        <button onClick={() => setBreakMode('taking')}
                        style={{ padding: '12px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
                        Take a break
                        </button>
                        <button onClick={() => { stopSession(); setShowBreakReminder(false); setBreakMode(null) }}
                        style={{ padding: '12px', background: '#e94560', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
                        I'm done with this session
                        </button>
                    </div>
                    </>
                )}

                {/* Break duration picker */}
                {breakMode === 'taking' && (
                    <>
                    <div style={{ fontSize: '48px' }}>😴</div>
                    <h2 style={{ color: '#4CAF50' }}>How long is your break?</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                        {[1, 5, 10].map(mins => (
                        <button key={mins} 
                            onClick={() => { 
                                pauseForBreak('countdown', mins * 60)
                            }}
                            style={{ padding: '12px', background: '#0f3460', color: 'white', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
                            ⏱ {mins} minute{mins > 1 ? 's' : ''}
                        </button>
                        ))}
                        <button 
                        onClick={() => { 
                            pauseForBreak('indefinite', 0)
                        }}
                        style={{ padding: '12px', background: '#0f3460', color: 'white', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
                        ∞ Indefinite
                        </button>
                    </div>
                    </>
                )}

                {/* Countdown break */}
                {breakMode === 'countdown' && (
                    <>
                    <div style={{ fontSize: '48px' }}>😌</div>
                    <h2 style={{ color: '#4CAF50' }}>Enjoy your break!</h2>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#FF9800', margin: '16px 0' }}>
                        {Math.floor(breakTimeLeft / 60)}:{String(breakTimeLeft % 60).padStart(2, '0')}
                    </div>
                    <p style={{ color: '#888' }}>Session is paused ⏸</p>
                    {breakTimeLeft === 0 && (
                        <button 
                            onClick={continueGamingAfterBreak}
                            style={{ padding: '12px 30px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', marginTop: '10px' }}>
                            Continue gaming
                        </button>
                    )}
                    </>
                )}

                {/* Indefinite break */}
                {breakMode === 'indefinite' && (
                    <>
                    <div style={{ fontSize: '48px' }}>😌</div>
                    <h2 style={{ color: '#4CAF50' }}>Take your time!</h2>
                    <p style={{ color: '#888' }}>Session is paused ⏸</p>
                    <button 
                        onClick={continueGamingAfterBreak}
                        style={{ padding: '12px 30px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', marginTop: '20px' }}>
                        Get back to gaming
                    </button>
                    </>
                )}

                </div>
            </div>
            )}

        {/* Header */}
        <div style={{ background: '#16213e', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, color: '#e94560' }}>GoAFK 🎮</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>👋 {username}</span>
            <button onClick={logout} style={{ padding: '8px 16px', background: 'transparent', color: 'white', border: '1px solid #e94560', borderRadius: '8px', cursor: 'pointer' }}>Logout</button>
            </div>
        </div>

        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '32px' }}>
            <div style={{ background: '#16213e', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#e94560' }}>
                    {todayMinutes}m {todaySeconds}s
                </div>
                <div style={{ color: '#888', marginTop: '4px' }}>Today</div>
            </div>
            <div style={{ background: '#16213e', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#4CAF50' }}>{Math.round(weekMinutes / 60 * 10) / 10}h</div>
                <div style={{ color: '#888', marginTop: '4px' }}>This Week</div>
            </div>
            <div style={{ background: '#16213e', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#FF9800' }}>{sessions.filter(s => s.endedAt).length}</div>
                <div style={{ color: '#888', marginTop: '4px' }}>Total Sessions</div>
            </div>
            </div>

            {/* Daily Limit Progress */}
            <div style={{ background: '#16213e', padding: '24px', borderRadius: '12px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span>Daily Limit</span>
                <span style={{ color: '#888' }}>{todayMinutes} / {dailyLimit} min</span>
            </div>
            <div style={{ background: '#0f3460', borderRadius: '999px', height: '12px' }}>
                <div style={{ width: `${dailyProgress}%`, background: progressColor, borderRadius: '999px', height: '12px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#888', fontSize: '14px' }}>Set limit (minutes):</span>
                <input type="number" value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))}
                style={{ width: '80px', padding: '4px 8px', background: '#0f3460', color: 'white', border: '1px solid #333', borderRadius: '6px' }} />
            </div>
            </div>

            {/* Session Control */}
            <div style={{ background: '#16213e', padding: '24px', borderRadius: '12px', marginBottom: '32px' }}>
            {!activeSession ? (
                <div>
                <h3 style={{ margin: '0 0 16px' }}>Start a Session</h3>
                <input placeholder="What are you playing?" value={gameName} onChange={e => setGameName(e.target.value)}
                    style={{ width: '100%', padding: '12px', background: '#0f3460', color: 'white', border: '1px solid #333', borderRadius: '8px', marginBottom: '12px', boxSizing: 'border-box' }} />
                <button onClick={startSession}
                    style={{ width: '100%', padding: '14px', background: '#e94560', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                    Start Session 🎮
                </button>
                </div>
            ) : (
                <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px' }}>Now Playing: {activeSession.gameName}</h3>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#4CAF50', margin: '16px 0' }}>{formatTime(elapsed)}</div>
                <button onClick={stopSession}
                    style={{ width: '100%', padding: '14px', background: '#f44336', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold' }}>
                    Stop Session ⏹
                </button>
                </div>
            )}
            </div>

            {/* Recent Sessions */}
            <div style={{ background: '#16213e', padding: '24px', borderRadius: '12px' }}>
            <h3 style={{ margin: '0 0 16px' }}>Recent Sessions</h3>
            {sessions.filter(s => s.endedAt).slice(0, 5).map(s => (
                <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#0f3460', borderRadius: '8px', marginBottom: '8px' }}>
                    <div>
                        <div style={{ fontWeight: 'bold' }}>{s.gameName}</div>
                        <div style={{ color: '#888', fontSize: '14px' }}>{new Date(s.startedAt).toLocaleDateString()}</div>
                    </div>
                    <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                        {s.durationMinutes}m {s.durationSeconds !== undefined ? `${s.durationSeconds % 60}s` : ''}
                    </div>
                </div>
            ))}
            {sessions.filter(s => s.endedAt).length === 0 && <p style={{ color: '#888', textAlign: 'center' }}>No sessions yet. Start gaming! 🎮</p>}
            </div>
        </div>
        </div>
    )
}
