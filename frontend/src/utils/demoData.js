export const defaultSettings = {
  appearanceMode: 'dark',
  breakReminderIntervalMinutes: 30,
  dailyPlaytimeLimit: 120,
  reminderSound: true,
  notifications: true,
  darkCozyTheme: true,
  sessionAutoPauseReminder: true,
  preferredBreakDuration: 5,
  reminderPreset: 'support',
  reminderMode: 'balanced',
  gentleReminderMode: true,
  focusMode: false,
  wellnessRemindersEnabled: true,
  wellnessIntensity: 'balanced',
  wellnessReminderTypes: {
    eye: true,
    posture: true,
    stretch: true,
    walk: true,
  },
}

export const mockSteamLibrary = [
  {
    id: 'hades',
    title: 'Hades',
    playtimeHours: 82,
    status: 'Recently played',
    accent: 'game-card--ember',
  },
  {
    id: 'stardew-valley',
    title: 'Stardew Valley',
    playtimeHours: 146,
    status: 'Cozy favorite',
    accent: 'game-card--meadow',
  },
  {
    id: 'cyberpunk-2077',
    title: 'Cyberpunk 2077',
    playtimeHours: 61,
    status: 'Installed',
    accent: 'game-card--dusk',
  },
  {
    id: 'hollow-knight',
    title: 'Hollow Knight',
    playtimeHours: 54,
    status: 'Backlog revisit',
    accent: 'game-card--mist',
  },
]

const SETTINGS_KEY = 'goafk.settings'
const GAMES_KEY = 'goafk.games'

export function loadSettings() {
  if (typeof window === 'undefined') return defaultSettings

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function loadGames() {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(GAMES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveGames(games) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(GAMES_KEY, JSON.stringify(games))
}

export function deriveSessionInsights(session, index) {
  const durationSeconds = session.durationSeconds || session.durationMinutes * 60 || 0
  const durationMinutes = Math.max(1, Math.floor(durationSeconds / 60))
  const reminderWindows = Math.max(1, Math.floor(durationMinutes / 30))
  const breaksTaken = durationMinutes >= 25 ? Math.max(1, Math.min(3, reminderWindows - (index % 2 === 0 ? 0 : 1))) : 0
  const breaksSkipped = durationMinutes >= 20 ? Math.max(0, reminderWindows - breaksTaken) : 0
  const longestBreakMinutes = breaksTaken > 0 ? [5, 10, 15][index % 3] : 0

  return {
    breaksTaken,
    breaksSkipped,
    longestBreakMinutes,
    reminderStyle: breaksTaken > breaksSkipped ? 'gentle follow-through' : 'quick return',
  }
}
