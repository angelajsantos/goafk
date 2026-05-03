import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { API_BASE_URL } from '../config/api'
import { formatDuration, formatShortDate, formatTimerClock } from '../utils/sessionPresentation'
import { REMINDER_PRESETS, resolveReminderPresetKey } from '../utils/reminderPresets'
import {
  ensureBrowserNotificationPermission,
  getBrowserNotificationPermission,
  sendBrowserNotification,
} from '../utils/browserNotifications'
import { playReminderChime, prepareReminderChime } from '../utils/reminderChime'
import {
  WELLNESS_INTENSITIES,
  WELLNESS_REMINDER_TYPES,
  createWellnessSchedule,
  createWellnessScheduleFromSession,
  getNextWellnessReminder,
  getWellnessCounts,
  getWellnessIntervalSeconds,
  getWellnessSnoozeSeconds,
  normalizeWellnessPreferences,
} from '../utils/wellnessReminders'

export default function Dashboard({ setToken, settings, setSettings, onToggleAppearance }) {
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [gameName, setGameName] = useState('')
  const [dailyLimit, setDailyLimit] = useState(settings.dailyPlaytimeLimit)
  const [elapsed, setElapsed] = useState(0)
  const [showBreakReminder, setShowBreakReminder] = useState(false)
  const [breakMode, setBreakMode] = useState(null)
  const [breakTimeLeft, setBreakTimeLeft] = useState(0)
  const [sessionPaused, setSessionPaused] = useState(false)
  const [pauseReason, setPauseReason] = useState(null)
  const [pausedAt, setPausedAt] = useState(null)
  const [totalPausedSeconds, setTotalPausedSeconds] = useState(0)
  const [nextBreakReminderAt, setNextBreakReminderAt] = useState(settings.breakReminderIntervalMinutes * 60)
  const [currentReminderAt, setCurrentReminderAt] = useState(null)
  const [activeBreakStartedAt, setActiveBreakStartedAt] = useState(null)
  const [activeBreakType, setActiveBreakType] = useState(null)
  const [hasSkippedReminderDuringSession, setHasSkippedReminderDuringSession] = useState(false)
  const [wellnessSchedule, setWellnessSchedule] = useState({})
  const [activeWellnessReminder, setActiveWellnessReminder] = useState(null)
  const [isStopping, setIsStopping] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [transientMessage, setTransientMessage] = useState('')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [showEarlyBreakConfirm, setShowEarlyBreakConfirm] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState(getBrowserNotificationPermission)
  const breakReminderIntervalSeconds = Math.max(1, Math.round(settings.breakReminderIntervalMinutes * 60))
  const preferredBreakSeconds = Math.max(60, settings.preferredBreakDuration * 60)
  const wellnessPreferences = normalizeWellnessPreferences(settings)
  const wellnessIntensity = WELLNESS_INTENSITIES[wellnessPreferences.intensity]
  const wellnessTypeKey = JSON.stringify(wellnessPreferences.activeTypes)
  const elapsedRef = useRef(0)

  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const activeSessionId = activeSession?._id || null

  const completedTodaySeconds = sessions
    .filter((session) => session.endedAt && new Date(session.startedAt).toDateString() === new Date().toDateString())
    .reduce((sum, session) => sum + (session.durationSeconds || 0), 0)

  const todayTotalSeconds = completedTodaySeconds + elapsed
  const dailyLimitSeconds = Math.max(0, dailyLimit * 60)

  const resetBreakState = useCallback(() => {
    setShowBreakReminder(false)
    setBreakMode(null)
    setBreakTimeLeft(0)
    setSessionPaused(false)
    setPauseReason(null)
    setPausedAt(null)
    setTotalPausedSeconds(0)
    setNextBreakReminderAt(breakReminderIntervalSeconds)
    setCurrentReminderAt(null)
    setActiveBreakStartedAt(null)
    setActiveBreakType(null)
    setShowEarlyBreakConfirm(false)
  }, [breakReminderIntervalSeconds])

  const resetWellnessState = useCallback(() => {
    setWellnessSchedule({})
    setActiveWellnessReminder(null)
  }, [])

  const requestNotificationPermission = useCallback(async () => {
    if (!settings.notifications) return getBrowserNotificationPermission()

    const permission = await ensureBrowserNotificationPermission()
    setNotificationPermission(permission)
    return permission
  }, [settings.notifications])

  const notifyReminder = useCallback(
    (title, body, tag) => {
      if (!settings.notifications || notificationPermission !== 'granted') return
      if (typeof document !== 'undefined' && !document.hidden) return

      sendBrowserNotification({
        title,
        body,
        tag,
        silent: true,
      })
    },
    [notificationPermission, settings.notifications]
  )

  const playReminderSound = useCallback(() => {
    if (!settings.reminderSound) return
    playReminderChime()
  }, [settings.reminderSound])

  const snoozeActiveWellnessReminder = useCallback(
    (fromElapsedSeconds = elapsedRef.current) => {
      if (!activeWellnessReminder) return

      const reminderType = activeWellnessReminder.type
      setActiveWellnessReminder(null)
      setWellnessSchedule((currentSchedule) => ({
        ...currentSchedule,
        [reminderType]: fromElapsedSeconds + getWellnessSnoozeSeconds(settings),
      }))
    },
    [activeWellnessReminder, settings]
  )

  const getCurrentBreakPausedSeconds = useCallback(() => {
    if (!sessionPaused || !pausedAt) return 0
    return Math.max(0, Math.floor((new Date() - new Date(pausedAt)) / 1000))
  }, [pausedAt, sessionPaused])

  const getEffectivePausedSeconds = useCallback(
    () => totalPausedSeconds + getCurrentBreakPausedSeconds(),
    [getCurrentBreakPausedSeconds, totalPausedSeconds]
  )

  const fetchSessions = useCallback(async () => {
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
        resetWellnessState()
        setElapsed(0)
      }
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to load your sessions right now.')
    }
  }, [headers, resetBreakState, resetWellnessState])

  const stopSession = useCallback(
    async (reason = 'manual_end') => {
      if (!activeSession || isStopping) return

      setIsStopping(true)

      try {
        const pausedSeconds = getEffectivePausedSeconds()
        const endingReason =
          reason === 'manual_end' && hasSkippedReminderDuringSession ? 'continued_after_reminder' : reason

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
            : ''
        )
        resetBreakState()
        resetWellnessState()
        fetchSessions()
      } catch (error) {
        setStatusMessage(error.response?.data?.error || 'Unable to stop the current session.')
      } finally {
        setIsStopping(false)
      }
    },
    [activeSession, fetchSessions, getEffectivePausedSeconds, hasSkippedReminderDuringSession, headers, isStopping, resetBreakState, resetWellnessState]
  )

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  useEffect(() => {
    setNotificationPermission(getBrowserNotificationPermission())
  }, [settings.notifications])

  useEffect(() => {
    elapsedRef.current = elapsed
  }, [elapsed])

  useEffect(() => {
    setDailyLimit(settings.dailyPlaytimeLimit)
  }, [settings.dailyPlaytimeLimit])

  useEffect(() => {
    if (!activeSessionId) {
      setNextBreakReminderAt(breakReminderIntervalSeconds)
      return
    }

    setNextBreakReminderAt(elapsedRef.current + breakReminderIntervalSeconds)
  }, [activeSessionId, breakReminderIntervalSeconds])

  useEffect(() => {
    if (!activeSession || !wellnessPreferences.enabled) {
      resetWellnessState()
      return
    }

    setActiveWellnessReminder(null)
    setWellnessSchedule(createWellnessScheduleFromSession(activeSession, settings, elapsedRef.current))
  }, [activeSession, resetWellnessState, settings, wellnessPreferences.enabled, wellnessTypeKey])

  useEffect(() => {
    if (!activeSession) return undefined

    const interval = setInterval(() => {
      const seconds = Math.max(
        0,
        Math.floor((new Date() - new Date(activeSession.startedAt)) / 1000) - getEffectivePausedSeconds()
      )

      setElapsed(seconds)

      if (!sessionPaused && !showBreakReminder && !breakMode && !activeWellnessReminder && seconds >= nextBreakReminderAt) {
        setCurrentReminderAt(new Date().toISOString())
        setShowBreakReminder(true)
        playReminderSound()
        notifyReminder(
          'Break check-in',
          `You've been playing for ${formatDuration(seconds)}. Want to reset for a bit?`,
          'goafk-break-reminder'
        )
        return
      }

      if (!sessionPaused && pauseReason !== 'break' && !showBreakReminder && !breakMode && !activeWellnessReminder && wellnessPreferences.enabled) {
        const nextWellness = getNextWellnessReminder(settings, wellnessSchedule, seconds)
        if (nextWellness && seconds >= nextWellness.dueAt) {
          const reminderConfig = WELLNESS_REMINDER_TYPES[nextWellness.type]
          setActiveWellnessReminder({
            type: nextWellness.type,
            remindedAt: new Date().toISOString(),
          })
          playReminderSound()
          notifyReminder(
            reminderConfig.title,
            reminderConfig.message,
            `goafk-wellness-${nextWellness.type}`
          )
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [
    activeSession,
    activeWellnessReminder,
    breakMode,
    getEffectivePausedSeconds,
    nextBreakReminderAt,
    notifyReminder,
    pauseReason,
    playReminderSound,
    sessionPaused,
    settings,
    showBreakReminder,
    wellnessPreferences.enabled,
    wellnessSchedule,
  ])

  useEffect(() => {
    if (breakMode !== 'countdown' || breakTimeLeft <= 0 || pauseReason === 'manual') return undefined

    const interval = setInterval(() => {
      setBreakTimeLeft((timeLeft) => Math.max(0, timeLeft - 1))
    }, 1000)

    return () => clearInterval(interval)
  }, [breakMode, breakTimeLeft, pauseReason])

  useEffect(() => {
    if (pauseReason !== 'break' && !breakMode) return
    snoozeActiveWellnessReminder(elapsedRef.current)
  }, [breakMode, pauseReason, snoozeActiveWellnessReminder])

  useEffect(() => {
    if (!transientMessage) return undefined

    const timeout = window.setTimeout(() => {
      setTransientMessage('')
    }, 2600)

    return () => window.clearTimeout(timeout)
  }, [transientMessage])

  useEffect(() => {
    if (!activeSession) {
      setIsEditingTitle(false)
      setEditingTitle('')
      return
    }

    setEditingTitle(activeSession.gameName || '')
  }, [activeSession])

  useEffect(() => {
    if (!activeSession || !dailyLimitSeconds || isStopping) return
    if (todayTotalSeconds < dailyLimitSeconds) return

    stopSession('limit_reached')
  }, [activeSession, dailyLimitSeconds, isStopping, stopSession, todayTotalSeconds])

  const startSession = async () => {
    try {
      setStatusMessage('')
      resetBreakState()
      resetWellnessState()
      setElapsed(0)
      setHasSkippedReminderDuringSession(false)
      await requestNotificationPermission()
      if (settings.reminderSound) {
        await prepareReminderChime()
      }

      const res = await axios.post(
        `${API_BASE_URL}/api/sessions/start`,
        { gameName: gameName || 'Gaming Session' },
        { headers }
      )

      setActiveSession(res.data)
      setWellnessSchedule(createWellnessSchedule(settings, 0))
      setGameName('')
      setNextBreakReminderAt(breakReminderIntervalSeconds)
      fetchSessions()
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to start a new session.')
      fetchSessions()
    }
  }

  const pauseForBreak = (mode, durationSeconds = 0) => {
    snoozeActiveWellnessReminder(elapsedRef.current)
    const now = new Date().toISOString()
    setBreakTimeLeft(durationSeconds)
    setBreakMode(mode)
    setSessionPaused(true)
    setPauseReason('break')
    setPausedAt(now)
    setActiveBreakStartedAt(now)
    setActiveBreakType(mode)
    setShowEarlyBreakConfirm(false)
  }

  const pauseSession = () => {
    if (!activeSession || sessionPaused || showBreakReminder) return

    setSessionPaused(true)
    setPauseReason('manual')
    setPausedAt(new Date().toISOString())
    setTransientMessage('')
  }

  const resumeSession = () => {
    if (!sessionPaused || pauseReason !== 'manual') return

    const newTotalPausedSeconds = getEffectivePausedSeconds()
    const resumeElapsed = Math.max(0, Math.floor((new Date() - new Date(activeSession.startedAt)) / 1000) - newTotalPausedSeconds)

    setTotalPausedSeconds(newTotalPausedSeconds)
    setElapsed(resumeElapsed)
    setPausedAt(null)
    setPauseReason(null)
    setSessionPaused(false)
    setTransientMessage('Session resumed. Break countdown is back on track.')
  }

  const continueGamingAfterBreak = async () => {
    if (!activeSession || !currentReminderAt) return

    const breakEndedAt = new Date().toISOString()
    const breakStartedAt = activeBreakStartedAt || breakEndedAt
    const breakDurationSeconds = Math.max(0, Math.floor((new Date(breakEndedAt) - new Date(breakStartedAt)) / 1000))
    const newTotalPausedSeconds = getEffectivePausedSeconds()
    const resumeElapsed = Math.max(0, Math.floor((new Date() - new Date(activeSession.startedAt)) / 1000) - newTotalPausedSeconds)

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
    setPauseReason(null)
    setSessionPaused(false)
    setShowBreakReminder(false)
    setBreakMode(null)
    setBreakTimeLeft(0)
    setCurrentReminderAt(null)
    setActiveBreakStartedAt(null)
    setActiveBreakType(null)
    setShowEarlyBreakConfirm(false)
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
      setShowEarlyBreakConfirm(false)
      setNextBreakReminderAt(elapsed + breakReminderIntervalSeconds)
      fetchSessions()
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to save that reminder choice.')
    }
  }

  const completeWellnessReminder = async (action) => {
    if (!activeSession || !activeWellnessReminder) return

    const reminder = activeWellnessReminder
    const nextDueAt = elapsed + getWellnessIntervalSeconds(reminder.type, settings)

    setActiveWellnessReminder(null)
    setWellnessSchedule((currentSchedule) => ({
      ...currentSchedule,
      [reminder.type]: nextDueAt,
    }))

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/sessions/${activeSession._id}/wellness-reminders`,
        {
          action,
          reminderType: reminder.type,
          remindedAt: reminder.remindedAt,
        },
        { headers }
      )

      setActiveSession(res.data)
      setSessions((currentSessions) =>
        currentSessions.map((session) => (session._id === res.data._id ? res.data : session))
      )
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Wellness nudge handled, but it could not be saved.')
    }
  }

  const snoozeWellnessReminder = () => {
    if (!activeWellnessReminder) return

    const reminder = activeWellnessReminder
    setActiveWellnessReminder(null)
    setWellnessSchedule((currentSchedule) => ({
      ...currentSchedule,
      [reminder.type]: elapsed + getWellnessSnoozeSeconds(settings),
    }))
    setTransientMessage('Wellness nudge tucked away for a bit.')
  }

  const updateDailyLimit = (value) => {
    const nextLimit = Math.max(0, Number(value) || 0)
    setDailyLimit(nextLimit)
    setSettings({ ...settings, dailyPlaytimeLimit: nextLimit })
  }

  const saveSessionTitle = async () => {
    if (!activeSession || !editingTitle.trim()) return

    setIsSavingTitle(true)
    setStatusMessage('')

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/sessions/${activeSession._id}`,
        { gameName: editingTitle },
        { headers }
      )

      setActiveSession(res.data)
      setSessions((currentSessions) =>
        currentSessions.map((session) => (session._id === res.data._id ? res.data : session))
      )
      setIsEditingTitle(false)
      setTransientMessage('Session title updated.')
    } catch (error) {
      setStatusMessage(error.response?.data?.error || 'Unable to rename this session.')
    } finally {
      setIsSavingTitle(false)
    }
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
  const nextReminderSeconds = Math.max(0, nextBreakReminderAt - elapsed)
  const nextReminderProgress = activeSession ? Math.min((nextReminderSeconds / breakReminderIntervalSeconds) * 100, 100) : 100
  const nextBreakRingValue = activeSession ? Math.max(0, 100 - nextReminderProgress) : 0
  const activePreset = resolveReminderPresetKey(settings.reminderPreset)
  const activePresetLabel = REMINDER_PRESETS[activePreset]?.label || 'Custom'
  const elapsedBreakSeconds = activeBreakStartedAt
    ? Math.max(0, Math.floor((new Date() - new Date(activeBreakStartedAt)) / 1000))
    : 0
  const canEndBreakEarly = breakMode === 'countdown' && breakTimeLeft > 0 && elapsedBreakSeconds >= 15
  const wellnessCounts = getWellnessCounts(activeSession || {})
  const nextWellnessReminder = activeSession
    ? getNextWellnessReminder(settings, wellnessSchedule, elapsed)
    : null
  const nextWellnessConfig = nextWellnessReminder ? WELLNESS_REMINDER_TYPES[nextWellnessReminder.type] : null
  const nextWellnessSeconds = activeSession && nextWellnessReminder
    ? Math.max(0, nextWellnessReminder.dueAt - elapsed)
    : 0
  const activeWellnessConfig = activeWellnessReminder
    ? WELLNESS_REMINDER_TYPES[activeWellnessReminder.type]
    : null
  const wellnessDecisionCount = wellnessCounts.completed + wellnessCounts.skipped
  const wellnessCompletionRate = wellnessDecisionCount
    ? Math.round((wellnessCounts.completed / wellnessDecisionCount) * 100)
    : 0
  const wellnessPanelStatus = pauseReason === 'break' || breakMode
    ? 'Paused during break'
    : activeSession && nextWellnessConfig
      ? formatTimerClock(nextWellnessSeconds)
      : wellnessPreferences.enabled
        ? 'Starts when you begin playing'
        : 'Enable in Settings'

  const pauseBannerMessage = pauseReason === 'manual'
    ? 'Session paused. Your timer and next reminder are both on hold.'
    : transientMessage

  return (
    <>
      {showBreakReminder && (
        <div className="modal-backdrop">
          <div className="modal">
            {!breakMode && (
              <div className="stack">
                <div className="reminder-callout">
                  <span className="badge badge--warm">{settings.reminderMode || 'balanced'} mode</span>
                  <span className="reminder-callout__time">Suggested reset: {settings.preferredBreakDuration} min</span>
                </div>
                <h2 className="modal__title">Break check-in</h2>
                <p className="modal__desc">You&apos;ve been playing for {formatDuration(elapsed)}. Want to reset for a bit?</p>
                <div className="modal-actions">
                  <Button variant="secondary" onClick={skipReminder}>
                    Keep Playing
                  </Button>
                  <Button variant="primary" onClick={() => pauseForBreak('countdown', preferredBreakSeconds)}>
                    Take Break
                  </Button>
                </div>
                <div className="modal-actions modal-actions--split">
                  <Button variant="ghost" onClick={() => setBreakMode('taking')}>
                    More break options
                  </Button>
                  <Button variant="danger" onClick={() => stopSession('manual_end')}>
                    End session
                  </Button>
                </div>
              </div>
            )}

            {breakMode === 'taking' && (
              <div className="stack">
                <h2 className="modal__title">Choose a break</h2>
                <p className="modal__desc">Your play timer pauses the moment you pick one.</p>
                <div className="quick-break-grid">
                  {[1, settings.preferredBreakDuration, 10, 15]
                    .filter((minutes, index, all) => all.indexOf(minutes) === index)
                    .map((minutes) => (
                      <Button key={minutes} variant="secondary" onClick={() => pauseForBreak('countdown', minutes * 60)}>
                        {minutes} minute{minutes > 1 ? 's' : ''}
                      </Button>
                    ))}
                </div>
                <div className="modal-actions modal-actions--split">
                  <Button variant="secondary" onClick={() => pauseForBreak('indefinite', 0)}>
                    Indefinite break
                  </Button>
                  <Button variant="ghost" onClick={() => setBreakMode(null)}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            {breakMode === 'countdown' && (
              <div className="center stack">
                <h2 className="modal__title">Break in progress</h2>
                <div className="session-time">{formatTimerClock(breakTimeLeft)}</div>
                {breakTimeLeft > 0 ? (
                  <>
                    {!showEarlyBreakConfirm ? (
                      <>
                        <p className="modal__desc">
                          {canEndBreakEarly
                            ? 'Take your time. You can end this break early if you need to.'
                            : 'Take a few deep breaths. Early ending unlocks after 15 seconds.'}
                        </p>
                        <Button variant="ghost" onClick={() => setShowEarlyBreakConfirm(true)} disabled={!canEndBreakEarly}>
                          End break early
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="modal__desc">Are you sure you want to stop your break timer now?</p>
                        <div className="modal-actions">
                          <Button variant="secondary" onClick={() => setShowEarlyBreakConfirm(false)}>
                            Keep resting
                          </Button>
                          <Button variant="primary" onClick={continueGamingAfterBreak}>
                            End break now
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p className="modal__desc">Session timer is paused while you recharge.</p>
                    <Button variant="primary" onClick={continueGamingAfterBreak}>
                      Resume session
                    </Button>
                  </>
                )}
              </div>
            )}

            {breakMode === 'indefinite' && (
              <div className="center stack">
                <h2 className="modal__title">Take your time</h2>
                <p className="modal__desc">Session timer is paused until you come back.</p>
                <Button variant="primary" onClick={continueGamingAfterBreak}>
                  Resume session
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeWellnessConfig && (
        <div className="wellness-toast" role="status" aria-live="polite">
          <div className="wellness-toast__meta">
            <span className="badge badge--subtle">Wellness nudge</span>
            <span>{wellnessIntensity?.label || 'Balanced'} pace</span>
          </div>
          <h2 className="wellness-toast__title">{activeWellnessConfig.title}</h2>
          <p className="wellness-toast__message">{activeWellnessConfig.message}</p>
          <div className="wellness-toast__actions">
            <Button variant="primary" onClick={() => completeWellnessReminder('completed')}>
              Done
            </Button>
            <Button variant="secondary" onClick={snoozeWellnessReminder}>
              Remind me later
            </Button>
            <Button variant="ghost" onClick={() => completeWellnessReminder('skipped')}>
              Skip
            </Button>
          </div>
        </div>
      )}

      <AppLayout
        title="Dashboard"
        subtitle="Track your sessions in a calm and healthy rhythm."
        username={username}
        setToken={setToken}
        appearanceMode={settings.appearanceMode}
        onToggleAppearance={onToggleAppearance}
      >
        <section className="dashboard-grid">
          <div className="span-12">
            <div className="session-layout">
              <Card
                className="ui-card--hero ui-card--session-focus"
                title="Current Session"
                subtitle={
                  activeSession
                    ? `Now playing: ${activeSession.gameName}`
                    : `Ready to begin? Break reminders every ${settings.breakReminderIntervalMinutes} minutes.`
                }
              >
                <div className="stack">
                  {statusMessage ? <p className="error-text">{statusMessage}</p> : null}
                  {pauseBannerMessage ? <p className="notice notice--info">{pauseBannerMessage}</p> : null}

                  {activeSession ? (
                    <div className="session-focus session-focus--panel">
                      <div className="session-focus__main">
                        <div className="session-focus__head">
                          {isEditingTitle ? (
                            <div className="inline-edit">
                              <input
                                className="input"
                                value={editingTitle}
                                onChange={(event) => setEditingTitle(event.target.value)}
                                maxLength={80}
                              />
                              <div className="inline-edit__actions">
                                <Button variant="primary" onClick={saveSessionTitle} disabled={isSavingTitle || !editingTitle.trim()}>
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    setIsEditingTitle(false)
                                    setEditingTitle(activeSession.gameName || '')
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="session-heading session-heading--minimal">
                              <div>
                                <p className="eyebrow">Gaming Session</p>
                                <h3 className="session-heading__title">{activeSession.gameName}</h3>
                              </div>
                              <Button variant="ghost" onClick={() => setIsEditingTitle(true)}>
                                Rename
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="session-focus__center">
                          <p className={`session-time session-time--hero ${sessionPaused ? 'session-time--paused' : ''}`}>
                            {formatTimerClock(elapsed)}
                          </p>
                        </div>

                        <div className="session-focus__footer">
                          <div className="status-row status-row--compact">
                            <span className="badge badge--micro">Taken {activeSession.breaksTaken || 0}</span>
                            <span className="badge badge--micro">Skipped {activeSession.breaksSkipped || 0}</span>
                            <span className="badge badge--micro badge--subtle">{activePresetLabel}</span>
                            {pauseReason === 'manual' ? <span className="badge badge--micro badge--warm">Paused</span> : null}
                          </div>

                          <div className="hero-actions hero-actions--compact">
                            {pauseReason === 'manual' ? (
                              <Button variant="primary" size="lg" onClick={resumeSession}>
                                Resume
                              </Button>
                            ) : (
                              <Button variant="secondary" size="lg" onClick={pauseSession} disabled={showBreakReminder || breakMode === 'countdown'}>
                                Pause
                              </Button>
                            )}
                            <Button variant="danger" size="lg" onClick={() => stopSession('manual_end')} disabled={isStopping}>
                              Stop
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="session-focus session-focus--panel">
                      <div className="session-focus__main session-focus__main--idle">
                        <label className="field">
                          <span className="field__label">Game name</span>
                          <input
                            className="input"
                            placeholder="What are you playing?"
                            value={gameName}
                            onChange={(event) => setGameName(event.target.value)}
                          />
                        </label>
                        <Button variant="primary" onClick={startSession} className="start-session-button">
                          Start session
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              <div className={`break-hero ${nextReminderSeconds <= 300 ? 'break-hero--soon' : ''}`}>
                <p className="eyebrow">Next Break</p>
                <div className={`break-ring break-ring--hero ${!activeSession ? 'break-ring--idle' : ''}`}>
                  <CircularProgressbar
                    value={activeSession ? nextBreakRingValue : 0}
                    strokeWidth={10.5}
                    styles={buildStyles({
                      pathColor: nextReminderSeconds <= 300 ? '#dfbc90' : '#8db49f',
                      trailColor: 'rgba(79, 103, 97, 0.24)',
                    })}
                  />
                  <div className="break-ring__content break-ring__content--hero">
                    <strong>{formatTimerClock(activeSession ? nextReminderSeconds : breakReminderIntervalSeconds)}</strong>
                    <span>{pauseReason === 'manual' ? 'Paused' : activeSession ? 'Until reminder' : 'Default cadence'}</span>
                  </div>
                </div>
              </div>

              <aside className="session-controls">
                <Card
                  title="Wellness Nudges"
                  subtitle={wellnessPreferences.enabled ? wellnessIntensity?.description : 'Off for this setup'}
                >
                  <div className="wellness-widget wellness-widget--session">
                    <div className="wellness-widget__next">
                      <p className="session-detail__label">Next nudge</p>
                      <h3 className="wellness-widget__title">
                        {activeSession && nextWellnessConfig ? nextWellnessConfig.label : 'No active session'}
                      </h3>
                      <p className="wellness-widget__countdown">{wellnessPanelStatus}</p>
                      <div className="wellness-widget__bar">
                        <span
                          style={{
                            width: activeSession && nextWellnessReminder
                              ? `${Math.max(4, Math.min(100, 100 - (nextWellnessSeconds / getWellnessIntervalSeconds(nextWellnessReminder.type, settings)) * 100))}%`
                              : '0%',
                          }}
                        />
                      </div>
                    </div>

                    <div className="wellness-widget__metrics">
                      <div>
                        <strong>{wellnessCounts.completed}</strong>
                        <span>Done</span>
                      </div>
                      <div>
                        <strong>{wellnessCounts.skipped}</strong>
                        <span>Skipped</span>
                      </div>
                      <div>
                        <strong>{wellnessCompletionRate}%</strong>
                        <span>Follow-through</span>
                      </div>
                      <div>
                        <strong>{wellnessIntensity?.label || 'Balanced'}</strong>
                        <span>Intensity</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </aside>
            </div>
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
