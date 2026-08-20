import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Phone, Mail, User, Pencil, Shield, Eye, EyeOff, KeyRound, Download } from 'lucide-react'
import Modal from '../components/Modal'
import { E, useIsMobile } from '../styles/earth'
import { exportHR } from '../utils/exportExcel'
import { downloadCsv } from '../utils/exportCsv'
import { MONTHS, GOVT_WORK_DAYS, roundHours, resolveEmpName, computeEmpMonthClockHours, computeAllTimeEarned, computeDayMinutes, computeOTSpans, capNormalMin } from '../utils/salaryCalc'
import { mapLink } from '../utils/geo'
import { holidaysInMonth, holidayOn, getHolidays, DEFAULT_HOLIDAYS } from '../utils/holidays'
import { annualLeaveStatus } from '../utils/payrollEngine'

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
          <div style={{ padding: '2px 10px', borderRadius: 6, backgroundColor: '#eef4ec', border: '1px solid #d4e6cd' }}>
            <span style={{ fontSize: '10px', color: '#3a6d31', fontWeight: '600' }}>正常上班</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: green, marginLeft: '6px' }}>{s.totalHours}</span>
            <span style={{ fontSize: '11px', color: textMuted }}> h</span>
          </div>
          <div style={{ padding: '2px 10px', borderRadius: 6, backgroundColor: s.hasOT ? '#fef3c7' : 'transparent', border: `1px solid ${s.hasOT ? '#f5d97a' : 'transparent'}` }}>
            <span style={{ fontSize: '10px', color: '#b45309', fontWeight: '600' }}>加班</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: s.hasOT ? '#b45309' : textMuted, marginLeft: '6px' }}>{s.hasOT ? s.totalOTHours : 0}</span>
            <span style={{ fontSize: '11px', color: textMuted }}> h</span>
          </div>
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
                display: 'flex', flexDirection: 'column', gap: '4px', padding: '6px 10px',
                backgroundColor: d.isMissingAll ? '#fde0dc' : d.isMissingOut ? '#fde8e6' : d.isOngoing ? '#e8f4e6' : d.isCompLeave ? '#f0ebf5' : sandLight,
                borderRadius: '8px', fontSize: '12px',
              }}>
                {/* ── 第一行：正常上班 ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: textSecond, fontWeight: '600', minWidth: '58px' }}>{d.date.slice(5)}</span>
                  {d.onLeaveType ? (
                    <span style={{ color: '#6a3a80', fontWeight: '600', fontSize: '11px' }}>🌿 請假（{d.onLeaveType}）</span>
                  ) : d.isMissingAll ? (
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
                  ) : d.hasRegularPunch ? (
                    <span style={{ color: textPrimary }}>
                      <span style={{ fontSize: '10px', color: textMuted, marginRight: '4px' }}>上班</span>
                      {d.clockIn || '--'} → {d.clockOut || '--'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: textMuted, fontStyle: 'italic' }}>無正常上班打卡</span>
                  )}
                  {d.dayMin > 0 && (
                    <span style={{ marginLeft: 'auto', fontWeight: '700', color: d.isOngoing ? '#3a6d31' : d.isCompLeave ? '#6a3a80' : green }}>
                      {d.isOngoing ? '~' : ''}{roundHours(d.dayMin)}h
                    </span>
                  )}
                </div>
                {/* ── 第二行（含）以下：加班 OT，每段一行，支援跨日 ── */}
                {d.hasOTPunch && (d.otSpans || []).map((sp, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                    paddingLeft: '58px', marginTop: '-2px',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: '700', color: '#b45309', backgroundColor: '#fef3c7',
                      padding: '1px 6px', borderRadius: '4px' }}>加班</span>
                    {sp.missingEnd ? (
                      <span style={{ color: '#c04030', fontSize: '11.5px' }}>
                        {sp.startTime} → <span style={{ fontWeight: '600' }}>⚠ 未打結束卡</span>
                      </span>
                    ) : sp.missingStart ? (
                      <span style={{ color: '#c04030', fontSize: '11.5px' }}>
                        <span style={{ fontWeight: '600' }}>⚠ 未打開始卡</span> → {sp.endTime}
                      </span>
                    ) : (
                      <span style={{ color: '#9a5a09', fontSize: '11.5px' }}>
                        {sp.startTime} → {sp.endTime}
                        {sp.crossDay && (
                          <span style={{ fontSize: '10px', color: '#b45309', fontWeight: '700', marginLeft: '4px' }}>
                            ＋1（{sp.endDate?.slice(5)}）
                          </span>
                        )}
                      </span>
                    )}
                    {sp.minutes > 0 && (
                      <span style={{ marginLeft: 'auto', fontWeight: '700', color: '#b45309', fontSize: '12px' }}>
                        +{roundHours(sp.minutes)}h
                      </span>
                    )}
                  </div>
                ))}
                {/* 打卡地點 */}
                {(d.inLoc || d.outLoc) && (
                  <div style={{ flexBasis: '100%', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px', paddingLeft: '58px' }}>
                    {d.inLoc && (
                      <a href={mapLink(d.inLoc.lat, d.inLoc.lng)} target="_blank" rel="noreferrer"
                        style={{ fontSize: '11px', color: '#3a6d31', textDecoration: 'none' }}
                        title={`上班打卡位置（誤差約 ${d.inLoc.accuracy ?? '?'} 公尺）`}>
                        📍上班 {d.inLoc.address || '看地圖'}
                      </a>
                    )}
                    {d.outLoc && (
                      <a href={mapLink(d.outLoc.lat, d.outLoc.lng)} target="_blank" rel="noreferrer"
                        style={{ fontSize: '11px', color: '#5a4a8a', textDecoration: 'none' }}
                        title={`下班打卡位置（誤差約 ${d.outLoc.accuracy ?? '?'} 公尺）`}>
                        📍下班 {d.outLoc.address || '看地圖'}
                      </a>
                    )}
                  </div>
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
  const [mobSelDay, setMobSelDay] = useState(null)
  const [mobSchedMode, setMobSchedMode] = useState('cal') // cal=月曆看 edit=排班編
  const [mobEditEmp, setMobEditEmp] = useState(null)
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', email: '', phone: '' })
  const [editEmployee, setEditEmployee] = useState(null)
  const [showHolidayModal, setShowHolidayModal] = useState(false)
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' })
  const [showSuspModal, setShowSuspModal] = useState(false)
  const [newSusp, setNewSusp] = useState({ date: '', label: '豪雨假', scope: 'full', fromTime: '14:00' })

  // 帳號管理 state
  const [showAddAcc, setShowAddAcc]   = useState(false)
  const [newAcc, setNewAcc]           = useState(EMPTY_ACC)
  const [editAcc, setEditAcc]         = useState(null)
  const [accMsg, setAccMsg]           = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [clockinNameFilter, setClockinNameFilter] = useState('all')
  const [clockinDateFilter, setClockinDateFilter] = useState('')

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
  // 手機排班編：整月平日(非國定假日)一鍵填出勤 — 單次批次寫入
  function fillMonthAttend(empId) {
    const d = daysInMonth(year, month)
    let arr = data.schedules.map(s => ({ ...s }))
    let ts = Date.now()
    for (let day = 1; day <= d; day++) {
      const dow = getDayOfWeek(year, month, day)
      if (dow === 0 || dow === 6 || holidayByDay[day]) continue
      const ex = arr.find(s => s.empId === empId && s.year === year && s.month === month && s.day === day)
      if (ex) ex.shift = '出勤'
      else arr.push({ id: ts++, empId, year, month, day, shift: '出勤' })
    }
    update('schedules', arr)
  }
  function clearMonthSchedule(empId) {
    const emp = data.employees.find(e => e.id === empId)
    if (!window.confirm(`確定清空 ${emp?.name || ''} ${month} 月整月排班？`)) return
    update('schedules', data.schedules.filter(s => !(s.empId === empId && s.year === year && s.month === month)))
  }

  // ── 國定假日管理 ──
  const monthHolidays = holidaysInMonth(data, year, month)
  const holidayByDay = {}
  monthHolidays.forEach(h => { holidayByDay[Number(h.date.slice(-2))] = h.name })

  function addHoliday() {
    if (!newHoliday.date || !newHoliday.name.trim()) return
    const base = getHolidays(data)  // 首次編輯時以預設為基礎，避免清空
    const filtered = base.filter(h => h.date !== newHoliday.date)
    update('holidays', [...filtered, { date: newHoliday.date, name: newHoliday.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)))
    setNewHoliday({ date: '', name: '' })
  }
  function removeHoliday(date) {
    const base = getHolidays(data)
    update('holidays', base.filter(h => h.date !== date))
  }
  function resetHolidays() {
    if (!window.confirm('確定重設為 2026 政府行事曆預設假日？你目前的自訂會被覆蓋。')) return
    update('holidays', [...DEFAULT_HOLIDAYS])
  }

  // ── 停班 / 豪雨假管理 ──
  const allSusp = data.suspensions || {}
  const suspByDay = {}
  Object.entries(allSusp).forEach(([date, s]) => {
    const [y, m] = date.split('-').map(Number)
    if (y === year && m === month) suspByDay[Number(date.slice(-2))] = s
  })
  const monthSuspList = Object.entries(allSusp)
    .filter(([date]) => { const [y, m] = date.split('-').map(Number); return y === year && m === month })
    .sort((a, b) => a[0].localeCompare(b[0]))
  function suspLabel(s) {
    return s.scope === 'partial' ? `${s.label || '停班'} ${s.fromTime || ''}後` : (s.label || '停班')
  }
  function addSusp() {
    if (!newSusp.date) return
    const next = { ...(data.suspensions || {}) }
    next[newSusp.date] = newSusp.scope === 'partial'
      ? { label: newSusp.label.trim() || '豪雨假', scope: 'partial', fromTime: newSusp.fromTime }
      : { label: newSusp.label.trim() || '豪雨假', scope: 'full' }
    update('suspensions', next)
    setNewSusp({ date: '', label: '豪雨假', scope: 'full', fromTime: '14:00' })
  }
  function removeSusp(date) {
    const next = { ...(data.suspensions || {}) }
    delete next[date]
    update('suspensions', next)
  }

  // 排班鎖定：非管理員 + 當月 + 已過5日
  const todayDate = new Date()
  const isScheduleLocked = !isAdmin &&
    year === todayDate.getFullYear() && month === todayDate.getMonth() + 1 &&
    todayDate.getDate() > 5

  // 排班編輯權限：管理員可編全員；員工只能編自己（桌機/手機一致）
  const canEditSchedule = (emp) =>
    isAdmin || emp.name === currentUser?.name || currentUser?.name?.includes(emp.name) || emp.name?.includes(currentUser?.name)

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
      let totalHours = 0, totalOTHours = 0
      const compLeaveForMonth = emp ? (data.compLeaveRecords || []).filter(r => r.empId === emp.id && r.date?.startsWith(monthStr)) : []
      const allDates = [...new Set([...myClockins.map(c => c.date), ...compLeaveForMonth.map(r => r.date)])].sort()

      allDates.forEach(date => {
        const dayRecs = myClockins.filter(c => c.date === date)
        const { dayMin: baseDayMin } = computeDayMinutes(dayRecs, false)
        const cl = compLeaveForMonth.find(r => r.date === date)
        const dayMin = capNormalMin(baseDayMin) + (cl ? Number(cl.hours) * 60 : 0) // 正常工時上限 8h
        totalHours += roundHours(dayMin)
      })
      // 加班用跨日 span 總和（避免同日配對漏掉跨午夜段）
      totalOTHours = roundHours(computeOTSpans(myClockins).reduce((sum, sp) => sum + sp.minutes, 0))

      const leaveDays = data.schedules.filter(s => s.empId === emp?.id && s.year === year && s.month === month && s.shift === '休假').length
      return {
        name: emp?.name || name,
        expected: expectedHours,
        actual: totalHours,
        ot: totalOTHours,
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
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: E.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>人事管理</h1>
        {isAdmin && (
          <button onClick={() => exportHR(data)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: `1px solid ${E.inputBorder}`, backgroundColor: E.cardBg, color: '#5a3a1a', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            <Download size={14} /> 匯出 Excel
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', backgroundColor: E.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
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
            {isAdmin && (
              <button onClick={() => setShowHolidayModal(true)} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                🎌 國定假日
              </button>
            )}
            {isAdmin && (
              <button onClick={() => setShowSuspModal(true)} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                🌧️ 停班/豪雨假
              </button>
            )}
            <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', flexWrap: 'wrap' }}>
              {SHIFTS.map(s => (
                <span key={s.code} style={{ fontSize: '11px', padding: '3px 12px', borderRadius: '999px', backgroundColor: s.bg, color: s.color, fontWeight: '600' }}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          {/* 手機版：月曆看 / 排班編 切換 */}
          {mob && (
            <div style={{ display: 'flex', gap: '4px', backgroundColor: E.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}` }}>
              {[['cal', '📅 月曆看'], ['edit', '✏️ 排班編']].map(([key, label]) => (
                <button key={key} onClick={() => setMobSchedMode(key)} style={{ ...E.tab(mobSchedMode === key), flex: 1 }}>{label}</button>
              ))}
            </div>
          )}
          {/* 手機版：排班編（管理員可編全員；員工只能編自己） */}
          {mob && mobSchedMode === 'edit' && (() => {
            const editableEmps = isAdmin
              ? data.employees
              : data.employees.filter(e => e.name === currentUser?.name || currentUser?.name?.includes(e.name) || e.name?.includes(currentUser?.name))
            if (editableEmps.length === 0) return (
              <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '24px' }}>找不到你的員工資料，請聯絡管理員</div>
            )
            const editEmp = editableEmps.find(e => e.id === mobEditEmp) || editableEmps[0]
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* 選員工 */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {editableEmps.map(emp => {
                    const isSel = emp.id === editEmp.id
                    return (
                      <button key={emp.id} onClick={() => setMobEditEmp(emp.id)} style={{
                        padding: '7px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: isSel ? '700' : '500', cursor: 'pointer',
                        border: isSel ? `2px solid ${E.coffee}` : `1px solid ${E.divider}`,
                        backgroundColor: isSel ? '#efe6db' : E.cardBg, color: isSel ? E.coffee : E.textSecond,
                      }}>{emp.name}</button>
                    )
                  })}
                </div>
                {/* 快速鍵 */}
                {!isScheduleLocked && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => fillMonthAttend(editEmp.id)} style={{ ...E.btnPrimary, flex: 1, padding: '9px 0', fontSize: '13px' }}>⚡ 整月平日填出勤</button>
                    <button onClick={() => clearMonthSchedule(editEmp.id)} style={{ ...E.btnGhost, padding: '9px 14px', fontSize: '13px', color: '#c04030' }}>清空</button>
                  </div>
                )}
                {/* 整月直式列表 */}
                <div style={{ ...E.card, padding: '4px 12px' }}>
                  {Array.from({ length: days }, (_, i) => i + 1).map(d => {
                    const dow = getDayOfWeek(year, month, d)
                    const isWkend = dow === 0 || dow === 6
                    const isHol = !!holidayByDay[d]
                    const isSusp = !!suspByDay[d]
                    const shift = getSchedule(editEmp.id, d)
                    const s = shift ? getShift(shift) : null
                    return (
                      <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${E.divider}`, backgroundColor: isHol ? 'rgba(192,32,42,0.05)' : isSusp ? 'rgba(60,110,180,0.05)' : 'transparent' }}>
                        <span style={{ width: '52px', fontSize: '13px', fontWeight: '600', color: isHol || dow === 0 ? '#c04030' : dow === 6 ? '#4a70a0' : E.textPrimary }}>{d}（{WEEKDAYS[dow]}）</span>
                        <span style={{ flex: 1, fontSize: '10px', color: isHol ? '#c0202a' : '#3c6eb4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isHol ? `🎌${holidayByDay[d]}` : isSusp ? `🌧️${suspLabel(suspByDay[d])}` : ''}
                        </span>
                        <button
                          onClick={() => !isScheduleLocked && setSchedule(editEmp.id, d, nextShift(shift))}
                          disabled={isScheduleLocked}
                          style={{ minWidth: '58px', padding: '7px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', backgroundColor: s ? s.bg : '#f0ece5', color: s ? s.color : '#b0a090', cursor: isScheduleLocked ? 'not-allowed' : 'pointer' }}>
                          {s ? s.label : '—'}
                        </button>
                      </div>
                    )
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: '13px' }}>
                    <span style={{ color: E.textSecond }}>{editEmp.name} 本月時數</span>
                    <strong style={{ color: E.green }}>{monthHours(editEmp.id)}h</strong>
                  </div>
                </div>
              </div>
            )
          })()}
          {/* 手機版：月曆格式（點日看當天） */}
          {mob && mobSchedMode === 'cal' && (() => {
            const todayStr = new Date().toLocaleDateString('sv-SE')
            const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
            const sel = (mobSelDay && mobSelDay <= days) ? mobSelDay : (todayStr.startsWith(monthPrefix) ? Number(todayStr.slice(-2)) : 1)
            // 與儀表板 MiniCalendar 同一套規則：週日開頭、今天淺綠底、選中綠底白字
            const lead = getDayOfWeek(year, month, 1)
            const countOn = d => data.employees.filter(e => (getShift(getSchedule(e.id, d))?.hours || 0) > 0).length
            const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ ...E.card, padding: '10px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
                    {WEEKDAYS.map(w => (
                      <div key={w} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#b09070', padding: '4px 0' }}>{w}</div>
                    ))}
                    {cells.map((d, idx) => {
                      if (d === null) return <div key={'b' + idx} />
                      const dow = getDayOfWeek(year, month, d)
                      const isHol = !!holidayByDay[d]
                      const isSusp = !!suspByDay[d]
                      const cnt = countOn(d)
                      const isSel = d === sel
                      const isToday = `${monthPrefix}-${String(d).padStart(2, '0')}` === todayStr
                      const numColor = isSel ? '#fff' : isHol ? '#c0202a' : isToday ? '#3a6d31' : isSusp ? '#3c6eb4' : dow === 0 ? '#c04030' : E.textPrimary
                      return (
                        <button key={d} onClick={() => setMobSelDay(d)} style={{
                          aspectRatio: '1', border: 'none', borderRadius: '8px',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px', cursor: 'pointer', padding: 0,
                          backgroundColor: isSel ? '#3a6d31' : isToday ? '#edf2ea' : isHol ? 'rgba(192,32,42,0.08)' : isSusp ? 'rgba(60,110,180,0.08)' : 'transparent',
                        }}>
                          <span style={{ fontSize: '13px', fontWeight: isSel || isToday ? '800' : '600', color: numColor }}>{isHol ? '🎌' : isSusp ? '🌧️' : ''}{d}</span>
                          {cnt > 0 && <span style={{ fontSize: '9px', fontWeight: '700', color: isSel ? 'rgba(255,255,255,0.9)' : '#3a6d31' }}>{cnt}人</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div style={{ ...E.card }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary }}>{month}/{sel}（{WEEKDAYS[getDayOfWeek(year, month, sel)]}）</span>
                    {holidayByDay[sel] && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#fbecea', color: '#c0202a', fontWeight: '700' }}>🎌 {holidayByDay[sel]}</span>}
                    {suspByDay[sel] && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#eaf0f8', color: '#3c6eb4', fontWeight: '700' }}>🌧️ {suspLabel(suspByDay[sel])}</span>}
                  </div>
                  {isAdmin && !isScheduleLocked && <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '8px' }}>點右側班別可切換：出勤 → 休假 → 上午 → 下午</div>}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {data.employees.map(emp => {
                      const shift = getSchedule(emp.id, sel)
                      const s = shift ? getShift(shift) : null
                      return (
                        <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 2px', borderBottom: `1px solid ${E.divider}` }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#efe6db', color: E.coffee, fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{emp.name.slice(0, 1)}</div>
                          <span style={{ flex: 1, fontSize: '13px', color: E.textPrimary }}>{emp.name}</span>
                          <button
                            onClick={() => { if (isAdmin && !isScheduleLocked) setSchedule(emp.id, sel, nextShift(shift)) }}
                            disabled={!isAdmin || isScheduleLocked}
                            style={{ minWidth: '60px', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', backgroundColor: s ? s.bg : '#f0ece5', color: s ? s.color : '#b0a090', cursor: (isAdmin && !isScheduleLocked) ? 'pointer' : 'default' }}>
                            {s ? s.label : '休'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px', fontSize: '12px', color: E.textSecond }}>
                    當日出勤 <strong style={{ color: E.green, margin: '0 3px' }}>{countOn(sel)}</strong> 人
                  </div>
                </div>
              </div>
            )
          })()}
          {!mob && (
          <div style={{ ...E.card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: 'max-content' }}>
              <thead style={{ backgroundColor: E.sandLight, borderBottom: `1px solid ${E.divider}` }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: E.textSecond, fontWeight: '600', position: 'sticky', left: 0, backgroundColor: E.sandLight, minWidth: '80px' }}>員工</th>
                  {Array.from({ length: days }, (_, i) => i+1).map(d => {
                    const dow = getDayOfWeek(year, month, d)
                    const isSun = dow === 0
                    const isSat = dow === 6
                    const isHol = !!holidayByDay[d]
                    const color = isHol ? '#c0202a' : isSun ? '#c04030' : isSat ? '#4a70a0' : E.textMuted
                    return (
                      <th key={d} style={{ padding: '6px 2px', textAlign: 'center', minWidth: '36px', backgroundColor: isHol ? 'rgba(192,32,42,0.10)' : suspByDay[d] ? 'rgba(60,110,180,0.10)' : (isSun || isSat) ? 'rgba(0,0,0,0.02)' : 'transparent' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color }}>{isHol ? '🎌' : suspByDay[d] ? '🌧️' : ''}{d}</div>
                        <div style={{ fontSize: '9px', fontWeight: '500', color, opacity: 0.8 }}>{WEEKDAYS[dow]}</div>
                      </th>
                    )
                  })}
                  <th style={{ padding: '10px 14px', color: E.textSecond, fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>月時數</th>
                </tr>
              </thead>
              <tbody>
                {/* 國定假日列 */}
                {monthHolidays.length > 0 && (
                  <tr style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: '#fbeceA' }}>
                    <td style={{ padding: '3px 14px', fontWeight: '700', color: '#c0202a', position: 'sticky', left: 0, backgroundColor: '#fbecea', borderRight: `1px solid ${E.divider}`, fontSize: '10px', whiteSpace: 'nowrap' }}>🎌 國定假日</td>
                    {Array.from({ length: days }, (_, i) => i+1).map(d => (
                      <td key={d} style={{ padding: '2px 1px', textAlign: 'center', backgroundColor: holidayByDay[d] ? 'rgba(192,32,42,0.10)' : 'transparent' }}>
                        {holidayByDay[d] && (
                          <span title={holidayByDay[d]} style={{ fontSize: '8px', color: '#c0202a', fontWeight: '700', lineHeight: 1.1, display: 'inline-block', maxWidth: '34px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {holidayByDay[d].length > 3 ? holidayByDay[d].slice(0, 3) : holidayByDay[d]}
                          </span>
                        )}
                      </td>
                    ))}
                    <td />
                  </tr>
                )}
                {/* 停班/豪雨假列 */}
                {monthSuspList.length > 0 && (
                  <tr style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: '#eaf0f8' }}>
                    <td style={{ padding: '3px 14px', fontWeight: '700', color: '#3c6eb4', position: 'sticky', left: 0, backgroundColor: '#eaf0f8', borderRight: `1px solid ${E.divider}`, fontSize: '10px', whiteSpace: 'nowrap' }}>🌧️ 停班</td>
                    {Array.from({ length: days }, (_, i) => i+1).map(d => (
                      <td key={d} style={{ padding: '2px 1px', textAlign: 'center', backgroundColor: suspByDay[d] ? 'rgba(60,110,180,0.10)' : 'transparent' }}>
                        {suspByDay[d] && (
                          <span title={suspLabel(suspByDay[d])} style={{ fontSize: '8px', color: '#3c6eb4', fontWeight: '700', lineHeight: 1.1, display: 'inline-block', maxWidth: '34px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {suspByDay[d].scope === 'partial' ? `${suspByDay[d].fromTime}後` : '全天'}
                          </span>
                        )}
                      </td>
                    ))}
                    <td />
                  </tr>
                )}
                {/* 活動備註列 */}
                <tr style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: '#f5f0e8' }}>
                  <td style={{ padding: '4px 14px', fontWeight: '600', color: E.coffee, position: 'sticky', left: 0, backgroundColor: '#f5f0e8', borderRight: `1px solid ${E.divider}`, fontSize: '10px', whiteSpace: 'nowrap' }}>活動備註</td>
                  {Array.from({ length: days }, (_, i) => i+1).map(d => {
                    const noteKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                    const noteVal = (data.scheduleNotes || {})[noteKey] || ''
                    return (
                      <td key={d} style={{ padding: '2px 1px', textAlign: 'center' }}>
                        <input
                          key={noteKey}
                          defaultValue={noteVal}
                          onBlur={e => {
                            // 離開欄位才寫入（避免每輸入一字打一次 Firebase）
                            if (e.target.value === noteVal) return
                            update('scheduleNotes', { ...(data.scheduleNotes || {}), [noteKey]: e.target.value })
                          }}
                          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
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
                    <td style={{ padding: '8px 14px', fontWeight: '600', color: E.textPrimary, position: 'sticky', left: 0, backgroundColor: ri % 2 === 0 ? E.cardBg : '#faf7f2', borderRight: `1px solid ${E.divider}` }}>{emp.name}</td>
                    {Array.from({ length: days }, (_, i) => i+1).map(d => {
                      const shift = getSchedule(emp.id, d)
                      const s = shift ? getShift(shift) : null
                      const dow = getDayOfWeek(year, month, d)
                      const isWeekend = dow === 0 || dow === 6
                      const cellLocked = isScheduleLocked || !canEditSchedule(emp)
                      return (
                        <td key={d} style={{ padding: '3px 2px', textAlign: 'center', backgroundColor: isWeekend ? 'rgba(0,0,0,0.025)' : 'transparent' }}>
                          <button
                            onClick={() => !cellLocked && setSchedule(emp.id, d, nextShift(shift))}
                            disabled={cellLocked}
                            title={isScheduleLocked ? '當月5日後僅管理員可編輯' : !canEditSchedule(emp) ? '僅能編輯自己的排班' : ''}
                            style={{ width: '34px', height: '26px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', border: 'none', transition: 'all 0.1s', backgroundColor: s ? s.bg : 'transparent', color: s ? s.color : '#d0c0b0', cursor: cellLocked ? 'not-allowed' : 'pointer', opacity: cellLocked ? 0.8 : 1 }}>
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
          )}
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

          // 跨日加班 span：整月一次配對，依「開始日」歸戶
          const otSpans = computeOTSpans(myClockins)
          const otSpansByStart = {}
          otSpans.forEach(sp => {
            const key = sp.startDate || sp.endDate  // 落單的結束以結束日歸戶
            if (!key) return
            ;(otSpansByStart[key] ||= []).push(sp)
          })

          const allDates = [...new Set([...myClockins.map(c => c.date), ...compLeaveForMonth.map(r => r.date), ...scheduledWorkDates])].sort()

          const todayStr = new Date().toLocaleDateString('sv-SE')
          allDates.forEach(date => {
            const dayRecs = myClockins.filter(c => c.date === date)
            const clockInRecs  = dayRecs.filter(c => c.type === '上班').sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            const clockOutRecs = dayRecs.filter(c => c.type === '下班').sort((a, b) => (a.time || '').localeCompare(b.time || ''))
            const isScheduledWork = scheduledWorkDates.includes(date)

            // 用共用 helper 算工時（含跨午夜、多段班、午休扣除）；正常工時每日上限 8h
            const { dayMin: rawDayMin, isOngoing, pairCount } = computeDayMinutes(dayRecs, date === todayStr)
            const baseDayMin = capNormalMin(rawDayMin)
            let dayMin = baseDayMin
            // 該日的加班 span（開始於這天，可能跨到隔天）
            const daySpans = otSpansByStart[date] || []
            const otMin = daySpans.reduce((sum, sp) => sum + sp.minutes, 0)
            const hasRegularPunch = clockInRecs.length > 0 || clockOutRecs.length > 0
            const hasOTPunch = daySpans.length > 0

            // 已核准請假覆蓋的日期，不算「排班出勤未打卡」
            const approvedLeave = emp
              ? (data.leaveRequests || []).find(l =>
                  l.empId === emp.id && l.status === '已核准' &&
                  (l.startDate || '') <= date && date <= (l.endDate || l.startDate || ''))
              : null

            let isMissingOut = false
            let isMissingAll = false
            if (clockInRecs.length > 0 && clockOutRecs.length === 0 && date !== todayStr) {
              isMissingOut = true
            } else if (clockInRecs.length === 0 && clockOutRecs.length === 0 && isScheduledWork && date < todayStr && !approvedLeave) {
              isMissingAll = true
            }

            // Add comp leave hours for this date
            const cl = compLeaveForMonth.find(r => r.date === date)
            const clMin = cl ? Number(cl.hours) * 60 : 0
            dayMin += clMin

            totalMinutes += dayMin
            totalOTMinutes += otMin
            const isCompLeaveOnly = clMin > 0 && pairCount === 0
            if (pairCount > 0 || clMin > 0) workDays.add(date)
            const inRec = clockInRecs[0]
            const outRec = clockOutRecs[clockOutRecs.length - 1]
            const locOf = r => (r && Number.isFinite(r.lat) && Number.isFinite(r.lng))
              ? { lat: r.lat, lng: r.lng, address: r.address || '', accuracy: r.accuracy }
              : null
            dayDetails.push({
              date, dayMin, otMin,
              clockIn: isCompLeaveOnly ? '補休' : (inRec?.time || ''),
              clockOut: isCompLeaveOnly ? `${cl.hours}h` : isOngoing ? '進行中' : (outRec?.time || ''),
              otSpans: daySpans,
              hasRegularPunch,
              hasOTPunch,
              onLeaveType: (!hasRegularPunch && !hasOTPunch && approvedLeave) ? approvedLeave.type : '',
              inLoc: locOf(inRec),
              outLoc: locOf(outRec),
              hasPair: pairCount > 0 || clMin > 0,
              isCompLeave: isCompLeaveOnly,
              isMissingOut,
              isMissingAll,
              isOngoing,
            })
          })

          // 總計 = 每日卡片顯示的 roundHours 加總（避免「先加總再捨去」與「先捨去再加總」的 0.5h 誤差）
          const totalHours   = dayDetails.reduce((sum, d) => sum + roundHours(d.dayMin), 0)
          const totalOTHours = dayDetails.reduce((sum, d) => sum + roundHours(d.otMin), 0)
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
                {/* 特休狀態 */}
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${E.divider}` }}>
                  {emp.hireDate ? (() => {
                    const al = annualLeaveStatus(emp, year, data)
                    return (
                      <div>
                        <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '4px' }}>
                          到職 {emp.hireDate}　🌴 {year} 年特休
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#e4ece4', color: '#3a6d31', fontWeight: '600' }}>額度 {al.entitledDays} 天</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: E.sandLight, color: E.textSecond, fontWeight: '600' }}>已用 {al.usedDays} 天</span>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '6px', backgroundColor: '#fef3e0', color: '#b45309', fontWeight: '700' }}>剩 {al.remainingDays} 天</span>
                        </div>
                      </div>
                    )
                  })() : (
                    <div style={{ fontSize: '11px', color: '#c08a30' }}>⚠️ 未填到職日，無法計算特休（點 ✏️ 補上）</div>
                  )}
                </div>
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
        const clockinNames = [...new Set(visibleClockins.map(c => resolveEmpName(c.empName, data.employees) || c.empName))].sort()
        const filtered = visibleClockins
          .filter(c => clockinNameFilter === 'all' || (resolveEmpName(c.empName, data.employees) || c.empName) === clockinNameFilter)
          .filter(c => !clockinDateFilter || c.date === clockinDateFilter)
        const sorted = filtered.sort((a, b) => {
          const d = (b.date || '').localeCompare(a.date || '')
          return d !== 0 ? d : (b.time || '').localeCompare(a.time || '')
        })
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <select value={clockinNameFilter} onChange={e => setClockinNameFilter(e.target.value)}
                  style={{ ...E.input, width: 'auto', minWidth: '100px', fontSize: '13px', padding: '5px 8px', cursor: 'pointer' }}>
                  <option value="all">全部人員</option>
                  {clockinNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <input type="date" value={clockinDateFilter} onChange={e => setClockinDateFilter(e.target.value)}
                  style={{ ...E.input, width: 'auto', fontSize: '13px', padding: '5px 8px' }} />
                {(clockinNameFilter !== 'all' || clockinDateFilter) && (
                  <button onClick={() => { setClockinNameFilter('all'); setClockinDateFilter('') }}
                    style={{ ...E.btnGhost, fontSize: '12px', padding: '4px 10px' }}>清除篩選</button>
                )}
                <span style={{ fontSize: '13px', color: E.textSecond }}>
                  {sorted.length} 筆{sorted.length !== visibleClockins.length ? ` / 共 ${visibleClockins.length} 筆` : ''}
                </span>
              </div>
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

      {/* Modal：國定假日管理 */}
      {showHolidayModal && (
        <Modal title="🎌 國定假日管理" onClose={() => setShowHolidayModal(false)} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: E.textMuted, lineHeight: 1.5, backgroundColor: E.sandLight, padding: '8px 12px', borderRadius: '8px' }}>
              已預載 2026 政府行事曆。農曆假日（春節/端午/中秋）日期請自行核對調整。國定假日當天出勤的工時，加班費以 <strong style={{ color: '#c0202a' }}>2 倍</strong> 計。
            </div>
            {/* 新增 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>日期</label>
                <input type="date" value={newHoliday.date} onChange={e => setNewHoliday(p => ({ ...p, date: e.target.value }))} style={E.input} />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>假日名稱</label>
                <input type="text" value={newHoliday.name} onChange={e => setNewHoliday(p => ({ ...p, name: e.target.value }))} placeholder="例：春節" style={E.input} />
              </div>
              <button onClick={addHoliday} disabled={!newHoliday.date || !newHoliday.name.trim()}
                style={{ ...E.btnPrimary, padding: '9px 16px', opacity: (!newHoliday.date || !newHoliday.name.trim()) ? 0.5 : 1 }}>加入</button>
            </div>
            {/* 清單 */}
            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: `1px solid ${E.divider}`, borderRadius: '8px', padding: '8px' }}>
              {getHolidays(data).filter(h => h.date >= `${year}-01-01` && h.date <= `${year}-12-31`).sort((a, b) => a.date.localeCompare(b.date)).map(h => (
                <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#fbecea' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#c0202a', minWidth: '88px' }}>{h.date}</span>
                  <span style={{ fontSize: '13px', color: E.textPrimary, flex: 1 }}>{h.name}</span>
                  <button onClick={() => removeHoliday(h.date)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c09070', padding: '2px', display: 'flex' }}><Trash2 size={14} /></button>
                </div>
              ))}
              {getHolidays(data).filter(h => h.date.startsWith(String(year))).length === 0 && (
                <div style={{ textAlign: 'center', color: E.textMuted, fontSize: '12px', padding: '16px' }}>{year} 年尚無國定假日</div>
              )}
            </div>
            <button onClick={resetHolidays} style={{ ...E.btnGhost, fontSize: '12px', padding: '8px 0' }}>↺ 重設為 2026 政府行事曆預設</button>
          </div>
        </Modal>
      )}

      {/* Modal：停班 / 豪雨假管理 */}
      {showSuspModal && (
        <Modal title="🌧️ 停班 / 豪雨假管理" onClose={() => setShowSuspModal(false)} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '12px', color: E.textMuted, lineHeight: 1.6, backgroundColor: '#eaf0f8', padding: '8px 12px', borderRadius: '8px' }}>
              縣市政府宣布停班時登記。依天災要點：停班日<strong style={{ color: '#3c6eb4' }}>沒出勤＝無薪</strong>（缺的時數照缺時扣薪），但<strong>不算曠職</strong>、不影響全勤；有出勤的工時照<strong>正常薪（1×）</strong>計，<u>不</u>自動 ×2。需另給加給/補假請手動處理。
            </div>
            {/* 新增 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>日期</label>
                <input type="date" value={newSusp.date} onChange={e => setNewSusp(p => ({ ...p, date: e.target.value }))} style={E.input} />
              </div>
              <div style={{ flex: 1, minWidth: '100px' }}>
                <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>名稱</label>
                <input type="text" value={newSusp.label} onChange={e => setNewSusp(p => ({ ...p, label: e.target.value }))} placeholder="豪雨假" style={E.input} />
              </div>
              <div style={{ minWidth: '110px' }}>
                <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>範圍</label>
                <select value={newSusp.scope} onChange={e => setNewSusp(p => ({ ...p, scope: e.target.value }))} style={E.input}>
                  <option value="full">全天</option>
                  <option value="partial">某時段後</option>
                </select>
              </div>
              {newSusp.scope === 'partial' && (
                <div style={{ minWidth: '90px' }}>
                  <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>停班起</label>
                  <input type="time" value={newSusp.fromTime} onChange={e => setNewSusp(p => ({ ...p, fromTime: e.target.value }))} style={E.input} />
                </div>
              )}
              <button onClick={addSusp} disabled={!newSusp.date}
                style={{ ...E.btnPrimary, padding: '9px 16px', opacity: !newSusp.date ? 0.5 : 1 }}>加入</button>
            </div>
            {/* 清單（本月） */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', border: `1px solid ${E.divider}`, borderRadius: '8px', padding: '8px' }}>
              {monthSuspList.map(([date, s]) => (
                <div key={date} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#eaf0f8' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#3c6eb4', minWidth: '88px' }}>{date}</span>
                  <span style={{ fontSize: '13px', color: E.textPrimary, flex: 1 }}>{suspLabel(s)}<span style={{ color: E.textMuted, fontSize: '11px', marginLeft: '6px' }}>{s.scope === 'partial' ? '（部分停班）' : '（全天停班）'}</span></span>
                  <button onClick={() => removeSusp(date)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c09070', padding: '2px', display: 'flex' }}><Trash2 size={14} /></button>
                </div>
              ))}
              {monthSuspList.length === 0 && (
                <div style={{ textAlign: 'center', color: E.textMuted, fontSize: '12px', padding: '16px' }}>本月尚無停班日</div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showAddEmployee && (
        <Modal title="新增員工" onClose={() => setShowAddEmployee(false)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['姓名 *','name','text'],['職稱','role','text'],['到職日','hireDate','date'],['電話','phone','text'],['Email','email','email']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}{key === 'hireDate' && <span style={{ color: E.textMuted, fontWeight: '400' }}>（算特休年資用）</span>}</label>
                <input type={type} value={newEmployee[key] || ''} onChange={e => setNewEmployee(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
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
            {[['姓名 *','name','text'],['職稱','role','text'],['到職日','hireDate','date'],['電話','phone','text'],['Email','email','email']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}{key === 'hireDate' && <span style={{ color: E.textMuted, fontWeight: '400' }}>（算特休年資用）</span>}</label>
                <input type={type} value={editEmployee[key] || ''} onChange={e => setEditEmployee(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
          </div>
          <button onClick={() => {
            if (!editEmployee.name.trim()) return
            updateItem('employees', editEmployee.id, { name: editEmployee.name, role: editEmployee.role, email: editEmployee.email, phone: editEmployee.phone, hireDate: editEmployee.hireDate || '' })
            const who = currentUser?.name || currentUser?.username || '未知'
            logEdit({ user: who, action: '編輯', entityType: '員工', entityName: editEmployee.name, summary: `職稱：${editEmployee.role || '—'}${editEmployee.hireDate ? ` · 到職 ${editEmployee.hireDate}` : ''}` })
            setEditEmployee(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}
    </div>
  )
}
