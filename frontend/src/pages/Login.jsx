import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { API_BASE_URL } from '../config/api'
import { validateLoginForm } from '../utils/authValidation'

const wait = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

export default function Login({ setToken }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (event) => {
    event.preventDefault()

    const validationMessage = validateLoginForm({ email, password })
    if (validationMessage) {
      setStatus({ type: 'error', message: validationMessage })
      return
    }

    try {
      setIsSubmitting(true)
      setStatus({ type: 'info', message: 'Signing you in, please wait...' })

      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: email.trim(),
        password,
      })

      localStorage.setItem('token', res.data.token)
      localStorage.setItem('username', res.data.username)
      localStorage.setItem('email', email.trim())
      setStatus({ type: 'success', message: res.data.message || 'Signed in successfully.' })
      await wait(700)
      setToken(res.data.token)
      navigate('/dashboard')
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.error || 'Login failed. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" title="Welcome back" subtitle="Sign in to continue your cozy tracking routine.">
        <form className="stack" onSubmit={handleLogin}>
          {status.message ? (
            <p className={`notice notice--${status.type || 'info'}`} aria-live="polite">
              {status.message}
            </p>
          ) : null}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </label>

          <Button variant="primary" size="lg" block type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing you in...' : 'Login'}
          </Button>

          <p className="auth-link">
            No account yet? <Link to="/signup">Create one</Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
