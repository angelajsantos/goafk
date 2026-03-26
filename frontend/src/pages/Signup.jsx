import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function Signup({ setToken }) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSignup = async () => {
    try {
      const res = await axios.post('http://localhost:3001/api/auth/signup', { username, email, password })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('username', res.data.username)
      setToken(res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed')
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" title="Create account" subtitle="Start balancing game time and breaks with a calmer routine.">
        <div className="stack">
          {error && <p className="error-text">{error}</p>}

          <label className="field">
            <span className="field__label">Username</span>
            <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your name" />
          </label>

          <label className="field">
            <span className="field__label">Email</span>
            <input className="input" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Create password"
            />
          </label>

          <Button variant="primary" size="lg" block onClick={handleSignup}>
            Sign up
          </Button>

          <p className="auth-link">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
