import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import { API_BASE_URL } from '../config/api'
import { validateSignupForm } from '../utils/authValidation'

const wait = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds)
})

export default function Signup({ setToken }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState({ type: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userCount, setUserCount] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const fetchPublicStats = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/auth/public-stats`)
        setUserCount(Number(res.data.userCount) || 0)
      } catch {
        setUserCount(null)
      }
    }

    fetchPublicStats()
  }, [])

  const handleSignup = async (event) => {
    event.preventDefault()

    const validationMessage = validateSignupForm({ username, email, password })
    if (validationMessage) {
      setStatus({ type: 'error', message: validationMessage })
      return
    }

    try {
      setIsSubmitting(true)
      setStatus({ type: 'info', message: 'Creating account, please wait...' })

      const res = await axios.post(`${API_BASE_URL}/api/auth/signup`, {
        username: username.trim(),
        email: email.trim(),
        password,
      })

      localStorage.setItem('token', res.data.token)
      localStorage.setItem('username', res.data.username)
      localStorage.setItem('email', res.data.email || email.trim())
      if (Number.isFinite(Number(res.data.userCount))) {
        setUserCount(Number(res.data.userCount))
      }
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'sign_up', {
          method: 'email',
        })
      }
      setStatus({ type: 'success', message: res.data.message || 'Account created successfully.' })
      await wait(900)
      setToken(res.data.token)
      navigate('/dashboard')
    } catch (error) {
      setStatus({ type: 'error', message: error.response?.data?.error || 'Signup failed. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" title="Create account" subtitle="Start balancing game time and breaks with a calmer routine.">
        <form className="stack" onSubmit={handleSignup}>
          {status.message ? (
            <p className={`notice notice--${status.type || 'info'}`} aria-live="polite">
              {status.message}
            </p>
          ) : null}

          <label className="field">
            <span className="field__label">Username</span>
            <input
              className="input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Your name"
              autoComplete="username"
            />
          </label>

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
              placeholder="Create password"
              autoComplete="new-password"
            />
          </label>

          <p className="helper-text">Use a valid email and a password with at least 6 characters.</p>
          {userCount !== null ? (
            <p className="helper-text">Join {userCount.toLocaleString()} player{userCount === 1 ? '' : 's'} already tracking calmer sessions.</p>
          ) : null}

          <Button variant="primary" size="lg" block type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Sign up'}
          </Button>

          <p className="auth-link">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </form>
      </Card>
    </div>
  )
}
