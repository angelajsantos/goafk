import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Button from '../ui/Button'

export default function AppLayout({ title, subtitle, username, setToken, actions, children }) {
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
