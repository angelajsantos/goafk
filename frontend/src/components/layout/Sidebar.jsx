const NAV_ITEMS = [
  { id: 'games', label: 'Games' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
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
          <button
            key={item.id}
            type="button"
            className={`sidebar__link ${item.id === 'sessions' ? 'sidebar__link--active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <p className="sidebar__meta">Player</p>
        <p className="sidebar__name">{username || 'Guest'}</p>
      </div>
    </aside>
  )
}
