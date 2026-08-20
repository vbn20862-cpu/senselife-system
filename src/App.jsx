import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Design from './pages/Design'
import Finance from './pages/Finance'
import HR from './pages/HR'
import Leave from './pages/Leave'
import Dispatch from './pages/Dispatch'
import Guide from './pages/Guide'
import Assets from './pages/Assets'
import Checkin from './pages/Checkin'
import CheckinAdmin from './pages/CheckinAdmin'
import History from './pages/History'
import Announcements from './pages/Announcements'
import Documents from './pages/Documents'
import Import from './pages/Import'

// Loading 畫面
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f5f0eb', color: '#5c4b3a', fontFamily: 'sans-serif',
    }}>
      <div style={{
        width: 40, height: 40, border: '4px solid #d4c5b0', borderTopColor: '#8b7355',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <p style={{ marginTop: 16, fontSize: 15 }}>載入資料中...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// 等待資料載入完成
function WaitForData({ children }) {
  const { loading } = useApp()
  const { authLoading } = useAuth()
  if (loading || authLoading) return <LoadingScreen />
  return children
}

// 已登入才能進入的頁面
function RequireAuth({ children }) {
  const { currentUser } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

// 管理員才能進入（打卡後台）
function RequireAdmin({ children }) {
  const { currentUser, isAdmin } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

// 登入頁：已登入就跳回首頁
function LoginPage() {
  const { currentUser } = useAuth()
  if (currentUser) return <Navigate to="/" replace />
  return <Login />
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AuthProvider>
          <WaitForData>
            <Routes>
              {/* 登入頁 */}
              <Route path="/login" element={<LoginPage />} />

              {/* 員工打卡 — 不需登入（kiosk 模式） */}
              <Route path="/checkin" element={<Checkin />} />

              {/* 打卡後台 — 需要管理員登入 */}
              <Route path="/checkin-admin" element={
                <RequireAdmin><CheckinAdmin /></RequireAdmin>
              } />

              {/* 主系統 — 需要登入 */}
              <Route path="*" element={
                <RequireAuth>
                  <Layout>
                    <ErrorBoundary>
                      <Routes>
                        <Route path="/"             element={<Dashboard />} />
                        <Route path="/projects"     element={<Projects />} />
                        <Route path="/design"       element={<Design />} />
                        <Route path="/dispatch"     element={<Dispatch />} />
                        <Route path="/finance"      element={<Finance />} />
                        <Route path="/hr"           element={<HR />} />
                        <Route path="/leave"        element={<Leave />} />
                        <Route path="/guide"        element={<Guide />} />
                        <Route path="/assets"       element={<Assets />} />
                        <Route path="/history"       element={<History />} />
                        <Route path="/announcements" element={<Announcements />} />
                        <Route path="/documents"    element={<Documents />} />
                        <Route path="/import"       element={<Import />} />
                      </Routes>
                    </ErrorBoundary>
                  </Layout>
                </RequireAuth>
              } />
            </Routes>
          </WaitForData>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
