import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { API_BASE_URL } from '../config/api'

const getGameKey = (game) => game.appId || game.id || game.name || game.title
const getGameName = (game) => game.name || game.title || 'Untitled Steam Game'
const getGameIcon = (game) => game.icon || game.logo

const getPlaytimeMinutes = (game) => {
  if (typeof game.playtimeForever === 'number') {
    return game.playtimeForever
  }

  if (typeof game.playtimeHours === 'number') {
    return game.playtimeHours * 60
  }

  return 0
}

const formatPlaytime = (minutes) => {
  if (!minutes) {
    return 'No recorded playtime'
  }

  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours.toLocaleString()} ${hours === 1 ? 'hour' : 'hours'} played`
}

export default function Games({ setToken, games, setGames, appearanceMode, onToggleAppearance }) {
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  const [account, setAccount] = useState(null)
  const [notice, setNotice] = useState({ type: '', message: '' })
  const [isLoadingAccount, setIsLoadingAccount] = useState(true)
  const [isImportingGames, setIsImportingGames] = useState(false)
  const [isStartingSteamAuth, setIsStartingSteamAuth] = useState(false)
  const [isDisconnectingSteam, setIsDisconnectingSteam] = useState(false)

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const steamConnected = Boolean(account?.steam?.steamId && account?.steam?.verified)

  useEffect(() => {
    const fetchAccount = async () => {
      setIsLoadingAccount(true)

      try {
        const res = await axios.get(`${API_BASE_URL}/api/auth/me`, { headers })
        setAccount(res.data)
      } catch (error) {
        setNotice({
          type: 'error',
          message: error.response?.data?.error || 'Unable to check your Steam connection.',
        })
      } finally {
        setIsLoadingAccount(false)
      }
    }

    fetchAccount()
  }, [headers])

  const startSteamAuth = async () => {
    setIsStartingSteamAuth(true)
    setNotice({ type: '', message: '' })

    try {
      const res = await axios.get(`${API_BASE_URL}/api/steam/auth/state`, { headers })
      window.location.assign(res.data.authUrl)
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to start Steam sign in.',
      })
      setIsStartingSteamAuth(false)
    }
  }

  const importSteamLibrary = async () => {
    setIsImportingGames(true)
    setNotice({ type: '', message: '' })

    try {
      const res = await axios.get(`${API_BASE_URL}/api/steam/games`, { headers })
      const nextGames = res.data.games || []
      setGames(nextGames)
      setNotice({
        type: nextGames.length ? 'success' : 'info',
        message: nextGames.length
          ? `Imported ${nextGames.length.toLocaleString()} Steam games.`
          : 'No games found.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to import your Steam games.',
      })
    } finally {
      setIsImportingGames(false)
    }
  }

  const disconnectSteam = async () => {
    const confirmed = window.confirm('Disconnect Steam? Imported Steam games may be removed.')
    if (!confirmed) return

    setIsDisconnectingSteam(true)
    setNotice({ type: '', message: '' })

    try {
      const res = await axios.delete(`${API_BASE_URL}/api/steam/disconnect`, { headers })
      setAccount((current) => ({
        ...current,
        steam: null,
      }))
      setGames([])
      setNotice({ type: 'success', message: res.data.message || 'Steam account disconnected.' })
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to disconnect Steam account.',
      })
    } finally {
      setIsDisconnectingSteam(false)
    }
  }

  return (
    <AppLayout
      title="Games"
      subtitle="Import your verified Steam library for a simple view of your games and playtime."
      username={username}
      setToken={setToken}
      appearanceMode={appearanceMode}
      onToggleAppearance={onToggleAppearance}
      actions={
        steamConnected ? (
          <>
            <Button variant="primary" onClick={importSteamLibrary} disabled={isImportingGames || isDisconnectingSteam}>
              {isImportingGames ? 'Importing...' : 'Import Steam Library'}
            </Button>
            <Button
              variant="secondary"
              className="ui-button--destructive-subtle"
              onClick={disconnectSteam}
              disabled={isDisconnectingSteam || isImportingGames}
            >
              {isDisconnectingSteam ? 'Disconnecting...' : 'Disconnect Steam'}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={startSteamAuth} disabled={isStartingSteamAuth || isLoadingAccount}>
            {isStartingSteamAuth ? 'Opening Steam...' : 'Sign in with Steam'}
          </Button>
        )
      }
    >
      <section className="dashboard-grid">
        <div className="span-12">
          <Card
            title="Steam Library"
            subtitle={
              steamConnected
                ? `${account.steam.personaName || 'Steam'} is connected and ready to import.`
                : 'Connect Steam to import your owned games.'
            }
          >
            <div className="account-stack">
              {notice.message ? <p className={`notice notice--${notice.type || 'info'}`}>{notice.message}</p> : null}

              {isLoadingAccount ? (
                <div className="empty-state empty-state--loading">
                  <span className="loading-spinner" aria-hidden="true" />
                  <p>Checking Steam connection...</p>
                </div>
              ) : !steamConnected ? (
                <div className="empty-state empty-state--action">
                  <div className="stack center">
                    <p>Connect your Steam account to import your games.</p>
                    <Button variant="primary" onClick={startSteamAuth} disabled={isStartingSteamAuth}>
                      {isStartingSteamAuth ? 'Opening Steam...' : 'Sign in with Steam'}
                    </Button>
                  </div>
                </div>
              ) : isImportingGames ? (
                <div className="empty-state empty-state--loading">
                  <span className="loading-spinner" aria-hidden="true" />
                  <p>Importing your Steam library...</p>
                </div>
              ) : games.length > 0 ? (
                <div className="games-grid">
                  {games.map((game) => {
                    const playtimeMinutes = getPlaytimeMinutes(game)
                    const gameIcon = getGameIcon(game)

                    return (
                      <article key={getGameKey(game)} className="game-card">
                        <div className="game-card__cover game-card__cover--steam">
                          {gameIcon ? (
                            <img src={gameIcon} alt="" />
                          ) : (
                            <span>{getGameName(game).slice(0, 1)}</span>
                          )}
                        </div>
                        <div className="game-card__content">
                          <div className="row">
                            <h3 className="game-card__title">{getGameName(game)}</h3>
                            {game.playtime2Weeks ? <span className="badge">Recently played</span> : null}
                          </div>
                          <p className="game-card__meta">{formatPlaytime(playtimeMinutes)}</p>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state empty-state--action">
                  <div className="stack center">
                    <p>No games imported yet.</p>
                    <Button variant="primary" onClick={importSteamLibrary}>
                      Import Steam Library
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </section>
    </AppLayout>
  )
}
