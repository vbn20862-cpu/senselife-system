import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, Kanban, DollarSign, Users, Package, Menu, X, Megaphone, FolderOpen, Upload, ChevronDown, LogOut, ClipboardCheck, Shield, History, MessageSquarePlus, Bug, Lightbulb, HelpCircle, Send } from 'lucide-react'
import logo from '../assets/logo.jpeg'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

const NAV_MAIN = [
  { to: '/',         icon: LayoutDashboard, label: '儀表板' },
  { to: '/projects', icon: FolderKanban,    label: '案件管理' },
  { to: '/design',   icon: Kanban,          label: '執行追蹤' },
  { to: '/finance',  icon: DollarSign,      label: '財務管理' },
  { to: '/hr',       icon: Users,           label: '人事管理' },
  { to: '/assets',   icon: Package,         label: '公司財產' },
]

const NAV_EXPAND = [
  { to: '/history',       icon: History,        label: '歷年紀錄' },
]

const NAV_SYSTEM = [
  { to: '/import', icon: Upload, label: '匯入資料' },
]

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

function NavItem({ to, icon: Icon, label, end, size = 16, fontSize = '14px', fontWeight500 = true }) {
  return (
    <NavLink to={to} end={end}>
      {({ isActive }) => (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px 12px', borderRadius: '8px',
          fontSize, fontWeight: isActive ? '600' : (fontWeight500 ? '500' : '400'),
          backgroundColor: isActive ? C.navActive : 'transparent',
          color: isActive ? C.navActiveTxt : C.navText,
          cursor: 'pointer', transition: 'all 0.15s',
        }}>
          <Icon size={size} />
          {label}
        </div>
      )}
    </NavLink>
  )
}

const FB_TYPES = [
  { value: 'Bug', label: 'Bug 回報', icon: Bug, color: '#c04030' },
  { value: '建議', label: '功能建議', icon: Lightbulb, color: '#c08a30' },
  { value: '其他', label: '其他', icon: HelpCircle, color: '#7a8a6a' },
]

