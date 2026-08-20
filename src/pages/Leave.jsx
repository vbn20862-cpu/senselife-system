import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { E, useIsMobile } from '../styles/earth'
import Modal from '../components/Modal'
import { Plus, Check, X, Trash2, Clock } from 'lucide-react'
import { LEAVE_TYPES, leaveTypeCat, annualLeaveStatus, computeCompLedger } from '../utils/payrollEngine'
import { localTimestamp } from '../utils/salaryCalc'

const CAT_STYLE = {
  paid:   { label: '全薪', bg: '#e4f0e8', color: '#2e6040' },
  half:   { label: '半薪', bg: '#fdf5e0', color: '#a07020' },
  unpaid: { label: '無薪', bg: '#f5e8e0', color: '#8a3a20' },
}
const STATUS_STYLE = {
  '待審核': { bg: '#fef3cd', color: '#8a6d1a' },
  '已核准': { bg: '#e4f0e8', color: '#2e6040' },
  '已駁回': { bg: '#f5e4e0', color: '#8a3020' },
}

// 計算兩日期間天數（含頭尾）
function daysBetween(start, end) {
  if (!start) return 0
  const d = new Date(start), last = new Date(end || start)
  let n = 0
  while (d <= last) { n++; d.setDate(d.getDate() + 1) }
  return n
}

