import { useEffect, useState } from 'react'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import { deriveSessionInsights } from '../utils/demoData'
import { API_BASE_URL } from '../config/api'

export default function Sessions({ setToken }) {
  const [sessions, setSessions] = useState([])
  const username = localStorage.getItem('username')
  const token = localStorage.getItem('token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    const res = await axios.get(`${API_BASE_URL}/api/sessions`, { headers })
    setSessions(res.data.filter(session => session.endedAt))
  }

  const sessionsWithInsights = sessions.map((session, index) => ({
    ...session,
    insights: deriveSessionInsights(session, index),
  }))

  const totalSessions = sessionsWithInsights.length
  const totalPlaytimeSeconds = sessionsWithInsights.reduce((sum, session) => sum + (session.durationSeconds || 0), 0)
  const totalPlaytimeHours = Math.round((totalPlaytimeSeconds / 3600) * 10) / 10
  const totalBreaksTaken = sessionsWithInsights.reduce((sum, session) => sum + session.insights.breaksTaken, 0)
  const totalBreaksSkipped = sessionsWithInsights.reduce((sum, session) => sum + session.insights.breaksSkipped, 0)
  const averageSessionMinutes = totalSessions > 0 ? Math.round(totalPlaytimeSeconds / totalSessions / 60) : 0

  return (
    <AppLayout
      title="Sessions"
      subtitle="A deeper view of play patterns, break behavior, and session history."
      username={username}
      setToken={setToken}
    >
      <section className="dashboard-grid">
        <div className="span-12">
          <Card title="Session Overview" subtitle="Real session history with frontend-derived break insights for demo polish">
            <div className="stats-grid">
              <div>
                <p className="stat-value">{totalSessions}</p>
                <p className="stat-label">Total sessions</p>
              </div>
              <div>
                <p className="stat-value">{totalPlaytimeHours}h</p>
                <p className="stat-label">Total playtime</p>
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
                <p className="stat-value">{averageSessionMinutes}m</p>
                <p className="stat-label">Average session</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="span-12">
          <Card title="Session History" subtitle="Each entry includes demo-friendly break behavior details">
            {sessionsWithInsights.length > 0 ? (
              <div className="session-history">
                {sessionsWithInsights.map(session => (
                  <article key={session._id} className="history-card">
                    <div className="history-card__top">
                      <div>
                        <h3 className="history-card__title">{session.gameName}</h3>
                        <p className="history-card__meta">{new Date(session.startedAt).toLocaleString()}</p>
                      </div>
                      <p className="history-card__duration">
                        {session.durationMinutes}m {session.durationSeconds ? `${session.durationSeconds % 60}s` : ''}
                      </p>
                    </div>

                    <div className="history-card__stats">
                      <span className="badge">Breaks taken: {session.insights.breaksTaken}</span>
                      <span className="badge">Skipped: {session.insights.breaksSkipped}</span>
                      <span className="badge">Longest break: {session.insights.longestBreakMinutes}m</span>
                      <span className="badge">Style: {session.insights.reminderStyle}</span>
                    </div>
                  </article>
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
