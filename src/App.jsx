import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Design from './pages/Design'
import Finance from './pages/Finance'
import HR from './pages/HR'
import Assets from './pages/Assets'
import Checkin from './pages/Checkin'
import CheckinAdmin from './pages/CheckinAdmin'
import Leave from './pages/Leave'
import Contract from './pages/Contract'
import CRM from './pages/CRM'
import Announcements from './pages/Announcements'
import Documents from './pages/Documents'
import Import from './pages/Import'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* 員工打卡 — 獨立頁，無 sidebar */}
          <Route path="/checkin" element={<Checkin />} />
          {/* 打卡後台管理 — 獨立頁，有密碼保護 */}
          <Route path="/checkin-admin" element={<CheckinAdmin />} />

          {/* 主系統 */}
          <Route path="*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/design" element={<Design />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/hr" element={<HR />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/leave" element={<Leave />} />
                <Route path="/contract" element={<Contract />} />
                <Route path="/crm" element={<CRM />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/import" element={<Import />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