export default function Leave() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const { currentUser, isAdmin } = useAuth()
  const mob = useIsMobile()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ empId: '', type: '特休', startDate: '', endDate: '', halfDay: false, reason: '' })
  const [formErr, setFormErr] = useState('')

  const myEmp = useMemo(() =>
    data.employees.find(e => e.name === currentUser?.name || currentUser?.name?.includes(e.name) || e.name?.includes(currentUser?.name)),
    [data.employees, currentUser])

  const leaves = useMemo(() => {
    const all = (data.leaveRequests || [])
    const visible = isAdmin ? all : all.filter(l => l.empId === myEmp?.id)
    return [...visible].sort((a, b) => (b.submittedAt || b.startDate || '').localeCompare(a.submittedAt || a.startDate || ''))
  }, [data.leaveRequests, isAdmin, myEmp])

  const pendingCount = (data.leaveRequests || []).filter(l => l.status === '待審核').length

  function openForm() {
    setForm({ empId: isAdmin ? '' : (myEmp?.id || ''), type: '特休', startDate: '', endDate: '', halfDay: false, reason: '' })
    setFormErr('')
    setShowForm(true)
  }

  function submit() {
    const empId = isAdmin ? Number(form.empId) : myEmp?.id
    if (!empId) { setFormErr('請選擇員工'); return }
    if (!form.startDate) { setFormErr('請選擇開始日期'); return }
    const end = form.halfDay ? form.startDate : (form.endDate || form.startDate)
    if (end < form.startDate) { setFormErr('結束日不能早於開始日'); return }

    // 1 小時前提出規則（管理員補登不受限）
    if (!isAdmin) {
      const leaveStartTs = new Date(`${form.startDate}T09:00:00`).getTime()
      if (Date.now() > leaveStartTs - 3600 * 1000) {
        setFormErr('請假需於事實發生前 1 小時提出。臨時/逾時請聯絡管理員補登。')
        return
      }
    }

    const emp = data.employees.find(e => e.id === empId)
    const days = form.halfDay ? 0.5 : daysBetween(form.startDate, end)

    // 餘額檢查：特休不能超過剩餘額度、補休不能超過餘額
    if (emp) {
      if (form.type === '特休') {
        const al = annualLeaveStatus(emp, new Date(form.startDate).getFullYear(), data)
        if (days > al.remainingDays) { setFormErr(`特休剩餘 ${al.remainingDays} 天，不足以請 ${days} 天`); return }
      } else if (form.type === '補休') {
        const now = new Date()
        const bal = computeCompLedger(emp, data, { year: now.getFullYear(), month: now.getMonth() + 1 }).balanceHours
        if (days * 8 > bal) { setFormErr(`補休餘額 ${bal} 小時（約 ${Math.round(bal/8*10)/10} 天），不足以請 ${days} 天`); return }
      }
    }
    addItem('leaveRequests', {
      id: Date.now(),
      empId, empName: emp?.name || '',
      type: form.type,
      startDate: form.startDate,
      endDate: end,
      days,
      halfDay: form.halfDay,
      reason: form.reason.trim(),
      status: isAdmin ? '已核准' : '待審核', // 管理員補登直接核准
      submittedAt: localTimestamp(),
      reviewedBy: isAdmin ? (currentUser?.name || '管理員') : '',
      reviewedAt: isAdmin ? localTimestamp() : '',
    })
    // TODO: 之後接「小彥機器人」→ 發送到老闆群組
    setShowForm(false)
  }

  function review(l, decision) {
    updateItem('leaveRequests', l.id, {
      status: decision,
      reviewedBy: currentUser?.name || '管理員',
      reviewedAt: localTimestamp(),
    })
  }

  const curCat = leaveTypeCat(form.type)

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>
          請假管理
          {isAdmin && pendingCount > 0 && (
            <span style={{ marginLeft: '10px', fontSize: '12px', padding: '2px 10px', borderRadius: '999px', backgroundColor: '#fef3cd', color: '#8a6d1a', fontWeight: '700' }}>{pendingCount} 待審核</span>
          )}
        </h1>
        <button onClick={openForm} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> {isAdmin ? '補登請假' : '申請請假'}
        </button>
      </div>

      {/* 員工：我的特休 + 補休餘額 */}
      {!isAdmin && myEmp && (() => {
        const al = myEmp.hireDate ? annualLeaveStatus(myEmp, new Date().getFullYear(), data) : null
        const now = new Date()
        const compBal = computeCompLedger(myEmp, data, { year: now.getFullYear(), month: now.getMonth() + 1 }).balanceHours
        return (
          <div style={{ ...E.card, display: 'flex', gap: '24px', flexWrap: 'wrap', backgroundColor: '#f0f5ed', border: '1px solid #cfe0c8' }}>
            {al
              ? [['特休額度', `${al.entitledDays} 天`], ['特休已用', `${al.usedDays} 天`], ...(al.pendingDays > 0 ? [['待審核', `${al.pendingDays} 天`]] : []), ['特休剩餘', `${al.remainingDays} 天`]].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: '11px', color: E.textMuted }}>{k}</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: k === '特休剩餘' ? E.green : E.textPrimary }}>{v}</div>
                  </div>
                ))
              : <div style={{ fontSize: '12px', color: '#c08a30' }}>⚠️ 未填到職日，無法計算特休（請管理員補上）</div>}
            <div style={{ borderLeft: `1px solid ${E.divider}`, paddingLeft: '24px' }}>
              <div style={{ fontSize: '11px', color: E.textMuted }}>補休餘額</div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: E.coffee }}>{compBal} 小時</div>
            </div>
          </div>
        )
      })()}

      <div style={{ fontSize: '12px', color: E.textMuted, backgroundColor: '#f8f2e8', padding: '10px 14px', borderRadius: '10px', border: '1px solid #ede5d8', lineHeight: 1.5 }}>
        <Clock size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
        請假需於<strong>事實發生前 1 小時</strong>提出。全薪假不扣薪、病假扣半薪、事假無薪照缺扣。核准後自動連動薪資計算。
      </div>

      {/* 請假清單 */}
      {leaves.length === 0 ? (
        <div style={{ ...E.card, textAlign: 'center', padding: '40px', color: E.textMuted, fontSize: '13px' }}>尚無請假紀錄</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {leaves.map(l => {
            const cat = CAT_STYLE[leaveTypeCat(l.type)] || CAT_STYLE.paid
            const st = STATUS_STYLE[l.status] || STATUS_STYLE['待審核']
            return (
              <div key={l.id} style={{ ...E.card, display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {isAdmin && <span style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>{l.empName}</span>}
                    <span style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{l.type}</span>
                    <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '999px', backgroundColor: cat.bg, color: cat.color, fontWeight: '600' }}>{cat.label}</span>
                    <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '999px', backgroundColor: st.bg, color: st.color, fontWeight: '600' }}>{l.status || '待審核'}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: E.textMuted, marginTop: '4px' }}>
                    {l.startDate}{l.endDate && l.endDate !== l.startDate ? ` ~ ${l.endDate}` : ''} · {l.days} 天{l.reason ? ` · ${l.reason}` : ''}
                  </div>
                  {l.reviewedBy && <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px' }}>{l.status} · {l.reviewedBy} · {l.reviewedAt}</div>}
                </div>
                {isAdmin && l.status === '待審核' && (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => review(l, '已核准')} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#3a6d31', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}><Check size={13} /> 核准</button>
                    <button onClick={() => review(l, '已駁回')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', color: '#c04030', border: '1px solid #e0b8a8', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer' }}><X size={13} /> 駁回</button>
                  </div>
                )}
                {(isAdmin || (l.empId === myEmp?.id && l.status === '待審核')) && (
                  <button onClick={() => { if (window.confirm('確定刪除這筆請假？')) deleteItem('leaveRequests', l.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '4px' }}><Trash2 size={14} /></button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 申請 Modal */}
      {showForm && (
        <Modal title={isAdmin ? '補登請假' : '申請請假'} onClose={() => setShowForm(false)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isAdmin && (
              <Field label="員工 *">
                <select value={form.empId} onChange={e => setForm(p => ({ ...p, empId: e.target.value }))} style={E.input}>
                  <option value="">選擇員工</option>
                  {data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="假別 *">
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={E.input}>
                {LEAVE_TYPES.map(t => <option key={t.type} value={t.type}>{t.type}（{CAT_STYLE[t.cat].label}）</option>)}
              </select>
              <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '4px' }}>{LEAVE_TYPES.find(t => t.type === form.type)?.desc}</div>
            </Field>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: E.textSecond, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.halfDay} onChange={e => setForm(p => ({ ...p, halfDay: e.target.checked }))} />
              半天假（單日 0.5 天）
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: form.halfDay ? '1fr' : '1fr 1fr', gap: '10px' }}>
              <Field label={form.halfDay ? '日期 *' : '開始日 *'}>
                <input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} style={E.input} />
              </Field>
              {!form.halfDay && (
                <Field label="結束日">
                  <input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} style={E.input} />
                </Field>
              )}
            </div>
            <Field label="事由（選填）">
              <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={2} style={{ ...E.input, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            {formErr && <div style={{ fontSize: '13px', color: '#c04030', backgroundColor: '#fce8e0', padding: '8px 12px', borderRadius: '8px' }}>⚠ {formErr}</div>}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
              <button onClick={submit} style={{ ...E.btnPrimary, padding: '8px 18px' }}>{isAdmin ? '補登' : '送出申請'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}
