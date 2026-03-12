import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Design from './pages/Design'
import Finance from './pages/Finance'
import HR from './pages/HR'
import Assets from './pages/Assets'
import Checkin from './pages/Checkin'
import CheckinAdmin from './pages/CheckinAdmin'
import History from './pages/History'
import Announcements from './pages/Announcements'
import Documents from './pages/Documents'
import Import from './pages/Import'

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
                  <Routes>
                    <Route path="/"             element={<Dashboard />} />
                    <Route path="/projects"     element={<Projects />} />
                    <Route path="/design"       element={<Design />} />
                    <Route path="/finance"      element={<Finance />} />
                    <Route path="/hr"           element={<HR />} />
                    <Route path="/assets"       element={<Assets />} />
                    <Route path="/history"       element={<History />} />
                    <Route path="/announcements" element={<Announcements />} />
                    <Route path="/documents"    element={<Documents />} />
                    <Route path="/import"       element={<Import />} />
                  </Routes>
                </Layout>
              </RequireAuth>
            } />
          </Routes>
        </AuthProvider>
      </AppProvider>
    </BrowserRouter>
  )
}
