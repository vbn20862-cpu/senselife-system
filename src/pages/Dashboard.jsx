import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { AlertTriangle, CheckCircle2, Plus, Trash2, Calendar, Users, ClipboardList, FileText } from 'lucide-react'
import Modal from '../components/Modal'

// 大地色系
const STATUS_CHIP = {
  '執行中': { bg: '#e8f0e4', color: '#3a6d31' },
  '企劃中': { bg: '#e8e4f0', color: '#5a4a8a' },
  '結案':   { bg: '#e8e4de', color: '#7a6a5a' },
  '長期':   { bg: '#f0e8de', color: '#8a6a48' },
  '暫停':   { bg: '#f0e4e0', color: '#8a3a2a' },
  '提案中': { bg: '#f0ece0', color: '#8a7028' },
}
const EVENT_CHIP = {
  '截止日': { bg: '#f0e4de', color: '#8a3a28', border: '#e0b8a8' },
  '繳款日': { bg: '#f0ece0', color: '#8a7028', border: '#e0d0a0' },
  '活動日': { bg: '#e4ece4', color: '#3a6d31', border: '#b0ccb0' },
}

// 共用卡片樣式
const card = {
  backgroundColor: '#fdfaf5',
  border: '1px solid #e8ddd0',
  borderRadius: '16px',
  boxShadow: '0 1px 4px rgba(60,30,0,0.06)',
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function SectionTitle({ icon: Icon, color, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
      <Icon size={16} style={{ color }} />
      <span style={{ fontWeight: '600', fontSize: '14px', color: '#3d2510' }}>{children}</span>
    </div>
  )
}

export default function Dashboard() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const [showAddTodo, setShowAddTodo] = useState(false)
  const [newTodo, setNewTodo] = useState('')
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: '截止日', project: '', note: '' })

  const today = new Date().toISOString().split('T')[0]
  const upcomingEvents = [...data.events]
    .filter(e => { const d = daysUntil(e.date); return d !== null && d >= 0 && d <= 30 })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const urgentEvents = upcomingEvents.filter(e => daysUntil(e.date) <= 7)

  // 今日出勤：從打卡記錄自動抓取
  const todayClockins = (data.clockins || []).filter(c => c.date === today)
  const clockedInToday = (() => {
    const map = {}
    for (const c of todayClockins) {
      if (!map[c.empId]) map[c.empId] = { empId: c.empId, empName: c.empName, clockIn: null, clockOut: null, overtime: false }
      if (c.type === '上班' && !map[c.empId].clockIn) map[c.empId].clockIn = c.time
      if (c.type === '下班') map[c.empId].clockOut = c.time
      if (c.type === '加班開始') map[c.empId].overtime = true
      if (c.type === '加班結束') map[c.empId].overtime = false
    }
    return Object.values(map).filter(e => e.clockIn)
  })()

  function handleAddTodo() {
    if (!newTodo.trim()) return
    addItem('todos', { id: Date.now(), text: newTodo.trim(), done: false, date: today })
    setNewTodo(''); setShowAddTodo(false)
  }
  function handleAddEvent() {
    if (!newEvent.title || !newEvent.date) return
    addItem('events', { ...newEvent, id: Date.now() })
    setNewEvent({ title: '', date: '', type: '截止日', project: '', note: '' }); setShowAddEvent(false)
  }
  const btn = {
    primary: { backgroundColor: '#3a6d31', color: '#f2f7f0', border: 'none', borderRadius: '10px', padding: '9px 0', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' },
    ghost:   { backgroundColor: 'transparent', color: '#3a6d31', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#2c1a0e', margin: 0 }}>儀表板</h1>

      {/* 緊急提醒 */}
      {urgentEvents.length > 0 && (
        <div style={{ backgroundColor: '#f5ebe4', border: '1px solid #ddb89a', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={15} style={{ color: '#a05020' }} />
            <span style={{ fontWeight: '600', fontSize: '13px', color: '#a05020' }}>7 天內重要事項</span>
          </div>
          {urgentEvents.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '2px 0' }}>
              <span style={{ color: '#6b3010' }}>{e.title}</span>
              <span style={{ color: '#a05020', fontWeight: '600' }}>
                {daysUntil(e.date) === 0 ? '今天！' : `${daysUntil(e.date)} 天後`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {/* 案件總覽 */}
        <div style={card} className="p-5">
          <SectionTitle icon={ClipboardList} color="#4d8843">案件總覽</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.projects.filter(p => p.id !== 'Admin_sl').map(p => {
              const chip = STATUS_CHIP[p.status] || { bg: '#eee', color: '#666' }
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#2c1a0e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '11px', color: '#9a7a5a' }}>{p.client}</div>
                  </div>
                  <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', backgroundColor: chip.bg, color: chip.color, fontWeight: '500', flexShrink: 0 }}>
                    {p.status}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 今日出勤 */}
        <div style={card} className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <SectionTitle icon={Users} color="#a97248">今日出勤</SectionTitle>
            <span style={{ fontSize: '12px', color: '#b09070' }}>{clockedInToday.length} 人</span>
          </div>
          {clockedInToday.length === 0
            ? <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '16px 0' }}>尚無人打卡上班</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {clockedInToday.map(a => (
                  <div key={a.empId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: a.clockOut ? '#9a8a7a' : a.overtime ? '#c07030' : '#4d8843', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#2c1a0e', flex: 1 }}>{a.empName}</span>
                    <span style={{ fontSize: '12px', color: '#9a7a5a' }}>{a.clockIn}</span>
                    {a.clockOut
                      ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#f0ece8', color: '#9a7a5a' }}>已下班 {a.clockOut}</span>
                      : a.overtime
                        ? <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#fef3c7', color: '#b45309' }}>加班中</span>
                        : <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: '#edf2ea', color: '#3a6d31' }}>在班</span>
                    }
                  </div>
                ))}
              </div>
          }
        </div>

        {/* 待辦事項 */}
        <div style={card} className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <SectionTitle icon={CheckCircle2} color="#8f5b38">待辦事項</SectionTitle>
            <button style={btn.ghost} onClick={() => setShowAddTodo(true)}>
              <Plus size={13} /> 新增
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.todos.length === 0 && <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '12px 0' }}>沒有待辦事項</div>}
            {data.todos.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="group">
                <input type="checkbox" checked={t.done} onChange={() => updateItem('todos', t.id, { done: !t.done })}
                  style={{ width: '16px', height: '16px', accentColor: '#3a6d31', cursor: 'pointer', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', flex: 1, color: t.done ? '#b09070' : '#3d2510', textDecoration: t.done ? 'line-through' : 'none' }}>{t.text}</span>
                <button onClick={() => deleteItem('todos', t.id)} style={{ color: '#d0c0b0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 行事曆 */}
        <div style={{ ...card, gridColumn: '1 / -1' }} className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: '#a97248' }} />
              <span style={{ fontWeight: '600', fontSize: '14px', color: '#3d2510' }}>近期重要日期</span>
              <span style={{ fontSize: '12px', color: '#b09070' }}>（30天內）</span>
            </div>
            <button style={btn.ghost} onClick={() => setShowAddEvent(true)}>
              <Plus size={13} /> 新增事件
            </button>
          </div>
          {upcomingEvents.length === 0
            ? <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '16px 0' }}>近期無重要事件</div>
            : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                {upcomingEvents.map(e => {
                  const days = daysUntil(e.date)
                  const chip = EVENT_CHIP[e.type] || { bg: '#eee', color: '#666', border: '#ccc' }
                  const urgent = days <= 3 ? '#f5e8e0' : days <= 7 ? '#f5f0e0' : '#f8f5f0'
                  return (
                    <div key={e.id} style={{ backgroundColor: urgent, border: `1px solid ${days <= 3 ? '#e0b8a0' : days <= 7 ? '#e0d0a0' : '#e8ddd0'}`, borderRadius: '12px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#2c1a0e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                          <div style={{ fontSize: '11px', color: '#9a7a5a', marginTop: '3px' }}>{e.date}{e.project ? ` · ${e.project}` : ''}</div>
                          {e.note && <div style={{ fontSize: '11px', color: '#7a6050', marginTop: '5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{e.note}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}>{e.type}</span>
                          <span style={{ fontSize: '12px', fontWeight: '700', color: days <= 3 ? '#8a3a20' : days <= 7 ? '#8a7020' : '#7a6a5a' }}>
                            {days === 0 ? '今天！' : `${days} 天`}
                          </span>
                          <button onClick={() => deleteItem('events', e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8b09a', padding: 0, marginTop: '2px' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      </div>

      {/* Modals */}
      {showAddTodo && (
        <Modal title="新增待辦" onClose={() => setShowAddTodo(false)} size="sm">
          <input autoFocus value={newTodo} onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTodo()}
            placeholder="輸入待辦事項..."
            style={{ width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', outline: 'none', backgroundColor: '#fdfaf5', boxSizing: 'border-box' }} />
          <button onClick={handleAddTodo} style={{ ...btn.primary, marginTop: '12px' }}>新增</button>
        </Modal>
      )}

      {showAddEvent && (
        <Modal title="新增重要日期" onClose={() => setShowAddEvent(false)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: '事件名稱', key: 'title', type: 'text', placeholder: '例：PW_sl 期中審查' },
              { label: '日期',     key: 'date',  type: 'date', placeholder: '' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input type={f.type} value={newEvent[f.key]} onChange={e => setNewEvent(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', outline: 'none', backgroundColor: '#fdfaf5', boxSizing: 'border-box' }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }}>類型</label>
              <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', outline: 'none', backgroundColor: '#fdfaf5' }}>
                {['截止日', '繳款日', '活動日'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }}>關聯案件</label>
              <select value={newEvent.project} onChange={e => setNewEvent(p => ({ ...p, project: e.target.value }))}
                style={{ width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', outline: 'none', backgroundColor: '#fdfaf5' }}>
                <option value="">不綁定案件</option>
                {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }}>備註</label>
              <textarea value={newEvent.note} onChange={e => setNewEvent(p => ({ ...p, note: e.target.value }))}
                placeholder="活動細節、注意事項..."
                rows={3}
                style={{ width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', outline: 'none', backgroundColor: '#fdfaf5', resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button onClick={handleAddEvent} style={{ ...btn.primary, marginTop: '14px' }}>新增</button>
        </Modal>
      )}
    </div>
  )
}
