import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { API_BASE_URL } from '../config/api'

const LAST_IMPORTED_KEY = 'goafk.steamLastImportedAt'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently played' },
  { value: 'most', label: 'Most played' },
  { value: 'az', label: 'A-Z' },
  { value: 'never', label: 'Never played' },
]

const getGameKey = (game) => game.appId || game.id || game.name || game.title
const getGameName = (game) => game.name || game.title || 'Untitled Steam Game'
const getGameIcon = (game) => game.icon || game.logo
const getRecentMinutes = (game) => Math.max(0, Number(game.playtime2Weeks) || 0)

const getPlaytimeMinutes = (game) => {
  if (typeof game.playtimeForever === 'number') {
    return game.playtimeForever
  }

  if (typeof game.playtimeHours === 'number') {
    return game.playtimeHours * 60
  }

  return 0
}

const getPlaytimeHours = (minutes) => Math.round((minutes / 60) * 10) / 10

const formatPlaytime = (minutes) => {
  if (!minutes) {
    return 'No recorded playtime'
  }

  const hours = getPlaytimeHours(minutes)
  return `${hours.toLocaleString()} ${hours === 1 ? 'hour' : 'hours'}`
}

const formatPlaytimeLabel = (minutes) => {
  if (!minutes) {
    return 'No recorded playtime'
  }

  return `${formatPlaytime(minutes)} played`
}

const formatImportedTime = (value) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const sortGames = (games, sortMode) => {
  const byName = (a, b) => getGameName(a).localeCompare(getGameName(b))
  const byForever = (a, b) => getPlaytimeMinutes(b) - getPlaytimeMinutes(a) || byName(a, b)

  if (sortMode === 'most') {
    return [...games].sort(byForever)
  }

  if (sortMode === 'az') {
    return [...games].sort(byName)
  }

  if (sortMode === 'never') {
    return [...games]
      .filter((game) => getPlaytimeMinutes(game) === 0)
      .sort(byName)
  }

  return [...games].sort((a, b) => {
    const aRecent = getRecentMinutes(a)
    const bRecent = getRecentMinutes(b)
    const aForever = getPlaytimeMinutes(a)
    const bForever = getPlaytimeMinutes(b)

    if (aRecent || bRecent) {
      return bRecent - aRecent || byForever(a, b)
    }

    if (aForever || bForever) {
      return bForever - aForever || byName(a, b)
    }

    return byName(a, b)
  })
}

