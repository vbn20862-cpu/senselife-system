import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Palette, DollarSign, Users, Package, Menu, X, CalendarOff, FileSignature, Handshake, Megaphone, FolderOpen, Upload, ChevronDown } from 'lucide-react'
import logo from '../assets/logo.jpeg'

const NAV_MAIN = [
  { to: '/',         icon: LayoutDashboard, label: '儀表板' },
  { to: '/projects', icon: FolderKanban,    label: '案件管理' },
  { to: '/design',   icon: Palette,         label: '設計任務' },
  { to: '/finance',  icon: DollarSign,      label: '財務管理' },
  { to: '/hr',       icon: Users,           label: '人事管理' },
  { to: '/assets',   icon: Package,         label: '公司財產' },
]

const NAV_EXPAND = [
  { to: '/leave',         icon: CalendarOff,    label: '請假管理' },
  { to: '/contract',      icon: FileSignature,  label: '合約管理' },
  { to: '/crm',           icon: Handshake,      label: '客戶關係' },
  { to: '/announcements', icon: Megaphone,      label: '公告欄' },
  { to: '/documents',     icon: FolderOpen,     label: '文件庫' },
]

const NAV_SYSTEM = [
  { to: '/import', icon: Upload, label: '匯入資料' },
]

// 大地色系色票
const C = {
  sidebarBg:      '#1c2718',
  sidebarBorder:  'rgba(255,255,255,0.07)',
  logoText:       '#c8b88a',
  logoSub:        'rgba(200,184,138,0.45)',
  navText:        'rgba(200,184,138,0.7)',
  navActive:      '#4d8843',
  navActiveTxt:   '#f2f7f0',
  footerTxt:      'rgba(200,184,138,0.28)',
  mobileBg:       '#1c2718',
  mobileTxt:      '#c8b88a',
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false)
  const [expandOpen, setExpandOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#f5f0e8' }}>
      {open && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-30 w-60 flex flex-col
        transform transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} style={{ backgroundColor: C.sidebarBg }}>

        {/* Logo */}
        <div className="px-5 py-5 flex items-center justify-between"
          style={{ borderBottom: `1px solid ${C.sidebarBorder}` }}>
          <NavLink to="/" end onClick={() => setOpen(false)} style={{ display: 'flex', alignItems: 'center' }}>
            <img src={logo} alt="深活共構" style={{ height: '64px', width: 'auto', objectFit: 'contain', filter: 'invert(1)', mixBlendMode: 'screen', cursor: 'pointer' }} />
          </NavLink>
          <button onClick={() => setOpen(false)} className="md:hidden" style={{ color: C.logoText }}>
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV_MAIN.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '8px',
                  fontSize: '14px', fontWeight: isActive ? '600' : '500',
                  backgroundColor: isActive ? C.navActive : 'transparent',
                  color: isActive ? C.navActiveTxt : C.navText,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <Icon size={16} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}

          {/* 擴充功能（可收合） */}
          <div style={{ margin: '8px 4px', borderTop: `1px solid ${C.sidebarBorder}` }} />
          <button onClick={() => setExpandOpen(p => !p)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 12px 4px', width: '100%',
          }}>
            <span style={{ fontSize: '10px', color: 'rgba(200,184,138,0.4)', fontWeight: '600', letterSpacing: '0.08em' }}>擴充功能</span>
            <ChevronDown size={12} style={{ color: 'rgba(200,184,138,0.35)', transition: 'transform 0.2s', transform: expandOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>

          {expandOpen && NAV_EXPAND.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: isActive ? '600' : '400',
                  backgroundColor: isActive ? C.navActive : 'transparent',
                  color: isActive ? C.navActiveTxt : 'rgba(200,184,138,0.5)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <Icon size={15} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}

          {/* 分隔 */}
          <div style={{ margin: '8px 4px', borderTop: `1px solid ${C.sidebarBorder}` }} />
          <div style={{ fontSize: '10px', color: 'rgba(200,184,138,0.3)', fontWeight: '600', letterSpacing: '0.08em', padding: '2px 12px 4px' }}>
            系統工具
          </div>

          {NAV_SYSTEM.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} onClick={() => setOpen(false)}>
              {({ isActive }) => (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: isActive ? '600' : '400',
                  backgroundColor: isActive ? C.navActive : 'transparent',
                  color: isActive ? C.navActiveTxt : 'rgba(200,184,138,0.5)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <Icon size={15} />
                  {label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4" style={{
          borderTop: `1px solid ${C.sidebarBorder}`,
          color: C.footerTxt, fontSize: '11px', letterSpacing: '0.05em'
        }}>
          深活共構 · v1.0 · 2026
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden px-4 py-3 flex items-center gap-3"
          style={{ backgroundColor: C.mobileBg, borderBottom: `1px solid ${C.sidebarBorder}` }}>
          <button onClick={() => setOpen(true)} style={{ color: C.mobileTxt }}>
            <Menu size={22} />
          </button>
          <span className="font-semibold" style={{ color: C.mobileTxt }}>深活共構管理系統</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
