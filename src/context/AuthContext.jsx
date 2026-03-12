import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const ACCOUNTS_KEY = 'auth_accounts'
const SESSION_KEY  = 'auth_session'

// 預設管理員帳號（首次安裝時使用）
const DEFAULT_ACCOUNTS = [
  {
    id: 'admin_001',
    username: 'admin',
    name: '管理員',
    email: '',
    role: 'admin',
    password: 'admin1234',
    createdAt: '2026-01-01',
  },
]

function loadAccounts() {
  try {
    const s = localStorage.getItem(ACCOUNTS_KEY)
    return s ? JSON.parse(s) : DEFAULT_ACCOUNTS
  } catch { return DEFAULT_ACCOUNTS }
}

function loadSession() {
  try {
    const s = localStorage.getItem(SESSION_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [accounts, setAccounts] = useState(loadAccounts)
  const [currentUser, setCurrentUser] = useState(loadSession)

  function persist(list) {
    setAccounts(list)
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list))
  }

  // ── 登入 ──
  function login(username, password) {
    const acc = accounts.find(a => a.username === username.trim() && a.password === password)
    if (!acc) return false
    const session = { id: acc.id, username: acc.username, name: acc.name, email: acc.email, role: acc.role }
    setCurrentUser(session)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return true
  }

  // ── 登出 ──
  function logout() {
    setCurrentUser(null)
    localStorage.removeItem(SESSION_KEY)
  }

  // ── 帳號 CRUD（管理員用）──
  function addAccount(data) {
    // 帳號名稱不能重複
    if (accounts.some(a => a.username === data.username.trim())) return { error: '帳號名稱已存在' }
    const newAcc = {
      ...data,
      username: data.username.trim(),
      id: `user_${Date.now()}`,
      createdAt: new Date().toISOString().split('T')[0],
    }
    persist([...accounts, newAcc])
    return { ok: true, account: newAcc }
  }

  function updateAccount(id, data) {
    // 若改帳號名稱，檢查不重複
    if (data.username) {
      const dup = accounts.find(a => a.username === data.username.trim() && a.id !== id)
      if (dup) return { error: '帳號名稱已存在' }
    }
    const updated = accounts.map(a => a.id === id ? { ...a, ...data } : a)
    persist(updated)
    // 若修改的是當前登入的人，同步更新 session
    if (currentUser?.id === id) {
      const u = updated.find(a => a.id === id)
      const session = { id: u.id, username: u.username, name: u.name, email: u.email, role: u.role }
      setCurrentUser(session)
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
    return { ok: true }
  }

  function deleteAccount(id) {
    if (id === 'admin_001') return { error: '無法刪除預設管理員帳號' }
    persist(accounts.filter(a => a.id !== id))
    return { ok: true }
  }

  const isAdmin = currentUser?.role === 'admin'

  return (
    <AuthContext.Provider value={{
      currentUser, accounts, isAdmin,
      login, logout,
      addAccount, updateAccount, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