export default function Layout({ children }) {
  const [open, setOpen]           = useState(false)
  const [expandOpen, setExpandOpen] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [fbType, setFbType] = useState('Bug')
  const [fbMsg, setFbMsg] = useState('')
  const [fbSent, setFbSent] = useState(false)
  const { currentUser, isAdmin, logout } = useAuth()
  const { addItem } = useApp()
  const navigate = useNavigate()

  function handleFeedbackSubmit() {
    if (!fbMsg.trim()) return
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    addItem('feedbacks', {
      id: Date.now(),
      type: fbType,
      message: fbMsg.trim(),
      reporter: currentUser?.name || currentUser?.username || '未知',
      createdAt: now,
    })
    setFbSent(true)
    setTimeout(() => {
      setShowFeedback(false)
      setFbMsg('')
      setFbType('Bug')
      setFbSent(false)
    }, 1200)
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const roleLabel = isAdmin ? '管理員' : '員工'
  const roleColor = isAdmin ? '#c8a84a' : 'rgba(200,184,138,0.6)'

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

          {NAV_MAIN.map(({ to, icon, label }) => (
            <div key={to} onClick={() => setOpen(false)}>
              <NavItem to={to} icon={icon} label={label} end={to === '/'} />
            </div>
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

          {expandOpen && NAV_EXPAND.map(({ to, icon, label }) => (
            <div key={to} onClick={() => setOpen(false)}>
              <NavItem to={to} icon={icon} label={label} size={15} fontSize="13px" fontWeight500={false} />
            </div>
          ))}

          {/* 系統工具 */}
          <div style={{ margin: '8px 4px', borderTop: `1px solid ${C.sidebarBorder}` }} />
          <div style={{ fontSize: '10px', color: 'rgba(200,184,138,0.3)', fontWeight: '600', letterSpacing: '0.08em', padding: '2px 12px 4px' }}>
            系統工具
          </div>

          {NAV_SYSTEM.map(({ to, icon, label }) => (
            <div key={to} onClick={() => setOpen(false)}>
              <NavItem to={to} icon={icon} label={label} size={15} fontSize="13px" fontWeight500={false} />
            </div>
          ))}

          {/* 打卡後台（管理員專屬）*/}
          {isAdmin && (
            <a href="/checkin-admin" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '8px',
                fontSize: '13px', fontWeight: '400',
                color: 'rgba(200,184,138,0.5)',
                cursor: 'pointer', textDecoration: 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <ClipboardCheck size={15} />
              打卡後台
              <span style={{ fontSize: '10px', color: 'rgba(200,184,138,0.35)', marginLeft: 'auto' }}>↗</span>
            </a>
          )}
        </nav>

        {/* 回報問題按鈕 */}
        <div style={{ padding: '0 14px 4px' }}>
          <button onClick={() => setShowFeedback(true)} style={{
            display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
            padding: '8px 10px', borderRadius: '8px', border: `1px solid rgba(200,184,138,0.15)`,
            backgroundColor: 'rgba(200,184,138,0.06)', cursor: 'pointer',
            fontSize: '12px', color: 'rgba(200,184,138,0.55)', fontWeight: '500',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(200,184,138,0.12)'; e.currentTarget.style.color = 'rgba(200,184,138,0.8)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(200,184,138,0.06)'; e.currentTarget.style.color = 'rgba(200,184,138,0.55)' }}>
            <MessageSquarePlus size={14} />
            回報問題 / 建議
          </button>
        </div>

        {/* 底部：使用者資訊 + 登出 */}
        <div style={{ borderTop: `1px solid ${C.sidebarBorder}`, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* 頭像圓圈 */}
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
              backgroundColor: isAdmin ? '#4d3a10' : '#2a3d24',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {isAdmin
                ? <Shield size={14} style={{ color: '#c8a84a' }} />
                : <Users size={14} style={{ color: '#7ab870' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: C.logoText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.name || currentUser?.username}
              </div>
              <div style={{ fontSize: '10px', color: roleColor, marginTop: '1px' }}>{roleLabel}</div>
            </div>
            {/* 登出按鈕 */}
            <button
              onClick={handleLogout}
              title="登出"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(200,184,138,0.35)', padding: '4px', display: 'flex', borderRadius: '6px', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#e07060'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(200,184,138,0.35)'}
            >
              <LogOut size={15} />
            </button>
          </div>
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

      {/* 回報 Modal */}
      {showFeedback && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => { setShowFeedback(false); setFbSent(false) }} style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
          <div style={{
            position: 'relative', backgroundColor: '#fdfaf5', borderRadius: '16px',
            padding: '28px', width: '400px', maxWidth: '92vw',
            boxShadow: '0 20px 60px rgba(60,30,0,0.25)',
          }}>
            {fbSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>&#10003;</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#3a6d31' }}>感謝你的回報！</div>
                <div style={{ fontSize: '12px', color: '#8a7a6a', marginTop: '6px' }}>我們會盡快處理</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#3e2e1e', margin: 0 }}>回報問題 / 建議</h2>
                  <button onClick={() => setShowFeedback(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b0a090', fontSize: '18px', padding: '2px' }}>✕</button>
                </div>

                {/* 類型選擇 */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  {FB_TYPES.map(ft => {
                    const Icon = ft.icon
                    const active = fbType === ft.value
                    return (
                      <button key={ft.value} onClick={() => setFbType(ft.value)} style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600',
                        cursor: 'pointer', transition: 'all 0.15s',
                        border: active ? `2px solid ${ft.color}` : '2px solid #ede5d8',
                        backgroundColor: active ? `${ft.color}12` : '#fff',
                        color: active ? ft.color : '#8a7a6a',
                      }}>
                        <Icon size={14} />
                        {ft.label}
                      </button>
                    )
                  })}
                </div>

                {/* 描述 */}
                <textarea
                  value={fbMsg}
                  onChange={e => setFbMsg(e.target.value)}
                  placeholder="請描述你遇到的問題或建議..."
                  rows={4}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '10px',
                    border: '1.5px solid #ede5d8', backgroundColor: '#fff',
                    fontSize: '13px', color: '#3e2e1e', resize: 'vertical',
                    outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#c8b88a'}
                  onBlur={e => e.currentTarget.style.borderColor = '#ede5d8'}
                />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                  <span style={{ fontSize: '11px', color: '#b0a090' }}>
                    回報人：{currentUser?.name || currentUser?.username}
                  </span>
                  <button onClick={handleFeedbackSubmit} disabled={!fbMsg.trim()} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 20px', borderRadius: '10px', border: 'none',
                    fontSize: '13px', fontWeight: '600', cursor: fbMsg.trim() ? 'pointer' : 'not-allowed',
                    backgroundColor: fbMsg.trim() ? '#3a6d31' : '#d8d0c4',
                    color: fbMsg.trim() ? '#f2f7f0' : '#a09888',
                    transition: 'all 0.15s',
                  }}>
                    <Send size={13} />
                    送出
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
