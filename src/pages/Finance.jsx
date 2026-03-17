import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Search, CreditCard, ChevronLeft, Pencil, Download, Receipt, Filter } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS, useIsMobile } from '../styles/earth'
import { exportFinance } from '../utils/exportExcel'

const CHART_COLORS = ['#4d8843','#5b7ec9','#c89040','#8a5cb0','#c04030','#3a9080','#b06030','#607060']

// ── 薪資計算用常數 & helper（與 HR.jsx 共用邏輯）──
const MONTHS = ['一','二','三','四','五','六','七','八','九','十','十一','十二']
const GOVT_WORK_DAYS = {
  '2025-01': { hours: 136 }, '2025-02': { hours: 152 }, '2025-03': { hours: 168 },
  '2025-04': { hours: 152 }, '2025-05': { hours: 176 }, '2025-06': { hours: 160 },
  '2025-07': { hours: 184 }, '2025-08': { hours: 168 }, '2025-09': { hours: 168 },
  '2025-10': { hours: 160 }, '2025-11': { hours: 168 }, '2025-12': { hours: 168 },
  '2026-01': { hours: 168 }, '2026-02': { hours: 112 }, '2026-03': { hours: 176 },
  '2026-04': { hours: 160 }, '2026-05': { hours: 160 }, '2026-06': { hours: 168 },
  '2026-07': { hours: 184 }, '2026-08': { hours: 168 }, '2026-09': { hours: 160 },
  '2026-10': { hours: 160 }, '2026-11': { hours: 168 }, '2026-12': { hours: 176 },
}
const SHIFTS_DEF = [
  { code: '出勤', hours: 8 }, { code: '上午班', hours: 4 },
  { code: '下午班', hours: 4 }, { code: '休假', hours: 0 },
]
function getShiftHours(code) { return SHIFTS_DEF.find(s => s.code === code)?.hours || 0 }
const roundHours = m => Math.floor((m / 60) * 2) / 2
function computeEmpMonthClockHours(emp, yr, mo, data) {
  const myClockins = data.clockins.filter(c =>
    c.date?.startsWith(`${yr}-${String(mo).padStart(2,'0')}`) &&
    c.empName && (c.empName === emp.name || emp.name.includes(c.empName) || c.empName.includes(emp.name))
  )
  const allDates = [...new Set(myClockins.map(c => c.date))].sort()
  let totalMinutes = 0
  allDates.forEach(date => {
    const dayRecs = myClockins.filter(c => c.date === date).sort((a, b) => (a.time||'').localeCompare(b.time||''))
    const ins = dayRecs.filter(c => c.type === '上班')
    const outs = dayRecs.filter(c => c.type === '下班')
    if (ins.length > 0 && outs.length > 0 && ins[0].time && outs[outs.length-1].time) {
      const [ih, im] = ins[0].time.split(':').map(Number)
      const [oh, om] = outs[outs.length-1].time.split(':').map(Number)
      let dayMin = Math.max(0, (oh*60+om) - (ih*60+im))
      if (dayMin >= 300) dayMin = Math.max(0, dayMin - 60)
      totalMinutes += dayMin
    }
  })
  return roundHours(totalMinutes)
}
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
    return total + Math.max(0, computeEmpMonthClockHours(emp, yr, mo, data) - (GOVT_WORK_DAYS[mStr]?.hours || 0))
  }, 0)
}

function DonutChart({ slices, size = 120 }) {
  const r = 40, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      {slices.map((s, i) => {
        const dash = (s.pct / 100) * circ
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={s.color} strokeWidth={18}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-offset} />
        )
        offset += dash
        return el
      })}
      <circle cx={cx} cy={cy} r={31} fill="#fdfaf5" />
    </svg>
  )
}

