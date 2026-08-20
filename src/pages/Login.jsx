import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.jpeg'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) { setError('請輸入帳號與密碼'); return }
    setError('')
    setLoading(true)
    setTimeout(() => {
      const ok = login(username, password)
      if (!ok) setError('帳號或密碼錯誤，請確認後再試')
      setLoading(false)
    }, 250)
  }

  const input = {
    width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px',
    padding: '11px 14px', fontSize: '14px', outline: 'none',
    backgroundColor: '#fdfaf5', color: '#2c1a0e', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(160deg, #4a1e0e 0%, #3d1a0b 50%, #200d06 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      {/* Logo */}
      <img src={logo} alt="深活共構"
        style={{ height: '72px', objectFit: 'contain', filter: 'invert(1)', mixBlendMode: 'screen', marginBottom: '28px' }} />

      {/* Card */}
      <div style={{
        backgroundColor: '#ffffff', borderRadius: '20px', padding: '36px 32px',
        width: '100%', maxWidth: '380px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#2c1a0e', margin: '0 0 4px' }}>登入</h1>
        <p style={{ fontSize: '13px', color: '#9a7a5a', margin: '0 0 28px' }}>深活共構管理系統</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '6px', fontWeight: '500' }}>帳號</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="輸入帳號"
              autoFocus
              autoComplete="username"
              style={input}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '6px', fontWeight: '500' }}>密碼</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="輸入密碼"
              autoComplete="current-password"
              style={input}
            />
          </div>

          {error && (
            <div style={{
              fontSize: '13px', color: '#8a3a20',
              backgroundColor: '#f5e8e0', border: '1px solid #e0b8a0',
              padding: '10px 14px', borderRadius: '8px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#c85c28', color: '#fff8f4',
              border: 'none', borderRadius: '10px',
              padding: '13px', fontSize: '14px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1, marginTop: '6px',
              transition: 'opacity 0.15s, background-color 0.15s, box-shadow 0.15s',
              boxShadow: '0 2px 8px rgba(58,109,49,0.3)',
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.backgroundColor = '#2e5627'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(58,109,49,0.4)' } }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#3a6d31'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(58,109,49,0.3)' }}
          >
            {loading ? '登入中…' : '登入'}
          </button>
        </form>
      </div>

      <p style={{ fontSize: '11px', color: 'rgba(200,184,138,0.3)', marginTop: '28px', letterSpacing: '0.05em' }}>
        深活共構 · v1.0 · 2026
      </p>
    </div>
  )
}
