import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, Trash2, Phone, Mail, Building2, User, Pencil } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS } from '../styles/earth'

const MONTHS = ['一','二','三','四','五','六','七','八','九','十','十一','十二']
const WEEKDAYS = ['日','一','二','三','四','五','六']
function getDayOfWeek(year, month, day) { return new Date(year, month - 1, day).getDay() }
const SHIFTS = [
  { code: '出勤',  label: '出勤',  short: '出勤', bg: '#d6e8d0', color: '#2e6031', hours: 8 },
  { code: '上午班', label: '上午班', short: '上午', bg: '#d0e0ee', color: '#2a5070', hours: 4 },
  { code: '下午班', label: '下午班', short: '下午', bg: '#f0e4c0', color: '#7a5a10', hours: 4 },
  { code: '休假',  label: '休假',  short: '休假', bg: '#edddd8', color: '#8a3a30', hours: 0 },
]
function getShift(code) { return SHIFTS.find(s => s.code === code) || null }
function daysInMonth(y, m) { return new Date(y, m, 0).getDate() }

export default function HR() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const [tab, setTab] = useState('schedule')
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })
  const [showAddContact, setShowAddContact] = useState(false)
  const [showAddEmployee, setShowAddEmployee] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', type: '廠商', phone: '', email: '', project: '', note: '' })
  const [newEmployee, setNewEmployee] = useState({ name: '', role: '', email: '', phone: '' })
  const [editEmployee, setEditEmployee] = useState(null) // { id, name, role, email, phone }
  const [contactSearch, setContactSearch] = useState('')

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

  const filteredContacts = data.contacts.filter(c =>
    !contactSearch || c.name.includes(contactSearch) || c.type.includes(contactSearch) || c.note?.includes(contactSearch)
  )

  const TABS = [['schedule','排班表'],['attendance','出缺勤'],['clockin','打卡記錄'],['salary','薪資計算'],['employees','員工'],['contacts','廠商 & 聯絡人']]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>人事管理</h1>

      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#fdfaf5', borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto' }}>
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
                          <button onClick={() => setSchedule(emp.id, d, nextShift(shift))}
                            style={{ width: '34px', height: '26px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', border: 'none', cursor: 'pointer', transition: 'all 0.1s', backgroundColor: s ? s.bg : 'transparent', color: s ? s.color : '#d0c0b0' }}>
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
          <p style={{ fontSize: '12px', color: E.textMuted, margin: 0 }}>點擊格子循環切換：出勤 → 上午班 → 下午班 → 休假 → 清空</p>
        </div>
      )}

      {/* 出缺勤 */}
      {tab === 'attendance' && (
        <div style={E.card}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary, margin: '0 0 16px' }}>本月出缺勤統計（{year}/{month}）</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.employees.map(emp => {
              const empS = data.schedules.filter(s => s.empId === emp.id && s.year === year && s.month === month)
              const worked = empS.filter(s => s.shift === '出勤').length
              const half   = empS.filter(s => s.shift === '上午班' || s.shift === '下午班').length
              const off    = empS.filter(s => s.shift === '休假').length
              const total  = empS.reduce((sum, s) => sum + (getShift(s.shift).hours || 0), 0)
              return (
                <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 0', borderBottom: `1px solid ${E.divider}` }}>
                  <div style={{ width: '80px', fontWeight: '600', fontSize: '13px', color: E.textPrimary }}>{emp.name}</div>
                  <div style={{ display: 'flex', gap: '16px', flex: 1, flexWrap: 'wrap' }}>
                    {[['出勤', worked],['半天', half],['休假', off]].map(([label, val]) => (
                      <span key={label} style={{ fontSize: '12px', color: E.textSecond }}>
                        {label} <strong style={{ color: E.textPrimary }}>{val}</strong> 天
                      </span>
                    ))}
                    <span style={{ fontSize: '12px', color: E.textSecond }}>合計 <strong style={{ color: E.green }}>{total}h</strong></span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 員工 */}
      {tab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAddEmployee(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}><Plus size={15} />新增員工</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
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
        const sorted = [...data.clockins].sort((a, b) => {
          const d = (b.date || '').localeCompare(a.date || '')
          return d !== 0 ? d : (b.time || '').localeCompare(a.time || '')
        })
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: E.textSecond }}>共 {data.clockins.length} 筆記錄</span>
              <div style={{ display: 'flex', gap: '8px' }}>
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
                          <td style={{ padding: '10px 14px', fontWeight: '600', color: E.textPrimary }}>{c.empName}</td>
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

      {/* 薪資計算 */}
      {tab === 'salary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ ...E.card }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary, margin: '0 0 4px' }}>
              {year} 年 {MONTHS[month-1]} 月 薪資計算
            </h3>
            <p style={{ fontSize: '12px', color: E.textMuted, margin: '0 0 16px' }}>
              以排班表時數為基礎，輸入時薪計算當月薪資
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {data.employees.map((emp, i) => {
                const hrs = monthHours(emp.id)
                const setting = data.salarySettings?.find(s => s.empId === emp.id)
                const rate = setting?.hourlyRate || 0
                const pay = Math.round(hrs * rate)
                return (
                  <div key={emp.id} style={{
                    display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap',
                    padding: '14px 0', borderBottom: i < data.employees.length - 1 ? `1px solid ${E.divider}` : 'none',
                  }}>
                    <div style={{ width: '90px', fontWeight: '600', fontSize: '13px', color: E.textPrimary, flexShrink: 0 }}>{emp.name}</div>
                    <div style={{ fontSize: '12px', color: E.textSecond, flexShrink: 0 }}>本月時數 <strong style={{ color: E.green }}>{hrs}h</strong></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: E.textSecond }}>時薪</span>
                      <input
                        type="number"
                        value={rate || ''}
                        placeholder="0"
                        onChange={e => {
                          const val = Number(e.target.value)
                          const existing = (data.salarySettings || []).find(s => s.empId === emp.id)
                          if (existing) {
                            updateItem('salarySettings', existing.id, { hourlyRate: val })
                          } else {
                            addItem('salarySettings', { id: Date.now() + emp.id, empId: emp.id, hourlyRate: val })
                          }
                        }}
                        style={{ ...E.input, width: '90px', padding: '6px 10px', fontSize: '13px' }}
                      />
                      <span style={{ fontSize: '12px', color: E.textSecond }}>元</span>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '15px', fontWeight: '700', color: pay > 0 ? E.textPrimary : E.textMuted }}>
                      {pay > 0 ? `NT$${pay.toLocaleString()}` : '--'}
                    </div>
                  </div>
                )
              })}
            </div>
            {data.employees.some(emp => {
              const s = data.salarySettings?.find(x => x.empId === emp.id)
              return s?.hourlyRate > 0
            }) && (
              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${E.divider}`, display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary }}>
                  合計：NT${data.employees.reduce((sum, emp) => {
                    const hrs = monthHours(emp.id)
                    const s = data.salarySettings?.find(x => x.empId === emp.id)
                    return sum + Math.round(hrs * (s?.hourlyRate || 0))
                  }, 0).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          <div style={{ ...E.card, backgroundColor: '#f5f0e8', border: 'none' }}>
            <p style={{ fontSize: '12px', color: E.textSecond, margin: 0 }}>
              💡 時薪設定會自動儲存。如需固定月薪制，時薪可填入「月薪 ÷ 月總時數」。
            </p>
          </div>
        </div>
      )}

      {/* 廠商 & 聯絡人 */}
      {tab === 'contacts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input value={contactSearch} onChange={e => setContactSearch(e.target.value)} placeholder="搜尋名稱、類型..."
              style={{ ...E.input, flex: 1 }} />
            <button onClick={() => setShowAddContact(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}><Plus size={15} />新增</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
            {filteredContacts.map(c => (
              <div key={c.id} style={E.card}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: 0 }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: E.sandLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={16} style={{ color: E.coffee }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: E.sandLight, color: E.textSecond }}>{c.type}</span>
                        {c.project && <span style={{ fontSize: '11px', color: E.textMuted }}>{c.project}</span>}
                        {c.note && <span style={{ fontSize: '11px', color: E.textMuted }}>{c.note}</span>}
                      </div>
                      {c.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: E.textSecond, marginTop: '6px' }}><Phone size={11} />{c.phone}</div>}
                      {c.email && <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: E.textSecond, marginTop: '2px' }}><Mail size={11} />{c.email}</div>}
                    </div>
                  </div>
                  <button onClick={() => deleteItem('contacts', c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', flexShrink: 0 }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddContact && (
        <Modal title="新增廠商 / 聯絡人" onClose={() => setShowAddContact(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))} placeholder="名稱 *" style={E.input} />
            <select value={newContact.type} onChange={e => setNewContact(p => ({ ...p, type: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
              {['廠商','業主','政府單位','媒體','其他'].map(t => <option key={t}>{t}</option>)}
            </select>
            <input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))} placeholder="電話" style={E.input} />
            <input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))} placeholder="Email" style={E.input} />
            <select value={newContact.project} onChange={e => setNewContact(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
              <option value="">不綁定案件</option>
              {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={newContact.note} onChange={e => setNewContact(p => ({ ...p, note: e.target.value }))} placeholder="備註" style={E.input} />
          </div>
          <button onClick={() => { if (!newContact.name.trim()) return; addItem('contacts',{id:Date.now(),...newContact}); setNewContact({name:'',type:'廠商',phone:'',email:'',project:'',note:''}); setShowAddContact(false) }}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
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
            setEditEmployee(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}
    </div>
  )
}
