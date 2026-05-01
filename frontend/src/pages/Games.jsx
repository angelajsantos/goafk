import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { mockSteamLibrary } from '../utils/demoData'

export default function Games({ setToken, games, setGames, appearanceMode, onToggleAppearance }) {
  const username = localStorage.getItem('username')

  const importFromSteam = () => {
    setGames(mockSteamLibrary)
  }

  return (
    <AppLayout
      title="Games"
      subtitle="A mock Steam library to demo where your imported collection can live."
      username={username}
      setToken={setToken}
      appearanceMode={appearanceMode}
      onToggleAppearance={onToggleAppearance}
      actions={
        <Button variant="primary" onClick={importFromSteam}>
          Import from Steam
        </Button>
      }
    >
      <section className="dashboard-grid">
        <div className="span-12">
          <Card
            title="Steam Library"
            subtitle={
              games.length > 0
                ? `${games.length} games ready for demo review.`
                : 'No games imported yet. Use the mock Steam import to populate this view.'
            }
          >
            {games.length > 0 ? (
              <div className="games-grid">
                {games.map(game => (
                  <article key={game.id} className={`game-card ${game.accent}`}>
                    <div className="game-card__cover">
                      <span>{game.title.slice(0, 1)}</span>
                    </div>
                    <div className="game-card__content">
                      <div className="row">
                        <h3 className="game-card__title">{game.title}</h3>
                        <span className="badge">{game.status}</span>
                      </div>
                      <p className="game-card__meta">{game.playtimeHours} hours played</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Import a sample library to simulate the start of a real Steam sync experience.</p>
              </div>
            )}
          </Card>
        </div>
      </section>
    </AppLayout>
  )
}
