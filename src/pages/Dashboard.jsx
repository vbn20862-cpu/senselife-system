import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { AlertTriangle, CheckCircle2, Plus, Trash2, Calendar, Users, CalendarDays, Settings, RefreshCw } from 'lucide-react'
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

// Google Calendar iCal 設定 key
const GCAL_ICAL_KEY = 'gcal_ical_url'

// 解析 iCal 格式
function parseIcal(text) {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = unfolded.split('\n')
  const events = []
  let cur = null
  for (const raw of lines) {
    const line = raw.trim()
    if (line === 'BEGIN:VEVENT') { cur = {} }
    else if (line === 'END:VEVENT') {
      if (cur?.title && cur?.date) events.push(cur)
      cur = null
    } else if (cur !== null) {
      if (line.startsWith('SUMMARY:')) {
        cur.title = line.replace(/^SUMMARY:/, '')
      } else if (/^DTSTART/.test(line)) {
        const val = line.replace(/^[^:]+:/, '')
        const d = val.slice(0, 8)
        cur.date = `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
        // 嘗試抓時間
        if (val.length >= 15) {
          cur.time = `${val.slice(9,11)}:${val.slice(11,13)}`
        }
      }
    }
  }
  return events.map((e, i) => ({
    id: `gcal_${i}_${e.date}`,
    title: e.title,
    date: e.date,
    time: e.time || '',
    type: '活動日',
    source: 'google',
  }))
}

export default function Dashboard() {
  const { data, addItem, deleteItem } = useApp()
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: '截止日', project: '', note: '', tags: '' })

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // Google Calendar iCal
  const [gcalIcalUrl, setGcalIcalUrl] = useState(() => localStorage.getItem(GCAL_ICAL_KEY) || '')
  const [gcalEvents, setGcalEvents] = useState([])
  const [gcalLoading, setGcalLoading] = useState(false)
  const [gcalError, setGcalError] = useState('')
  const [showGcalSetup, setShowGcalSetup] = useState(false)
  const [gcalInput, setGcalInput] = useState('')

  function fetchGcal(url) {
    if (!url) return
    setGcalLoading(true)
    setGcalError('')
    const proxyUrl = url.replace('https://calendar.google.com', '/gcal-proxy')
    fetch(proxyUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text() })
      .then(txt => { setGcalEvents(parseIcal(txt)); setGcalLoading(false) })
      .catch(err => { setGcalError(err.message); setGcalLoading(false) })
  }

  useEffect(() => { fetchGcal(gcalIcalUrl) }, [gcalIcalUrl])

  function saveGcalUrl() {
    const url = gcalInput.trim()
    localStorage.setItem(GCAL_ICAL_KEY, url)
    setGcalIcalUrl(url)
    setShowGcalSetup(false)
    setGcalInput('')
  }

  // 合併 Google Calendar + 手動新增事件
  const allEvents = [
    ...gcalEvents,
    ...(data.events || []).map(e => ({ ...e, source: 'manual' })),
  ]

  // 今日 / 明日行程
  const todayEvents    = allEvents.filter(e => e.date === today).sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'))
  const tomorrowEvents = allEvents.filter(e => e.date === tomorrow).sort((a,b) => (a.time||'99:99').localeCompare(b.time||'99:99'))

  // 近期重要日期（14天內）
  const upcomingEvents = allEvents
    .filter(e => { const d = daysUntil(e.date); return d !== null && d >= 0 && d <= 14 })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  const urgentEvents = upcomingEvents.filter(e => daysUntil(e.date) <= 7)

  // 今日出勤：從排班表
  const [ty, tm, td] = today.split('-').map(Number)
  const todaySchedules = (data.schedules || []).filter(
    s => s.year === ty && s.month === tm && s.day === td && s.shift !== '休假'
  )

  // 執行中工項：按專案分組
  const inProgressItems = (data.workItems || []).filter(w => w.status === '進行中')
  const inProgressByProject = (data.projects || [])
    .filter(p => p.id !== 'Admin_sl')
    .map(p => ({ project: p, items: inProgressItems.filter(w => w.projectId === p.id) }))
    .filter(g => g.items.length > 0)

  function handleAddEvent() {
    if (!newEvent.title || !newEvent.date) return
    addItem('events', { ...newEvent, id: Date.now() })
    setNewEvent({ title: '', date: '', type: '截止日', project: '', note: '', tags: '' })
    setShowAddEvent(false)
  }

  const btn = {
    primary: { backgroundColor: '#3a6d31', color: '#f2f7f0', border: 'none', borderRadius: '10px', padding: '9px 0', fontSize: '13px', fontWeight: '600', cursor: 'pointer', width: '100%' },
    ghost:   { backgroundColor: 'transparent', color: '#3a6d31', border: 'none', fontSize: '12px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0' },
  }

  // 今日/明日行程單一事件列
  function ScheduleRow({ e }) {
    const chip = EVENT_CHIP[e.type] || { bg: '#eee', color: '#666', border: '#ccc' }
    const isGoogle = e.source === 'google'
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 0', borderBottom: '1px solid #f0e8dc' }}>
        {e.time && (
          <span style={{ fontSize: '11px', color: '#9a7a5a', minWidth: '36px', fontWeight: '600', paddingTop: '1px' }}>{e.time}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {isGoogle && (
              <span style={{ fontSize: '9px', fontWeight: '700', color: '#4285f4', backgroundColor: '#e8f0fe', padding: '1px 4px', borderRadius: '3px', flexShrink: 0 }}>G</span>
            )}
            <span style={{ fontSize: '13px', color: '#2c1a0e', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
          </div>
          {e.note && <div style={{ fontSize: '11px', color: '#9a7a5a', marginTop: '2px' }}>{e.note}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', backgroundColor: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}>{e.type}</span>
          {!isGoogle && (
            <button onClick={() => deleteItem('events', e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8b09a', padding: 0, display: 'flex' }}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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

      {/* 今日出勤（縮小）+ 執行中工項 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {/* 今日出勤 */}
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} style={{ color: '#a97248' }} />
              <span style={{ fontWeight: '600', fontSize: '14px', color: '#3d2510' }}>今日出勤</span>
            </div>
            <span style={{ fontSize: '12px', color: '#b09070', fontWeight: '600' }}>{todaySchedules.length} 人</span>
          </div>
          {todaySchedules.length === 0
            ? <div style={{ fontSize: '13px', color: '#b09070' }}>今日無排班</div>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {todaySchedules.map(s => {
                  const emp = data.employees.find(e => e.id === s.empId)
                  return (
                    <span key={s.id} style={{
                      fontSize: '12px', padding: '4px 10px', borderRadius: '999px',
                      backgroundColor: '#edf2ea', color: '#3a6d31', fontWeight: '500',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4d8843', display: 'inline-block' }} />
                      {emp?.name || s.empId}
                      <span style={{ fontSize: '10px', color: '#5a8a52', opacity: 0.8 }}>{s.shift}</span>
                    </span>
                  )
                })}
              </div>
          }
        </div>

        {/* 執行中工項 */}
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={15} style={{ color: '#8f5b38' }} />
              <span style={{ fontWeight: '600', fontSize: '14px', color: '#3d2510' }}>執行中工項</span>
            </div>
            <span style={{ fontSize: '12px', color: '#b09070' }}>{inProgressItems.length} 項</span>
          </div>
          {inProgressByProject.length === 0
            ? <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '12px 0' }}>目前無執行中工項</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '240px', overflowY: 'auto' }}>
                {inProgressByProject.map(({ project, items }) => (
                  <div key={project.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: project.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#5a3a1a' }}>{project.name}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '13px' }}>
                      {items.map(task => (
                        <div key={task.id} style={{ fontSize: '13px', color: '#3d2510', lineHeight: '1.4' }}>
                          <span style={{ fontWeight: '500' }}>{task.title}</span>
                          {task.assignee && <span style={{ fontSize: '11px', color: '#9a7a5a', marginLeft: '6px' }}>· {task.assignee}</span>}
                          {task.dueDate && <span style={{ fontSize: '11px', color: '#9a7a5a', marginLeft: '4px' }}>· {task.dueDate}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>

      </div>

      {/* 今日 / 明日行程 */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarDays size={15} style={{ color: '#4285f4' }} />
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#3d2510' }}>今日 / 明日行程</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {gcalIcalUrl && (
              <button onClick={() => fetchGcal(gcalIcalUrl)} title="重新抓取"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: gcalLoading ? '#4285f4' : '#b09070', padding: '2px', display: 'flex' }}>
                <RefreshCw size={13} style={{ animation: gcalLoading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            )}
            <button onClick={() => { setGcalInput(gcalIcalUrl); setShowGcalSetup(true) }} title="設定 Google Calendar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: gcalIcalUrl ? '#4285f4' : '#b09070', padding: '2px', display: 'flex' }}>
              <Settings size={13} />
            </button>
            <button style={btn.ghost} onClick={() => setShowAddEvent(true)}>
              <Plus size={13} /> 新增
            </button>
          </div>
        </div>

        {!gcalIcalUrl && (
          <div style={{ fontSize: '12px', color: '#9a7a5a', backgroundColor: '#fdf5e8', border: '1px dashed #d8c8a8', borderRadius: '8px', padding: '7px 12px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={12} />
            點右上角齒輪可連結 Google Calendar iCal
          </div>
        )}
        {gcalError && (
          <div style={{ fontSize: '12px', color: '#8a3a20', backgroundColor: '#f5e8e0', border: '1px solid #e0b8a0', borderRadius: '8px', padding: '7px 12px', marginBottom: '12px' }}>
            抓取失敗：{gcalError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* 今日 */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#5a3a1a', marginBottom: '6px', paddingBottom: '5px', borderBottom: '2px solid #e8ddd0' }}>
              今日 <span style={{ fontWeight: '400', color: '#9a7a5a' }}>{today}</span>
            </div>
            {todayEvents.length === 0
              ? <div style={{ fontSize: '12px', color: '#b09070', padding: '8px 0' }}>無行程</div>
              : todayEvents.map(e => <ScheduleRow key={e.id} e={e} />)
            }
          </div>
          {/* 明日 */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#5a3a1a', marginBottom: '6px', paddingBottom: '5px', borderBottom: '2px solid #e8ddd0' }}>
              明日 <span style={{ fontWeight: '400', color: '#9a7a5a' }}>{tomorrow}</span>
            </div>
            {tomorrowEvents.length === 0
              ? <div style={{ fontSize: '12px', color: '#b09070', padding: '8px 0' }}>無行程</div>
              : tomorrowEvents.map(e => <ScheduleRow key={e.id} e={e} />)
            }
          </div>
        </div>
      </div>

      {/* 近期重要日期 */}
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} style={{ color: '#a97248' }} />
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#3d2510' }}>近期重要日期</span>
            <span style={{ fontSize: '12px', color: '#b09070' }}>（14天內）</span>
          </div>
        </div>

        {upcomingEvents.length === 0
          ? <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '16px 0' }}>
              {gcalLoading ? '正在載入…' : '近期無重要事件'}
            </div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {upcomingEvents.map(e => {
                const days = daysUntil(e.date)
                const chip = EVENT_CHIP[e.type] || { bg: '#eee', color: '#666', border: '#ccc' }
                const urgent = days <= 3 ? '#f5e8e0' : days <= 7 ? '#f5f0e0' : '#f8f5f0'
                const isGoogle = e.source === 'google'
                return (
                  <div key={e.id} style={{ backgroundColor: urgent, border: `1px solid ${days <= 3 ? '#e0b8a0' : days <= 7 ? '#e0d0a0' : '#e8ddd0'}`, borderRadius: '12px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          {isGoogle && (
                            <span style={{ fontSize: '10px', fontWeight: '700', color: '#4285f4', backgroundColor: '#e8f0fe', padding: '1px 5px', borderRadius: '4px', flexShrink: 0 }}>G</span>
                          )}
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#2c1a0e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#9a7a5a', marginTop: '3px' }}>{e.date}{e.project ? ` · ${e.project}` : ''}</div>
                        {e.tags && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                            {e.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                              <span key={t} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', backgroundColor: 'rgba(60,30,0,0.07)', color: '#7a5a40', fontWeight: '500' }}>#{t}</span>
                            ))}
                          </div>
                        )}
                        {e.note && <div style={{ fontSize: '11px', color: '#7a6050', marginTop: '5px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{e.note}</div>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: chip.bg, color: chip.color, border: `1px solid ${chip.border}` }}>{e.type}</span>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: days <= 3 ? '#8a3a20' : days <= 7 ? '#8a7020' : '#7a6a5a' }}>
                          {days === 0 ? '今天！' : `${days} 天`}
                        </span>
                        {!isGoogle && (
                          <button onClick={() => deleteItem('events', e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c8b09a', padding: 0, marginTop: '2px' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {/* Modals */}
      {showGcalSetup && (
        <Modal title="設定 Google Calendar iCal" onClose={() => setShowGcalSetup(false)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13px', color: '#7a6050', lineHeight: '1.7' }}>
              請到 Google Calendar →<br />
              <b>設定</b> → 選擇行事曆 → 「整合行事曆」<br />
              複製「<b>iCal 格式的私人網址</b>」貼到下方：
            </div>
            <input
              value={gcalInput}
              onChange={e => setGcalInput(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              style={{ width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', outline: 'none', backgroundColor: '#fdfaf5', boxSizing: 'border-box' }}
            />
            {gcalInput && !gcalInput.includes('calendar.google.com') && (
              <div style={{ fontSize: '12px', color: '#8a3a20' }}>⚠ 請確認網址格式正確</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            {gcalIcalUrl && (
              <button onClick={() => { localStorage.removeItem(GCAL_ICAL_KEY); setGcalIcalUrl(''); setGcalEvents([]); setShowGcalSetup(false) }}
                style={{ flex: 1, padding: '10px', border: '1px solid #e0c8b8', borderRadius: '10px', backgroundColor: '#fdfaf5', color: '#8a3a20', fontSize: '13px', cursor: 'pointer' }}>
                解除連結
              </button>
            )}
            <button onClick={saveGcalUrl}
              style={{ flex: 2, backgroundColor: '#3a6d31', color: '#f2f7f0', border: 'none', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              儲存
            </button>
          </div>
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
            <div>
              <label style={{ fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }}>標籤 <span style={{ color: '#b09070', fontWeight: '400' }}>（逗號分隔）</span></label>
              <input value={newEvent.tags} onChange={e => setNewEvent(p => ({ ...p, tags: e.target.value }))}
                placeholder="#標籤1, #標籤2"
                style={{ width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px', padding: '9px 12px', fontSize: '14px', outline: 'none', backgroundColor: '#fdfaf5', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button onClick={handleAddEvent} style={{ ...btn.primary, marginTop: '14px' }}>新增</button>
        </Modal>
      )}

    </div>
  )
}
