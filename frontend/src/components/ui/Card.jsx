export default function Card({ title, subtitle, className = '', children, actions }) {
  const classes = ['ui-card', className].filter(Boolean).join(' ')

  return (
    <section className={classes}>
      {(title || subtitle || actions) && (
        <header className="ui-card__header">
          <div>
            {title && <h3 className="ui-card__title">{title}</h3>}
            {subtitle && <p className="ui-card__subtitle">{subtitle}</p>}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  )
}
