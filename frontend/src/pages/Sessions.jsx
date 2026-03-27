import { useEffect, useState } from 'react'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import { API_BASE_URL } from '../config/api'
import { formatDateTime, formatDuration, getEndingReasonLabel } from '../utils/sessionPresentation'

export default function Sessions({ setToken }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const username = localStorage.getItem('username')
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await axios.get(`${API_BASE_URL}/api/sessions/recent?limit=50`, { headers })
      setSessions(res.data)
    } catch (requestError) {
      setError(requestError.response?.data?.error || 'Unable to load recent sessions.')
    } finally {
      setLoading(false)
    }
  }

  const totalSessions = sessions.length
  const totalPlaytimeSeconds = sessions.reduce((sum, session) => sum + (session.durationSeconds || 0), 0)
  const totalBreaksTaken = sessions.reduce((sum, session) => sum + (session.breaksTaken || 0), 0)
  const totalBreaksSkipped = sessions.reduce((sum, session) => sum + (session.breaksSkipped || 0), 0)
  const averageSessionSeconds = totalSessions ? Math.round(totalPlaytimeSeconds / totalSessions) : 0

  return (
    <AppLayout
      title="Sessions"
      subtitle="Detailed session history with actual reminder and break behavior."
      username={username}
      setToken={setToken}
    >
      <section className="dashboard-grid">
        <div className="span-12">
          <Card title="Recent Session Overview" subtitle="Most recent 50 sessions, newest first">
            {error ? <p className="error-text">{error}</p> : null}

            <div className="stats-grid stats-grid--five">
              <div>
                <p className="stat-value">{totalSessions}</p>
                <p className="stat-label">Recent sessions</p>
              </div>
              <div>
                <p className="stat-value">{formatDuration(totalPlaytimeSeconds)}</p>
                <p className="stat-label">Tracked playtime</p>
              </div>
              <div>
                <p className="stat-value">{totalBreaksTaken}</p>
                <p className="stat-label">Breaks taken</p>
              </div>
              <div>
                <p className="stat-value">{totalBreaksSkipped}</p>
                <p className="stat-label">Breaks skipped</p>
              </div>
              <div>
                <p className="stat-value">{formatDuration(averageSessionSeconds)}</p>
                <p className="stat-label">Average session</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="span-12">
          <Card title="Session History" subtitle="Expand a session to inspect its timing and break details">
            {loading ? (
              <div className="empty-state">
                <p>Loading recent sessions...</p>
              </div>
            ) : sessions.length > 0 ? (
              <div className="session-history">
                {sessions.map((session) => (
                  <details key={session._id} className="session-record" open={false}>
                    <summary className="session-record__summary">
                      <div>
                        <h3 className="history-card__title">{session.gameName}</h3>
                        <p className="history-card__meta">{formatDateTime(session.startedAt)}</p>
                      </div>

                      <div className="session-record__summary-meta">
                        <span className="badge">{formatDuration(session.durationSeconds)}</span>
                        <span className="badge badge--subtle">{getEndingReasonLabel(session.endingReason)}</span>
                      </div>
                    </summary>

                    <div className="session-record__body">
                      <div className="session-record__grid">
                        <div className="session-detail">
                          <p className="session-detail__label">Start time</p>
                          <p className="session-detail__value">{formatDateTime(session.startTime || session.startedAt)}</p>
                        </div>
                        <div className="session-detail">
                          <p className="session-detail__label">End time</p>
                          <p className="session-detail__value">{formatDateTime(session.endTime || session.endedAt)}</p>
                        </div>
                        <div className="session-detail">
                          <p className="session-detail__label">Session duration</p>
                          <p className="session-detail__value">{formatDuration(session.durationSeconds)}</p>
                        </div>
                        <div className="session-detail">
                          <p className="session-detail__label">Breaks taken</p>
                          <p className="session-detail__value">{session.breaksTaken || 0}</p>
                        </div>
                        <div className="session-detail">
                          <p className="session-detail__label">Breaks skipped</p>
                          <p className="session-detail__value">{session.breaksSkipped || 0}</p>
                        </div>
                        <div className="session-detail">
                          <p className="session-detail__label">Longest break</p>
                          <p className="session-detail__value">{formatDuration(session.longestBreakSeconds || 0)}</p>
                        </div>
                      </div>

                      <div className="session-record__footer">
                        <span className="badge badge--subtle">Ending reason: {getEndingReasonLabel(session.endingReason)}</span>
                        <span className="badge badge--subtle">
                          Total break time: {formatDuration(session.totalBreakSeconds || 0)}
                        </span>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No completed sessions yet. Play a session on the dashboard and it will appear here.</p>
              </div>
            )}
          </Card>
        </div>
      </section>
    </AppLayout>
  )
}
