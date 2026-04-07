import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Phone, Mail, User, Pencil, Shield, Eye, EyeOff, KeyRound, Download } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS, useIsMobile } from '../styles/earth'
import { exportHR } from '../utils/exportExcel'
import { downloadCsv } from '../utils/exportCsv'

const MONTHS = ['一','二','三','四','五','六','七','八','九','十','十一','十二']

// 行政機關辦公日曆（依行政院人事行政總處公告）
const GOVT_WORK_DAYS = {
  // 114年 (2025)
  '2025-01': { days: 17, hours: 136 },
  '2025-02': { days: 19, hours: 152 },
  '2025-03': { days: 21, hours: 168 },
  '2025-04': { days: 19, hours: 152 },
  '2025-05': { days: 22, hours: 176 },
  '2025-06': { days: 20, hours: 160 },
  '2025-07': { days: 23, hours: 184 },
  '2025-08': { days: 21, hours: 168 },
  '2025-09': { days: 21, hours: 168 },
  '2025-10': { days: 20, hours: 160 },
  '2025-11': { days: 21, hours: 168 },
  '2025-12': { days: 21, hours: 168 },
  // 115年 (2026)
  '2026-01': { days: 21, hours: 168 },
  '2026-02': { days: 14, hours: 112 },
  '2026-03': { days: 22, hours: 176 },
  '2026-04': { days: 20, hours: 160 },
  '2026-05': { days: 20, hours: 160 },
  '2026-06': { days: 21, hours: 168 },
  '2026-07': { days: 23, hours: 184 },
  '2026-08': { days: 21, hours: 168 },
  '2026-09': { days: 20, hours: 160 },
  '2026-10': { days: 20, hours: 160 },
  '2026-11': { days: 21, hours: 168 },
  '2026-12': { days: 22, hours: 176 },
}

const resolveEmpName = (name, employees) => {
  if (!name) return name
  const emp = employees.find(e => e.name === name || e.name.includes(name) || name.includes(e.name))
  return emp?.name || name
}

// 時數捨去規則：小數 .0~.4 捨去，.5~.9 取 .5
const roundHours = (minutes) => Math.floor((minutes / 60) * 2) / 2

