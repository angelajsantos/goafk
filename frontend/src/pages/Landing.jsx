import { Link, Navigate } from 'react-router-dom'
import ThemeToggle from '../components/ui/ThemeToggle'
import darkIcon from '../assets/darkicon-wobg.png'
import lightIcon from '../assets/lighticon-wobg.png'

const features = [
  {
    title: 'Session tracking',
    text: 'Start a focused play session and keep a calm record of how long you played.',
  },
  {
    title: 'Break reminders',
    text: 'Get gentle nudges for breaks, posture checks, eye resets, and longer-session care.',
  },
  {
    title: 'Steam game import',
    text: 'Connect Steam to browse your library and start tracking from real game names.',
  },
  {
    title: 'Stats and history',
    text: 'Review completed sessions, playtime patterns, and healthier follow-through over time.',
  },
]

export default function Landing({ token, appearanceMode = 'dark', onToggleAppearance }) {
  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  const heroIcon = appearanceMode === 'light' ? lightIcon : darkIcon

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <nav className="landing-nav" aria-label="Landing navigation">
          <Link className="landing-nav__brand" to="/">GoAFK</Link>
          <div className="landing-nav__actions">
            <Link className="ui-button ui-button--ghost ui-button--md" to="/login">Log In</Link>
            <ThemeToggle appearanceMode={appearanceMode} onToggleAppearance={onToggleAppearance} />
          </div>
        </nav>

        <div className="landing-hero__inner">
          <div className="landing-hero__content">
            <p className="landing-eyebrow">Cozy gaming session tracker</p>
            <h1>GoAFK</h1>
            <p className="landing-hero__tagline">A cozy companion for healthier gaming sessions.</p>
            <p className="landing-hero__copy">
              Track your playtime, get gentle break reminders, and understand your gaming habits.
            </p>

            <div className="landing-actions">
              <Link className="ui-button ui-button--primary ui-button--lg" to="/signup">Get Started</Link>
              <Link className="ui-button ui-button--secondary ui-button--lg" to="/login">Log In</Link>
            </div>

            <p className="landing-note">Built for calm, mindful gaming - not restriction.</p>
          </div>

          <div className="landing-visual" aria-hidden="true">
            <img className="landing-visual__icon" src={heroIcon} alt="" />
          </div>
        </div>
      </section>

      <section className="landing-overview" aria-label="GoAFK features">
        <div className="landing-preview">
          <div>
            <p className="landing-preview__label">Current session</p>
            <h2>Stardew Valley</h2>
            <p className="landing-preview__timer">01:24:18</p>
          </div>
          <div className="landing-preview__meta">
            <span className="badge badge--warm">Next break in 06:42</span>
            <span className="badge badge--subtle">Steam connected</span>
          </div>
        </div>

        <div className="landing-feature-grid">
          {features.map((feature) => (
            <article key={feature.title} className="landing-feature">
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
