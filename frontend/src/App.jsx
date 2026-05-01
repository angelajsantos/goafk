import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import { useEffect, useState } from 'react'
import Games from './pages/Games'
import Sessions from './pages/Sessions'
import Statistics from './pages/Statistics'
import Settings from './pages/Settings'
import { loadGames, loadSettings, saveGames, saveSettings } from './utils/demoData'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [settings, setSettings] = useState(loadSettings)
  const [games, setGames] = useState(loadGames)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)')

    const applyTheme = () => {
      const resolvedTheme =
        settings.appearanceMode === 'system'
          ? (mediaQuery.matches ? 'light' : 'dark')
          : (settings.appearanceMode || 'dark')

      document.documentElement.dataset.theme = resolvedTheme
    }

    applyTheme()
    mediaQuery.addEventListener('change', applyTheme)

    return () => mediaQuery.removeEventListener('change', applyTheme)
  }, [settings.appearanceMode])

  const updateSettings = nextSettings => {
    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  const updateGames = nextGames => {
    setGames(nextGames)
    saveGames(nextGames)
  }

  const toggleAppearance = () => {
    updateSettings({
      ...settings,
      appearanceMode: settings.appearanceMode === 'light' ? 'dark' : 'light',
    })
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/signup" element={<Signup setToken={setToken} />} />
        <Route
          path="/dashboard"
          element={
            token ? (
              <Dashboard
                setToken={setToken}
                settings={settings}
                setSettings={updateSettings}
                onToggleAppearance={toggleAppearance}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/games"
          element={
            token ? (
              <Games
                setToken={setToken}
                games={games}
                setGames={updateGames}
                appearanceMode={settings.appearanceMode}
                onToggleAppearance={toggleAppearance}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/sessions"
          element={
            token ? (
              <Sessions
                setToken={setToken}
                settings={settings}
                appearanceMode={settings.appearanceMode}
                onToggleAppearance={toggleAppearance}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/statistics"
          element={
            token ? (
              <Statistics
                setToken={setToken}
                settings={settings}
                appearanceMode={settings.appearanceMode}
                onToggleAppearance={toggleAppearance}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/settings"
          element={
            token ? (
              <Settings
                setToken={setToken}
                settings={settings}
                setSettings={updateSettings}
                onToggleAppearance={toggleAppearance}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
