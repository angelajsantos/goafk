import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { API_BASE_URL } from '../config/api'
import { applyReminderPreset, REMINDER_PRESETS, resolveReminderPresetKey, syncReminderSettings } from '../utils/reminderPresets'
import {
  browserNotificationsSupported,
  ensureBrowserNotificationPermission,
  getBrowserNotificationPermission,
} from '../utils/browserNotifications'
import { playReminderChime, prepareReminderChime } from '../utils/reminderChime'
import {
  WELLNESS_INTENSITIES,
  WELLNESS_REMINDER_TYPES,
  normalizeWellnessPreferences,
} from '../utils/wellnessReminders'

const defaultAccount = {
  username: '',
  email: '',
  steam: null,
}

const formatMinutes = (value) => {
  const minutes = Number(value) || 0
  return `${minutes} minute${minutes === 1 ? '' : 's'}`
}

const formatWellnessCadence = (intensity) =>
  Object.entries(intensity.intervals || {})
    .map(([type, minutes]) => `${WELLNESS_REMINDER_TYPES[type]?.label || type}: ${minutes}m`)
    .join(' / ')

export default function Settings({ setToken, settings, setSettings, setGames, onToggleAppearance }) {
  const token = localStorage.getItem('token')
  const storedUsername = localStorage.getItem('username') || 'Player'
  const [account, setAccount] = useState(defaultAccount)
  const [displayName, setDisplayName] = useState(storedUsername)
  const [profileNotice, setProfileNotice] = useState({ type: '', message: '' })
  const [passwordNotice, setPasswordNotice] = useState({ type: '', message: '' })
  const [reminderNotice, setReminderNotice] = useState({ type: '', message: '' })
  const [steamNotice, setSteamNotice] = useState({ type: '', message: '' })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [isConnectingSteam, setIsConnectingSteam] = useState(false)
  const [isDisconnectingSteam, setIsDisconnectingSteam] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])
  const wellnessPreferences = normalizeWellnessPreferences(settings)
  const activePreset = resolveReminderPresetKey(settings.reminderPreset)
  const activePresetDescription = REMINDER_PRESETS[activePreset]?.description || REMINDER_PRESETS.custom.description
  const notificationPermission = getBrowserNotificationPermission()
  const breakTimingSummary = `Every ${formatMinutes(settings.breakReminderIntervalMinutes)} with a ${formatMinutes(settings.preferredBreakDuration)} suggested break.`

  const updateBreakReminderSettings = (partialSettings) => {
    const nextSettings = syncReminderSettings(
      {
        ...partialSettings,
        reminderPreset: partialSettings.reminderPreset || 'custom',
      },
      settings
    )

    setSettings(nextSettings)
  }

  const applyBreakPreset = (presetKey) => {
    setSettings(applyReminderPreset(presetKey, settings))
  }

  const toggleBrowserNotifications = async () => {
    setReminderNotice({ type: '', message: '' })

    if (settings.notifications && getBrowserNotificationPermission() === 'granted') {
      setSettings({ ...settings, notifications: false })
      return
    }

    if (!browserNotificationsSupported()) {
      setSettings({ ...settings, notifications: false })
      setReminderNotice({ type: 'error', message: 'Browser notifications are not supported here.' })
      return
    }

    const permission = await ensureBrowserNotificationPermission()
    if (permission === 'granted') {
      setSettings({ ...settings, notifications: true })
      setReminderNotice({ type: 'success', message: 'Browser notifications are ready for reminders.' })
      return
    }

    setSettings({ ...settings, notifications: false })
    setReminderNotice({ type: 'error', message: 'Notifications are blocked in this browser. You can allow them from site settings.' })
  }

  const toggleReminderSound = async () => {
    const nextReminderSound = !settings.reminderSound
    setSettings({ ...settings, reminderSound: nextReminderSound })

    if (nextReminderSound) {
      await prepareReminderChime()
      playReminderChime()
    }
  }

  const updateWellnessSettings = (partialSettings) => {
    setSettings({
      ...settings,
      ...partialSettings,
    })
  }

  const toggleWellnessType = (type) => {
    updateWellnessSettings({
      wellnessReminderTypes: {
        ...wellnessPreferences.activeTypes,
        [type]: !wellnessPreferences.activeTypes[type],
      },
    })
  }

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/auth/me`, { headers })
        setAccount({
          ...defaultAccount,
          ...res.data,
        })
        setDisplayName(res.data.username || storedUsername)
        localStorage.setItem('username', res.data.username || storedUsername)
        if (res.data.email) {
          localStorage.setItem('email', res.data.email)
        }
      } catch (error) {
        setProfileNotice({
          type: 'error',
          message: error.response?.data?.error || 'Unable to load account settings right now.',
        })
      }
    }

    fetchAccount()
  }, [headers, storedUsername])

  useEffect(() => {
    const steamStatus = searchParams.get('steam')
    const steamError = searchParams.get('steam_error')

    if (!steamStatus && !steamError) {
      return
    }

    if (steamStatus === 'connected') {
      setSteamNotice({ type: 'success', message: 'Steam account connected.' })
    }

    if (steamError) {
      setSteamNotice({ type: 'error', message: steamError })
    }

    const nextSearchParams = new URLSearchParams(searchParams)
    nextSearchParams.delete('steam')
    nextSearchParams.delete('steam_error')
    setSearchParams(nextSearchParams, { replace: true })
  }, [searchParams, setSearchParams])

  const toggleAppearance = () => {
    setSettings({
      ...settings,
      appearanceMode: settings.appearanceMode === 'light' ? 'dark' : 'light',
    })
  }

  const saveDisplayName = async () => {
    const nextName = displayName.trim()
    if (!nextName) return

    setIsSavingProfile(true)
    setProfileNotice({ type: '', message: '' })

    try {
      const res = await axios.put(`${API_BASE_URL}/api/auth/profile`, { username: nextName }, { headers })
      setAccount((current) => ({ ...current, username: res.data.username, email: res.data.email }))
      setDisplayName(res.data.username)
      localStorage.setItem('username', res.data.username)
      if (res.data.email) {
        localStorage.setItem('email', res.data.email)
      }
      setProfileNotice({ type: 'success', message: res.data.message || 'Profile updated.' })
    } catch (error) {
      setProfileNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to save your profile.',
      })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const savePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordNotice({ type: 'error', message: 'Please fill in all password fields.' })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordNotice({ type: 'error', message: 'New password and confirmation do not match.' })
      return
    }

    setIsSavingPassword(true)
    setPasswordNotice({ type: '', message: '' })

    try {
      const res = await axios.put(
        `${API_BASE_URL}/api/auth/password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        { headers }
      )

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setPasswordNotice({ type: 'success', message: res.data.message || 'Password updated successfully.' })
    } catch (error) {
      setPasswordNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to update your password.',
      })
    } finally {
      setIsSavingPassword(false)
    }
  }

  const startSteamAuth = async () => {
    setIsConnectingSteam(true)
    setSteamNotice({ type: '', message: '' })

    try {
      const res = await axios.get(`${API_BASE_URL}/api/steam/auth/state`, { headers })
      window.location.assign(res.data.authUrl)
    } catch (error) {
      setSteamNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to start Steam sign in.',
      })
      setIsConnectingSteam(false)
    }
  }

  const disconnectSteam = async () => {
    const confirmed = window.confirm('Disconnect Steam? Imported Steam games may be removed.')
    if (!confirmed) return

    setIsDisconnectingSteam(true)
    setSteamNotice({ type: '', message: '' })

    try {
      const res = await axios.delete(`${API_BASE_URL}/api/steam/disconnect`, { headers })
      setAccount((current) => ({
        ...current,
        steam: null,
      }))
      setGames?.([])
      setSteamNotice({ type: 'success', message: res.data.message || 'Steam account disconnected.' })
    } catch (error) {
      setSteamNotice({
        type: 'error',
        message: error.response?.data?.error || 'Unable to disconnect Steam account.',
      })
    } finally {
      setIsDisconnectingSteam(false)
    }
  }

  return (
    <AppLayout
      title="Settings"
      subtitle="Manage your account and a few calm app preferences."
      username={displayName}
      setToken={setToken}
      appearanceMode={settings.appearanceMode}
      onToggleAppearance={onToggleAppearance || toggleAppearance}
    >
      <section className="dashboard-grid">
        <div className="span-12">
          <Card title="Account" subtitle="Your profile details for GoAFK.">
            <div className="account-stack">
              {profileNotice.message ? <p className={`notice notice--${profileNotice.type || 'info'}`}>{profileNotice.message}</p> : null}

              <div className="settings-grid">
                <label className="field">
                  <span className="field__label">Display name</span>
                  <input
                    className="input"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={40}
                    placeholder="How should we address you?"
                  />
                </label>

                <label className="field">
                  <span className="field__label">Email address</span>
                  <input
                    className="input"
                    value={account.email || localStorage.getItem('email') || 'Saved after your next login'}
                    readOnly
                  />
                </label>
              </div>

              <div className="account-actions">
                <Button variant="primary" onClick={saveDisplayName} disabled={isSavingProfile || !displayName.trim()}>
                  {isSavingProfile ? 'Saving...' : 'Save profile'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <div className="span-12">
          <Card title="Break reminders" subtitle={breakTimingSummary}>
            <div className="account-stack">
              {reminderNotice.message ? <p className={`notice notice--${reminderNotice.type || 'info'}`}>{reminderNotice.message}</p> : null}

              <div className="settings-section">
                <div>
                  <p className="settings-section__title">How reminders reach you</p>
                  <p className="settings-section__help">These apply to both break reminders and wellness nudges.</p>
                </div>

                <div className="settings-option-grid">
                  <button
                    type="button"
                    className={`toggle ${settings.notifications && notificationPermission === 'granted' ? 'toggle--on' : ''}`}
                    onClick={toggleBrowserNotifications}
                  >
                    <div>
                      <p className="settings-list__title">Browser notifications</p>
                      <p className="settings-list__meta">Show reminders when this tab is in the background.</p>
                    </div>
                    <span className="badge">
                      {settings.notifications && notificationPermission === 'granted'
                        ? 'On'
                        : notificationPermission === 'default'
                          ? 'Allow'
                          : 'Off'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`toggle ${settings.reminderSound ? 'toggle--on' : ''}`}
                    onClick={toggleReminderSound}
                  >
                    <div>
                      <p className="settings-list__title">Reminder chime</p>
                      <p className="settings-list__meta">Play a soft three-note chime when a reminder appears.</p>
                    </div>
                    <span className="badge">{settings.reminderSound ? 'On' : 'Off'}</span>
                  </button>
                </div>
              </div>

              <div className="settings-section">
                <div>
                  <p className="settings-section__title">Timing preset</p>
                  <p className="settings-section__help">{activePresetDescription}</p>
                </div>

                <div className="preset-grid">
                  {Object.entries(REMINDER_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      className={`preset-chip ${activePreset === key ? 'preset-chip--active' : ''}`}
                      onClick={() => applyBreakPreset(key)}
                    >
                      <strong>{preset.label}</strong>
                      <span className="preset-chip__subtitle">{preset.subtitle || 'Your timing'}</span>
                      {preset.intervalMinutes ? (
                        <span className="preset-chip__meta">
                          Reminder every {preset.intervalMinutes}m / break {preset.breakDurationMinutes}m
                        </span>
                      ) : (
                        <span className="preset-chip__meta">Uses the custom timing below</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="settings-grid">
                  <label className="field">
                    <span className="field__label">Reminder interval</span>
                    <input
                      className="input"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={settings.breakReminderIntervalMinutes}
                      onChange={(event) =>
                        updateBreakReminderSettings({ breakReminderIntervalMinutes: Math.max(0.1, Number(event.target.value) || 0.1) })
                      }
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Suggested break length</span>
                    <select
                      className="input input--select"
                      value={settings.preferredBreakDuration}
                      onChange={(event) =>
                        updateBreakReminderSettings({ preferredBreakDuration: Number(event.target.value) || 5 })
                      }
                    >
                      {[1, 5, 10, 15].map((value) => (
                        <option key={value} value={value}>
                          {value} minutes
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="span-12">
          <Card title="Wellness reminders" subtitle="Optional comfort nudges while a gaming session is active.">
            <div className="account-stack">
              <div className="settings-section">
                <div>
                  <p className="settings-section__title">General comfort reminders</p>
                  <p className="settings-section__help">These do not stop your session; they simply offer small reset prompts.</p>
                </div>

                <button
                  type="button"
                  className={`toggle ${wellnessPreferences.enabled ? 'toggle--on' : ''}`}
                  onClick={() => updateWellnessSettings({ wellnessRemindersEnabled: !wellnessPreferences.enabled })}
                >
                  <div>
                    <p className="settings-list__title">Wellness reminders</p>
                    <p className="settings-list__meta">Eye, posture, stretch, and walk check-ins during active sessions.</p>
                  </div>
                  <span className="badge">{wellnessPreferences.enabled ? 'On' : 'Off'}</span>
                </button>
              </div>

              <div className="settings-section">
                <div>
                  <p className="settings-section__title">Nudge pace</p>
                  <p className="settings-section__help">Choose how often comfort reminders appear.</p>
                </div>

                <div className="preset-grid">
                  {Object.entries(WELLNESS_INTENSITIES).map(([key, intensity]) => (
                    <button
                      key={key}
                      type="button"
                      className={`preset-chip ${wellnessPreferences.intensity === key ? 'preset-chip--active' : ''}`}
                      onClick={() => updateWellnessSettings({ wellnessIntensity: key })}
                    >
                      <strong>{intensity.label}</strong>
                      <span className="preset-chip__subtitle">{intensity.description}</span>
                      <span className="preset-chip__meta">{formatWellnessCadence(intensity)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <div>
                  <p className="settings-section__title">Reminder types</p>
                  <p className="settings-section__help">Mute any wellness prompts you do not want during play.</p>
                </div>

                <div className="wellness-type-grid">
                  {Object.entries(WELLNESS_REMINDER_TYPES).map(([type, reminder]) => (
                    <button
                      key={type}
                      type="button"
                      className={`toggle ${wellnessPreferences.activeTypes[type] ? 'toggle--on' : ''}`}
                      onClick={() => toggleWellnessType(type)}
                    >
                      <div>
                        <p className="settings-list__title">{reminder.label}</p>
                        <p className="settings-list__meta">{reminder.title}</p>
                      </div>
                      <span className="badge badge--subtle">
                        {wellnessPreferences.activeTypes[type] ? 'Active' : 'Muted'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="span-6">
          <Card title="Connected accounts" subtitle="Steam is optional and only used for library import features.">
            <div className="account-stack">
              {steamNotice.message ? <p className={`notice notice--${steamNotice.type || 'info'}`}>{steamNotice.message}</p> : null}

              {!account.steam?.steamId ? (
                <div className="settings-list__item">
                  <div>
                    <p className="settings-list__title">Steam connection</p>
                    <p className="settings-list__meta">Not connected. Manual session tracking still works from the dashboard.</p>
                  </div>
                  <span className="badge badge--subtle">Optional</span>
                </div>
              ) : null}

              {!account.steam?.steamId ? (
                <div className="account-actions">
                  <Button variant="primary" onClick={startSteamAuth} disabled={isConnectingSteam}>
                    {isConnectingSteam ? 'Opening Steam...' : 'Sign in with Steam'}
                  </Button>
                </div>
              ) : null}

              {account.steam?.steamId ? (
                <div className="steam-profile">
                  {account.steam.avatar ? (
                    <img className="steam-profile__avatar" src={account.steam.avatar} alt="" />
                  ) : null}
                  <div className="steam-profile__details">
                    <div className="row">
                      <p className="settings-list__title">{account.steam.personaName || 'Steam profile'}</p>
                      <span className="badge">{account.steam.verified ? 'Verified' : 'Connected'}</span>
                    </div>
                    <p className="settings-list__meta">{account.steam.steamId}</p>
                    {account.steam.profileUrl ? (
                      <a className="steam-profile__link" href={account.steam.profileUrl} target="_blank" rel="noreferrer">
                        View Steam profile
                      </a>
                    ) : null}
                    <div className="account-actions account-actions--inline">
                      <Button
                        variant="secondary"
                        className="ui-button--destructive-subtle"
                        onClick={disconnectSteam}
                        disabled={isDisconnectingSteam}
                      >
                        {isDisconnectingSteam ? 'Disconnecting...' : 'Disconnect Steam'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="span-6">
          <Card title="Password reset" subtitle="Update the password used for email sign-in.">
            <div className="account-stack">
              {passwordNotice.message ? <p className={`notice notice--${passwordNotice.type || 'info'}`}>{passwordNotice.message}</p> : null}

              <div className="settings-grid">
                <label className="field">
                  <span className="field__label">Current password</span>
                  <input
                    className="input"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    autoComplete="current-password"
                  />
                </label>

                <label className="field">
                  <span className="field__label">New password</span>
                  <input
                    className="input"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    autoComplete="new-password"
                  />
                </label>

                <label className="field">
                  <span className="field__label">Confirm new password</span>
                  <input
                    className="input"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    autoComplete="new-password"
                  />
                </label>
              </div>

              <div className="account-actions">
                <Button variant="primary" onClick={savePassword} disabled={isSavingPassword}>
                  {isSavingPassword ? 'Updating...' : 'Update password'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </AppLayout>
  )
}
