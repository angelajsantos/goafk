import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import { API_BASE_URL } from '../config/api'
import { formatDuration, getEndingReasonLabel } from '../utils/sessionPresentation'
import { WELLNESS_REMINDER_TYPES } from '../utils/wellnessReminders'

export default function Statistics({ setToken, settings, appearanceMode, onToggleAppearance }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const username = localStorage.getItem('username')
  const token = localStorage.getItem('token')
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await axios.get(
        `${API_BASE_URL}/api/sessions/stats?dailyLimitMinutes=${settings.dailyPlaytimeLimit}`,
        { headers }
      )
      setStats(res.data)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load your statistics right now.')
    } finally {
      setLoading(false)
    }
  }, [headers, settings.dailyPlaytimeLimit])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const totals = stats?.totals
  const highlights = stats?.highlights
  const streak = stats?.streak
  const wellness = stats?.wellness
  const mostCommonEnding = totals?.endingReasonCounts
    ? Object.entries(totals.endingReasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    : null

  return (
    <AppLayout
      title="Statistics"
      subtitle="Longer-term patterns for healthier play and steadier breaks."
      username={username}
      setToken={setToken}
      appearanceMode={appearanceMode}
      onToggleAppearance={onToggleAppearance}
    >
      <section className="dashboard-grid">
        <div className="span-12">
          <Card className="statistics-hero" title="Behavior Snapshot" subtitle="Weekly and monthly rhythm, built from saved session history">
            {error ? <p className="error-text">{error}</p> : null}

            {loading || !totals ? (
              <div className="empty-state">
                <p>Loading your statistics...</p>
              </div>
            ) : (
              <div className="stats-grid stats-grid--four">
                <div>
                  <p className="stat-value">{formatDuration(totals.totalPlaytimeWeekSeconds)}</p>
                  <p className="stat-label">This week</p>
                </div>
                <div>
                  <p className="stat-value">{formatDuration(totals.totalPlaytimeMonthSeconds)}</p>
                  <p className="stat-label">This month</p>
                </div>
                <div>
                  <p className="stat-value">{formatDuration(totals.averageSessionSeconds)}</p>
                  <p className="stat-label">Average session</p>
                </div>
                <div>
                  <p className="stat-value">{streak?.current || 0}</p>
                  <p className="stat-label">{streak?.label || 'Current streak'}</p>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="span-8">
          <Card title="Break Habits" subtitle="Signals that reflect how often you actually pause">
            {loading || !totals ? (
              <div className="empty-state">
                <p>Waiting for break data...</p>
              </div>
            ) : (
              <div className="statistics-list">
                <div className="statistics-list__item">
                  <span>Total breaks taken</span>
                  <strong>{totals.totalBreaksTaken}</strong>
                </div>
                <div className="statistics-list__item">
                  <span>Average breaks per session</span>
                  <strong>{totals.averageBreaksPerSession}</strong>
                </div>
                <div className="statistics-list__item">
                  <span>Longest break</span>
                  <strong>{formatDuration(totals.longestBreakSeconds)}</strong>
                </div>
                <div className="statistics-list__item">
                  <span>Breaks skipped</span>
                  <strong>{totals.totalBreaksSkipped}</strong>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="span-4">
          <Card title="Streak" subtitle="Preferred streak: staying within your daily limit">
            {loading || !streak ? (
              <div className="empty-state">
                <p>Building your streak...</p>
              </div>
            ) : (
              <div className="streak-panel">
                <p className="streak-panel__value">{streak.current}</p>
                <p className="streak-panel__label">{streak.label}</p>
                <div className="streak-panel__meta">
                  <span className="badge badge--warm">Best: {streak.best}</span>
                  <span className="badge badge--subtle">Limit: {settings.dailyPlaytimeLimit} min</span>
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="span-12">
          <Card title="Wellness Nudges" subtitle="General comfort reminders completed during saved sessions">
            {loading || !wellness ? (
              <div className="empty-state">
                <p>Waiting for wellness data...</p>
              </div>
            ) : (
              <div className="wellness-stats-layout">
                <div className="stats-grid stats-grid--four">
                  <div>
                    <p className="stat-value">{wellness.totalCompleted}</p>
                    <p className="stat-label">Completed</p>
                  </div>
                  <div>
                    <p className="stat-value">{wellness.completionRate}%</p>
                    <p className="stat-label">Completion rate</p>
                  </div>
                  <div>
                    <p className="stat-value">{wellness.mostCompletedType?.label || 'None yet'}</p>
                    <p className="stat-label">Most completed</p>
                  </div>
                  <div>
                    <p className="stat-value">{wellness.streak?.current || 0}</p>
                    <p className="stat-label">Wellness streak</p>
                  </div>
                </div>

                <div className="wellness-summary">
                  {Object.entries(WELLNESS_REMINDER_TYPES).map(([type, reminder]) => {
                    const count = wellness.byType?.[type] || { completed: 0, skipped: 0 }

                    return (
                      <span key={type} className="badge badge--subtle">
                        {reminder.label}: {count.completed} done / {count.skipped} skipped
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="span-12">
          <Card title="Highlights" subtitle="Useful patterns pulled from completed sessions">
            {loading || !highlights || !totals ? (
              <div className="empty-state">
                <p>Collecting highlights...</p>
              </div>
            ) : (
              <div className="statistics-highlights">
                <article className="statistics-highlight">
                  <p className="session-detail__label">Most played game</p>
                  <h3 className="history-card__title">{highlights.mostPlayedGame?.gameName || 'No sessions yet'}</h3>
                  <p className="history-card__meta">
                    {highlights.mostPlayedGame ? formatDuration(highlights.mostPlayedGame.totalSeconds) : 'Start tracking to build this'}
                  </p>
                </article>

                <article className="statistics-highlight">
                  <p className="session-detail__label">Longest session</p>
                  <h3 className="history-card__title">{highlights.longestSession?.gameName || 'No sessions yet'}</h3>
                  <p className="history-card__meta">
                    {highlights.longestSession ? formatDuration(highlights.longestSession.durationSeconds) : 'Start tracking to build this'}
                  </p>
                </article>

                <article className="statistics-highlight">
                  <p className="session-detail__label">Common play window</p>
                  <h3 className="history-card__title">{highlights.commonPlayTime?.label || 'Not enough history yet'}</h3>
                  <p className="history-card__meta">
                    {highlights.commonPlayTime ? `${highlights.commonPlayTime.count} session starts` : 'Track a few sessions to surface a pattern'}
                  </p>
                </article>

                <article className="statistics-highlight">
                  <p className="session-detail__label">Longest break session</p>
                  <h3 className="history-card__title">{highlights.longestBreak?.gameName || 'No break history yet'}</h3>
                  <p className="history-card__meta">
                    {highlights.longestBreak ? formatDuration(highlights.longestBreak.seconds) : 'Take a break during a session to surface this'}
                  </p>
                </article>
              </div>
            )}
          </Card>
        </div>

        <div className="span-12">
          <Card title="Summary Notes" subtitle="A fast read of what your current history suggests">
            {loading || !totals ? (
              <div className="empty-state">
                <p>Loading summary notes...</p>
              </div>
            ) : (
              <div className="statistics-list">
                <div className="statistics-list__item">
                  <span>Completed sessions</span>
                  <strong>{totals.sessionsCompleted}</strong>
                </div>
                <div className="statistics-list__item">
                  <span>Total tracked playtime</span>
                  <strong>{formatDuration(totals.totalPlaytimeSeconds)}</strong>
                </div>
                <div className="statistics-list__item">
                  <span>Most common ending</span>
                  <strong>{mostCommonEnding ? getEndingReasonLabel(mostCommonEnding) : 'Not enough history yet'}</strong>
                </div>
                <div className="statistics-list__item">
                  <span>Healthy rhythm signal</span>
                  <strong>
                    {totals.averageBreaksPerSession >= 1 ? 'Taking breaks regularly' : 'Room to build in more breaks'}
                  </strong>
                </div>
              </div>
            )}
          </Card>
        </div>
      </section>
    </AppLayout>
  )
}
