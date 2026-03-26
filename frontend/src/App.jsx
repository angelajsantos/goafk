import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import { useState } from 'react'
import Games from './pages/Games'
import Sessions from './pages/Sessions'
import Settings from './pages/Settings'
import { loadGames, loadSettings, saveGames, saveSettings } from './utils/demoData'

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [settings, setSettings] = useState(loadSettings)
  const [games, setGames] = useState(loadGames)

  const updateSettings = nextSettings => {
    setSettings(nextSettings)
    saveSettings(nextSettings)
  }

  const updateGames = nextGames => {
    setGames(nextGames)
    saveGames(nextGames)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={token ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login setToken={setToken} />} />
        <Route path="/signup" element={<Signup setToken={setToken} />} />
        <Route
          path="/dashboard"
          element={token ? <Dashboard setToken={setToken} settings={settings} /> : <Navigate to="/login" />}
        />
        <Route
          path="/games"
          element={token ? <Games setToken={setToken} games={games} setGames={updateGames} /> : <Navigate to="/login" />}
        />
        <Route
          path="/sessions"
          element={token ? <Sessions setToken={setToken} settings={settings} /> : <Navigate to="/login" />}
        />
        <Route
          path="/settings"
          element={
            token ? <Settings setToken={setToken} settings={settings} setSettings={updateSettings} /> : <Navigate to="/login" />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
