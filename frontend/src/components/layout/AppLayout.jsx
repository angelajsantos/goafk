import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Button from '../ui/Button'

const FEEDBACK_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeWKGACTFyQrJc6puQwGM4XxJtchpgzWVTV5kAN-8cxkHEpeg/viewform?usp=dialog'

export default function AppLayout({
  title,
  subtitle,
  username,
  setToken,
  actions,
  children,
  appearanceMode = 'dark',
  onToggleAppearance,
}) {
  const navigate = useNavigate()

  const logout = () => {
    localStorage.clear()
    setToken(null)
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <Sidebar username={username} />

      <main className="dashboard-main">
        <header className="topbar">
          <div className="topbar__title">
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="topbar__actions">
            {onToggleAppearance ? (
              <button
                type="button"
                className="theme-toggle"
                onClick={onToggleAppearance}
                aria-label={`Switch to ${appearanceMode === 'light' ? 'dark' : 'light'} mode`}
                title={`Switch to ${appearanceMode === 'light' ? 'dark' : 'light'} mode`}
              >
                <span className="theme-toggle__icon" aria-hidden="true">
                  {appearanceMode === 'light' ? '\u2600' : '\u263E'}
                </span>
              </button>
            ) : null}
            {actions}
            <a
              className="feedback-link"
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Give Feedback
            </a>
            <Button variant="ghost" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>

        {children}
      </main>
    </div>
  )
}
