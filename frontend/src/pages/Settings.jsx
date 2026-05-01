import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import AppLayout from '../components/layout/AppLayout'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { API_BASE_URL } from '../config/api'

const defaultAccount = {
  username: '',
  email: '',
}

export default function Settings({ setToken, settings, setSettings, onToggleAppearance }) {
  const token = localStorage.getItem('token')
  const storedUsername = localStorage.getItem('username') || 'Player'
  const [account, setAccount] = useState(defaultAccount)
  const [displayName, setDisplayName] = useState(storedUsername)
  const [profileNotice, setProfileNotice] = useState({ type: '', message: '' })
  const [passwordNotice, setPasswordNotice] = useState({ type: '', message: '' })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

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
          <Card title="Profile" subtitle="Basic account details for this session companion">
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
                  <span className="field__label">Email</span>
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

        <div className="span-6">
          <Card title="Password & Security" subtitle="Keep access comfortable but protected">
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
                  <span className="field__label">Confirm password</span>
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
