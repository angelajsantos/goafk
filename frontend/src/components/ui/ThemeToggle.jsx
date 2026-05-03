export default function ThemeToggle({ appearanceMode = 'dark', onToggleAppearance, className = '' }) {
  if (!onToggleAppearance) return null

  const nextMode = appearanceMode === 'light' ? 'dark' : 'light'
  const classes = ['theme-toggle', className].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={classes}
      onClick={onToggleAppearance}
      aria-label={`Switch to ${nextMode} mode`}
      title={`Switch to ${nextMode} mode`}
    >
      <span className="theme-toggle__icon" aria-hidden="true">
        {appearanceMode === 'light' ? '\u2600' : '\u263E'}
      </span>
    </button>
  )
}
