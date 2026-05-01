import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Button from '../ui/Button'

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
