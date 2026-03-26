import { useState } from 'react'
import axios from 'axios'
import { useNavigate, Link } from 'react-router-dom'

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
        <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
        <h1>GoAFK 🎮</h1>
        <h2>Sign Up</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }} />
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }} />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: '10px', padding: '8px' }} />
        <button onClick={handleSignup} style={{ width: '100%', padding: '10px', background: '#4CAF50', color: 'white', border: 'none', cursor: 'pointer' }}>Sign Up</button>
        <p>Already have an account? <Link to="/login">Login</Link></p>
        </div>
    )
}