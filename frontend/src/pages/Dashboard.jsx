import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function Dashboard({ setToken }) {
  const BREAK_REMINDER_INTERVAL_SECONDS = 10

  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [gameName, setGameName] = useState('')
  const [dailyLimit, setDailyLimit] = useState(120)
  const [elapsed, setElapsed] = useState(0)
  const [showBreakReminder, setShowBreakReminder] = useState(false)
  const [breakMode, setBreakMode] = useState(null)
  const [breakTimeLeft, setBreakTimeLeft] = useState(0)
  const [sessionPaused, setSessionPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(null)
  const [totalPausedSeconds, setTotalPausedSeconds] = useState(0)
  const [nextBreakReminderAt, setNextBreakReminderAt] = useState(BREAK_REMINDER_INTERVAL_SECONDS)

  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  const navigate = useNavigate()
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchSessions()
  }, [])

  const resetBreakState = () => {
    setShowBreakReminder(false)
    setBreakMode(null)
    setBreakTimeLeft(0)
    setSessionPaused(false)
    setPausedAt(null)
    setTotalPausedSeconds(0)
    setNextBreakReminderAt(BREAK_REMINDER_INTERVAL_SECONDS)
  }

  const pauseForBreak = (mode, durationSeconds = 0) => {
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
    setBreakTimeLeft(0)
    setNextBreakReminderAt(resumeElapsed + BREAK_REMINDER_INTERVAL_SECONDS)
  }

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
    const res = await axios.post(
      'http://localhost:3001/api/sessions/start',
      { gameName: gameName || 'Gaming Session' },
      { headers }
    )
    setActiveSession(res.data)
    fetchSessions()
  }

  const stopSession = async () => {
    const pausedSeconds = getEffectivePausedSeconds()
    await axios.put(`http://localhost:3001/api/sessions/stop/${activeSession._id}`, { pausedSeconds }, { headers })
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

  const formatTime = secs => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h > 0 ? `${h}h ` : ''}${m}m ${s}s`
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
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(s.startedAt) > weekAgo
    })
    .reduce((sum, s) => sum + s.durationMinutes, 0)

  const dailyProgress = Math.min((todayTotalSeconds / (dailyLimit * 60)) * 100, 100)

  return (
    <>
      {showBreakReminder && (
        <div className="modal-backdrop">
          <div className="modal">
            {!breakMode && (
              <div className="stack">
                <h2 className="modal__title">Time for a gentle break</h2>
                <p className="modal__desc">Rest your eyes, stretch, and drink some water.</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowBreakReminder(false)
                    setBreakMode(null)
                    setNextBreakReminderAt(elapsed + BREAK_REMINDER_INTERVAL_SECONDS)
                  }}
                >
                  No, keep playing
                </Button>
                <Button variant="primary" onClick={() => setBreakMode('taking')}>
                  Take a break
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    stopSession()
                    setShowBreakReminder(false)
                    setBreakMode(null)
                  }}
                >
                  End this session
                </Button>
              </div>
            )}

            {breakMode === 'taking' && (
              <div className="stack">
                <h2 className="modal__title">How long should this break be?</h2>
                <p className="modal__desc">Your session timer will stay paused until you continue.</p>
                {[1, 5, 10].map(mins => (
                  <Button key={mins} variant="secondary" onClick={() => pauseForBreak('countdown', mins * 60)}>
                    {mins} minute{mins > 1 ? 's' : ''}
                  </Button>
                ))}
                <Button variant="secondary" onClick={() => pauseForBreak('indefinite', 0)}>
                  Indefinite break
                </Button>
              </div>
            )}

            {breakMode === 'countdown' && (
              <div className="center stack">
                <h2 className="modal__title">Break in progress</h2>
                <div className="session-time">
                  {Math.floor(breakTimeLeft / 60)}:{String(breakTimeLeft % 60).padStart(2, '0')}
                </div>
                <p className="modal__desc">Session timer is paused.</p>
                {breakTimeLeft === 0 && (
                  <Button variant="primary" onClick={continueGamingAfterBreak}>
                    Continue gaming
                  </Button>
                )}
              </div>
            )}

            {breakMode === 'indefinite' && (
              <div className="center stack">
                <h2 className="modal__title">Take your time</h2>
                <p className="modal__desc">Session timer is paused until you come back.</p>
                <Button variant="primary" onClick={continueGamingAfterBreak}>
                  Get back to gaming
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="app-shell">
        <Sidebar username={username} />

        <main className="dashboard-main">
          <header className="topbar">
            <div className="topbar__title">
              <h2>Dashboard</h2>
              <p>Track your sessions in a calm and healthy rhythm.</p>
            </div>
            <Button variant="ghost" onClick={logout}>
              Logout
            </Button>
          </header>

          <section className="dashboard-grid">
            <div className="span-12">
              <Card className="ui-card--hero" title="Current Session" subtitle={activeSession ? `Now playing: ${activeSession.gameName}` : 'Ready to begin?'}>
                {activeSession ? (
                  <div className="stack">
                    <p className={`session-time ${sessionPaused ? 'session-time--paused' : ''}`}>{formatTime(elapsed)}</p>
                    <Button variant="danger" size="lg" block onClick={stopSession}>
                      Stop session
                    </Button>
                  </div>
                ) : (
                  <div className="stack">
                    <label className="field">
                      <span className="field__label">Game name</span>
                      <input
                        className="input"
                        placeholder="What are you playing?"
                        value={gameName}
                        onChange={e => setGameName(e.target.value)}
                      />
                    </label>
                    <Button variant="primary" size="lg" block onClick={startSession}>
                      Start session
                    </Button>
                  </div>
                )}
              </Card>
            </div>

            <div className="span-8">
              <Card title="Playtime Summary" subtitle="A quick view of your current momentum">
                <div className="stats-grid">
                  <div>
                    <p className="stat-value">
                      {todayMinutes}m {todaySeconds}s
                    </p>
                    <p className="stat-label">Today</p>
                  </div>
                  <div>
                    <p className="stat-value">{Math.round((weekMinutes / 60) * 10) / 10}h</p>
                    <p className="stat-label">This week</p>
                  </div>
                  <div>
                    <p className="stat-value">{sessions.filter(s => s.endedAt).length}</p>
                    <p className="stat-label">Completed sessions</p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="span-4">
              <Card title="Daily Limit" subtitle={`${todayMinutes} / ${dailyLimit} minutes`}>
                <div className="stack">
                  <div className="progress">
                    <div className="progress__fill" style={{ width: `${dailyProgress}%` }} />
                  </div>
                  <label className="field">
                    <span className="field__label">Set limit (minutes)</span>
                    <input
                      className="input"
                      type="number"
                      value={dailyLimit}
                      onChange={e => setDailyLimit(Number(e.target.value))}
                    />
                  </label>
                </div>
              </Card>
            </div>

            <div className="span-12">
              <Card title="Recent Sessions">
                <div className="recent-list">
                  {sessions.filter(s => s.endedAt).slice(0, 5).map(s => (
                    <div key={s._id} className="recent-item">
                      <div>
                        <p className="recent-item__game">{s.gameName}</p>
                        <p className="recent-item__meta">{new Date(s.startedAt).toLocaleDateString()}</p>
                      </div>
                      <p className="recent-item__dur">
                        {s.durationMinutes}m {s.durationSeconds !== undefined ? `${s.durationSeconds % 60}s` : ''}
                      </p>
                    </div>
                  ))}
                  {sessions.filter(s => s.endedAt).length === 0 && <p>No sessions yet. Start your first one.</p>}
                </div>
              </Card>
            </div>
          </section>
        </main>
      </div>
    </>
  )
}
