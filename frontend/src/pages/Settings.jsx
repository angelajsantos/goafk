import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import { applyReminderPreset, REMINDER_PRESETS, syncReminderSettings } from '../utils/reminderPresets'

export default function Settings({ setToken, settings, setSettings }) {
  const username = localStorage.getItem('username')

  const updateSetting = (key, value) => {
    const nextSettings = syncReminderSettings(
      {
        [key]: value,
        reminderPreset: key === 'reminderPreset' ? value : 'custom',
      },
      settings
    )

    setSettings(key === 'reminderPreset' ? applyReminderPreset(value, settings) : nextSettings)
  }

  return (
    <AppLayout
      title="Settings"
      subtitle="Tune the app's reminder style and session defaults for a calmer routine."
      username={username}
      setToken={setToken}
    >
      <section className="dashboard-grid">
        <div className="span-8">
          <Card title="Reminder Preferences" subtitle="Demo-ready settings stored on the frontend">
            <div className="settings-grid">
              <label className="field">
                <span className="field__label">Preset</span>
                <select
                  className="input input--select"
                  value={settings.reminderPreset || 'balanced'}
                  onChange={e => updateSetting('reminderPreset', e.target.value)}
                >
                  {Object.entries(REMINDER_PRESETS).map(([key, preset]) => (
                    <option key={key} value={key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Break reminder interval (minutes)</span>
                <input
                  className="input"
                  type="number"
                  value={settings.breakReminderIntervalMinutes}
                  onChange={e => updateSetting('breakReminderIntervalMinutes', Number(e.target.value) || 0)}
                />
              </label>

              <label className="field">
                <span className="field__label">Preferred break duration (minutes)</span>
                <select
                  className="input input--select"
                  value={settings.preferredBreakDuration}
                  onChange={e => updateSetting('preferredBreakDuration', Number(e.target.value))}
                >
                  {[1, 5, 10, 15].map(value => (
                    <option key={value} value={value}>
                      {value} minutes
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field__label">Daily playtime limit (minutes)</span>
                <input
                  className="input"
                  type="number"
                  value={settings.dailyPlaytimeLimit}
                  onChange={e => updateSetting('dailyPlaytimeLimit', Number(e.target.value) || 0)}
                />
              </label>

              <label className="field">
                <span className="field__label">Reminder style</span>
                <select
                  className="input input--select"
                  value={settings.reminderMode || (settings.gentleReminderMode ? 'gentle' : 'focus')}
                  onChange={e => updateSetting('reminderMode', e.target.value)}
                >
                  <option value="gentle">Gentle reminder mode</option>
                  <option value="balanced">Balanced mode</option>
                  <option value="focus">Focus mode</option>
                </select>
              </label>
            </div>
          </Card>
        </div>

        <div className="span-4">
          <Card title="Toggles" subtitle="Quick switches for demo scenarios">
            <div className="toggle-list">
              <button className={`toggle ${settings.reminderSound ? 'toggle--on' : ''}`} onClick={() => updateSetting('reminderSound', !settings.reminderSound)}>
                <span>Reminder sound</span>
                <strong>{settings.reminderSound ? 'On' : 'Off'}</strong>
              </button>
              <button className={`toggle ${settings.notifications ? 'toggle--on' : ''}`} onClick={() => updateSetting('notifications', !settings.notifications)}>
                <span>Notifications</span>
                <strong>{settings.notifications ? 'On' : 'Off'}</strong>
              </button>
              <button className={`toggle ${settings.darkCozyTheme ? 'toggle--on' : ''}`} onClick={() => updateSetting('darkCozyTheme', !settings.darkCozyTheme)}>
                <span>Dark cozy theme</span>
                <strong>{settings.darkCozyTheme ? 'Ready' : 'Off'}</strong>
              </button>
              <button
                className={`toggle ${settings.sessionAutoPauseReminder ? 'toggle--on' : ''}`}
                onClick={() => updateSetting('sessionAutoPauseReminder', !settings.sessionAutoPauseReminder)}
              >
                <span>Session auto-pause reminder</span>
                <strong>{settings.sessionAutoPauseReminder ? 'On' : 'Off'}</strong>
              </button>
              <button className={`toggle ${settings.focusMode ? 'toggle--on' : ''}`} onClick={() => updateSetting('focusMode', !settings.focusMode)}>
                <span>Focus mode</span>
                <strong>{settings.focusMode ? 'On' : 'Off'}</strong>
              </button>
            </div>
          </Card>
        </div>
      </section>
    </AppLayout>
  )
}
