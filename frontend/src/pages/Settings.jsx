import { useMemo, useState } from 'react'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'

export default function Settings({ setToken, settings, setSettings }) {
  const storedUsername = localStorage.getItem('username') || 'Player'
  const storedEmail = localStorage.getItem('email') || ''
  const [displayName, setDisplayName] = useState(storedUsername)
  const [profileNotice, setProfileNotice] = useState('')

  const memberSummary = useMemo(() => {
    return storedEmail
      ? 'Signed in and ready for calmer, dashboard-first session tracking.'
      : 'Signed in with a local demo account. Add an email on your next login for a fuller profile.'
  }, [storedEmail])

  const saveDisplayName = () => {
    const nextName = displayName.trim() || 'Player'
    localStorage.setItem('username', nextName)
    setDisplayName(nextName)
    setProfileNotice('Display name updated for this device.')
  }

  const updateAppearance = (value) => {
    setSettings({
      ...settings,
      appearanceMode: value,
    })
  }

  return (
    <AppLayout
      title="Settings"
      subtitle="Manage your account, appearance, and a few calm app preferences."
      username={displayName}
      setToken={setToken}
    >
      <section className="dashboard-grid">
        <div className="span-8">
          <Card title="Profile" subtitle="Basic account details for this session companion">
            <div className="account-stack">
              {profileNotice ? <p className="notice notice--success">{profileNotice}</p> : null}

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
                  <span className="field__label">Email</span>
                  <input
                    className="input"
                    value={storedEmail || 'Saved after your next login'}
                    readOnly
                  />
                </label>
              </div>

              <div className="account-actions">
                <Button variant="primary" onClick={saveDisplayName} disabled={!displayName.trim()}>
                  Save profile
                </Button>
              </div>

              <div className="account-summary">
                <div className="account-summary__item">
                  <span className="account-summary__label">Account status</span>
                  <strong>Active</strong>
                </div>
                <div className="account-summary__item">
                  <span className="account-summary__label">Experience</span>
                  <strong>Dashboard-first reminders</strong>
                </div>
                <div className="account-summary__item">
                  <span className="account-summary__label">Summary</span>
                  <strong>{memberSummary}</strong>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="span-4">
          <Card title="Appearance" subtitle="Choose how the app should look on this device">
            <div className="stack">
              <label className="field">
                <span className="field__label">Theme preference</span>
                <select
                  className="input input--select"
                  value={settings.appearanceMode || 'dark'}
                  onChange={(event) => updateAppearance(event.target.value)}
                >
                  <option value="dark">Dark cozy</option>
                  <option value="system">System</option>
                  <option value="light">Light</option>
                </select>
              </label>
              <p className="helper-text">
                Dark mode is the polished experience today. System and light are ready for future tuning.
              </p>
            </div>
          </Card>
        </div>

        <div className="span-6">
          <Card title="Account Management" subtitle="Safe placeholders for the next round of account tools">
            <div className="settings-list">
              <div className="settings-list__item">
                <div>
                  <p className="settings-list__title">Password and security</p>
                  <p className="settings-list__meta">Password reset and device management can live here next.</p>
                </div>
                <span className="badge badge--subtle">Soon</span>
              </div>
              <div className="settings-list__item">
                <div>
                  <p className="settings-list__title">Email preferences</p>
                  <p className="settings-list__meta">Notification controls can be added once account messaging is wired up.</p>
                </div>
                <span className="badge badge--subtle">Planned</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="span-6">
          <Card title="Connected Accounts" subtitle="Space for future Steam and platform integrations">
            <div className="settings-list">
              <div className="settings-list__item">
                <div>
                  <p className="settings-list__title">Steam connection</p>
                  <p className="settings-list__meta">Library sync and richer session naming can plug in here later.</p>
                </div>
                <span className="badge">Not connected</span>
              </div>
              <div className="settings-list__item">
                <div>
                  <p className="settings-list__title">Other launchers</p>
                  <p className="settings-list__meta">Epic, Xbox, and Discord presence can follow the same pattern.</p>
                </div>
                <span className="badge badge--subtle">Future</span>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </AppLayout>
  )
}