// 計算員工某月純打卡時數（含休息扣除，不含補休）
function computeEmpMonthClockHours(emp, yr, mo, data) {
  const monthStr = `${yr}-${String(mo).padStart(2,'0')}`
  const todayStr = new Date().toISOString().split('T')[0]
  const myClockins = data.clockins.filter(c =>
    c.empName && c.date?.startsWith(monthStr) &&
    (c.empName === emp.name || emp.name.includes(c.empName) || c.empName.includes(emp.name))
  )
  const allDates = [...new Set(myClockins.map(c => c.date))].sort()
  let totalMinutes = 0
  allDates.forEach(date => {
    const dayRecs = myClockins.filter(c => c.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    const ins = dayRecs.filter(c => c.type === '上班')
    const outs = dayRecs.filter(c => c.type === '下班')
    if (ins.length > 0 && outs.length > 0 && ins[0].time && outs[outs.length-1].time) {
      const [ih, im] = ins[0].time.split(':').map(Number)
      const [oh, om] = outs[outs.length-1].time.split(':').map(Number)
      let dayMin = Math.max(0, (oh*60+om) - (ih*60+im))
      if (dayMin >= 300) dayMin = Math.max(0, dayMin - 60)
      totalMinutes += dayMin
    } else if (ins.length > 0 && outs.length === 0 && ins[0].time && date === todayStr) {
      // 今天有上班沒下班：用目前時間計算
      const [ih, im] = ins[0].time.split(':').map(Number)
      const now = new Date()
      let dayMin = Math.max(0, (now.getHours() * 60 + now.getMinutes()) - (ih * 60 + im))
      if (dayMin >= 300) dayMin = Math.max(0, dayMin - 60)
      totalMinutes += dayMin
    }
  })
  return roundHours(totalMinutes)
}

// 累計所有月份轉補休時數（打卡時數 - 應上時數 的正值加總）
function computeAllTimeEarned(empId, data) {
  const emp = data.employees.find(e => e.id === empId)
  if (!emp) return 0
  const months = [...new Set(
    data.clockins
      .filter(c => c.empName && (c.empName === emp.name || emp.name.includes(c.empName) || c.empName.includes(emp.name)))
      .map(c => c.date?.slice(0, 7)).filter(Boolean)
  )]
  return months.reduce((total, mStr) => {
    const [yr, mo] = mStr.split('-').map(Number)
    const clockHrs = computeEmpMonthClockHours(emp, yr, mo, data)
    return total + Math.max(0, clockHrs - (GOVT_WORK_DAYS[mStr]?.hours || 0))
  }, 0)
}

// 出勤統計列（展開細節）
function AttendanceRow({ s, divider, green, coffee, textPrimary, textSecond, textMuted, sandLight, card, mob }) {
  const [open, setOpen] = useState(false)
  const hrs = parseFloat(s.totalHours)
  const pct = Math.min(100, (hrs / 200) * 100) // 200h = full month reference

  return (
    <div style={{ ...card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        {/* 姓名 */}
        <div style={{ width: '80px', fontWeight: '700', fontSize: '14px', color: textPrimary, flexShrink: 0 }}>{s.name}</div>
        {/* 統計數字 */}
        <div style={{ display: 'flex', gap: '20px', flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: textMuted }}>出勤</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: textPrimary, marginLeft: '6px' }}>{s.workDays}</span>
            <span style={{ fontSize: '11px', color: textMuted }}> 天</span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: textMuted }}>時數</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: green, marginLeft: '6px' }}>{s.totalHours}</span>
            <span style={{ fontSize: '11px', color: textMuted }}> h</span>
          </div>
          {s.hasOT && (
            <div>
              <span style={{ fontSize: '11px', color: textMuted }}>加班</span>
              <span style={{ fontSize: '20px', fontWeight: '800', color: '#b45309', marginLeft: '6px' }}>{s.totalOTHours}</span>
              <span style={{ fontSize: '11px', color: textMuted }}> h</span>
            </div>
          )}
          {s.missingAllCount > 0 && (
            <div style={{ backgroundColor: '#fde0dc', padding: '2px 10px', borderRadius: '999px' }}>
              <span style={{ fontSize: '11px', color: '#c04030', fontWeight: '700' }}>⚠ 未打卡 {s.missingAllCount} 天</span>
            </div>
          )}
        </div>
        {/* 展開按鈕 */}
        <span style={{ fontSize: '16px', color: textMuted, userSelect: 'none' }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* 進度條 */}
      <div style={{ height: '5px', backgroundColor: sandLight, borderRadius: '999px', overflow: 'hidden', marginTop: '10px' }}>
        <div style={{ height: '100%', borderRadius: '999px', backgroundColor: hrs > 160 ? green : hrs > 80 ? coffee : '#c89040', width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>

      {/* 每日明細（展開） */}
      {open && s.dayDetails.length > 0 && (
        <div style={{ marginTop: '12px', borderTop: `1px solid ${divider}`, paddingTop: '10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px' }}>
            {s.dayDetails.map(d => (
              <div key={d.date} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px',
                backgroundColor: d.isMissingAll ? '#fde0dc' : d.isMissingOut ? '#fde8e6' : d.isOngoing ? '#e8f4e6' : d.isCompLeave ? '#f0ebf5' : sandLight,
                borderRadius: '8px', fontSize: '12px',
              }}>
                <span style={{ color: textSecond, fontWeight: '600', minWidth: '58px' }}>{d.date.slice(5)}</span>
                {d.isMissingAll ? (
                  <span style={{ color: '#c04030', fontWeight: '700', fontSize: '11px' }}>⚠ 排班出勤未打卡</span>
                ) : d.isCompLeave ? (
                  <span style={{ color: '#6a3a80', fontWeight: '600', fontSize: '11px' }}>補休 {d.clockOut}</span>
                ) : d.isMissingOut ? (
                  <span style={{ color: '#c04030' }}>
                    {d.clockIn} → <span style={{ fontSize: '11px', fontWeight: '600' }}>未打下班卡</span>
                  </span>
                ) : d.isOngoing ? (
                  <span style={{ color: '#3a6d31' }}>
                    {d.clockIn} → <span style={{ fontSize: '11px', fontWeight: '600' }}>🟢 上班中</span>
                  </span>
                ) : (
                  <span style={{ color: textPrimary }}>
                    {d.clockIn || '--'} → {d.clockOut || '--'}
                  </span>
                )}
                {d.dayMin > 0 && (
                  <span style={{ marginLeft: 'auto', fontWeight: '700', color: d.isOngoing ? '#3a6d31' : d.isCompLeave ? '#6a3a80' : green }}>
                    {d.isOngoing ? '~' : ''}{roundHours(d.dayMin)}h
                  </span>
                )}
                {d.otMin > 0 && (
                  <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#b45309', fontWeight: '600' }}>+{roundHours(d.otMin)}h OT</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
const WEEKDAYS = ['日','一','二','三','四','五','六']
function getDayOfWeek(year, month, day) { return new Date(year, month - 1, day).getDay() }
const SHIFTS = [
  { code: '出勤',  label: '出勤',  short: '出勤', bg: '#d6e8d0', color: '#2e6031', hours: 8 },
  { code: '休假',  label: '休假',  short: '休假', bg: '#edddd8', color: '#8a3a30', hours: 0 },
  { code: '上午班', label: '上午班', short: '上午', bg: '#d0e0ee', color: '#2a5070', hours: 4 },
  { code: '下午班', label: '下午班', short: '下午', bg: '#f0e4c0', color: '#7a5a10', hours: 4 },
]
function getShift(code) { return SHIFTS.find(s => s.code === code) || null }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate() }

const EMPTY_ACC = { username: '', name: '', email: '', role: 'employee', password: '', confirmPw: '' }

export default function HR() {
  const { data, update, addItem, updateItem, deleteItem, logEdit } = useApp()
  const { currentUser, isAdmin, accounts, addAccount, updateAccount, deleteAccount } = useAuth()
  const mob = useIsMobile()
  const [tab, setTab] = useState('schedule')
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', email: '', phone: '' })
  const [editEmployee, setEditEmployee] = useState(null)

  // 帳號管理 state
  const [showAddAcc, setShowAddAcc]   = useState(false)
  const [newAcc, setNewAcc]           = useState(EMPTY_ACC)
  const [editAcc, setEditAcc]         = useState(null)
  const [accMsg, setAccMsg]           = useState('')
  const [showPw, setShowPw]           = useState(false)

  const { year, month } = scheduleMonth
  const days = daysInMonth(year, month)

  function getSchedule(empId, day) {
    return data.schedules.find(s => s.empId === empId && s.year === year && s.month === month && s.day === day)?.shift || ''
  }
  function nextShift(current) {
    if (!current) return '出勤'
    const idx = SHIFTS.findIndex(s => s.code === current)
    if (idx === SHIFTS.length - 1) return '' // 最後一個 → 清空
    return SHIFTS[idx + 1].code
  }
  function setSchedule(empId, day, shift) {
    const existing = data.schedules.find(s => s.empId === empId && s.year === year && s.month === month && s.day === day)
    if (shift === '') {
      if (existing) deleteItem('schedules', existing.id)
    } else if (existing) {
      updateItem('schedules', existing.id, { shift })
    } else {
      addItem('schedules', { id: Date.now(), empId, year, month, day, shift })
    }
  }
  function monthHours(empId) {
    return data.schedules.filter(s => s.empId === empId && s.year === year && s.month === month)
      .reduce((sum, s) => sum + (getShift(s.shift)?.hours || 0), 0)
  }

  // 排班鎖定：非管理員 + 當月 + 已過5日
  const todayDate = new Date()
  const isScheduleLocked = !isAdmin &&
    year === todayDate.getFullYear() && month === todayDate.getMonth() + 1 &&
    todayDate.getDate() > 5

  // 打卡記錄：員工只看自己的
  const visibleClockins = isAdmin
    ? [...data.clockins]
    : [...data.clockins].filter(c => c.empName === currentUser?.name)

  const TABS = [
    ['schedule',  '排班表'],
    ['attendance', '工時統計'],
    ['clockin',   '打卡記錄'],
    ...(isAdmin ? [['employees', '員工']] : []),
    ...(isAdmin ? [['accounts', '帳號管理']] : []),
    ...(isAdmin ? [['logs', '操作紀錄']] : []),
  ]

  // 帳號管理：新增
  function handleAddAccount() {
    if (!newAcc.username || !newAcc.name || !newAcc.password) { setAccMsg('請填寫帳號、姓名及密碼'); return }
    if (newAcc.password !== newAcc.confirmPw) { setAccMsg('兩次密碼不一致'); return }
    const res = addAccount({ username: newAcc.username, name: newAcc.name, email: newAcc.email, role: newAcc.role, password: newAcc.password })
    if (res?.error) { setAccMsg(res.error); return }
    setNewAcc(EMPTY_ACC); setAccMsg(''); setShowAddAcc(false)
  }

  // 帳號管理：儲存編輯
  function handleSaveAccount() {
    if (!editAcc.name) { setAccMsg('姓名不能為空'); return }
    if (isAdmin && !editAcc.username?.trim()) { setAccMsg('帳號名稱不能為空'); return }
    if (editAcc.password && editAcc.password !== editAcc.confirmPw) { setAccMsg('兩次密碼不一致'); return }
    const updates = { name: editAcc.name, email: editAcc.email, role: editAcc.role }
    if (isAdmin && editAcc.username?.trim()) updates.username = editAcc.username.trim()
    if (editAcc.password) updates.password = editAcc.password
    const res = updateAccount(editAcc.id, updates)
    if (res?.error) { setAccMsg(res.error); return }
    const who = currentUser?.name || currentUser?.username || '未知'
    logEdit({ user: who, action: '編輯', entityType: '帳號', entityName: editAcc.name, summary: `角色：${editAcc.role === 'admin' ? '管理員' : '員工'}` })
    setEditAcc(null); setAccMsg('')
  }

  // === CSV 匯出 ===
  function exportSchedule() {
    const d = daysInMonth(year, month)
    const dayHeaders = Array.from({ length: d }, (_, i) => ({
      label: String(i + 1),
      value: (row) => row.shifts[i] || ''
    }))
    const headers = [{ label: '員工', value: (row) => row.name }, ...dayHeaders]
    const rows = data.employees.map(emp => ({
      name: emp.name,
      shifts: Array.from({ length: d }, (_, i) => getSchedule(emp.id, i + 1))
    }))
    downloadCsv(`排班表_${year}年${month}月.csv`, headers, rows)
  }

  function exportAttendance() {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const monthClockins = data.clockins.filter(c => c.date && c.date.startsWith(monthStr))
    const allClockinNames = [...new Set(data.clockins.map(c => c.empName).filter(Boolean))]
    const govtInfo = GOVT_WORK_DAYS[monthStr]
    const expectedHours = govtInfo?.hours || 0

    const headers = [
      { label: '員工', value: r => r.name },
      { label: '應出勤(時)', value: r => r.expected },
      { label: '實際出勤(時)', value: r => r.actual },
      { label: '加班(時)', value: r => r.ot },
      { label: '請假(天)', value: r => r.leave },
    ]
    const rows = allClockinNames.map(name => {
      const emp = data.employees.find(e => e.name === name || e.name.includes(name) || name.includes(e.name))
      const myClockins = monthClockins.filter(c => c.empName === name)
      const workDays = new Set(myClockins.filter(c => c.type === '上班').map(c => c.date))
      let totalMinutes = 0, totalOTMinutes = 0
      const compLeaveForMonth = emp ? (data.compLeaveRecords || []).filter(r => r.empId === emp.id && r.date?.startsWith(monthStr)) : []
      const allDates = [...new Set([...myClockins.map(c => c.date), ...compLeaveForMonth.map(r => r.date)])].sort()

      allDates.forEach(date => {
        const dayRecs = myClockins.filter(c => c.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
        const ins = dayRecs.filter(c => c.type === '上班')
        const outs = dayRecs.filter(c => c.type === '下班')
        let dayMin = 0
        if (ins.length > 0 && outs.length > 0 && ins[0].time && outs[outs.length - 1].time) {
          const [ih, im] = ins[0].time.split(':').map(Number)
          const [oh, om] = outs[outs.length - 1].time.split(':').map(Number)
          dayMin = Math.max(0, (oh * 60 + om) - (ih * 60 + im))
          if (dayMin >= 300) dayMin = Math.max(0, dayMin - 60)
        }
        const cl = compLeaveForMonth.find(r => r.date === date)
        dayMin += cl ? Number(cl.hours) * 60 : 0

        const otStart = dayRecs.filter(c => c.type === '加班開始')
        const otEnd = dayRecs.filter(c => c.type === '加班結束')
        if (otStart.length > 0 && otEnd.length > 0 && otStart[0].time && otEnd[otEnd.length - 1].time) {
          const [sh, sm] = otStart[0].time.split(':').map(Number)
          const [eh, em] = otEnd[otEnd.length - 1].time.split(':').map(Number)
          totalOTMinutes += Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
        }
        totalMinutes += dayMin
      })

      const leaveDays = data.schedules.filter(s => s.empId === emp?.id && s.year === year && s.month === month && s.shift === '休假').length
      return {
        name: emp?.name || name,
        expected: expectedHours,
        actual: roundHours(totalMinutes),
        ot: roundHours(totalOTMinutes),
        leave: leaveDays,
      }
    }).filter(r => r.actual > 0)
    downloadCsv(`工時統計_${year}年${month}月.csv`, headers, rows)
  }

  function exportEmployees() {
    const headers = [
      { label: '姓名', key: 'name' },
      { label: '職務', key: 'role' },
      { label: 'Email', key: 'email' },
      { label: '電話', key: 'phone' },
    ]
    downloadCsv('員工名冊.csv', headers, data.employees)
  }

  function exportClockIn() {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`
    const filtered = visibleClockins
      .filter(c => c.date && c.date.startsWith(monthStr))
      .sort((a, b) => {
        const d = (a.date || '').localeCompare(b.date || '')
        return d !== 0 ? d : (a.time || '').localeCompare(b.time || '')
      })
    // Group by date+employee to pair clock-in/out
    const headers = [
      { label: '日期', key: 'date' },
      { label: '員工', value: r => resolveEmpName(r.empName, data.employees) },
      { label: '上班打卡', value: r => r.type === '上班' ? r.time : '' },
      { label: '下班打卡', value: r => r.type === '下班' ? r.time : '' },
      { label: '備註', value: r => r.type !== '上班' && r.type !== '下班' ? r.type : '' },
    ]
    downloadCsv(`打卡記錄_${year}年${month}月.csv`, headers, filtered)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>人事管理</h1>
        {isAdmin && (
          <button onClick={() => exportHR(data)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: '1px solid #d8cbb8', backgroundColor: '#fdfaf5', color: '#5a3a1a', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            <Download size={14} /> 匯出 Excel
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#fdfaf5', borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...E.tab(tab === key), flexShrink: 0 }}>{label}</button>
        ))}
      </div>

      {/* 排班表 */}
      {tab === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ ...E.card, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={() => setScheduleMonth(p => p.month === 1 ? { year: p.year-1, month: 12 } : { year: p.year, month: p.month-1 })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '18px', padding: '0 4px' }}>◀</button>
            <span style={{ fontWeight: '700', fontSize: '15px', color: E.textPrimary }}>{year} 年 {MONTHS[month-1]} 月</span>
            <button onClick={() => setScheduleMonth(p => p.month === 12 ? { year: p.year+1, month: 1 } : { year: p.year, month: p.month+1 })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '18px', padding: '0 4px' }}>▶</button>
            <button onClick={exportSchedule} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <Download size={13} /> 匯出
            </button>
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {SHIFTS.map(s => (
                <span key={s.code} style={{ fontSize: '11px', padding: '3px 12px', borderRadius: '999px', backgroundColor: s.bg, color: s.color, fontWeight: '600' }}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: 'max-content' }}>
              <thead style={{ backgroundColor: E.sandLight, borderBottom: `1px solid ${E.divider}` }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: E.textSecond, fontWeight: '600', position: 'sticky', left: 0, backgroundColor: E.sandLight, minWidth: '80px' }}>員工</th>
                  {Array.from({ length: days }, (_, i) => i+1).map(d => {
                    const dow = getDayOfWeek(year, month, d)
                    const isSun = dow === 0
                    const isSat = dow === 6
                    const color = isSun ? '#c04030' : isSat ? '#4a70a0' : E.textMuted
                    return (
                      <th key={d} style={{ padding: '6px 2px', textAlign: 'center', minWidth: '36px', backgroundColor: (isSun || isSat) ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color }}>{d}</div>
                        <div style={{ fontSize: '9px', fontWeight: '500', color, opacity: 0.8 }}>{WEEKDAYS[dow]}</div>
                      </th>
                    )
                  })}
                  <th style={{ padding: '10px 14px', color: E.textSecond, fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>月時數</th>
                </tr>
              </thead>
              <tbody>
                {/* 活動備註列 */}
                <tr style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: '#f5f0e8' }}>
                  <td style={{ padding: '4px 14px', fontWeight: '600', color: E.coffee, position: 'sticky', left: 0, backgroundColor: '#f5f0e8', borderRight: `1px solid ${E.divider}`, fontSize: '10px', whiteSpace: 'nowrap' }}>活動備註</td>
                  {Array.from({ length: days }, (_, i) => i+1).map(d => {
                    const noteKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                    const noteVal = (data.scheduleNotes || {})[noteKey] || ''
                    return (
                      <td key={d} style={{ padding: '2px 1px', textAlign: 'center' }}>
                        <input
                          value={noteVal}
                          onChange={e => {
                            const notes = { ...(data.scheduleNotes || {}), [noteKey]: e.target.value }
                            update('scheduleNotes', notes)
                          }}
                          placeholder="·"
                          style={{ width: '34px', height: '22px', border: 'none', borderRadius: '4px', fontSize: '9px', textAlign: 'center', backgroundColor: noteVal ? '#fff3cd' : 'transparent', color: E.textPrimary, outline: 'none', padding: '0 1px' }}
                        />
                      </td>
                    )
                  })}
                  <td />
                </tr>
                {data.employees.map((emp, ri) => (
                  <tr key={emp.id} style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: ri % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                    <td style={{ padding: '8px 14px', fontWeight: '600', color: E.textPrimary, position: 'sticky', left: 0, backgroundColor: ri % 2 === 0 ? '#fdfaf5' : '#faf7f2', borderRight: `1px solid ${E.divider}` }}>{emp.name}</td>
                    {Array.from({ length: days }, (_, i) => i+1).map(d => {
                      const shift = getSchedule(emp.id, d)
                      const s = shift ? getShift(shift) : null
                      const dow = getDayOfWeek(year, month, d)
                      const isWeekend = dow === 0 || dow === 6
                      return (
                        <td key={d} style={{ padding: '3px 2px', textAlign: 'center', backgroundColor: isWeekend ? 'rgba(0,0,0,0.025)' : 'transparent' }}>
                          <button
                            onClick={() => !isScheduleLocked && setSchedule(emp.id, d, nextShift(shift))}
                            disabled={isScheduleLocked}
                            title={isScheduleLocked ? '當月5日後僅管理員可編輯' : ''}
                            style={{ width: '34px', height: '26px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', border: 'none', transition: 'all 0.1s', backgroundColor: s ? s.bg : 'transparent', color: s ? s.color : '#d0c0b0', cursor: isScheduleLocked ? 'not-allowed' : 'pointer', opacity: isScheduleLocked ? 0.8 : 1 }}>
                            {s ? s.short : '·'}
                          </button>
                        </td>
                      )
                    })}
                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: '700', color: E.green }}>{monthHours(emp.id)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* 行政機關辦公日曆資訊 */}
          {(() => {
            const key = `${year}-${String(month).padStart(2, '0')}`
            const g = GOVT_WORK_DAYS[key]
            return g ? (
              <div style={{ ...E.card, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: E.textSecond, flexWrap: 'wrap' }}>
                <span>📅 本月行政機關辦公日：</span>
                <span style={{ fontWeight: '700', color: E.textPrimary }}>{g.days} 天</span>
                <span style={{ color: E.textMuted, fontSize: '11px' }}>× 8小時 =</span>
                <span style={{ fontWeight: '800', color: E.green, fontSize: '15px' }}>{g.hours} 小時</span>
              </div>
            ) : null
          })()}
          {isScheduleLocked
            ? <p style={{ fontSize: '12px', color: '#c04030', margin: 0 }}>🔒 當月5日後排班表已鎖定，如需調整請聯絡管理員</p>
            : <p style={{ fontSize: '12px', color: E.textMuted, margin: 0 }}>點擊格子循環切換：出勤 → 休假 → 上午班 → 下午班 → 清空</p>
          }
        </div>
      )}

      {/* 出缺勤 — 根據打卡紀錄統計 */}
      {tab === 'attendance' && (() => {
        const [attYear, setAttYear] = [scheduleMonth.year, (y) => setScheduleMonth(p => ({...p, year: y}))]
        const [attMonth, setAttMonth] = [scheduleMonth.month, (m) => setScheduleMonth(p => ({...p, month: m}))]

        // Filter clockins for selected month, resolve empName to full name
        const monthStr = `${attYear}-${String(attMonth).padStart(2,'0')}`
        const monthClockins = data.clockins
          .filter(c => c.date && c.date.startsWith(monthStr))
          .map(c => ({ ...c, _resolvedName: resolveEmpName(c.empName, data.employees) || c.empName }))

        // Get unique employee names：打卡紀錄 + 排班表有出勤的員工
        const scheduledEmpNames = (data.schedules || [])
          .filter(s => s.year === attYear && s.month === attMonth && (s.shift === '出勤' || s.shift === 'W'))
          .map(s => { const emp = data.employees.find(e => e.id === s.empId); return emp?.name })
          .filter(Boolean)
        const allClockinNames = [...new Set([
          ...monthClockins.map(c => c._resolvedName).filter(Boolean),
          ...scheduledEmpNames,
        ])]
          .filter(name => isAdmin || name === currentUser?.name || currentUser?.name?.includes(name) || name?.includes(currentUser?.name))

        // Per-employee stats
        const stats = allClockinNames.map(name => {
          const myClockins = monthClockins.filter(c => c._resolvedName === name)
          const workDays = new Set(myClockins.filter(c => c.type === '上班').map(c => c.date))
          let totalMinutes = 0
          let totalOTMinutes = 0
          const dayDetails = []
          const emp = data.employees.find(e => e.name === name)

          // Include dates from comp leave records
          const compLeaveForMonth = emp
            ? (data.compLeaveRecords || []).filter(r => r.empId === emp.id && r.date?.startsWith(monthStr))
            : []

          // 排班「出勤」但完全沒打卡的日期也要列出
          const scheduledWorkDates = emp
            ? (data.schedules || [])
                .filter(s => s.empId === emp.id && s.year === attYear && s.month === attMonth && (s.shift === '出勤' || s.shift === 'W'))
                .map(s => `${attYear}-${String(attMonth).padStart(2,'0')}-${String(s.day).padStart(2,'0')}`)
            : []

          const allDates = [...new Set([...myClockins.map(c => c.date), ...compLeaveForMonth.map(r => r.date), ...scheduledWorkDates])].sort()

          allDates.forEach(date => {
            const dayRecs = myClockins.filter(c => c.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            const clockInRecs  = dayRecs.filter(c => c.type === '上班')
            const clockOutRecs = dayRecs.filter(c => c.type === '下班')
            const otStart = dayRecs.filter(c => c.type === '加班開始')
            const otEnd   = dayRecs.filter(c => c.type === '加班結束')

            let dayMin = 0
            let pairCount = 0
            let isMissingOut = false
            let isOngoing = false
            let isMissingAll = false
            const todayStr = new Date().toISOString().split('T')[0]
            const isScheduledWork = scheduledWorkDates.includes(date)

            if (clockInRecs.length > 0 && clockOutRecs.length > 0) {
              const inTime  = clockInRecs[0].time
              const outTime = clockOutRecs[clockOutRecs.length - 1].time
              if (inTime && outTime) {
                const [ih, im] = inTime.split(':').map(Number)
                const [oh, om] = outTime.split(':').map(Number)
                dayMin = Math.max(0, (oh * 60 + om) - (ih * 60 + im))
                pairCount = 1
              }
            } else if (clockInRecs.length > 0 && clockOutRecs.length === 0) {
              // 有上班沒下班
              const inTime = clockInRecs[0].time
              if (inTime) {
                const [ih, im] = inTime.split(':').map(Number)
                if (date === todayStr) {
                  // 今天：用目前時間即時計算
                  const now = new Date()
                  const nowMin = now.getHours() * 60 + now.getMinutes()
                  dayMin = Math.max(0, nowMin - (ih * 60 + im))
                  pairCount = 1
                  isOngoing = true
                } else {
                  // 過去日期：忘記打下班，標記但不計算
                  isMissingOut = true
                }
              }
            } else if (clockInRecs.length === 0 && clockOutRecs.length === 0 && isScheduledWork && date < todayStr) {
              // 排班出勤但完全沒打卡（不含今天和未來）
              isMissingAll = true
            }

            // 工時達5小時自動扣1小時休息
            if (pairCount > 0 && dayMin >= 300) dayMin = Math.max(0, dayMin - 60)

            // Add comp leave hours for this date
            const cl = compLeaveForMonth.find(r => r.date === date)
            const clMin = cl ? Number(cl.hours) * 60 : 0
            dayMin += clMin

            let otMin = 0
            if (otStart.length > 0 && otEnd.length > 0) {
              const s = otStart[0].time, e = otEnd[otEnd.length - 1].time
              if (s && e) {
                const [sh, sm] = s.split(':').map(Number)
                const [eh, em] = e.split(':').map(Number)
                otMin = Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
              }
            }

            totalMinutes += dayMin
            totalOTMinutes += otMin
            const isCompLeaveOnly = clMin > 0 && pairCount === 0
            if (pairCount > 0 || clMin > 0) workDays.add(date)
            dayDetails.push({
              date, dayMin, otMin,
              clockIn: isCompLeaveOnly ? '補休' : (clockInRecs[0]?.time || ''),
              clockOut: isCompLeaveOnly ? `${cl.hours}h` : isOngoing ? '進行中' : (clockOutRecs[clockOutRecs.length - 1]?.time || ''),
              hasPair: pairCount > 0 || clMin > 0,
              isCompLeave: isCompLeaveOnly,
              isMissingOut,
              isMissingAll,
              isOngoing,
            })
          })

          const totalHours   = roundHours(totalMinutes)
          const totalOTHours = roundHours(totalOTMinutes)
          const missingAllCount = dayDetails.filter(d => d.isMissingAll).length
          return {
            name: emp?.name || name,
            workDays: workDays.size,
            totalHours,
            totalMinutes,
            totalOTHours,
            totalOTMinutes,
            dayDetails,
            hasOT: totalOTMinutes > 0,
            missingAllCount,
          }
        }).filter(s => s.workDays > 0 || s.totalMinutes > 0 || s.missingAllCount > 0)

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 月份切換 */}
            <div style={{ ...E.card, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => setScheduleMonth(p => p.month === 1 ? { year: p.year-1, month: 12 } : { year: p.year, month: p.month-1 })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '18px', padding: '0 4px' }}>◀</button>
              <span style={{ fontWeight: '700', fontSize: '15px', color: E.textPrimary }}>{attYear} 年 {MONTHS[attMonth-1]} 月 工時統計</span>
              <button onClick={() => setScheduleMonth(p => p.month === 12 ? { year: p.year+1, month: 1 } : { year: p.year, month: p.month+1 })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '18px', padding: '0 4px' }}>▶</button>
              <button onClick={exportAttendance} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                <Download size={13} /> 匯出
              </button>
              <span style={{ fontSize: '12px', color: E.textMuted, marginLeft: 'auto' }}>
                共 {monthClockins.length} 筆打卡紀錄
              </span>
            </div>

            {stats.length === 0 ? (
              <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, padding: '40px', fontSize: '13px' }}>
                本月無打卡紀錄
              </div>
            ) : (
              stats.map(s => (
                <AttendanceRow key={s.name} s={s} divider={E.divider} green={E.green} coffee={E.coffee}
                  textPrimary={E.textPrimary} textSecond={E.textSecond} textMuted={E.textMuted}
                  sandLight={E.sandLight} card={E.card} mob={mob} />
              ))
            )}
          </div>
        )
      })()}

      {/* 員工 */}
      {tab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={exportEmployees} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <Download size={13} /> 匯出
            </button>
            <button onClick={() => setShowAddEmployee(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增員工</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {data.employees.map(emp => (
              <div key={emp.id} style={E.card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: E.sandLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <User size={18} style={{ color: E.coffee }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>{emp.name}</div>
                      <div style={{ fontSize: '12px', color: E.textMuted }}>{emp.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setEditEmployee({ ...emp })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                    <button onClick={() => deleteItem('employees', emp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                {(emp.phone || emp.email) && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${E.divider}`, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {emp.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: E.textSecond }}><Phone size={11} />{emp.phone}</div>}
                    {emp.email && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: E.textSecond }}><Mail size={11} />{emp.email}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 打卡記錄 */}
      {tab === 'clockin' && (() => {
        const TYPE_STYLE = {
          '上班':   { color: '#3a6d31', bg: '#edf2ea' },
          '下班':   { color: '#5a4a8a', bg: '#f0eef8' },
          '加班開始': { color: '#b45309', bg: '#fef3c7' },
          '加班結束': { color: '#0369a1', bg: '#e0f2fe' },
        }
        const sorted = visibleClockins.sort((a, b) => {
          const d = (b.date || '').localeCompare(a.date || '')
          return d !== 0 ? d : (b.time || '').localeCompare(a.time || '')
        })
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: E.textSecond }}>
                {isAdmin ? `共 ${data.clockins.length} 筆記錄` : `${currentUser?.name} 的打卡記錄（${visibleClockins.length} 筆）`}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={exportClockIn} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  <Download size={13} /> 匯出
                </button>
                <a href="/checkin" target="_blank" rel="noreferrer"
                  style={{ ...E.btnGhost, textDecoration: 'none', fontSize: '13px' }}>
                  📱 員工打卡頁
                </a>
                <a href="/checkin-admin" target="_blank" rel="noreferrer"
                  style={{ ...E.btnPrimary, display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '13px' }}>
                  🔐 後台管理
                </a>
              </div>
            </div>
            {sorted.length === 0 ? (
              <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, padding: '40px' }}>
                尚無打卡記錄<br />
                <span style={{ fontSize: '12px' }}>請員工開啟打卡頁進行打卡，或至後台補登</span>
              </div>
            ) : (
              <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ backgroundColor: E.sandLight }}>
                    <tr>
                      {['姓名', '日期', '時間', '打卡類型'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: E.textSecond, fontWeight: '600', borderBottom: `1px solid ${E.divider}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(c => {
                      const ts = TYPE_STYLE[c.type] || { color: '#666', bg: '#eee' }
                      return (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${E.divider}` }}>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: E.textPrimary }}>{resolveEmpName(c.empName, data.employees)}</td>
                          <td style={{ padding: '10px 14px', color: E.textSecond }}>{c.date}</td>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: E.textPrimary }}>{c.time}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ backgroundColor: ts.bg, color: ts.color, padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>
                              {c.type}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* 帳號管理（管理員專屬）*/}
      {tab === 'accounts' && isAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => { setNewAcc(EMPTY_ACC); setAccMsg(''); setShowAddAcc(true) }}
              style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={15} />新增帳號
            </button>
          </div>

          <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ backgroundColor: E.sandLight }}>
                <tr>
                  {['姓名', '帳號', 'Email', '角色', '建立日期', '操作'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: E.textSecond, fontWeight: '600', borderBottom: `1px solid ${E.divider}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc, i) => (
                  <tr key={acc.id} style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                    <td style={{ padding: '10px 14px', fontWeight: '600', color: E.textPrimary }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: acc.role === 'admin' ? '#4d3a10' : '#2a3d24', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {acc.role === 'admin'
                            ? <Shield size={12} style={{ color: '#c8a84a' }} />
                            : <User size={12} style={{ color: '#7ab870' }} />}
                        </div>
                        {acc.name}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: E.textSecond, fontFamily: 'monospace' }}>{acc.username}</td>
                    <td style={{ padding: '10px 14px', color: E.textSecond }}>{acc.email || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', backgroundColor: acc.role === 'admin' ? '#f5edd0' : '#e8f0e4', color: acc.role === 'admin' ? '#8a6010' : '#3a6d31', fontWeight: '600' }}>
                        {acc.role === 'admin' ? '管理員' : '員工'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: E.textMuted }}>{acc.createdAt}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditAcc({ ...acc, password: '', confirmPw: '' }); setAccMsg('') }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                        {acc.id !== 'admin_001' && (
                          <button onClick={() => { if (window.confirm(`確定刪除帳號「${acc.name}」？`)) deleteAccount(acc.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 操作紀錄（管理員專屬）*/}
      {tab === 'logs' && isAdmin && (() => {
        const logs = [...(data.editLogs || [])].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        const TYPE_COLORS = {
          '代墊申請': { bg: '#f0ede0', color: '#7a5a10' },
          '採購申請': { bg: '#e8f0f8', color: '#305080' },
          '匯款帳戶': { bg: '#e8f0e4', color: '#3a6d31' },
          '公司財產': { bg: '#f0e8f5', color: '#6a3a80' },
          '設計任務': { bg: '#f5e0e0', color: '#8a3030' },
          '員工':     { bg: '#e0eef0', color: '#205060' },
          '帳號':     { bg: '#f0e8e0', color: '#7a4010' },
        }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: E.textSecond }}>共 {logs.length} 筆操作記錄</span>
              {logs.length > 0 && (
                <button onClick={() => { if (window.confirm('確定清除所有操作紀錄？')) update('editLogs', []) }}
                  style={{ fontSize: '12px', color: '#d0b8a8', background: 'none', border: 'none', cursor: 'pointer' }}>清除全部</button>
              )}
            </div>
            {logs.length === 0 ? (
              <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '40px' }}>尚無操作記錄</div>
            ) : (
              <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: mob ? '600px' : undefined }}>
                  <thead style={{ backgroundColor: E.sandLight }}>
                    <tr>
                      {['時間','操作者','動作','類型','名稱','摘要'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: E.textSecond, fontWeight: '600', borderBottom: `1px solid ${E.divider}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => {
                      const tc = TYPE_COLORS[log.entityType] || { bg: '#eee', color: '#666' }
                      return (
                        <tr key={log.id} style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                          <td style={{ padding: '10px 14px', color: E.textMuted, fontSize: '12px', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: E.textPrimary }}>{log.user}</td>
                          <td style={{ padding: '10px 14px', color: E.textSecond }}>{log.action}</td>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: tc.bg, color: tc.color, fontWeight: '600' }}>{log.entityType}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: E.textPrimary, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.entityName}</td>
                          <td style={{ padding: '10px 14px', color: E.textMuted, fontSize: '12px' }}>{log.summary}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })()}

      {/* Modal：新增帳號 */}
      {showAddAcc && (
        <Modal title="新增帳號" onClose={() => setShowAddAcc(false)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['帳號 *', 'username', 'text'], ['姓名 *', 'name', 'text'], ['Email', 'email', 'email']].map(([label, key, type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={newAcc[key]} onChange={e => setNewAcc(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>角色</label>
              <select value={newAcc.role} onChange={e => setNewAcc(p => ({ ...p, role: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="employee">員工</option>
                <option value="admin">管理員</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>密碼 *</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={newAcc.password} onChange={e => setNewAcc(p => ({ ...p, password: e.target.value }))} style={{ ...E.input, paddingRight: '36px' }} />
                <button onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: E.textMuted }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>確認密碼 *</label>
              <input type={showPw ? 'text' : 'password'} value={newAcc.confirmPw} onChange={e => setNewAcc(p => ({ ...p, confirmPw: e.target.value }))} style={E.input} />
            </div>
            {accMsg && <div style={{ fontSize: '12px', color: '#8a3a20', backgroundColor: '#f5e8e0', padding: '8px 12px', borderRadius: '8px' }}>{accMsg}</div>}
          </div>
          <button onClick={handleAddAccount} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}

      {/* Modal：編輯帳號 */}
      {editAcc && (
        <Modal title="編輯帳號" onClose={() => setEditAcc(null)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {isAdmin ? (
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>帳號名稱 *</label>
                <input type="text" value={editAcc.username || ''} onChange={e => setEditAcc(p => ({ ...p, username: e.target.value }))} style={{ ...E.input, fontFamily: 'monospace' }} />
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: E.textMuted, backgroundColor: E.sandLight, padding: '8px 12px', borderRadius: '8px' }}>
                帳號：<strong style={{ fontFamily: 'monospace' }}>{editAcc.username}</strong>
              </div>
            )}
            {[['姓名 *', 'name', 'text'], ['Email', 'email', 'email']].map(([label, key, type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={editAcc[key] || ''} onChange={e => setEditAcc(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>角色</label>
              <select value={editAcc.role} onChange={e => setEditAcc(p => ({ ...p, role: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}
                disabled={editAcc.id === 'admin_001'}>
                <option value="employee">員工</option>
                <option value="admin">管理員</option>
              </select>
            </div>
            <div style={{ borderTop: `1px solid ${E.divider}`, paddingTop: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <KeyRound size={13} style={{ color: E.textMuted }} />
                <span style={{ fontSize: '12px', color: E.textSecond, fontWeight: '500' }}>修改密碼（留空表示不變）</span>
              </div>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <input type={showPw ? 'text' : 'password'} placeholder="新密碼" value={editAcc.password} onChange={e => setEditAcc(p => ({ ...p, password: e.target.value }))} style={{ ...E.input, paddingRight: '36px' }} />
                <button onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: E.textMuted }}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <input type={showPw ? 'text' : 'password'} placeholder="確認新密碼" value={editAcc.confirmPw} onChange={e => setEditAcc(p => ({ ...p, confirmPw: e.target.value }))} style={E.input} />
            </div>
            {accMsg && <div style={{ fontSize: '12px', color: '#8a3a20', backgroundColor: '#f5e8e0', padding: '8px 12px', borderRadius: '8px' }}>{accMsg}</div>}
          </div>
          <button onClick={handleSaveAccount} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}

      {showAddEmployee && (
        <Modal title="新增員工" onClose={() => setShowAddEmployee(false)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['姓名 *','name','text'],['職稱','role','text'],['電話','phone','text'],['Email','email','email']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={newEmployee[key]} onChange={e => setNewEmployee(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
          </div>
          <button onClick={() => { if (!newEmployee.name.trim()) return; addItem('employees',{id:Date.now(),...newEmployee}); setNewEmployee({name:'',role:'',email:'',phone:''}); setShowAddEmployee(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}

      {editEmployee && (
        <Modal title="編輯員工" onClose={() => setEditEmployee(null)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['姓名 *','name','text'],['職稱','role','text'],['電話','phone','text'],['Email','email','email']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={editEmployee[key] || ''} onChange={e => setEditEmployee(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
          </div>
          <button onClick={() => {
            if (!editEmployee.name.trim()) return
            updateItem('employees', editEmployee.id, { name: editEmployee.name, role: editEmployee.role, email: editEmployee.email, phone: editEmployee.phone })
            const who = currentUser?.name || currentUser?.username || '未知'
            logEdit({ user: who, action: '編輯', entityType: '員工', entityName: editEmployee.name, summary: `職稱：${editEmployee.role || '—'}` })
            setEditEmployee(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}
    </div>
  )
}