export default function Finance() {
  const { data, addItem, updateItem, deleteItem, logEdit, generateSerial } = useApp()
  const { isAdmin, currentUser } = useAuth()
  const mob = useIsMobile()
  const [tab, setTab] = useState('reimburse')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showAddBank, setShowAddBank] = useState(false)
  const [showAddPayable, setShowAddPayable] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState(null)
  const [showClosedBudgets, setShowClosedBudgets] = useState(false)
  const currentYear = new Date().getFullYear()
  const [budgetYear, setBudgetYear] = useState(String(currentYear))
  const [newR, setNewR] = useState({ date: '', person: '', project: '', amount: '', description: '', method: '現金', receiptNo: '' })
  const [newP, setNewP] = useState({ date: '', person: '', project: '', amount: '', description: '', status: '待審核' })
  const [newBank, setNewBank] = useState({ name: '', type: 'employee', bank: '', account: '', note: '' })
  const [newPayable, setNewPayable] = useState({ vendor: '', amount: '', invoiceNo: '', dueDate: '', project: '', status: '待付', note: '' })
  const [editR, setEditR] = useState(null)
  const [editP, setEditP] = useState(null)
  const [editBank, setEditBank] = useState(null)
  const [editPayable, setEditPayable] = useState(null)
  const [bankFilter, setBankFilter] = useState('all')
  const [bankSort, setBankSort] = useState('name')
  const [showPaidHistory, setShowPaidHistory] = useState(false)
  const [showPaidReimb, setShowPaidReimb] = useState(false)
  const [showAddExp, setShowAddExp] = useState(false)
  const [viewExp, setViewExp] = useState(null)
  const [editExp, setEditExp] = useState(null)
  const EMPTY_EXP = { date: '', direction: '支出', project: '', category: '', account: '', amount: '', vendor: '', method: '現金', receiptNo: '', note: '', linkedSerial: '' }
  const [newExp, setNewExp] = useState(EMPTY_EXP)
  const [expDirFilter, setExpDirFilter] = useState('all')
  const [expProjFilter, setExpProjFilter] = useState('all')
  const [expCatFilter, setExpCatFilter] = useState('all')
  const [showExpFilters, setShowExpFilters] = useState(false)

  // 薪資管理 state
  const now = new Date()
  const [payrollMonth, setPayrollMonth] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [showGenPayroll, setShowGenPayroll] = useState(false)
  const [genSlips, setGenSlips] = useState([])   // draft slips during generation
  const [viewPayroll, setViewPayroll] = useState(null)  // selected payroll record
  const [viewSlip, setViewSlip] = useState(null)        // selected single slip
  const [salaryEditEmp, setSalaryEditEmp] = useState(null)
  const [compLeaveForm, setCompLeaveForm] = useState({ empId: null, date: '', hours: 4, note: '' })
  const [salaryExpandedEmp, setSalaryExpandedEmp] = useState(null)
  // 統編發票
  const [showAddInv, setShowAddInv] = useState(false)
  const [editInv, setEditInv] = useState(null)
  const EMPTY_INV = { date: '', amount: '', issuer: '', purpose: '', note: '' }
  const [newInv, setNewInv] = useState(EMPTY_INV)
  const invoices = useMemo(() =>
    (data.invoices || []).sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [data.invoices])

  const expProjects = useMemo(() => [...new Set(data.expenses.map(e => e.project).filter(Boolean))].sort(), [data.expenses])
  const expCategories = useMemo(() => [...new Set(data.expenses.map(e => e.category).filter(Boolean))].sort(), [data.expenses])
  const expFiltered = useMemo(() =>
    [...data.expenses]
      .filter(e => !search || e.vendor?.includes(search) || e.project?.includes(search) || e.account?.includes(search))
      .filter(e => expDirFilter === 'all' || (e.direction || '支出') === expDirFilter)
      .filter(e => expProjFilter === 'all' || e.project === expProjFilter)
      .filter(e => expCatFilter === 'all' || e.category === expCatFilter)
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [data.expenses, search, expDirFilter, expProjFilter, expCatFilter])

  const allVisibleReimbursements = useMemo(() =>
    (isAdmin ? data.reimbursements : data.reimbursements.filter(r => r.person === currentUser?.name))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [data.reimbursements, isAdmin, currentUser?.name])
  const visibleReimbursements = useMemo(() => allVisibleReimbursements.filter(r => r.status !== '已還款'), [allVisibleReimbursements])
  const paidReimbursements = useMemo(() => allVisibleReimbursements.filter(r => r.status === '已還款'), [allVisibleReimbursements])

  const visiblePurchaseRequests = useMemo(() =>
    isAdmin ? data.purchaseRequests : data.purchaseRequests.filter(p => p.person === currentUser?.name),
    [data.purchaseRequests, isAdmin, currentUser?.name])

  const filteredBankAccounts = useMemo(() =>
    (data.bankAccounts || [])
      .filter(b => bankFilter === 'all' || b.type === bankFilter)
      .sort((a, b) => {
        if (bankSort === 'name') return (a.name || '').localeCompare(b.name || '', 'zh-TW')
        return (a.bank || '').localeCompare(b.bank || '', 'zh-TW')
      }),
    [data.bankAccounts, bankFilter, bankSort])

  const { payables, pendingPayables, paidPayables, overduePayables, totalPending } = useMemo(() => {
    const payables = data.payables || []
    const today = new Date().toISOString().split('T')[0]
    const pendingPayables = payables.filter(p => p.status === '待付')
    const paidPayables = payables.filter(p => p.status === '已付').sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    const overduePayables = pendingPayables.filter(p => p.dueDate && p.dueDate < today)
    const totalPending = pendingPayables.reduce((s, p) => s + (Number(p.amount) || 0), 0)
    return { payables, pendingPayables, paidPayables, overduePayables, totalPending }
  }, [data.payables])

  const ALL_TABS = [['reimburse','代墊申請'],['purchase','採購申請'],['payable','應付款項'],['invoice','統編發票'],['expenses','帳目查詢'],['budget','預算總覽'],['bank','匯款帳戶'],['payroll','薪資管理']]
  const TABS = isAdmin ? ALL_TABS : [['reimburse','代墊申請'],['purchase','採購申請'],['payroll','薪資管理']]

  function stChip(s) {
    const c = STATUS[s] || { bg: '#eee', color: '#666' }
    return { fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600', backgroundColor: c.bg, color: c.color }
  }

  function savePayable(pay) {
    const now = new Date().toISOString().slice(0,16).replace('T',' ')
    const who = currentUser?.name || currentUser?.username || '未知'
    updateItem('payables', pay.id, { ...pay, amount: Number(pay.amount), updatedBy: who, updatedAt: now })
    logEdit({ user: who, action: '編輯', entityType: '應付款項', entityName: pay.vendor, summary: `NT$${Number(pay.amount).toLocaleString()} · ${pay.status}` })
    setEditPayable(null)
  }

  // ── 薪資產生 helpers ──
  function monthLabel(ym) {
    const [y, m] = ym.split('-')
    const rocYear = Number(y) - 1911
    return `${rocYear}年${Number(m)}月`
  }
  function buildDraftSlips(ym) {
    const [y, m] = ym.split('-').map(Number)
    return (data.employees || []).map(emp => {
      const s = (data.salarySettings || []).find(x => x.empId === emp.id) || {}
      const payType = s.payType || 'monthly'
      const baseSalary = Number(s.baseSalary || s.hourlyRate || 0)
      const mealAllowance = Number(s.mealAllowance || 0)
      // calc hours from schedules for that month
      const hrs = (data.schedules || [])
        .filter(sc => sc.empId === emp.id && sc.year === y && sc.month === m)
        .reduce((sum, sc) => {
          const shiftHours = { '出勤': 8, '上午班': 4, '下午班': 4, '休假': 0 }
          return sum + (shiftHours[sc.shift] || 0)
        }, 0)
      const computedBase = payType === 'monthly' ? baseSalary : Math.round(hrs * baseSalary)
      const fullAttendanceBonus = Number(s.fullAttendanceBonus || 0)
      const activityAttendance = Number(s.activityAttendance || 0)
      const grossPay = computedBase + mealAllowance + fullAttendanceBonus + activityAttendance
      const healthInsEmp = Number(s.healthInsEmp || 0)
      const laborInsEmp = Number(s.laborInsEmp || 0)
      const pensionSelf = Number(s.pensionSelf || 0)
      const dependentHealth = Number(s.dependentHealth || 0)
      const wireFee = Number(s.wireFee || 0)
      const totalDeductions = healthInsEmp + laborInsEmp + pensionSelf + dependentHealth + wireFee
      const healthInsEmployer = Number(s.healthInsEmployer || 0)
      const laborInsEmployer = Number(s.laborInsEmployer || 0)
      const pensionEmployer = Number(s.pensionEmployer || 0)
      const totalEmployerBurden = healthInsEmployer + laborInsEmployer + pensionEmployer
      return {
        empId: emp.id, empName: emp.name, hoursWorked: hrs, payType,
        baseSalary: computedBase, mealAllowance,
        fullAttendanceBonus, activityAttendance, overtime: 0, advance: 0,
        grossPay, healthInsEmp, laborInsEmp, pensionSelf, dependentHealth, wireFee,
        totalDeductions, netPay: grossPay - totalDeductions,
        healthInsEmployer, laborInsEmployer, pensionEmployer,
        totalEmployerBurden, totalEmployerCost: grossPay + totalEmployerBurden,
        note: '',
      }
    })
  }
  function recalcSlip(slip) {
    const grossPay = (slip.baseSalary||0) + (slip.mealAllowance||0) + (slip.fullAttendanceBonus||0) + (slip.activityAttendance||0) + (slip.overtime||0)
    const totalDeductions = (slip.healthInsEmp||0)+(slip.laborInsEmp||0)+(slip.pensionSelf||0)+(slip.dependentHealth||0)+(slip.wireFee||0)+(slip.advance||0)
    const totalEmployerBurden = (slip.healthInsEmployer||0)+(slip.laborInsEmployer||0)+(slip.pensionEmployer||0)
    return { ...slip, grossPay, totalDeductions, netPay: grossPay - totalDeductions, totalEmployerBurden, totalEmployerCost: grossPay + totalEmployerBurden }
  }
  function monthHoursFor(empId) {
    const [y, m] = payrollMonth.split('-').map(Number)
    return data.schedules.filter(s => s.empId === empId && s.year === y && s.month === m)
      .reduce((sum, s) => sum + getShiftHours(s.shift), 0)
  }
  function updateSalarySettingFor(emp, updates) {
    const existing = (data.salarySettings || []).find(s => s.empId === emp.id)
    if (existing) {
      updateItem('salarySettings', existing.id, updates)
    } else {
      addItem('salarySettings', { id: Date.now() + emp.id, empId: emp.id, payType: 'monthly', baseSalary: 0, mealAllowance: 0, fullAttendanceBonus: 0, activityAttendance: 0, healthInsEmp: 0, laborInsEmp: 0, pensionSelf: 0, dependentHealth: 0, supplementalIns: 0, wireFee: 0, healthInsEmployer: 0, laborInsEmployer: 0, pensionEmployer: 0, ...updates })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>財務管理</h1>
        {isAdmin && (
          <button onClick={() => exportFinance(data)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', border: '1px solid #d8cbb8', backgroundColor: '#fdfaf5', color: '#5a3a1a', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}>
            <Download size={14} /> 匯出 Excel
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#fdfaf5', borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...E.tab(tab === key), flexShrink: 0 }}>{label}</button>
        ))}
      </div>

      {/* 代墊申請 */}
      {tab === 'reimburse' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => { setNewR(r => ({ ...r, person: !isAdmin ? (currentUser?.name || '') : r.person })); setShowAdd(true) }}
              style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增代墊</button>
          </div>

          {/* 管理員 Dashboard */}
          {isAdmin && (() => {
            const allPending = data.reimbursements.filter(r => r.status !== '已還款')
            const totalPendingAmt = allPending.reduce((s, r) => s + (Number(r.amount) || 0), 0)
            // 按員工分組（待還款）
            const byPerson = {}
            for (const r of allPending) {
              const p = r.person || '未知'
              if (!byPerson[p]) byPerson[p] = { count: 0, total: 0 }
              byPerson[p].count++
              byPerson[p].total += Number(r.amount) || 0
            }
            const persons = Object.entries(byPerson).sort((a, b) => b[1].total - a[1].total)
            return (
              <>
                {/* 統計列 */}
                <div style={{ ...E.card, display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center', borderLeft: `3px solid ${E.coffee}` }}>
                  <div>
                    <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>待還款總額</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: E.coffee }}>NT${totalPendingAmt.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>待還筆數</div>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: E.textPrimary }}>{allPending.length} 筆</div>
                  </div>
                </div>
                {/* 各員工待還卡片 */}
                {persons.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                    {persons.map(([person, stat]) => (
                      <div key={person} style={{ ...E.card, padding: '12px 16px', borderLeft: `3px solid ${E.coffee}` }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary, marginBottom: '6px' }}>{person}</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: E.coffee }}>NT${stat.total.toLocaleString()}</div>
                        <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px' }}>{stat.count} 筆待還</div>
                      </div>
                    ))}
                  </div>
                )}
                {persons.length === 0 && (
                  <div style={{ ...E.card, textAlign: 'center', color: E.green, fontSize: '13px', padding: '12px', fontWeight: '600' }}>🎉 目前無待還款項</div>
                )}
              </>
            )
          })()}

          {visibleReimbursements.length === 0 && paidReimbursements.length === 0
            ? <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>尚無代墊記錄</div>
            : (() => {
                // 管理員：按人分組；員工：平鋪自己的記錄
                const ReimbCard = ({ r }) => (
                  <div key={r.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{r.description || '代墊款'}</span>
                        <span style={stChip(r.status)}>{r.status}</span>
                        {r.serialNo && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#e8f0e4', color: '#3a6d31', fontWeight: '600', letterSpacing: '0.5px' }}>{r.serialNo}</span>}
                      </div>
                      <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>{r.date}{isAdmin ? ` · ${r.person}` : ''} · {r.project} · {r.method}</div>
                      {r.receiptNo && <div style={{ fontSize: '12px', color: E.textMuted }}>憑證：{r.receiptNo}</div>}
                      {r.updatedBy && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px', fontStyle: 'italic' }}>最後編輯：{r.updatedBy} · {r.updatedAt}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary }}>NT${Number(r.amount).toLocaleString()}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                        {isAdmin && (
                          <button onClick={() => updateItem('reimbursements', r.id, { status: '已還款' })}
                            style={{ fontSize: '11px', backgroundColor: E.green, color: '#f2f7f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>已還款</button>
                        )}
                        <button onClick={() => setEditR({ ...r })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                        {isAdmin && (
                          <button onClick={() => deleteItem('reimbursements', r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                        )}
                      </div>
                    </div>
                  </div>
                )
                if (!isAdmin) return visibleReimbursements.map(r => <ReimbCard key={r.id} r={r} />)
                // 管理員：按人分組
                const groups = {}
                for (const r of visibleReimbursements) {
                  const p = r.person || '未知'
                  if (!groups[p]) groups[p] = []
                  groups[p].push(r)
                }
                return Object.entries(groups).map(([person, recs]) => (
                  <div key={person}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '6px 0 4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: E.textSecond }}>{person}</span>
                      <span style={{ fontSize: '11px', color: E.textMuted }}>NT${recs.reduce((s,r)=>s+Number(r.amount),0).toLocaleString()} · {recs.length} 筆</span>
                      <div style={{ flex:1, height:'1px', backgroundColor: E.divider }} />
                    </div>
                    {recs.map(r => <ReimbCard key={r.id} r={r} />)}
                  </div>
                ))
              })()
          }

          {/* 已還款記錄（可收合） */}
          {paidReimbursements.length > 0 && (
            <div>
              <button
                onClick={() => setShowPaidReimb(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px', fontWeight: '600', padding: '4px 0', marginBottom: showPaidReimb ? '8px' : 0 }}
              >
                <span style={{ fontSize: '11px' }}>{showPaidReimb ? '▲' : '▼'}</span>
                已還款記錄（{paidReimbursements.length} 筆）
              </button>
              {showPaidReimb && paidReimbursements.map(r => (
                <div key={r.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', opacity: 0.72 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{r.description || '代墊款'}</span>
                      <span style={stChip('已還款')}>已還款</span>
                      {r.serialNo && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#e8f0e4', color: '#3a6d31', fontWeight: '600', letterSpacing: '0.5px' }}>{r.serialNo}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>{r.date} · {r.person} · {r.project} · {r.method}</div>
                    {r.receiptNo && <div style={{ fontSize: '12px', color: E.textMuted }}>憑證：{r.receiptNo}</div>}
                    {r.updatedBy && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px', fontStyle: 'italic' }}>還款：{r.updatedBy} · {r.updatedAt}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: E.textSecond }}>NT${Number(r.amount).toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditR({ ...r })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                      {isAdmin && (
                        <button onClick={() => deleteItem('reimbursements', r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 採購申請 */}
      {tab === 'purchase' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => { setNewP(p => ({ ...p, person: !isAdmin ? (currentUser?.name || '') : p.person })); setShowAdd(true) }}
              style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增申請</button>
          </div>
          {visiblePurchaseRequests.length === 0
            ? <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>尚無採購申請</div>
            : visiblePurchaseRequests.map(p => (
              <div key={p.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{p.description || '採購申請'}</span>
                    <span style={stChip(p.status)}>{p.status}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>{p.date} · {p.person} · {p.project}</div>
                  {p.updatedBy && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px', fontStyle: 'italic' }}>最後編輯：{p.updatedBy} · {p.updatedAt}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary }}>NT${Number(p.amount).toLocaleString()}</div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                    {isAdmin && p.status === '待審核' && (
                      <>
                        <button onClick={() => updateItem('purchaseRequests', p.id, { status: '已核准' })} style={{ fontSize: '11px', backgroundColor: E.green, color: '#f2f7f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>核准</button>
                        <button onClick={() => updateItem('purchaseRequests', p.id, { status: '不核准' })} style={{ fontSize: '11px', backgroundColor: '#c04030', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer' }}>駁回</button>
                      </>
                    )}
                    <button onClick={() => setEditP({ ...p })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                    {isAdmin && (
                      <button onClick={() => deleteItem('purchaseRequests', p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 應付款項 */}
      {tab === 'payable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 統計卡 */}
          <div style={{ ...E.card, display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>應付總額</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: E.textPrimary }}>NT${totalPending.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>待付筆數</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: E.coffee }}>{pendingPayables.length} 筆</div>
            </div>
            {overduePayables.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: '#c04030', marginBottom: '2px' }}>已逾期</div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#c04030' }}>{overduePayables.length} 筆</div>
              </div>
            )}
          </div>

          {/* 新增按鈕 */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddPayable(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增應付款</button>
          </div>

          {/* 待付款項列表 */}
          {pendingPayables.length === 0
            ? <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>目前無待付款項 🎉</div>
            : [...pendingPayables]
                .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
                .map(pay => {
                  const isOverdue = pay.dueDate && pay.dueDate < today
                  return (
                    <div key={pay.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', borderLeft: isOverdue ? '3px solid #c04030' : undefined, paddingLeft: isOverdue ? '17px' : undefined }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>{pay.vendor}</span>
                          {isOverdue && (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#fde8e6', color: '#c04030', fontWeight: '600' }}>逾期</span>
                          )}
                          {pay.serialNo && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#e8f0e4', color: '#3a6d31', fontWeight: '600', letterSpacing: '0.5px' }}>{pay.serialNo}</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>
                          應付日：{pay.dueDate || '未設定'}
                          {pay.project ? ` · ${pay.project}` : ''}
                          {pay.invoiceNo ? ` · 憑證：${pay.invoiceNo}` : ''}
                        </div>
                        {pay.note && <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '2px' }}>{pay.note}</div>}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: isOverdue ? '#c04030' : E.textPrimary }}>NT${Number(pay.amount).toLocaleString()}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                          <button onClick={() => {
                            const now = new Date().toISOString().slice(0,16).replace('T',' ')
                            const who = currentUser?.name || currentUser?.username || '未知'
                            updateItem('payables', pay.id, { status: '已付', updatedBy: who, updatedAt: now })
                            logEdit({ user: who, action: '標記已付', entityType: '應付款項', entityName: pay.vendor, summary: `NT$${Number(pay.amount).toLocaleString()}` })
                          }} style={{ fontSize: '11px', backgroundColor: E.green, color: '#f2f7f0', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '600' }}>標記已付</button>
                          <button onClick={() => setEditPayable({ ...pay })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                          {isAdmin && (
                            <button onClick={() => deleteItem('payables', pay.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
          }

          {/* 已付記錄（可收合） */}
          {paidPayables.length > 0 && (
            <div>
              <button
                onClick={() => setShowPaidHistory(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px', fontWeight: '600', padding: '4px 0', marginBottom: showPaidHistory ? '8px' : 0 }}
              >
                <span style={{ fontSize: '11px' }}>{showPaidHistory ? '▲' : '▼'}</span>
                已付記錄（{paidPayables.length} 筆）
              </button>
              {showPaidHistory && paidPayables.map(pay => (
                <div key={pay.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', opacity: 0.75 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>{pay.vendor}</span>
                      <button onClick={() => {
                        const now = new Date().toISOString().slice(0,16).replace('T',' ')
                        const who = currentUser?.name || currentUser?.username || '未知'
                        updateItem('payables', pay.id, { status: '待付', updatedBy: who, updatedAt: now })
                        logEdit({ user: who, action: '改回待付', entityType: '應付款項', entityName: pay.vendor, summary: `NT$${Number(pay.amount).toLocaleString()}` })
                      }} style={{ ...stChip('已付'), cursor: 'pointer', border: 'none', transition: 'opacity 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        title="點擊改回待付">已付</button>
                    </div>
                    <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>
                      應付日：{pay.dueDate || '未設定'}
                      {pay.project ? ` · ${pay.project}` : ''}
                      {pay.invoiceNo ? ` · 憑證：${pay.invoiceNo}` : ''}
                    </div>
                    {pay.updatedBy && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '3px', fontStyle: 'italic' }}>付款記錄：{pay.updatedBy} · {pay.updatedAt}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: '700', color: E.textSecond }}>NT${Number(pay.amount).toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', justifyContent: 'flex-end' }}>
                      {isAdmin && (
                        <button onClick={() => deleteItem('payables', pay.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 統編發票 */}
      {tab === 'invoice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 統計 */}
          <div style={{ ...E.card, display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>發票筆數</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: E.textPrimary }}>{invoices.length}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>總金額</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#c08a30' }}>
                NT${invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString()}
              </div>
            </div>
            <div style={{ marginLeft: 'auto' }}>
              <button onClick={() => { setNewInv(EMPTY_INV); setEditInv(null); setShowAddInv(true) }}
                style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', fontSize: '13px' }}>
                <Plus size={14} /> 新增發票
              </button>
            </div>
          </div>

          {/* 說明 */}
          <div style={{ fontSize: '12px', color: E.textMuted, backgroundColor: '#f8f2e8', padding: '10px 14px', borderRadius: '10px', border: '1px solid #ede5d8' }}>
            <Receipt size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
            此區紀錄「非公司付款、但開立公司統編」的發票，用於報稅登記。
          </div>

          {/* 列表 */}
          {invoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: E.textMuted, fontSize: '14px' }}>尚無發票紀錄</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {invoices.map(inv => (
                <div key={inv.id} style={{ ...E.card, display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }}
                  onClick={() => { setEditInv(inv); setNewInv({ date: inv.date, amount: inv.amount, issuer: inv.issuer, purpose: inv.purpose, note: inv.note || '' }); setShowAddInv(true) }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f5ecd8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Receipt size={18} style={{ color: '#c08a30' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{inv.issuer || '未填'}</div>
                    <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '2px' }}>{inv.purpose || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#c08a30' }}>NT${Number(inv.amount || 0).toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px' }}>{inv.date}</div>
                  </div>
                  {isAdmin && (
                    <button onClick={e => { e.stopPropagation(); if (confirm('確定刪除此筆發票？')) deleteItem('invoices', inv.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '4px' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 新增/編輯 Modal */}
          {showAddInv && (
            <Modal title={editInv ? '編輯發票' : '新增統編發票'} onClose={() => { setShowAddInv(false); setEditInv(null) }} size="sm">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: '日期', key: 'date', type: 'date' },
                  { label: '金額', key: 'amount', type: 'number', placeholder: '發票金額' },
                  { label: '開票人 / 店家', key: 'issuer', type: 'text', placeholder: '例：全聯、統一超商' },
                  { label: '用途', key: 'purpose', type: 'text', placeholder: '例：文具、交通、餐費' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                    <input type={f.type} value={newInv[f.key]} onChange={e => setNewInv(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder || ''}
                      style={{ ...E.input, boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }}>備註</label>
                  <textarea value={newInv.note} onChange={e => setNewInv(p => ({ ...p, note: e.target.value }))}
                    placeholder="選填"
                    rows={2}
                    style={{ ...E.input, resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={() => {
                if (!newInv.date || !newInv.amount) return
                if (editInv) {
                  updateItem('invoices', editInv.id, { ...newInv, amount: Number(newInv.amount) })
                } else {
                  addItem('invoices', { ...newInv, id: Date.now(), amount: Number(newInv.amount) })
                }
                setShowAddInv(false); setEditInv(null); setNewInv(EMPTY_INV)
              }} style={{ ...E.btnPrimary, width: '100%', marginTop: '14px', padding: '10px', fontSize: '14px', fontWeight: '600' }}>
                {editInv ? '儲存' : '新增'}
              </button>
            </Modal>
          )}
        </div>
      )}

      {/* 帳目查詢 */}
      {tab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: mob ? 'wrap' : 'nowrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: mob ? '100%' : '180px' }}>
              <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: E.textMuted }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋廠商、專案、科目..."
                style={{ ...E.input, paddingLeft: '36px' }} />
            </div>
            <button onClick={() => setShowExpFilters(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer',
                backgroundColor: showExpFilters || expDirFilter !== 'all' || expProjFilter !== 'all' || expCatFilter !== 'all' ? E.sandLight : 'transparent',
                border: `1px solid ${showExpFilters ? E.coffee : E.divider}`, color: showExpFilters ? E.coffee : E.textSecond }}>
              <Filter size={14} />篩選
              {(expDirFilter !== 'all' || expProjFilter !== 'all' || expCatFilter !== 'all') && (
                <span style={{ fontSize: '10px', backgroundColor: E.coffee, color: '#fff', borderRadius: '999px', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                  {[expDirFilter, expProjFilter, expCatFilter].filter(f => f !== 'all').length}
                </span>
              )}
            </button>
            <button onClick={() => setShowAddExp(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <Plus size={15} />新增帳目
            </button>
          </div>
          {showExpFilters && (
            <div style={{ ...E.card, padding: mob ? '12px' : '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: E.textSecond }}>篩選條件</span>
                {(expDirFilter !== 'all' || expProjFilter !== 'all' || expCatFilter !== 'all') && (
                  <button onClick={() => { setExpDirFilter('all'); setExpProjFilter('all'); setExpCatFilter('all') }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: E.coffee, padding: 0 }}>
                    清除全部
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: mob ? '8px' : '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: mob ? '100%' : '140px' }}>
                  <span style={{ fontSize: '11px', color: E.textMuted }}>收支類型</span>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {['all','支出','收入','稅抵用'].map(d => (
                      <button key={d} onClick={() => setExpDirFilter(d)}
                        style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', border: `1px solid ${expDirFilter === d ? E.coffee : E.divider}`,
                          backgroundColor: expDirFilter === d ? E.coffee : 'transparent', color: expDirFilter === d ? '#fff' : E.textSecond,
                          cursor: 'pointer', fontWeight: expDirFilter === d ? '600' : '400' }}>
                        {d === 'all' ? '全部' : d}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: mob ? '100%' : '160px' }}>
                  <span style={{ fontSize: '11px', color: E.textMuted }}>專案</span>
                  <select value={expProjFilter} onChange={e => setExpProjFilter(e.target.value)}
                    style={{ ...E.input, fontSize: '12px', padding: '5px 10px' }}>
                    <option value="all">全部專案</option>
                    {expProjects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: mob ? '100%' : '140px' }}>
                  <span style={{ fontSize: '11px', color: E.textMuted }}>類別</span>
                  <select value={expCatFilter} onChange={e => setExpCatFilter(e.target.value)}
                    style={{ ...E.input, fontSize: '12px', padding: '5px 10px' }}>
                    <option value="all">全部類別</option>
                    {expCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: E.textMuted }}>
                共 {expFiltered.length} 筆結果
                {expFiltered.length > 0 && <>　·　合計 <span style={{ fontWeight: '600', color: E.coffee }}>NT${expFiltered.reduce((s, e) => s + ((e.direction === '收入' ? 1 : -1) * (Number(e.amount) || 0)), 0).toLocaleString()}</span></>}
              </div>
            </div>
          )}
          <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: E.sandLight, borderBottom: `1px solid ${E.divider}` }}>
                    {['流水號','日期','收支','專案','類別','廠商','金額','操作'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: E.textSecond }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expFiltered.length === 0
                    ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: E.textMuted }}>無資料</td></tr>
                    : expFiltered.map((e, i) => (
                      <tr key={e.id} onClick={() => setViewExp(e)}
                        style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2', cursor: 'pointer' }}
                        onMouseEnter={ev => ev.currentTarget.style.backgroundColor = '#f0ede0'}
                        onMouseLeave={ev => ev.currentTarget.style.backgroundColor = i % 2 === 0 ? 'transparent' : '#faf7f2'}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                          {e.serialNo
                            ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#e8f0e4', color: '#3a6d31', fontWeight: '600', letterSpacing: '0.5px' }}>{e.serialNo}</span>
                            : <span style={{ color: E.textMuted, fontSize: '11px' }}>—</span>}
                        </td>
                        <td style={{ padding: '10px 14px', color: E.textSecond, whiteSpace: 'nowrap' }}>{e.date}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', fontWeight: '600',
                            backgroundColor: e.direction === '收入' ? '#e8f0e4' : e.direction === '稅抵用' ? '#ede8f5' : '#f5e8e0',
                            color: e.direction === '收入' ? '#3a6d31' : e.direction === '稅抵用' ? '#6b3fa0' : '#8a3a20' }}>
                            {e.direction || '支出'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}><span style={{ fontSize: '11px', backgroundColor: E.sandLight, color: E.textSecond, padding: '2px 8px', borderRadius: '6px' }}>{e.project}</span></td>
                        <td style={{ padding: '10px 14px', color: E.textSecond }}>{e.category}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '600', color: E.textPrimary }}>{e.vendor}</td>
                        <td style={{ padding: '10px 14px', fontWeight: '700', whiteSpace: 'nowrap',
                          color: e.direction === '收入' ? E.green : e.direction === '稅抵用' ? '#9b8ab0' : E.coffee,
                          opacity: e.direction === '稅抵用' ? 0.75 : 1 }}>
                          {e.direction === '收入' ? '+' : ''}NT${Number(e.amount).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} onClick={ev => ev.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => { setEditExp({ ...e }); setViewExp(null) }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080', padding: '4px' }}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => { if (window.confirm(`確定刪除「${e.vendor}」這筆帳目？`)) { deleteItem('expenses', e.id); setViewExp(null) } }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', padding: '4px' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 預算總覽 */}
      {tab === 'budget' && !selectedBudget && (() => {
        const projectsWithBudget = data.projects.filter(p => p.budget > 0)
        const allYears = [...new Set(
          projectsWithBudget.map(p => p.deadline ? p.deadline.slice(0, 4) : String(currentYear))
        )].sort((a, b) => b.localeCompare(a))
        if (!allYears.includes(budgetYear)) setBudgetYear(allYears[0] || String(currentYear))

        const yearProjects = projectsWithBudget.filter(p => {
          const y = p.deadline ? p.deadline.slice(0, 4) : String(currentYear)
          return y === budgetYear
        })
        const activeProjects = yearProjects.filter(p => p.status !== '結案')
        const closedProjects = yearProjects.filter(p => p.status === '結案')

        function BudgetCard({ p }) {
          const spent = data.expenses.filter(e => e.project === p.id && e.direction !== '稅抵用').reduce((s, e) => s + (e.amount || 0), 0)
          const contractAmount = Number(p.contractAmount) || 0
          const deductionAmount = Number(p.deductionAmount) || 0
          const effectiveBudget = contractAmount > 0 ? contractAmount - deductionAmount : Number(p.budget) || 0
          const pct = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : 0
          const isClosed = p.status === '結案'
          return (
            <div style={{ ...E.card, cursor: 'pointer', opacity: isClosed ? 0.72 : 1 }} onClick={() => setSelectedBudget(p.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{p.name}</div>
                    {isClosed && <span style={{ fontSize: '11px', padding: '1px 8px', borderRadius: '999px', backgroundColor: '#e8e4de', color: '#7a6a5a', fontWeight: '600' }}>結案</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px' }}>{p.id}</div>
                  {contractAmount > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ fontSize: '11px', color: E.textMuted }}>標案總金額 <span style={{ color: E.textSecond, fontWeight: '600' }}>NT${contractAmount.toLocaleString()}</span></div>
                      {deductionAmount > 0 && <div style={{ fontSize: '11px', color: E.textMuted }}>預扣金額 <span style={{ color: '#8a3a20', fontWeight: '600' }}>－NT${deductionAmount.toLocaleString()}</span></div>}
                      <div style={{ fontSize: '11px', color: E.textMuted }}>預算金額 <span style={{ color: E.textPrimary, fontWeight: '700' }}>NT${effectiveBudget.toLocaleString()}</span></div>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: E.coffee }}>NT${spent.toLocaleString()}</div>
                  <div style={{ fontSize: '11px', color: E.textMuted }}>/ NT${effectiveBudget.toLocaleString()} 預算</div>
                </div>
              </div>
              <div style={{ height: '8px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '999px', backgroundColor: isClosed ? '#9a8878' : pct > 80 ? '#c04030' : pct > 50 ? '#c89040' : E.green, width: `${pct}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: E.textMuted, marginTop: '6px' }}>
                <span>{pct.toFixed(1)}% 已使用</span>
                <span>剩餘 NT${(effectiveBudget - spent).toLocaleString()}</span>
              </div>
            </div>
          )
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto' }}>
              {allYears.map(y => (
                <button key={y} onClick={() => { setBudgetYear(y); setSelectedBudget(null) }}
                  style={{ ...E.tab(budgetYear === y), flexShrink: 0, border: budgetYear === y ? 'none' : `1px solid ${E.divider}` }}>
                  {y} 年
                </button>
              ))}
            </div>

            {yearProjects.length === 0
              ? <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>本年度無預算案件</div>
              : <>
                  {activeProjects.map(p => <BudgetCard key={p.id} p={p} />)}

                  {closedProjects.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowClosedBudgets(o => !o)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: `1px solid ${E.divider}`, borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', color: E.textSecond, fontSize: '13px', width: '100%', textAlign: 'left' }}>
                        <span style={{ fontSize: '12px' }}>{showClosedBudgets ? '▲' : '▼'}</span>
                        <span>結案案件（{closedProjects.length} 個）</span>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: E.textMuted }}>
                          {showClosedBudgets ? '收起' : '展開'}
                        </span>
                      </button>
                      {showClosedBudgets && closedProjects.map(p => <BudgetCard key={p.id} p={p} />)}
                    </>
                  )}
                </>
            }
          </div>
        )
      })()}

      {/* 預算詳細 */}
      {tab === 'budget' && selectedBudget && (() => {
        const p = data.projects.find(x => x.id === selectedBudget)
        if (!p) return null
        const exps = data.expenses.filter(e => e.project === p.id)
        const spentExps = exps.filter(e => e.direction !== '稅抵用')
        const spent = spentExps.reduce((s, e) => s + (e.amount || 0), 0)
        const contractAmount = Number(p.contractAmount) || 0
        const deductionAmount = Number(p.deductionAmount) || 0
        const effectiveBudget = contractAmount > 0 ? contractAmount - deductionAmount : Number(p.budget) || 0
        const pct = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : 0

        const byCategory = {}
        spentExps.forEach(e => { byCategory[e.category || '其他'] = (byCategory[e.category || '其他'] || 0) + e.amount })
        const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
        const maxCat = cats[0]?.[1] || 1
        const donutSlices = cats.map((c, i) => ({ label: c[0], val: c[1], pct: spent ? (c[1] / spent) * 100 : 0, color: CHART_COLORS[i % CHART_COLORS.length] }))

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button onClick={() => setSelectedBudget(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px', padding: 0, width: 'fit-content' }}>
              <ChevronLeft size={15} /> 返回總覽
            </button>

            {/* 合約金流 */}
            <div style={E.card}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary }}>{p.name}</div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px', marginBottom: '16px' }}>{p.id}{p.client ? ` · ${p.client}` : ''}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {/* 標案總金額 */}
                {contractAmount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: E.textMuted, width: '72px', flexShrink: 0 }}>標案總金額</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: E.textPrimary }}>NT${contractAmount.toLocaleString()}</span>
                  </div>
                )}
                {/* 預扣 */}
                {deductionAmount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', paddingLeft: '12px', paddingBottom: '8px', borderLeft: `2px solid ${E.divider}`, marginLeft: '36px' }}>
                    <span style={{ fontSize: '11px', color: E.textMuted, width: '60px', flexShrink: 0 }}>預扣 30%</span>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#8a3a20' }}>－NT${deductionAmount.toLocaleString()}</span>
                  </div>
                )}
                {/* 可動支 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', paddingBottom: '8px', ...(deductionAmount > 0 ? { paddingLeft: '12px', borderLeft: `2px solid ${E.divider}`, marginLeft: '36px' } : {}) }}>
                  <span style={{ fontSize: '11px', color: E.textMuted, width: contractAmount > 0 ? '60px' : 'auto', flexShrink: 0 }}>{contractAmount > 0 ? '可動支' : '預算金額'}</span>
                  <span style={{ fontSize: contractAmount > 0 ? '17px' : '20px', fontWeight: '800', color: E.textPrimary }}>NT${effectiveBudget.toLocaleString()}</span>
                </div>
                {/* 已支出 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', paddingLeft: '12px', paddingBottom: '8px', borderLeft: `2px solid ${E.divider}`, marginLeft: '36px' }}>
                  <span style={{ fontSize: '11px', color: E.textMuted, width: '60px', flexShrink: 0 }}>已支出</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color: E.coffee }}>NT${spent.toLocaleString()}</span>
                  <span style={{ fontSize: '11px', color: pct > 80 ? '#c04030' : E.textMuted }}>({pct.toFixed(1)}%)</span>
                </div>
                {/* 剩餘 */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', paddingLeft: '12px', borderLeft: `2px solid ${E.divider}`, marginLeft: '36px', paddingBottom: '12px' }}>
                  <span style={{ fontSize: '11px', color: E.textMuted, width: '60px', flexShrink: 0 }}>剩餘</span>
                  <span style={{ fontSize: '17px', fontWeight: '800', color: pct > 80 ? '#c04030' : E.green }}>NT${(effectiveBudget - spent).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ height: '8px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '999px', backgroundColor: pct > 80 ? '#c04030' : pct > 50 ? '#c89040' : E.green, width: `${pct}%`, transition: 'width 0.4s' }} />
              </div>
            </div>

            {cats.length > 0 && (
              <div style={E.card}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary, marginBottom: '14px' }}>支出類別</div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <DonutChart slices={donutSlices} size={130} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '160px' }}>
                    {cats.map((c, i) => (
                      <div key={c[0]}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0, display: 'inline-block' }} />
                            {c[0]}
                          </span>
                          <span style={{ fontWeight: '600', color: E.textPrimary }}>NT${c[1].toLocaleString()}</span>
                        </div>
                        <div style={{ height: '5px', backgroundColor: E.sandLight, borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '999px', backgroundColor: CHART_COLORS[i % CHART_COLORS.length], width: `${(c[1] / maxCat) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}


            <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${E.divider}`, fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>
                支出明細（{exps.length} 筆）
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: E.sandLight }}>
                      {['流水號','日期','類別','廠商','金額','科目'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 14px', fontWeight: '600', color: E.textSecond }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exps.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((e, i) => (
                      <tr key={e.id} style={{ borderBottom: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2' }}>
                        <td style={{ padding: '9px 14px' }}>
                          {e.serialNo
                            ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#e8f0e4', color: '#3a6d31', fontWeight: '600', letterSpacing: '0.5px' }}>{e.serialNo}</span>
                            : <span style={{ color: E.textMuted, fontSize: '11px' }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 14px', color: E.textSecond }}>{e.date}</td>
                        <td style={{ padding: '9px 14px', color: E.textSecond }}>{e.category}</td>
                        <td style={{ padding: '9px 14px', fontWeight: '600', color: E.textPrimary }}>{e.vendor}</td>
                        <td style={{ padding: '9px 14px', fontWeight: '700', color: E.coffee }}>NT${e.amount.toLocaleString()}</td>
                        <td style={{ padding: '9px 14px', color: E.textMuted }}>{e.account}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 匯款帳戶 */}
      {tab === 'bank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 控制列：篩選 + 排序 + 新增 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {/* 類型篩選 */}
            <div style={{ display: 'flex', gap: '3px', backgroundColor: '#fdfaf5', borderRadius: '10px', padding: '3px', border: `1px solid ${E.cardBorder}` }}>
              {[['all','全部'],['employee','員工'],['vendor','廠商']].map(([key, label]) => (
                <button key={key} onClick={() => setBankFilter(key)}
                  style={{ ...E.tab(bankFilter === key), padding: '5px 14px', fontSize: '12px' }}>{label}</button>
              ))}
            </div>
            {/* 排序 + 新增 */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <select value={bankSort} onChange={e => setBankSort(e.target.value)}
                style={{ border: `1px solid ${E.inputBorder}`, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', backgroundColor: E.inputBg, color: E.textSecond, cursor: 'pointer', outline: 'none' }}>
                <option value="name">依姓名排序</option>
                <option value="bank">依銀行排序</option>
              </select>
              <button onClick={() => setShowAddBank(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增帳戶</button>
            </div>
          </div>

          {/* 帳戶卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {filteredBankAccounts.length === 0
              ? <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px', gridColumn: '1/-1' }}>無符合條件的帳戶</div>
              : filteredBankAccounts.map(b => (
                <div key={b.id} style={E.card}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <CreditCard size={14} style={{ color: E.green, flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>{b.name}</span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: b.type === 'employee' ? '#e0e8f0' : '#ede0f5', color: b.type === 'employee' ? '#305080' : '#605080', fontWeight: '600' }}>
                          {b.type === 'employee' ? '員工' : '廠商'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: E.textSecond, marginTop: '6px' }}>{b.bank}</div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: E.textPrimary, marginTop: '3px', letterSpacing: '0.12em' }}>{b.account}</div>
                      {b.note && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px' }}>{b.note}</div>}
                      {b.updatedBy && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px', fontStyle: 'italic' }}>最後編輯：{b.updatedBy} · {b.updatedAt}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => setEditBank({ ...b })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080' }}><Pencil size={14} /></button>
                      <button onClick={() => deleteItem('bankAccounts', b.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* 新增代墊 Modal */}
      {showAdd && tab === 'reimburse' && (
        <Modal title="新增代墊申請" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['日期 *','date','date',''],['付款人 *','person','text','員工姓名'],['說明 *','description','text','說明用途'],['憑證編號','receiptNo','text','統編/收據號'],['金額 *','amount','number','0']].map(([label,key,type,ph]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={newR[key]} onChange={e => setNewR(p => ({ ...p, [key]: e.target.value }))} placeholder={ph}
                  readOnly={key === 'person' && !isAdmin}
                  style={{ ...E.input, ...(key === 'person' && !isAdmin ? { backgroundColor: '#f5f0e8', color: E.textSecond } : {}) }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>付款方式</label>
              <select value={newR.method} onChange={e => setNewR(p => ({ ...p, method: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {['現金','轉帳','信用卡'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={newR.project} onChange={e => setNewR(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>[{p.code || p.id}] {p.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => { if (!newR.date||!newR.person||!newR.amount) return; addItem('reimbursements',{id:Date.now(),...newR,amount:Number(newR.amount),status:'待還款',serialNo:generateSerial()}); setNewR({date:'',person:'',project:'',amount:'',description:'',method:'現金',receiptNo:''}); setShowAdd(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>送出申請</button>
        </Modal>
      )}

      {/* 新增採購 Modal */}
      {showAdd && tab === 'purchase' && (
        <Modal title="新增採購申請" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['日期 *','date','date'],['申請人 *','person','text'],['說明 *','description','text'],['金額 *','amount','number']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={newP[key]} onChange={e => setNewP(p => ({ ...p, [key]: e.target.value }))}
                  readOnly={key === 'person' && !isAdmin}
                  style={{ ...E.input, ...(key === 'person' && !isAdmin ? { backgroundColor: '#f5f0e8', color: E.textSecond } : {}) }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={newP.project} onChange={e => setNewP(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>[{p.code || p.id}] {p.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => { if (!newP.date||!newP.person||!newP.amount) return; addItem('purchaseRequests',{id:Date.now(),...newP,amount:Number(newP.amount)}); setNewP({date:'',person:'',project:'',amount:'',description:'',status:'待審核'}); setShowAdd(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>送出申請</button>
        </Modal>
      )}

      {/* 新增應付款 Modal */}
      {showAddPayable && (
        <Modal title="新增應付款項" onClose={() => setShowAddPayable(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>廠商 / 收款方 *</label>
              <input value={newPayable.vendor} onChange={e => setNewPayable(p => ({ ...p, vendor: e.target.value }))} placeholder="廠商名稱" style={E.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>金額 *</label>
                <input type="number" value={newPayable.amount} onChange={e => setNewPayable(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>應付日期</label>
                <input type="date" value={newPayable.dueDate} onChange={e => setNewPayable(p => ({ ...p, dueDate: e.target.value }))} style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>發票 / 憑證號碼</label>
              <input value={newPayable.invoiceNo} onChange={e => setNewPayable(p => ({ ...p, invoiceNo: e.target.value }))} placeholder="發票號或統編" style={E.input} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={newPayable.project} onChange={e => setNewPayable(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>[{p.id}] {p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={newPayable.note} onChange={e => setNewPayable(p => ({ ...p, note: e.target.value }))} placeholder="可選" style={E.input} />
            </div>
          </div>
          <button onClick={() => {
            if (!newPayable.vendor.trim() || !newPayable.amount) return
            addItem('payables', { id: Date.now(), ...newPayable, amount: Number(newPayable.amount), serialNo: generateSerial() })
            setNewPayable({ vendor: '', amount: '', invoiceNo: '', dueDate: '', project: '', status: '待付', note: '' })
            setShowAddPayable(false)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}

      {/* 新增帳戶 Modal */}
      {showAddBank && (
        <Modal title="新增匯款帳戶" onClose={() => setShowAddBank(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['姓名 / 公司名稱 *','name'],['銀行 / 郵局','bank'],['帳號 *','account']].map(([label,key]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input value={newBank[key]} onChange={e => setNewBank(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>類型</label>
              <select value={newBank.type} onChange={e => setNewBank(p => ({ ...p, type: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="employee">員工</option><option value="vendor">廠商</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={newBank.note} onChange={e => setNewBank(p => ({ ...p, note: e.target.value }))} placeholder="例：薪資、廠商付款" style={E.input} />
            </div>
          </div>
          <button onClick={() => { if (!newBank.name||!newBank.account) return; addItem('bankAccounts',{id:Date.now(),...newBank}); setNewBank({name:'',type:'employee',bank:'',account:'',note:''}); setShowAddBank(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}

      {/* 編輯代墊 Modal */}
      {editR && (
        <Modal title="編輯代墊申請" onClose={() => setEditR(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['日期','date','date',''],['付款人','person','text',''],['說明','description','text',''],['憑證編號','receiptNo','text',''],['金額','amount','number','']].map(([label,key,type,ph]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={editR[key] ?? ''} onChange={e => setEditR(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>付款方式</label>
              <select value={editR.method} onChange={e => setEditR(p => ({ ...p, method: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {['現金','轉帳','信用卡'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>狀態</label>
              <select value={editR.status} onChange={e => setEditR(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {['待還款','已還款'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={editR.project} onChange={e => setEditR(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>[{p.id}] {p.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => {
            const now = new Date().toISOString().slice(0,16).replace('T',' ')
            const who = currentUser?.name || currentUser?.username || '未知'
            updateItem('reimbursements', editR.id, { ...editR, amount: Number(editR.amount), updatedBy: who, updatedAt: now })
            logEdit({ user: who, action: '編輯', entityType: '代墊申請', entityName: editR.description || '代墊款', summary: `金額 NT$${Number(editR.amount).toLocaleString()}` })
            setEditR(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}

      {/* 編輯採購 Modal */}
      {editP && (
        <Modal title="編輯採購申請" onClose={() => setEditP(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['日期','date','date'],['申請人','person','text'],['說明','description','text'],['金額','amount','number']].map(([label,key,type]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input type={type} value={editP[key] ?? ''} onChange={e => setEditP(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>狀態</label>
              <select value={editP.status} onChange={e => setEditP(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {['待審核','已核准','不核准'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={editP.project} onChange={e => setEditP(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>[{p.id}] {p.name}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => {
            const now = new Date().toISOString().slice(0,16).replace('T',' ')
            const who = currentUser?.name || currentUser?.username || '未知'
            updateItem('purchaseRequests', editP.id, { ...editP, amount: Number(editP.amount), updatedBy: who, updatedAt: now })
            logEdit({ user: who, action: '編輯', entityType: '採購申請', entityName: editP.description || '採購申請', summary: `金額 NT$${Number(editP.amount).toLocaleString()}` })
            setEditP(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}

      {/* 編輯應付款 Modal */}
      {editPayable && (
        <Modal title="編輯應付款項" onClose={() => setEditPayable(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>廠商 / 收款方</label>
              <input value={editPayable.vendor ?? ''} onChange={e => setEditPayable(p => ({ ...p, vendor: e.target.value }))} style={E.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>金額</label>
                <input type="number" value={editPayable.amount ?? ''} onChange={e => setEditPayable(p => ({ ...p, amount: e.target.value }))} style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>應付日期</label>
                <input type="date" value={editPayable.dueDate ?? ''} onChange={e => setEditPayable(p => ({ ...p, dueDate: e.target.value }))} style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>發票 / 憑證號碼</label>
              <input value={editPayable.invoiceNo ?? ''} onChange={e => setEditPayable(p => ({ ...p, invoiceNo: e.target.value }))} style={E.input} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>狀態</label>
              <select value={editPayable.status} onChange={e => setEditPayable(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {['待付','已付'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={editPayable.project ?? ''} onChange={e => setEditPayable(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="">請選擇</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>[{p.id}] {p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={editPayable.note ?? ''} onChange={e => setEditPayable(p => ({ ...p, note: e.target.value }))} style={E.input} />
            </div>
          </div>
          <button onClick={() => savePayable(editPayable)}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}

      {/* 編輯帳戶 Modal */}
      {editBank && (
        <Modal title="編輯匯款帳戶" onClose={() => setEditBank(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['姓名 / 公司名稱','name'],['銀行 / 郵局','bank'],['帳號','account']].map(([label,key]) => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{label}</label>
                <input value={editBank[key] ?? ''} onChange={e => setEditBank(p => ({ ...p, [key]: e.target.value }))} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>類型</label>
              <select value={editBank.type} onChange={e => setEditBank(p => ({ ...p, type: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                <option value="employee">員工</option><option value="vendor">廠商</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={editBank.note ?? ''} onChange={e => setEditBank(p => ({ ...p, note: e.target.value }))} placeholder="例：薪資、廠商付款" style={E.input} />
            </div>
          </div>
          <button onClick={() => {
            const now = new Date().toISOString().slice(0,16).replace('T',' ')
            const who = currentUser?.name || currentUser?.username || '未知'
            updateItem('bankAccounts', editBank.id, { ...editBank, updatedBy: who, updatedAt: now })
            logEdit({ user: who, action: '編輯', entityType: '匯款帳戶', entityName: editBank.name, summary: `${editBank.bank} ${editBank.account}` })
            setEditBank(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}

      {/* 新增帳目 Modal */}
      {/* ── 薪資管理 ── */}
      {tab === 'payroll' && (() => {
        const payrolls = data.payrolls || []
        // employee sees only slips with their name
        const myName = currentUser?.name || ''

        if (viewSlip) {
          const sl = viewSlip
          const isMySlip = !isAdmin && sl.empName !== myName
          if (isMySlip) return null
          const addRow = (label, val, color) => val > 0 ? (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:`1px solid ${E.divider}`, fontSize:'13px' }}>
              <span style={{ color: E.textSecond }}>{label}</span>
              <span style={{ color: color || E.textPrimary, fontWeight:'500' }}>NT${Number(val).toLocaleString()}</span>
            </div>
          ) : null
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <button onClick={() => setViewSlip(null)} style={{ alignSelf:'flex-start', background:'none', border:'none', cursor:'pointer', color:E.textSecond, fontSize:'13px', display:'flex', alignItems:'center', gap:'4px' }}>← 返回</button>
              <div style={{ ...E.card }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
                  <div>
                    <h2 style={{ fontSize:'16px', fontWeight:'700', color:E.textPrimary, margin:'0 0 4px' }}>{sl.empName} · 薪資明細</h2>
                    <p style={{ fontSize:'13px', color:E.textMuted, margin:0 }}>{viewPayroll?.label || viewPayroll?.month}</p>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'22px', fontWeight:'800', color:E.green }}>NT${Number(sl.netPay||0).toLocaleString()}</div>
                    <div style={{ fontSize:'11px', color:E.textMuted }}>員工實領</div>
                  </div>
                </div>
                {/* 加項 */}
                <div style={{ marginBottom:'14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'700', color:E.textSecond, letterSpacing:'0.06em', marginBottom:'8px' }}>薪資加項</div>
                  {addRow('底薪', sl.baseSalary)}
                  {addRow('伙食津貼', sl.mealAllowance)}
                  {addRow('全勤獎金', sl.fullAttendanceBonus)}
                  {addRow('活動出勤', sl.activityAttendance)}
                  {addRow('加班費', sl.overtime)}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0 5px', fontSize:'13px', fontWeight:'700', borderTop:`2px solid ${E.divider}`, marginTop:'4px' }}>
                    <span>薪資總額</span><span>NT${Number(sl.grossPay||0).toLocaleString()}</span>
                  </div>
                </div>
                {/* 扣項 */}
                <div style={{ marginBottom:'14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'700', color:E.textSecond, letterSpacing:'0.06em', marginBottom:'8px' }}>員工扣項</div>
                  {addRow('健保費', sl.healthInsEmp, '#8a3a20')}
                  {addRow('勞保費', sl.laborInsEmp, '#8a3a20')}
                  {addRow('勞退自提', sl.pensionSelf, '#8a3a20')}
                  {addRow('眷屬健保', sl.dependentHealth, '#8a3a20')}
                  {addRow('匯費', sl.wireFee, '#8a3a20')}
                  {addRow('代墊扣除', sl.advance, '#8a3a20')}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0 5px', fontSize:'13px', fontWeight:'700', borderTop:`2px solid ${E.divider}`, marginTop:'4px', color:'#8a3a20' }}>
                    <span>扣項合計</span><span>－ NT${Number(sl.totalDeductions||0).toLocaleString()}</span>
                  </div>
                </div>
                {/* 實領 */}
                <div style={{ backgroundColor:'#e8f0e4', borderRadius:'10px', padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: isAdmin ? '14px' : 0 }}>
                  <span style={{ fontSize:'15px', fontWeight:'700', color:E.textPrimary }}>員工實領</span>
                  <span style={{ fontSize:'20px', fontWeight:'800', color:E.green }}>NT${Number(sl.netPay||0).toLocaleString()}</span>
                </div>
                {/* 雇主負擔（管理員才看得到）*/}
                {isAdmin && (sl.healthInsEmployer||sl.laborInsEmployer||sl.pensionEmployer) ? (
                  <div style={{ marginTop:'14px' }}>
                    <div style={{ fontSize:'11px', fontWeight:'700', color:E.textSecond, letterSpacing:'0.06em', marginBottom:'8px' }}>雇主負擔（不影響員工薪資）</div>
                    {addRow('健保費 雇主負擔', sl.healthInsEmployer)}
                    {addRow('勞保費 雇主負擔', sl.laborInsEmployer)}
                    {addRow('勞退 雇主負擔', sl.pensionEmployer)}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', fontSize:'13px', fontWeight:'700', borderTop:`2px solid ${E.divider}`, marginTop:'4px' }}>
                      <span>雇主總成本</span><span>NT${Number(sl.totalEmployerCost||0).toLocaleString()}</span>
                    </div>
                  </div>
                ) : null}
                {sl.note && <div style={{ marginTop:'12px', fontSize:'13px', color:E.textSecond, backgroundColor:E.sandLight, borderRadius:'8px', padding:'10px 12px' }}>備註：{sl.note}</div>}
                {sl.payType === 'hourly' && <div style={{ marginTop:'8px', fontSize:'12px', color:E.textMuted }}>本月出勤時數：{sl.hoursWorked} 小時</div>}
              </div>
            </div>
          )
        }

        if (viewPayroll) {
          const visibleSlips = isAdmin ? viewPayroll.slips : viewPayroll.slips.filter(s => s.empName === myName)
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <button onClick={() => setViewPayroll(null)} style={{ background:'none', border:'none', cursor:'pointer', color:E.textSecond, fontSize:'13px', display:'flex', alignItems:'center', gap:'4px' }}>← 返回</button>
                <span style={{ fontSize:'13px', color:E.textMuted }}>產生時間：{viewPayroll.generatedAt}</span>
              </div>
              <div style={{ ...E.card }}>
                <h2 style={{ fontSize:'15px', fontWeight:'700', color:E.textPrimary, margin:'0 0 16px' }}>{viewPayroll.label} 薪資明細</h2>
                {visibleSlips.length === 0
                  ? <div style={{ textAlign:'center', color:E.textMuted, fontSize:'13px', padding:'24px' }}>無薪資資料</div>
                  : visibleSlips.map((sl, i) => (
                    <div key={sl.empId} onClick={() => setViewSlip(sl)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom: i < visibleSlips.length-1 ? `1px solid ${E.divider}` : 'none', cursor:'pointer' }}>
                      <div>
                        <div style={{ fontSize:'14px', fontWeight:'600', color:E.textPrimary }}>{sl.empName}</div>
                        <div style={{ fontSize:'12px', color:E.textMuted, marginTop:'2px' }}>
                          {sl.payType === 'hourly' ? `${sl.hoursWorked}h × 時薪` : '月薪制'}
                          {sl.grossPay ? ` · 總額 NT$${Number(sl.grossPay).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'16px', fontWeight:'700', color:E.green }}>NT${Number(sl.netPay||0).toLocaleString()}</div>
                        <div style={{ fontSize:'11px', color:E.textMuted }}>實領</div>
                      </div>
                    </div>
                  ))
                }
                {isAdmin && (
                  <div style={{ marginTop:'16px', paddingTop:'12px', borderTop:`2px solid ${E.divider}`, display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'13px', color:E.textSecond }}>本月薪資合計</span>
                    <span style={{ fontSize:'15px', fontWeight:'700', color:E.textPrimary }}>NT${viewPayroll.slips.reduce((s,sl)=>s+Number(sl.netPay||0),0).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )
        }

        // 薪資管理主頁
        const [py, pm] = payrollMonth.split('-').map(Number)
        const govtHrs = GOVT_WORK_DAYS[payrollMonth]?.hours || 0
        const monthNav = (
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={() => setPayrollMonth(p => { const [y,m] = p.split('-').map(Number); return m===1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}` })}
              style={{ background:'none', border:'none', cursor:'pointer', color:E.textSecond, fontSize:'18px', padding:'0 4px' }}>◀</button>
            <span style={{ fontWeight:'700', fontSize:'15px', color:E.textPrimary }}>{py} 年 {MONTHS[pm-1]} 月</span>
            <button onClick={() => setPayrollMonth(p => { const [y,m] = p.split('-').map(Number); return m===12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}` })}
              style={{ background:'none', border:'none', cursor:'pointer', color:E.textSecond, fontSize:'18px', padding:'0 4px' }}>▶</button>
          </div>
        )

        // ── 員工視角 ──
        if (!isAdmin) {
          const myEmp = data.employees.find(e => e.name === myName || myName?.includes(e.name) || e.name?.includes(myName))
          if (!myEmp) return (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {monthNav}
              <div style={{ ...E.card, textAlign:'center', color:E.textMuted, padding:'40px', fontSize:'13px' }}>無法找到您的員工資料</div>
            </div>
          )
          const setting = data.salarySettings?.find(s => s.empId === myEmp.id) || {}
          const clockHrs = computeEmpMonthClockHours(myEmp, py, pm, data)
          const earnedThisMonth = Math.max(0, clockHrs - govtHrs)
          const allEarned = computeAllTimeEarned(myEmp.id, data)
          const allUsed = (data.compLeaveRecords || []).filter(r => r.empId === myEmp.id).reduce((sum, r) => sum + Number(r.hours), 0)
          const balance = Math.max(0, allEarned - allUsed)
          const payType = setting.payType || 'monthly'
          const schHrs = monthHoursFor(myEmp.id)
          const base = Number(setting.baseSalary || setting.hourlyRate || 0)
          const computedBase = payType === 'monthly' ? base : Math.round(schHrs * base)
          const meal = Number(setting.mealAllowance || 0)
          const fAB = Number(setting.fullAttendanceBonus || 0)
          const act = Number(setting.activityAttendance || 0)
          const gross = computedBase + meal + fAB + act
          const deduct = Number(setting.healthInsEmp||0)+Number(setting.laborInsEmp||0)+Number(setting.pensionSelf||0)+Number(setting.dependentHealth||0)+Number(setting.supplementalIns||0)+Number(setting.wireFee||0)
          const net = gross - deduct
          const isExpanded = salaryExpandedEmp === myEmp.id
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {monthNav}
              {/* 薪資卡片 */}
              <div style={{ ...E.card }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                  onClick={() => setSalaryExpandedEmp(isExpanded ? null : myEmp.id)}>
                  <div>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:E.textPrimary }}>{myEmp.name}</div>
                    <div style={{ fontSize:'12px', color:E.textMuted }}>{py}年{MONTHS[pm-1]}月薪資</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    {gross > 0 ? (
                      <>
                        <div style={{ fontSize:'22px', fontWeight:'800', color:E.green }}>NT${net.toLocaleString()}</div>
                        <div style={{ fontSize:'11px', color:E.textMuted }}>實領金額</div>
                      </>
                    ) : <div style={{ fontSize:'13px', color:E.textMuted }}>待設定</div>}
                  </div>
                  <span style={{ fontSize:'16px', color:E.textMuted, marginLeft:'8px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div style={{ marginTop:'16px', borderTop:`1px solid ${E.divider}`, paddingTop:'16px', display:'flex', flexDirection:'column', gap:'14px' }}>
                    <div>
                      <div style={{ fontSize:'11px', fontWeight:'700', color:E.textSecond, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>工時</div>
                      <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(2, 1fr)', gap:'8px' }}>
                        {[['應上時數', govtHrs > 0 ? `${govtHrs}h` : '—'],['打卡時數',`${clockHrs}h`],['本月轉補休',`+${earnedThisMonth}h`],['補休餘額',`${balance}h`]].map(([label, value]) => (
                          <div key={label} style={{ backgroundColor:E.sandLight, borderRadius:'8px', padding:'10px 12px' }}>
                            <div style={{ fontSize:'11px', color:E.textMuted }}>{label}</div>
                            <div style={{ fontSize:'16px', fontWeight:'700', color: label==='補休餘額' ? E.green : E.textPrimary }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {gross > 0 && (
                      <div>
                        <div style={{ fontSize:'11px', fontWeight:'700', color:E.textSecond, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>薪資明細</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:'4px', fontSize:'13px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between' }}>
                            <span style={{ color:E.textSecond }}>{payType==='monthly' ? '底薪' : `時薪 ${base} × ${schHrs}h`}</span>
                            <span>NT${computedBase.toLocaleString()}</span>
                          </div>
                          {meal>0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:E.textSecond }}>伙食津貼</span><span>NT${meal.toLocaleString()}</span></div>}
                          {fAB>0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:E.textSecond }}>全勤獎金</span><span>NT${fAB.toLocaleString()}</span></div>}
                          {act>0 && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ color:E.textSecond }}>活動出勤</span><span>NT${act.toLocaleString()}</span></div>}
                          <div style={{ display:'flex', justifyContent:'space-between', borderTop:`1px solid ${E.divider}`, paddingTop:'4px', fontWeight:'600' }}>
                            <span>薪資總額</span><span>NT${gross.toLocaleString()}</span>
                          </div>
                          {[['healthInsEmp','健保費'],['laborInsEmp','勞保費'],['pensionSelf','勞退自提'],['dependentHealth','眷屬健保'],['supplementalIns','補充保費'],['wireFee','匯費']].map(([key, label]) =>
                            Number(setting[key]||0) > 0 ? (
                              <div key={key} style={{ display:'flex', justifyContent:'space-between' }}>
                                <span style={{ color:'#8a3a20' }}>— {label}</span>
                                <span style={{ color:'#8a3a20' }}>NT${Number(setting[key]).toLocaleString()}</span>
                              </div>
                            ) : null
                          )}
                          <div style={{ display:'flex', justifyContent:'space-between', borderTop:`1px solid ${E.divider}`, paddingTop:'6px', fontWeight:'800', fontSize:'15px' }}>
                            <span style={{ color:E.textPrimary }}>實領金額</span>
                            <span style={{ color:E.green }}>NT${net.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* 補休餘額 */}
              <div style={{ ...E.card, backgroundColor:'#f5f0e8', border:'none' }}>
                <div style={{ fontSize:'13px', fontWeight:'600', color:E.textPrimary, marginBottom:'10px' }}>補休餘額</div>
                <div style={{ display:'flex', gap:'24px', flexWrap:'wrap' }}>
                  {[['累計轉補休',`${allEarned}h`,E.textPrimary],['已使用',`${allUsed}h`,'#8a3a20'],['剩餘',`${balance}h`,E.green]].map(([label, value, color]) => (
                    <div key={label}>
                      <div style={{ fontSize:'11px', color:E.textMuted }}>{label}</div>
                      <div style={{ fontSize:'20px', fontWeight:'800', color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* 薪資單記錄 */}
              {payrolls.filter(pr=>pr.slips.some(s=>s.empName===myName)).length > 0 && (
                <div style={{ ...E.card, padding:0 }}>
                  <div style={{ padding:'14px 20px 8px', fontSize:'13px', fontWeight:'700', color:E.textSecond, borderBottom:`1px solid ${E.divider}` }}>薪資單記錄</div>
                  {[...payrolls].sort((a,b)=>b.month.localeCompare(a.month)).map((pr, i) => {
                    const visSlips = pr.slips.filter(s => s.empName === myName)
                    if (visSlips.length === 0) return null
                    return (
                      <div key={pr.id} onClick={() => { setViewPayroll(pr); setViewSlip(null) }}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:`1px solid ${E.divider}`, cursor:'pointer' }}>
                        <div>
                          <div style={{ fontSize:'14px', fontWeight:'600', color:E.textPrimary }}>{pr.label}</div>
                          <div style={{ fontSize:'12px', color:E.textMuted, marginTop:'2px' }}>產生：{pr.generatedAt}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:'15px', fontWeight:'700', color:E.green }}>NT${Number(visSlips[0]?.netPay||0).toLocaleString()}</div>
                          <div style={{ fontSize:'11px', color:E.textMuted }}>實領</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        }

        // ── 管理員視角 ──
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {/* 月份 + 一鍵產生薪資 */}
            <div style={{ display:'flex', gap:'8px', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)}
                  style={{ ...E.input, width:'150px', padding:'7px 10px', fontSize:'13px' }} />
                <span style={{ fontSize:'13px', color:E.textMuted }}>{monthLabel(payrollMonth)}</span>
              </div>
              <button onClick={() => { setGenSlips(buildDraftSlips(payrollMonth)); setShowGenPayroll(true) }}
                style={{ ...E.btnPrimary, display:'flex', alignItems:'center', gap:'6px', whiteSpace:'nowrap' }}>
                <Plus size={15} />一鍵產生薪資
              </button>
            </div>

            {/* 薪資設定 */}
            <div style={{ ...E.card }}>
              <div style={{ marginBottom:'16px' }}>
                <h3 style={{ fontSize:'14px', fontWeight:'700', color:E.textPrimary, margin:'0 0 4px' }}>薪資設定</h3>
                <p style={{ fontSize:'12px', color:E.textMuted, margin:0 }}>{py}年{MONTHS[pm-1]}月 · 設定薪制、底薪與保費，確認後一鍵產生薪資單</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'0' }}>
                {data.employees.map((emp, i) => {
                  const setting = data.salarySettings?.find(s => s.empId === emp.id) || {}
                  const payType = setting.payType || 'monthly'
                  const baseSalary = Number(setting.baseSalary || setting.hourlyRate || 0)
                  const mealAllowance = Number(setting.mealAllowance || 0)
                  const fullAttendanceBonus = Number(setting.fullAttendanceBonus || 0)
                  const activityAttendance = Number(setting.activityAttendance || 0)
                  const clockHrs = computeEmpMonthClockHours(emp, py, pm, data)
                  const computedBase = payType === 'monthly' ? baseSalary : Math.round(clockHrs * baseSalary)
                  const estimatedGross = computedBase + mealAllowance + fullAttendanceBonus + activityAttendance
                  const totalDeductions = Number(setting.healthInsEmp||0)+Number(setting.laborInsEmp||0)+Number(setting.pensionSelf||0)+Number(setting.dependentHealth||0)+Number(setting.supplementalIns||0)+Number(setting.wireFee||0)
                  const netPay = estimatedGross - totalDeductions
                  return (
                    <div key={emp.id} style={{ padding:'14px 0', borderBottom: i < data.employees.length-1 ? `1px solid ${E.divider}` : 'none' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                        <div style={{ width:'76px', fontWeight:'700', fontSize:'13px', color:E.textPrimary, flexShrink:0 }}>{emp.name}</div>
                        <select value={payType} onChange={e => updateSalarySettingFor(emp, { payType: e.target.value })}
                          style={{ ...E.input, width:'72px', padding:'6px 8px', fontSize:'12px', flexShrink:0 }}>
                          <option value="monthly">月薪</option>
                          <option value="hourly">時薪</option>
                        </select>
                        <div style={{ display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }}>
                          {payType === 'monthly' ? (
                            <div style={{ ...E.input, width:'90px', padding:'6px 10px', fontSize:'13px', fontWeight:'700', color:E.textPrimary, background:'#f7f4ee', cursor:'default', userSelect:'none' }}>
                              {estimatedGross > 0 ? estimatedGross.toLocaleString() : '--'}
                            </div>
                          ) : (
                            <input type="number" value={baseSalary || ''} placeholder="0"
                              onChange={e => updateSalarySettingFor(emp, { baseSalary: Number(e.target.value), hourlyRate: Number(e.target.value) })}
                              style={{ ...E.input, width:'90px', padding:'6px 10px', fontSize:'13px' }} />
                          )}
                          <span style={{ fontSize:'11px', color:E.textSecond, whiteSpace:'nowrap' }}>
                            {payType === 'monthly' ? '元/月' : `元/時 ×${clockHrs}h`}
                          </span>
                        </div>
                        <div style={{ marginLeft:'auto', textAlign:'right', flexShrink:0 }}>
                          {netPay > 0 || estimatedGross > 0 ? (
                            <>
                              <div style={{ fontSize:'13px', fontWeight:'700', color:E.textPrimary }}>實領 NT${netPay.toLocaleString()}</div>
                              {totalDeductions > 0 && <div style={{ fontSize:'11px', color:E.textMuted }}>扣 {totalDeductions.toLocaleString()}</div>}
                            </>
                          ) : <div style={{ fontSize:'13px', color:E.textMuted }}>--</div>}
                        </div>
                        <button onClick={() => setSalaryEditEmp({ ...emp, setting })}
                          style={{ fontSize:'11px', padding:'5px 12px', border:`1px solid ${E.divider}`, borderRadius:'8px', background:'none', cursor:'pointer', color:E.textSecond, flexShrink:0, whiteSpace:'nowrap' }}>薪資細項</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop:'16px', paddingTop:'16px', borderTop:`1px solid ${E.divider}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'12px', color:E.textSecond }}>本月薪資合計（估算）</span>
                <span style={{ fontSize:'15px', fontWeight:'700', color:E.textPrimary }}>
                  NT${data.employees.reduce((sum, emp) => {
                    const s = data.salarySettings?.find(x => x.empId === emp.id) || {}
                    const type = s.payType || 'monthly'
                    const base = Number(s.baseSalary || s.hourlyRate || 0)
                    const cHrs = computeEmpMonthClockHours(emp, py, pm, data)
                    const cBase = type === 'monthly' ? base : Math.round(cHrs * base)
                    return sum + cBase + Number(s.mealAllowance||0) + Number(s.fullAttendanceBonus||0) + Number(s.activityAttendance||0)
                  }, 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* 補休管理 */}
            <div style={{ ...E.card }}>
              <h3 style={{ fontSize:'14px', fontWeight:'700', color:E.textPrimary, margin:'0 0 4px' }}>補休管理</h3>
              <p style={{ fontSize:'12px', color:E.textMuted, margin:'0 0 16px' }}>本月轉補休 = 打卡時數 − 應上時數（{govtHrs > 0 ? `${govtHrs}h` : '本月無政府行事曆資料'}）</p>
              {data.employees.map((emp, i) => {
                const clockHrs = computeEmpMonthClockHours(emp, py, pm, data)
                const earnedThisMonth = Math.max(0, clockHrs - govtHrs)
                const allEarned = computeAllTimeEarned(emp.id, data)
                const usageRecs = (data.compLeaveRecords || []).filter(r => r.empId === emp.id).sort((a, b) => b.date.localeCompare(a.date))
                const allUsed = usageRecs.reduce((sum, r) => sum + Number(r.hours), 0)
                const balance = Math.max(0, allEarned - allUsed)
                const isAddingForThisEmp = compLeaveForm.empId === emp.id
                return (
                  <div key={emp.id} style={{ padding:'14px 0', borderBottom: i < data.employees.length-1 ? `1px solid ${E.divider}` : 'none' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px', flexWrap:'wrap', gap:'8px' }}>
                      <span style={{ fontWeight:'700', fontSize:'14px', color:E.textPrimary }}>{emp.name}</span>
                      <div style={{ display:'flex', gap:'16px', fontSize:'12px', flexWrap:'wrap' }}>
                        <span style={{ color:E.textMuted }}>打卡 <strong style={{ color:E.textPrimary }}>{clockHrs}h</strong></span>
                        <span style={{ color:E.textMuted }}>本月轉補休 <strong style={{ color:E.textPrimary }}>+{earnedThisMonth}h</strong></span>
                        <span style={{ color:E.textMuted }}>累計已用 <strong style={{ color:'#8a3a20' }}>{allUsed}h</strong></span>
                        <span style={{ color:E.textMuted }}>餘額 <strong style={{ color:E.green, fontSize:'14px' }}>{balance}h</strong></span>
                      </div>
                    </div>
                    {usageRecs.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'8px' }}>
                        {usageRecs.map(r => (
                          <div key={r.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 10px', backgroundColor:'#f5f0f8', borderRadius:'8px', fontSize:'12px' }}>
                            <span style={{ color:E.textMuted, minWidth:'80px' }}>{r.date}</span>
                            <span style={{ color:'#6a3a80', fontWeight:'600' }}>－{r.hours}h</span>
                            <span style={{ color:E.textSecond, flex:1 }}>{r.note || '—'}</span>
                            <button onClick={() => deleteItem('compLeaveRecords', r.id)}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'#d0b8a8', padding:'2px' }}><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    {isAddingForThisEmp ? (
                      <div style={{ display:'flex', gap:'6px', alignItems:'center', flexWrap:'wrap' }}>
                        <input type="date" value={compLeaveForm.date} onChange={e => setCompLeaveForm(p => ({...p, date: e.target.value}))}
                          style={{ ...E.input, width:'130px', fontSize:'12px', padding:'5px 8px' }} />
                        <input type="number" value={compLeaveForm.hours} min="0.5" max="8" step="0.5"
                          onChange={e => setCompLeaveForm(p => ({...p, hours: Number(e.target.value)}))}
                          style={{ ...E.input, width:'64px', fontSize:'12px', padding:'5px 8px' }} />
                        <span style={{ fontSize:'11px', color:E.textMuted }}>小時</span>
                        <input type="text" placeholder="備注" value={compLeaveForm.note}
                          onChange={e => setCompLeaveForm(p => ({...p, note: e.target.value}))}
                          style={{ ...E.input, flex:1, minWidth:'80px', fontSize:'12px', padding:'5px 8px' }} />
                        <button onClick={() => {
                          if (!compLeaveForm.date || !compLeaveForm.hours) return
                          addItem('compLeaveRecords', { id: Date.now(), empId: emp.id, date: compLeaveForm.date, hours: compLeaveForm.hours, note: compLeaveForm.note })
                          setCompLeaveForm({ empId: null, date: '', hours: 4, note: '' })
                        }} style={{ ...E.btnPrimary, fontSize:'12px', padding:'5px 12px', whiteSpace:'nowrap' }}>新增</button>
                        <button onClick={() => setCompLeaveForm({ empId: null, date: '', hours: 4, note: '' })}
                          style={{ ...E.btnGhost, fontSize:'12px', padding:'5px 10px' }}>取消</button>
                      </div>
                    ) : (
                      <button onClick={() => setCompLeaveForm({ empId: emp.id, date: `${py}-${String(pm).padStart(2,'0')}-01`, hours: 4, note: '' })}
                        style={{ fontSize:'11px', padding:'4px 10px', border:`1px solid ${E.divider}`, borderRadius:'6px', background:'none', cursor:'pointer', color:E.textSecond }}>
                        ＋ 新增補休使用記錄
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 薪資記錄 */}
            <div style={{ ...E.card }}>
              <h3 style={{ fontSize:'14px', fontWeight:'700', color:E.textPrimary, margin:'0 0 12px' }}>薪資單記錄</h3>
              {payrolls.length === 0 ? (
                <div style={{ textAlign:'center', color:E.textMuted, fontSize:'13px', padding:'20px 0' }}>
                  尚未產生任何薪資記錄，設定完成後點「一鍵產生薪資」
                </div>
              ) : (
                <div style={{ margin:'0 -20px -20px' }}>
                  {[...payrolls].sort((a,b)=>b.month.localeCompare(a.month)).map((pr, i) => (
                    <div key={pr.id} onClick={() => { setViewPayroll(pr); setViewSlip(null) }}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderTop:`1px solid ${E.divider}`, cursor:'pointer' }}>
                      <div>
                        <div style={{ fontSize:'14px', fontWeight:'600', color:E.textPrimary }}>{pr.label}</div>
                        <div style={{ fontSize:'12px', color:E.textMuted, marginTop:'2px' }}>產生：{pr.generatedAt} · {pr.slips.length}位員工</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'15px', fontWeight:'700', color:E.green }}>NT${pr.slips.reduce((s,sl)=>s+Number(sl.netPay||0),0).toLocaleString()}</div>
                        <div style={{ fontSize:'11px', color:E.textMuted }}>合計</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Modal：產生薪資 */}
      {showGenPayroll && (
        <Modal title={`產生 ${monthLabel(payrollMonth)} 薪資`} onClose={() => setShowGenPayroll(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            <p style={{ fontSize:'12px', color:E.textSecond, margin:'0 0 4px' }}>確認各員工薪資明細，可調整加班費、全勤獎金等，確認後儲存。</p>
            {genSlips.map((sl, i) => (
              <div key={sl.empId} style={{ ...E.card, padding:'14px', backgroundColor: i%2===0 ? '#fdfaf5' : '#faf7f2' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                  <span style={{ fontSize:'14px', fontWeight:'700', color:E.textPrimary }}>{sl.empName}</span>
                  <span style={{ fontSize:'13px', color:E.textMuted }}>{sl.payType === 'hourly' ? `${sl.hoursWorked}h 時薪制` : '月薪制'}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap:'8px' }}>
                  {[
                    ['底薪', 'baseSalary', true],
                    ['伙食津貼', 'mealAllowance', false],
                    ['全勤獎金', 'fullAttendanceBonus', false],
                    ['活動出勤', 'activityAttendance', false],
                    ['加班費', 'overtime', false],
                    ['代墊扣除', 'advance', false],
                  ].map(([label, key, readOnly]) => (
                    <div key={key}>
                      <label style={{ fontSize:'11px', color:E.textSecond, display:'block', marginBottom:'3px' }}>{label}</label>
                      <input
                        type="number" value={sl[key] || 0} readOnly={readOnly}
                        onChange={e => {
                          const updated = genSlips.map((s,j) => j===i ? recalcSlip({...s,[key]:Number(e.target.value)}) : s)
                          setGenSlips(updated)
                        }}
                        style={{ ...E.input, padding:'6px 8px', fontSize:'13px', backgroundColor: readOnly ? E.sandLight : 'white', color: readOnly ? E.textMuted : E.textPrimary }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ fontSize:'11px', color:E.textSecond, display:'block', marginBottom:'3px' }}>備註</label>
                    <input type="text" value={sl.note || ''} placeholder="備註"
                      onChange={e => { const updated = genSlips.map((s,j) => j===i ? {...s,note:e.target.value} : s); setGenSlips(updated) }}
                      style={{ ...E.input, padding:'6px 8px', fontSize:'13px' }} />
                  </div>
                </div>
                <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:`1px solid ${E.divider}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:E.textSecond }}>員工實領</span>
                  <span style={{ fontSize:'16px', fontWeight:'800', color:E.green }}>NT${Number(sl.netPay||0).toLocaleString()}</span>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderTop:`2px solid ${E.divider}` }}>
              <span style={{ fontSize:'13px', fontWeight:'700', color:E.textPrimary }}>合計實領</span>
              <span style={{ fontSize:'16px', fontWeight:'800', color:E.green }}>NT${genSlips.reduce((s,sl)=>s+Number(sl.netPay||0),0).toLocaleString()}</span>
            </div>
            <button
              onClick={() => {
                const who = currentUser?.name || currentUser?.username || '管理員'
                const now2 = new Date()
                const genAt = `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,'0')}-${String(now2.getDate()).padStart(2,'0')} ${String(now2.getHours()).padStart(2,'0')}:${String(now2.getMinutes()).padStart(2,'0')}`
                const id = `payroll_${payrollMonth.replace('-','_')}_${Date.now()}`
                const record = { id, month: payrollMonth, label: monthLabel(payrollMonth), generatedAt: genAt, generatedBy: who, slips: genSlips }
                addItem('payrolls', record)
                logEdit({ user: who, action: '新增', entityType: '薪資', entityName: monthLabel(payrollMonth), summary: `${genSlips.length}位員工，合計NT$${genSlips.reduce((s,sl)=>s+Number(sl.netPay||0),0).toLocaleString()}` })
                setShowGenPayroll(false)
                setViewPayroll(record)
              }}
              style={{ ...E.btnPrimary, width:'100%', padding:'12px 0', fontSize:'14px', fontWeight:'700' }}>確認產生薪資</button>
          </div>
        </Modal>
      )}

      {viewExp && (
        <Modal title="帳目明細" onClose={() => setViewExp(null)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {[
              ['日期',     viewExp.date],
              ['收支',     viewExp.direction || '支出'],
              ['廠商／受款人', viewExp.vendor],
              ['金額',     `NT$${Number(viewExp.amount).toLocaleString()}`],
              ['付款方式', viewExp.method],
              ['案件',     viewExp.project],
              ['類別',     viewExp.category],
              ['會計科目', viewExp.account],
              ['憑證號碼', viewExp.receiptNo],
              ['備註',     viewExp.note],
            ].map(([label, val]) => val ? (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${E.divider}`, gap: '16px' }}>
                <span style={{ fontSize: '12px', color: E.textSecond, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: '13px', color: E.textPrimary, fontWeight: label === '金額' ? '700' : '400', textAlign: 'right' }}>{val}</span>
              </div>
            ) : null)}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => { setEditExp({ ...viewExp }); setViewExp(null) }}
              style={{ ...E.btnGhost, flex: 1, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Pencil size={14} />編輯
            </button>
            <button onClick={() => {
              if (window.confirm(`確定刪除「${viewExp.vendor}」這筆帳目？`)) {
                deleteItem('expenses', viewExp.id)
                setViewExp(null)
              }
            }} style={{ flex: 1, padding: '10px 0', border: `1px solid #e8d8d0`, borderRadius: '10px', background: 'none', cursor: 'pointer', color: '#8a3a20', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Trash2 size={14} />刪除
            </button>
            <button onClick={() => setViewExp(null)}
              style={{ ...E.btnPrimary, flex: 1, padding: '10px 0' }}>關閉</button>
          </div>
        </Modal>
      )}

      {showAddExp && (
        <Modal title="新增帳目" onClose={() => { setShowAddExp(false); setNewExp(EMPTY_EXP) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>交易日期 *</label>
                <input type="date" value={newExp.date} onChange={e => setNewExp(p => ({ ...p, date: e.target.value }))} style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>收支方向</label>
                <select value={newExp.direction} onChange={e => setNewExp(p => ({ ...p, direction: e.target.value }))} style={E.input}>
                  <option>支出</option>
                  <option>收入</option>
                  <option>稅抵用</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>廠商／受款人 *</label>
              <input value={newExp.vendor} onChange={e => setNewExp(p => ({ ...p, vendor: e.target.value }))} placeholder="廠商或受款人名稱" style={E.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>金額 *</label>
                <input type="number" value={newExp.amount} onChange={e => setNewExp(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>付款方式</label>
                <select value={newExp.method} onChange={e => setNewExp(p => ({ ...p, method: e.target.value }))} style={E.input}>
                  {['現金','轉帳','信用卡','支票'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>案件</label>
              <select value={newExp.project} onChange={e => setNewExp(p => ({ ...p, project: e.target.value }))} style={E.input}>
                <option value="">— 請選擇 —</option>
                {data.projects.map(pr => <option key={pr.id} value={pr.id}>{pr.id}｜{pr.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>專案支出類別</label>
                <input value={newExp.category} onChange={e => setNewExp(p => ({ ...p, category: e.target.value }))} placeholder="如：印刷、活動執行、餐費…" style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>會計科目</label>
                <input value={newExp.account} onChange={e => setNewExp(p => ({ ...p, account: e.target.value }))} placeholder="如：業務推廣費、雜項支出…" style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>憑證編號</label>
              <input value={newExp.receiptNo} onChange={e => setNewExp(p => ({ ...p, receiptNo: e.target.value }))} placeholder="發票號碼或收據編號" style={E.input} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯代墊 / 採購（選填）</label>
              <select value={newExp.linkedSerial} onChange={e => setNewExp(p => ({ ...p, linkedSerial: e.target.value }))} style={E.input}>
                <option value="">— 自動產生新流水號 —</option>
                {[...data.reimbursements, ...(data.purchaseRequests || [])]
                  .filter(r => r.serialNo)
                  .map(r => (
                    <option key={r.serialNo} value={r.serialNo}>
                      {r.serialNo}｜{r.description || r.vendor || r.person}｜NT${Number(r.amount).toLocaleString()}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={newExp.note} onChange={e => setNewExp(p => ({ ...p, note: e.target.value }))} placeholder="備註說明" style={E.input} />
            </div>
            <button
              onClick={() => {
                if (!newExp.date || !newExp.vendor || !newExp.amount) return
                const who = currentUser?.name || currentUser?.username || '未知'
                const maxId = (data.expenses || []).filter(e => e.id?.startsWith('slm')).length + 1
                const id = `slm26-${String(maxId).padStart(3, '0')}`
                const serialNo = newExp.linkedSerial || generateSerial()
                addItem('expenses', { id, ...newExp, amount: Number(newExp.amount), serialNo })
                logEdit({ user: who, action: '新增', entityType: '帳目', entityName: newExp.vendor, summary: `${newExp.project} NT$${Number(newExp.amount).toLocaleString()}` })
                setNewExp(EMPTY_EXP)
                setShowAddExp(false)
              }}
              disabled={!newExp.date || !newExp.vendor || !newExp.amount}
              style={{ ...E.btnPrimary, marginTop: '4px', width: '100%', padding: '11px 0', opacity: (!newExp.date || !newExp.vendor || !newExp.amount) ? 0.5 : 1 }}
            >確認新增</button>
          </div>
        </Modal>
      )}

      {/* Modal：編輯帳目 */}
      {editExp && (
        <Modal title="編輯帳目" onClose={() => setEditExp(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>交易日期 *</label>
                <input type="date" value={editExp.date} onChange={e => setEditExp(p => ({ ...p, date: e.target.value }))} style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>收支方向</label>
                <select value={editExp.direction || '支出'} onChange={e => setEditExp(p => ({ ...p, direction: e.target.value }))} style={E.input}>
                  <option>支出</option>
                  <option>收入</option>
                  <option>稅抵用</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>廠商／受款人 *</label>
              <input value={editExp.vendor} onChange={e => setEditExp(p => ({ ...p, vendor: e.target.value }))} placeholder="廠商或受款人名稱" style={E.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>金額 *</label>
                <input type="number" value={editExp.amount} onChange={e => setEditExp(p => ({ ...p, amount: e.target.value }))} placeholder="0" style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>付款方式</label>
                <select value={editExp.method || '現金'} onChange={e => setEditExp(p => ({ ...p, method: e.target.value }))} style={E.input}>
                  {['現金','轉帳','信用卡','支票'].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>案件</label>
              <select value={editExp.project || ''} onChange={e => setEditExp(p => ({ ...p, project: e.target.value }))} style={E.input}>
                <option value="">— 請選擇 —</option>
                {data.projects.map(pr => <option key={pr.id} value={pr.id}>{pr.id}｜{pr.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>專案支出類別</label>
                <input value={editExp.category || ''} onChange={e => setEditExp(p => ({ ...p, category: e.target.value }))} placeholder="如：印刷、活動執行、餐費…" style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>會計科目</label>
                <input value={editExp.account || ''} onChange={e => setEditExp(p => ({ ...p, account: e.target.value }))} placeholder="如：業務推廣費、雜項支出…" style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>憑證編號</label>
              <input value={editExp.receiptNo || ''} onChange={e => setEditExp(p => ({ ...p, receiptNo: e.target.value }))} placeholder="發票號碼或收據編號" style={E.input} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={editExp.note || ''} onChange={e => setEditExp(p => ({ ...p, note: e.target.value }))} placeholder="備註說明" style={E.input} />
            </div>
            <button
              onClick={() => {
                if (!editExp.date || !editExp.vendor || !editExp.amount) return
                const who = currentUser?.name || currentUser?.username || '未知'
                updateItem('expenses', editExp.id, { ...editExp, amount: Number(editExp.amount) })
                logEdit({ user: who, action: '編輯', entityType: '帳目', entityName: editExp.vendor, summary: `${editExp.project} NT$${Number(editExp.amount).toLocaleString()}` })
                setEditExp(null)
              }}
              disabled={!editExp.date || !editExp.vendor || !editExp.amount}
              style={{ ...E.btnPrimary, marginTop: '4px', width: '100%', padding: '11px 0', opacity: (!editExp.date || !editExp.vendor || !editExp.amount) ? 0.5 : 1 }}
            >儲存變更</button>
          </div>
        </Modal>
      )}

      {/* Modal：薪資細項設定 */}
      {salaryEditEmp && (() => {
        const s = salaryEditEmp.setting || {}
        function saveField(key, val) {
          const existing = (data.salarySettings || []).find(x => x.empId === salaryEditEmp.id)
          const updates = { [key]: Number(val) || 0 }
          if (key === 'baseSalary') updates.hourlyRate = updates.baseSalary
          if (key === 'hourlyRate') updates.baseSalary = updates.hourlyRate
          if (existing) {
            updateItem('salarySettings', existing.id, updates)
          } else {
            addItem('salarySettings', { id: Date.now() + salaryEditEmp.id, empId: salaryEditEmp.id, payType: 'monthly', baseSalary: 0, mealAllowance: 0, fullAttendanceBonus: 0, activityAttendance: 0, healthInsEmp: 0, laborInsEmp: 0, pensionSelf: 0, dependentHealth: 0, supplementalIns: 0, wireFee: 0, healthInsEmployer: 0, laborInsEmployer: 0, pensionEmployer: 0, ...updates })
          }
        }
        const fields = [
          { section: '加項', items: [['mealAllowance','伙食津貼'],['fullAttendanceBonus','全勤獎金'],['activityAttendance','活動出勤']] },
          { section: '員工扣項', items: [['healthInsEmp','健保費'],['laborInsEmp','勞保費'],['pensionSelf','勞退自提'],['dependentHealth','眷屬健保'],['supplementalIns','補充保費'],['wireFee','匯費（轉帳手續費）']] },
          { section: '雇主負擔（不從薪資扣，用於成本計算）', items: [['healthInsEmployer','健保費 雇主負擔'],['laborInsEmployer','勞保費 雇主負擔'],['pensionEmployer','勞退 雇主負擔']] },
        ]
        const liveSetting = data.salarySettings?.find(x => x.empId === salaryEditEmp.id) || {}
        return (
          <Modal title={`${salaryEditEmp.name} — 薪資細項設定`} onClose={() => setSalaryEditEmp(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: E.textSecond, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid ${E.divider}` }}>基本薪資</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <label style={{ fontSize: '13px', color: E.textPrimary, flex: 1 }}>{liveSetting.payType === 'hourly' ? '時薪' : '底薪'}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="number"
                      defaultValue={liveSetting.baseSalary || liveSetting.hourlyRate || 0}
                      onBlur={e => saveField(liveSetting.payType === 'hourly' ? 'hourlyRate' : 'baseSalary', e.target.value)}
                      onChange={e => saveField(liveSetting.payType === 'hourly' ? 'hourlyRate' : 'baseSalary', e.target.value)}
                      style={{ ...E.input, width: '100px', padding: '6px 10px', fontSize: '13px', textAlign: 'right' }} />
                    <span style={{ fontSize: '12px', color: E.textSecond, width: '18px' }}>元</span>
                  </div>
                </div>
              </div>
              {fields.map(({ section, items }) => (
                <div key={section}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: E.textSecond, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', paddingBottom: '6px', borderBottom: `1px solid ${E.divider}` }}>{section}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map(([key, label]) => (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                        <label style={{ fontSize: '13px', color: E.textPrimary, flex: 1 }}>{label}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input type="number"
                            defaultValue={liveSetting[key] || 0}
                            onBlur={e => saveField(key, e.target.value)}
                            onChange={e => saveField(key, e.target.value)}
                            style={{ ...E.input, width: '100px', padding: '6px 10px', fontSize: '13px', textAlign: 'right' }} />
                          <span style={{ fontSize: '12px', color: E.textSecond, width: '18px' }}>元</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ backgroundColor: '#f0ede0', borderRadius: '10px', padding: '12px 14px' }}>
                <div style={{ fontSize: '12px', color: E.textSecond, marginBottom: '6px', fontWeight: '600' }}>本月估算</div>
                {(() => {
                  const ls = data.salarySettings?.find(x => x.empId === salaryEditEmp.id) || {}
                  const hrs = monthHoursFor(salaryEditEmp.id)
                  const type = ls.payType || 'monthly'
                  const base = Number(ls.baseSalary || ls.hourlyRate || 0)
                  const cBase = type === 'monthly' ? base : Math.round(hrs * base)
                  const gross = cBase + Number(ls.mealAllowance||0) + Number(ls.fullAttendanceBonus||0) + Number(ls.activityAttendance||0)
                  const deduct = Number(ls.healthInsEmp||0)+Number(ls.laborInsEmp||0)+Number(ls.pensionSelf||0)+Number(ls.dependentHealth||0)+Number(ls.supplementalIns||0)+Number(ls.wireFee||0)
                  const employer = Number(ls.healthInsEmployer||0)+Number(ls.laborInsEmployer||0)+Number(ls.pensionEmployer||0)
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: E.textSecond }}>薪資總額</span><span style={{ fontWeight: '600' }}>NT${gross.toLocaleString()}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: E.textSecond }}>員工扣項</span><span style={{ color: '#8a3a20' }}>－ NT${deduct.toLocaleString()}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: `1px solid ${E.divider}`, paddingTop: '6px', marginTop: '2px' }}>
                        <span style={{ fontWeight: '700', color: E.textPrimary }}>員工實領</span>
                        <span style={{ fontWeight: '700', fontSize: '15px', color: E.green }}>NT${(gross - deduct).toLocaleString()}</span>
                      </div>
                      {employer > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: E.textMuted, fontSize: '12px' }}><span>雇主負擔</span><span>NT${employer.toLocaleString()}</span></div>}
                    </div>
                  )
                })()}
              </div>
            </div>
            <button onClick={() => setSalaryEditEmp(null)} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>完成</button>
          </Modal>
        )
      })()}

    </div>
  )
}
