import { useEffect, useState } from 'react'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { API_BASE_URL } from '../config/api'
import { formatDuration, formatShortDate } from '../utils/sessionPresentation'

const INACTIVE_TIMEOUT_SECONDS = 5 * 60

export default function Dashboard({ setToken, settings, setSettings }) {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [gameName, setGameName] = useState('')
  const [dailyLimit, setDailyLimit] = useState(settings.dailyPlaytimeLimit)
  const [elapsed, setElapsed] = useState(0)
  const [showBreakReminder, setShowBreakReminder] = useState(false)
  const [breakMode, setBreakMode] = useState(null)
  const [breakTimeLeft, setBreakTimeLeft] = useState(0)
  const [sessionPaused, setSessionPaused] = useState(false)
  const [pausedAt, setPausedAt] = useState(null)
  const [totalPausedSeconds, setTotalPausedSeconds] = useState(0)
  const [nextBreakReminderAt, setNextBreakReminderAt] = useState(settings.breakReminderIntervalMinutes * 60)
  const [currentReminderAt, setCurrentReminderAt] = useState(null)
  const [activeBreakStartedAt, setActiveBreakStartedAt] = useState(null)
  const [activeBreakType, setActiveBreakType] = useState(null)
  const [hasSkippedReminderDuringSession, setHasSkippedReminderDuringSession] = useState(false)
  const [hiddenSince, setHiddenSince] = useState(null)
  const [isStopping, setIsStopping] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const breakReminderIntervalSeconds = settings.breakReminderIntervalMinutes * 60

  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    setDailyLimit(settings.dailyPlaytimeLimit)
    setNextBreakReminderAt((current) => (current < breakReminderIntervalSeconds ? breakReminderIntervalSeconds : current))
  }, [settings.dailyPlaytimeLimit, breakReminderIntervalSeconds])

  useEffect(() => {
    if (!activeSession) return undefined

    const interval = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.floor((new Date() - new Date(activeSession.startedAt)) / 1000) - getEffectivePausedSeconds()
      )

      setElapsed(seconds)

      if (!sessionPaused && !showBreakReminder && !breakMode && seconds >= nextBreakReminderAt) {
        setCurrentReminderAt(new Date().toISOString())
        setShowBreakReminder(true)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [activeSession, sessionPaused, pausedAt, totalPausedSeconds, showBreakReminder, breakMode, nextBreakReminderAt])

  useEffect(() => {
    if (breakMode !== 'countdown' || breakTimeLeft <= 0) return undefined

    const interval = setInterval(() => {
      setBreakTimeLeft((timeLeft) => timeLeft - 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [breakMode, breakTimeLeft])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!activeSession) return

      if (document.hidden) {
        setHiddenSince(new Date())
      } else {
        setHiddenSince(null)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [activeSession])

  useEffect(() => {
    if (!activeSession || !hiddenSince || isStopping) return undefined

    const timeout = window.setTimeout(() => {
      stopSession('inactive_timeout')
    }, INACTIVE_TIMEOUT_SECONDS * 1000)

    return () => window.clearTimeout(timeout)
  }, [activeSession, hiddenSince, isStopping])

  const completedTodaySeconds = sessions
    .filter((session) => session.endedAt && new Date(session.startedAt).toDateString() === new Date().toDateString())
    .reduce((sum, session) => sum + (session.durationSeconds || 0), 0)

  const todayTotalSeconds = completedTodaySeconds + elapsed
  const dailyLimitSeconds = Math.max(0, dailyLimit * 60)

  useEffect(() => {
    if (!activeSession || !dailyLimitSeconds || isStopping) return
    if (todayTotalSeconds < dailyLimitSeconds) return

    stopSession('limit_reached')
  }, [activeSession, dailyLimitSeconds, todayTotalSeconds, isStopping])

  const resetBreakState = () => {
    setShowBreakReminder(false)
    setBreakMode(null)
    setBreakTimeLeft(0)
    setSessionPaused(false)
    setPausedAt(null)
    setTotalPausedSeconds(0)
    setNextBreakReminderAt(breakReminderIntervalSeconds)
    setCurrentReminderAt(null)
    setActiveBreakStartedAt(null)
    setActiveBreakType(null)
    setHiddenSince(null)
  }

  const getCurrentBreakPausedSeconds = () => {
    if (!sessionPaused || !pausedAt) return 0
    return Math.max(0, Math.floor((new Date() - new Date(pausedAt)) / 1000))
  }

  const getEffectivePausedSeconds = () => totalPausedSeconds + getCurrentBreakPausedSeconds()

  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sessions`, { headers })
      setSessions(res.data)

      const active = res.data.find((session) => !session.endedAt)
      setActiveSession(active || null)

      if (active) {
        setHasSkippedReminderDuringSession((active.breaksSkipped || 0) > 0)
      } else {
        setHasSkippedReminderDuringSession(false)
        resetBreakState()
        setElapsed(0)
      }
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to load your sessions right now.')
    }
  }

  const startSession = async () => {
    try {
      setStatusMessage('')
      resetBreakState()
      setElapsed(0)
      setHasSkippedReminderDuringSession(false)

      const res = await axios.post(
        `${API_BASE_URL}/api/sessions/start`,
        { gameName: gameName || 'Gaming Session' },
        { headers }
      )

      setActiveSession(res.data)
      setGameName('')
      fetchSessions()
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to start a new session.')
      fetchSessions()
    }
  }

  const stopSession = async (reason = 'manual_end') => {
    if (!activeSession || isStopping) return

    setIsStopping(true)

    try {
      const pausedSeconds = getEffectivePausedSeconds()
      const endingReason = reason === 'manual_end' && hasSkippedReminderDuringSession
        ? 'continued_after_reminder'
        : reason

      await axios.put(
        `${API_BASE_URL}/api/sessions/stop/${activeSession._id}`,
        { pausedSeconds, endingReason },
        { headers }
      )

      setActiveSession(null)
      setElapsed(0)
      setHasSkippedReminderDuringSession(false)
      setStatusMessage(
        endingReason === 'limit_reached'
          ? 'Daily limit reached. Session saved and ended gently.'
          : endingReason === 'inactive_timeout'
            ? 'Session ended after inactivity so your history stays accurate.'
            : ''
      )
      resetBreakState()
      fetchSessions()
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to stop the current session.')
    } finally {
      setIsStopping(false)
    }
  }

  const pauseForBreak = (mode, durationSeconds = 0) => {
    const now = new Date().toISOString()
    setBreakTimeLeft(durationSeconds)
    setBreakMode(mode)
    setSessionPaused(true)
    setPausedAt(now)
    setActiveBreakStartedAt(now)
    setActiveBreakType(mode)
  }

  const continueGamingAfterBreak = async () => {
    if (!activeSession || !currentReminderAt) return

    const breakEndedAt = new Date().toISOString()
    const breakStartedAt = activeBreakStartedAt || breakEndedAt
    const breakDurationSeconds = Math.max(0, Math.floor((new Date(breakEndedAt) - new Date(breakStartedAt)) / 1000))
    const newTotalPausedSeconds = getEffectivePausedSeconds()
    const resumeElapsed = activeSession
      ? Math.max(0, Math.floor((new Date() - new Date(activeSession.startedAt)) / 1000) - newTotalPausedSeconds)
      : elapsed

    try {
      await axios.post(
        `${API_BASE_URL}/api/sessions/${activeSession._id}/reminders`,
        {
          action: 'taken',
          remindedAt: currentReminderAt,
          breakType: activeBreakType || 'countdown',
          breakStartedAt,
          breakEndedAt,
          breakDurationSeconds,
        },
        { headers }
      )
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Break was taken, but it could not be saved.')
    }

    setTotalPausedSeconds(newTotalPausedSeconds)
    setElapsed(resumeElapsed)
    setPausedAt(null)
    setSessionPaused(false)
    setShowBreakReminder(false)
    setBreakMode(null)
    setBreakTimeLeft(0)
    setCurrentReminderAt(null)
    setActiveBreakStartedAt(null)
    setActiveBreakType(null)
    setNextBreakReminderAt(resumeElapsed + breakReminderIntervalSeconds)
    fetchSessions()
  }

  const skipReminder = async () => {
    if (!activeSession || !currentReminderAt) return

    try {
      await axios.post(
        `${API_BASE_URL}/api/sessions/${activeSession._id}/reminders`,
        {
          action: 'skipped',
          remindedAt: currentReminderAt,
        },
        { headers }
      )

      setHasSkippedReminderDuringSession(true)
      setShowBreakReminder(false)
      setBreakMode(null)
      setCurrentReminderAt(null)
      setNextBreakReminderAt(elapsed + breakReminderIntervalSeconds)
      fetchSessions()
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to save that reminder choice.')
    }
  }

  const updateDailyLimit = (value) => {
    const nextLimit = Math.max(0, Number(value) || 0)
    setDailyLimit(nextLimit)
    setSettings({ ...settings, dailyPlaytimeLimit: nextLimit })
  }

  const formatClock = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${secs}s`
  }

  const todayMinutes = Math.floor(todayTotalSeconds / 60)
  const todaySeconds = todayTotalSeconds % 60

  const weekMinutes = sessions
    .filter((session) => {
      if (!session.endedAt) return false
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return new Date(session.startedAt) > weekAgo
    })
    .reduce((sum, session) => sum + (session.durationMinutes || 0), 0)

  const dailyProgress = dailyLimitSeconds ? Math.min((todayTotalSeconds / dailyLimitSeconds) * 100, 100) : 0
  const completedSessions = sessions.filter((session) => session.endedAt)

  return (
    <>
      {showBreakReminder && (
        <div className="modal-backdrop">
          <div className="modal">
            {!breakMode && (
              <div className="stack">
                <h2 className="modal__title">Time for a gentle break</h2>
                <p className="modal__desc">Rest your eyes, stretch, and drink some water.</p>
                <Button variant="secondary" onClick={skipReminder}>
                  No, keep playing
                </Button>
                <Button variant="primary" onClick={() => setBreakMode('taking')}>
                  Take a break
                </Button>
                <Button variant="danger" onClick={() => stopSession('manual_end')}>
                  End this session
                </Button>
              </div>
            )}

            {breakMode === 'taking' && (
              <div className="stack">
                <h2 className="modal__title">How long should this break be?</h2>
                <p className="modal__desc">Your session timer will stay paused until you continue.</p>
                {[1, 5, 10].map((minutes) => (
                  <Button key={minutes} variant="secondary" onClick={() => pauseForBreak('countdown', minutes * 60)}>
                    {minutes} minute{minutes > 1 ? 's' : ''}
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
                  {Math.floor(breakTimeLeft / 60)}:{String(Math.max(0, breakTimeLeft % 60)).padStart(2, '0')}
                </div>
                <p className="modal__desc">Session timer is paused.</p>
                {breakTimeLeft <= 0 && (
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

      <AppLayout
        title="Dashboard"
        subtitle="Track your sessions in a calm and healthy rhythm."
        username={username}
        setToken={setToken}
      >
        <section className="dashboard-grid">
          <div className="span-12">
            <Card
              className="ui-card--hero"
              title="Current Session"
              subtitle={
                activeSession
                  ? `Now playing: ${activeSession.gameName}`
                  : `Ready to begin? Break reminders every ${settings.breakReminderIntervalMinutes} minutes.`
              }
            >
              <div className="stack">
                {statusMessage ? <p className="error-text">{statusMessage}</p> : null}

                {activeSession ? (
                  <>
                    <p className={`session-time ${sessionPaused ? 'session-time--paused' : ''}`}>{formatClock(elapsed)}</p>
                    <div className="status-row">
                      <span className="badge">Breaks taken: {activeSession.breaksTaken || 0}</span>
                      <span className="badge">Breaks skipped: {activeSession.breaksSkipped || 0}</span>
                      {sessionPaused ? <span className="badge badge--warm">On break</span> : null}
                    </div>
                    <Button variant="danger" size="lg" block onClick={() => stopSession('manual_end')} disabled={isStopping}>
                      Stop session
                    </Button>
                  </>
                ) : (
                  <>
                    <label className="field">
                      <span className="field__label">Game name</span>
                      <input
                        className="input"
                        placeholder="What are you playing?"
                        value={gameName}
                        onChange={(event) => setGameName(event.target.value)}
                      />
                    </label>
                    <Button variant="primary" size="lg" block onClick={startSession}>
                      Start session
                    </Button>
                  </>
                )}
              </div>
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
                  <p className="stat-value">{completedSessions.length}</p>
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
                    onChange={(event) => updateDailyLimit(event.target.value)}
                  />
                </label>
              </div>
            </Card>
          </div>

          <div className="span-12">
            <Card title="Recent Sessions" subtitle="Live history from saved session records">
              <div className="recent-list">
                {completedSessions.slice(0, 5).map((session) => (
                  <div key={session._id} className="recent-item">
                    <div>
                      <p className="recent-item__game">{session.gameName}</p>
                      <p className="recent-item__meta">{formatShortDate(session.startedAt)}</p>
                    </div>
                    <div className="recent-item__detail">
                      <p className="recent-item__dur">{formatDuration(session.durationSeconds)}</p>
                      <p className="recent-item__meta">
                        {session.breaksTaken || 0} break{(session.breaksTaken || 0) === 1 ? '' : 's'} taken
                      </p>
                    </div>
                  </div>
                ))}
                {completedSessions.length === 0 && <p>No sessions yet. Start your first one.</p>}
              </div>
            </Card>
          </div>
        </section>
      </AppLayout>
    </>
  )
}