export default function Games({ setToken, games, setGames, appearanceMode, onToggleAppearance }) {
  const token = localStorage.getItem('token')
  const username = localStorage.getItem('username')
  const navigate = useNavigate()
  const [account, setAccount] = useState(null)
  const [notice, setNotice] = useState({ type: '', message: '' })
  const [isLoadingAccount, setIsLoadingAccount] = useState(true)
  const [isImportingGames, setIsImportingGames] = useState(false)
  const [isStartingSteamAuth, setIsStartingSteamAuth] = useState(false)
  const [isDisconnectingSteam, setIsDisconnectingSteam] = useState(false)
  const [startingGameKey, setStartingGameKey] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortMode, setSortMode] = useState('recent')
  const [selectedGame, setSelectedGame] = useState(null)
  const [lastImportedAt, setLastImportedAt] = useState(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem(LAST_IMPORTED_KEY) || ''
  })

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const steamConnected = Boolean(account?.steam?.steamId && account?.steam?.verified)

  const importedGames = useMemo(
    () => games.filter((game) => game?.source === 'steam' || game?.appId || game?.name),
    [games]
  )

  const filteredGames = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const matchingGames = query
      ? importedGames.filter((game) => getGameName(game).toLowerCase().includes(query))
      : importedGames

    return sortGames(matchingGames, sortMode)
  }, [importedGames, searchTerm, sortMode])

  const summary = useMemo(() => {
    const totalPlaytimeMinutes = importedGames.reduce((sum, game) => sum + getPlaytimeMinutes(game), 0)
    const mostPlayedGame = importedGames.reduce((top, game) => {
      if (!top || getPlaytimeMinutes(game) > getPlaytimeMinutes(top)) {
        return game
      }

      return top
    }, null)
    const recentlyPlayedCount = importedGames.filter((game) => getRecentMinutes(game) > 0).length

    return {
      totalGames: importedGames.length,
      totalPlaytimeMinutes,
      mostPlayedGame,
      recentlyPlayedCount,
    }
  }, [importedGames])

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

  const saveImportedTime = (value) => {
    setLastImportedAt(value)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_IMPORTED_KEY, value)
    }
  }

  const clearImportedTime = () => {
    setLastImportedAt('')
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LAST_IMPORTED_KEY)
    }
  }

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
      const nextGames = (res.data.games || []).map((game) => ({
        ...game,
        source: 'steam',
      }))
      const importedAt = new Date().toISOString()
      setGames(nextGames)
      saveImportedTime(importedAt)
      setNotice({
        type: nextGames.length ? 'success' : 'info',
        message: nextGames.length
          ? `Refreshed ${nextGames.length.toLocaleString()} Steam games.`
          : 'No games found. Your Steam game library may be private, or this account may not have public game details yet.',
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to import your Steam games. Your Steam game library may be private.',
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
      clearImportedTime()
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

  const startSessionForGame = async (game) => {
    const gameName = getGameName(game)
    const gameKey = getGameKey(game)

    setStartingGameKey(gameKey)
    setNotice({ type: '', message: '' })

    try {
      await axios.post(
        `${API_BASE_URL}/api/sessions/start`,
        { gameName },
        { headers }
      )
      navigate('/dashboard')
    } catch (error) {
      setNotice({
        type: 'error',
        message: error.response?.data?.error || `Unable to start a session for ${gameName}.`,
      })
    } finally {
      setStartingGameKey('')
    }
  }

  const renderGameCard = (game) => {
    const playtimeMinutes = getPlaytimeMinutes(game)
    const recentMinutes = getRecentMinutes(game)
    const gameIcon = getGameIcon(game)
    const gameName = getGameName(game)
    const gameKey = getGameKey(game)

    return (
      <article key={gameKey} className="game-card game-card--interactive">
        <button type="button" className="game-card__preview" onClick={() => setSelectedGame(game)}>
          <div className="game-card__cover game-card__cover--steam">
            {gameIcon ? (
              <img src={gameIcon} alt="" />
            ) : (
              <span>{gameName.slice(0, 1)}</span>
            )}
            {recentMinutes ? <span className="badge badge--micro game-card__recent">Recent</span> : null}
          </div>
          <div className="game-card__content">
            <h3 className="game-card__title">{gameName}</h3>
            <p className="game-card__meta">{formatPlaytimeLabel(playtimeMinutes)}</p>
          </div>
        </button>
      </article>
    )
  }

  return (
    <>
      {selectedGame ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelectedGame(null)}>
          <div className="modal game-detail-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="stack">
              <div className="game-detail-modal__head">
                <div className="game-detail-modal__media">
                  {getGameIcon(selectedGame) ? (
                    <img className="game-detail-modal__icon" src={getGameIcon(selectedGame)} alt="" />
                  ) : (
                    <span>{getGameName(selectedGame).slice(0, 1)}</span>
                  )}
                </div>
                <div>
                  <div className="game-detail-modal__badges">
                    <span className="badge badge--subtle">Steam</span>
                    {getRecentMinutes(selectedGame) ? <span className="badge">Recently played</span> : null}
                  </div>
                  <h2 className="modal__title">{getGameName(selectedGame)}</h2>
                </div>
              </div>

              <div className="session-record__grid">
                <div className="session-detail">
                  <p className="session-detail__label">App ID</p>
                  <p className="session-detail__value">{selectedGame.appId || 'Unknown'}</p>
                </div>
                <div className="session-detail">
                  <p className="session-detail__label">Total playtime</p>
                  <p className="session-detail__value">{formatPlaytime(getPlaytimeMinutes(selectedGame))}</p>
                </div>
                <div className="session-detail">
                  <p className="session-detail__label">Recent playtime</p>
                  <p className="session-detail__value">
                    {getRecentMinutes(selectedGame) ? formatPlaytime(getRecentMinutes(selectedGame)) : 'None in the last two weeks'}
                  </p>
                </div>
                <div className="session-detail">
                  <p className="session-detail__label">Source</p>
                  <p className="session-detail__value">Steam</p>
                </div>
              </div>

              <div className="modal-actions">
                <Button variant="secondary" onClick={() => setSelectedGame(null)}>
                  Close
                </Button>
                <Button variant="primary" onClick={() => startSessionForGame(selectedGame)} disabled={Boolean(startingGameKey)}>
                  {startingGameKey === getGameKey(selectedGame) ? 'Starting...' : 'Start Session'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <AppLayout
        title="Games"
        subtitle="Browse your verified Steam library and start tracking sessions from the games you actually play."
        username={username}
        setToken={setToken}
        appearanceMode={appearanceMode}
        onToggleAppearance={onToggleAppearance}
        actions={
          steamConnected ? (
            <>
              <Button variant="primary" onClick={importSteamLibrary} disabled={isImportingGames || isDisconnectingSteam}>
                {isImportingGames ? 'Refreshing...' : importedGames.length ? 'Refresh Steam Library' : 'Import Steam Library'}
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
                  ? `${account.steam.personaName || 'Steam'} is connected${lastImportedAt ? ` - last refreshed ${formatImportedTime(lastImportedAt)}` : ''}.`
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
                    <p>Refreshing your Steam library...</p>
                  </div>
                ) : importedGames.length > 0 ? (
                  <>
                    <div className="stats-grid stats-grid--four library-summary">
                      <div>
                        <p className="stat-value">{summary.totalGames.toLocaleString()}</p>
                        <p className="stat-label">Imported games</p>
                      </div>
                      <div>
                        <p className="stat-value">{formatPlaytime(summary.totalPlaytimeMinutes)}</p>
                        <p className="stat-label">Total Steam playtime</p>
                      </div>
                      <div>
                        <p className="stat-value stat-value--text">{summary.mostPlayedGame ? getGameName(summary.mostPlayedGame) : 'None'}</p>
                        <p className="stat-label">Most played game</p>
                      </div>
                      <div>
                        <p className="stat-value">{summary.recentlyPlayedCount.toLocaleString()}</p>
                        <p className="stat-label">Recently played</p>
                      </div>
                    </div>

                    <div className="library-toolbar">
                      <label className="field library-toolbar__search">
                        <span className="field__label">Search library</span>
                        <input
                          className="input"
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Search games by name"
                        />
                      </label>

                      <label className="field library-toolbar__sort">
                        <span className="field__label">Sort</span>
                        <select className="input input--select" value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                          {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {filteredGames.length > 0 ? (
                      <div className="games-grid">
                        {filteredGames.map(renderGameCard)}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <p>No games match that search or filter.</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="empty-state empty-state--action">
                    <div className="stack center">
                      <p>No games imported yet. If Steam returns no games, your game library may be private.</p>
                      <p className="helper-text">In Steam, make your profile and game details public, then refresh here.</p>
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
    </>
  )
}
