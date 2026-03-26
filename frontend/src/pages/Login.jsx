import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

export default function Login({ setToken }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async () => {
    try {
      const res = await axios.post('http://localhost:3001/api/auth/login', { email, password })
      localStorage.setItem('token', res.data.token)
      localStorage.setItem('username', res.data.username)
      setToken(res.data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    }
  }

  return (
    <div className="auth-page">
      <Card className="auth-card" title="Welcome back" subtitle="Sign in to continue your cozy tracking routine.">
        <div className="stack">
          {error && <p className="error-text">{error}</p>}

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
              placeholder="Enter password"
            />
          </label>

          <Button variant="primary" size="lg" block onClick={handleLogin}>
            Login
          </Button>

          <p className="auth-link">
            No account yet? <Link to="/signup">Create one</Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
