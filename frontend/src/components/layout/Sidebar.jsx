import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', to: '/dashboard' },
  { id: 'games', label: 'Games', to: '/games' },
  { id: 'sessions', label: 'Sessions', to: '/sessions' },
  { id: 'statistics', label: 'Statistics', to: '/statistics' },
  { id: 'settings', label: 'Settings', to: '/settings' },
]

export default function Sidebar({ username }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <p className="sidebar__eyebrow">GoAFK</p>
        <h1 className="sidebar__title">Calm Play Companion</h1>
      </div>

      <nav className="sidebar__nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.id}
            to={item.to}
            className={({ isActive }) => `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <p className="sidebar__meta">Player</p>
        <p className="sidebar__name">{username || 'Guest'}</p>
      </div>
    </aside>
  )
}
