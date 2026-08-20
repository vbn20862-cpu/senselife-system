import { useState, useMemo, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { AlertTriangle, Users, ChevronLeft, ChevronRight, ListTodo, BarChart3, Plus, Trash2, Pencil } from 'lucide-react'
import { E, STATUS, useIsMobile } from '../styles/earth'
import { fetchGoogleCalendarEvents } from '../utils/googleCalendar'
import Modal from '../components/Modal'

// ── 共用 ──
const EVENT_CHIP = {
  '截止日': { bg: '#f0e4de', color: '#8a3a28', border: '#e0b8a8' },
  '繳款日': { bg: '#f0ece0', color: '#8a7028', border: '#e0d0a0' },
  '活動日': { bg: '#e4ece4', color: '#3a6d31', border: '#b0ccb0' },
  'Google': { bg: '#e3ecf6', color: '#1a56a0', border: '#b0c8e8' },
}

const STATUS_CYCLE = ['待開始', '進行中', '待審核', '完成']

function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target - today) / 86400000)
}

function SectionTitle({ icon: Icon, color, children, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Icon size={16} style={{ color }} />
        <span style={{ fontWeight: '700', fontSize: '14px', color: '#2c1a0e', letterSpacing: '-0.01em' }}>{children}</span>
      </div>
      {right}
    </div>
  )
}

function stChip(s) {
  const c = STATUS[s] || { bg: '#eee', color: '#666' }
  return {
    fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
    fontWeight: '600', backgroundColor: c.bg, color: c.color,
    cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s',
  }
}

// ── 月曆組件 ──
function MiniCalendar({ selectedDate, onSelect, eventDates, onMonthChange }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  useEffect(() => {
    onMonthChange?.(viewDate.year, viewDate.month + 1)
  }, [viewDate.year, viewDate.month])

  const { year, month } = viewDate
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toLocaleDateString('sv-SE')
  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
  const monthLabel = `${year} 年 ${month + 1} 月`

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  function toDateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={() => setViewDate(p => {
          const d = new Date(p.year, p.month - 1, 1)
          return { year: d.getFullYear(), month: d.getMonth() }
        })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '4px', display: 'flex' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontSize: '14px', fontWeight: '700', color: '#3d2510' }}>{monthLabel}</span>
        <button onClick={() => setViewDate(p => {
          const d = new Date(p.year, p.month + 1, 1)
          return { year: d.getFullYear(), month: d.getMonth() }
        })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '4px', display: 'flex' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#b09070', padding: '4px 0' }}>{w}</div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} />
          const ds = toDateStr(d)
          const isToday = ds === today
          const isSelected = ds === selectedDate
          const hasEvent = eventDates.has(ds)
          return (
            <button key={i} onClick={() => onSelect(ds)} style={{
              background: isSelected ? '#3a6d31' : isToday ? '#edf2ea' : 'transparent',
              color: isSelected ? '#fff' : isToday ? '#3a6d31' : '#3d2510',
              border: 'none', borderRadius: '8px', padding: '6px 0', fontSize: '13px',
              fontWeight: isToday || isSelected ? '700' : '400',
              cursor: 'pointer', position: 'relative', transition: 'all 0.1s',
            }}>
              {d}
              {hasEvent && (
                <div style={{
                  position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)',
                  width: '4px', height: '4px', borderRadius: '50%',
                  backgroundColor: isSelected ? '#fff' : '#c08a30',
                }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── 主元件 ──
export default function Dashboard() {
  const { data, updateItem, addItem, deleteItem } = useApp()
  const { currentUser, isAdmin } = useAuth()
  const mob = useIsMobile()
  const today = new Date().toLocaleDateString('sv-SE')
  const [selectedDate, setSelectedDate] = useState(today)
  const myName = currentUser?.name || ''

  // ── 新增／編輯行事曆事件 ──
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEventId, setEditingEventId] = useState(null)  // null = 新增模式
  const [newEvent, setNewEvent] = useState({ title: '', date: '', type: '活動日', project: '', note: '' })
  const [syncToGoogle, setSyncToGoogle] = useState(() => {
    try { return localStorage.getItem('syncEventToGoogle') !== 'false' } catch { return true }
  })

  function openEventModal() {
    setEditingEventId(null)
    setNewEvent({ title: '', date: selectedDate, type: '活動日', project: '', note: '' })
    setShowEventModal(true)
  }

  function openEditEventModal(evt) {
    setEditingEventId(evt.id)
    setNewEvent({
      title: evt.title || '',
      date: evt.date || '',
      type: evt.type || '活動日',
      project: evt.project || '',
      note: evt.note || '',
    })
    setShowEventModal(true)
  }

  // 組 Google 日曆新增事件 URL（全天事件，end date 需 +1 日）
  function buildGoogleCalendarUrl(evt) {
    const proj = evt.project ? (data.projects || []).find(p => p.id === evt.project) : null
    const startYmd = evt.date.replace(/-/g, '')
    const nextDay = new Date(evt.date)
    nextDay.setDate(nextDay.getDate() + 1)
    const endYmd = nextDay.toISOString().slice(0, 10).replace(/-/g, '')
    const details = [evt.type ? `類型：${evt.type}` : '', proj ? `案件：${proj.name}` : '', evt.note || '']
      .filter(Boolean).join('\n')
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: evt.title,
      dates: `${startYmd}/${endYmd}`,
      details,
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  }

  function saveEvent() {
    if (!newEvent.title.trim() || !newEvent.date) return
    const payload = {
      title: newEvent.title.trim(),
      date: newEvent.date,
      type: newEvent.type,
      project: newEvent.project || '',
      note: newEvent.note || '',
    }
    if (editingEventId) {
      updateItem('events', editingEventId, payload)
    } else {
      const evt = { id: Date.now(), ...payload }
      addItem('events', evt)
      if (syncToGoogle) {
        try { localStorage.setItem('syncEventToGoogle', 'true') } catch { /* ignore */ }
        window.open(buildGoogleCalendarUrl(evt), '_blank', 'noopener,noreferrer')
      } else {
        try { localStorage.setItem('syncEventToGoogle', 'false') } catch { /* ignore */ }
      }
    }
    setShowEventModal(false)
    setEditingEventId(null)
  }

  function removeEvent(id) {
    if (!window.confirm('確定刪除這個事件？')) return
    deleteItem('events', id)
  }

  // ── ① 交辦追蹤（管理員紅字區：逾期＋3天內到期；本週結算）──
  const [trackTab, setTrackTab] = useState('red')
  const OPEN_ST = ['待辦', '進行中', '暫停']
  const dispatchTrack = useMemo(() => {
    const ds = (data.dispatches || []).filter(Boolean)
    const open = ds.filter(d => OPEN_ST.includes(d.status))
    const red = open
      .map(d => ({ ...d, days: daysUntil(d.dueDate) }))
      .filter(d => d.days !== null && d.days <= 3)
      .sort((a, b) => a.days - b.days)
    // 本週（週一起算）
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const mondayStr = monday.toLocaleDateString('sv-SE')
    const doneThisWeek = ds.filter(d => d.status === '已完成' && (d.completedAt || '').slice(0, 10) >= mondayStr)
    const openByPerson = {}
    open.forEach(d => { openByPerson[d.assignee] = (openByPerson[d.assignee] || 0) + 1 })
    const overdueCount = open.filter(d => { const du = daysUntil(d.dueDate); return du !== null && du < 0 }).length
    return { red, doneThisWeek, openByPerson, overdueCount, openCount: open.length }
  }, [data.dispatches])

  // ── ② 行事曆事件（本地 + Google Calendar）──
  const localEvents = data.events || []
  const [gcalEvents, setGcalEvents] = useState([])
  const [gcalMonth, setGcalMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  })

  const handleMonthChange = useCallback((year, month) => {
    setGcalMonth({ year, month })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchGoogleCalendarEvents(gcalMonth.year, gcalMonth.month).then(evts => {
      if (!cancelled) setGcalEvents(evts)
    })
    return () => { cancelled = true }
  }, [gcalMonth.year, gcalMonth.month])

  const allEvents = useMemo(() => {
    const gEvents = gcalEvents.map(g => ({
      ...g,
      type: 'Google',
    }))
    return [...localEvents, ...gEvents]
  }, [localEvents, gcalEvents])

  const eventDates = useMemo(() => new Set(allEvents.map(e => e.date)), [allEvents])
  const selectedEvents = allEvents.filter(e => e.date === selectedDate).sort((a, b) => (a.title || '').localeCompare(b.title || ''))

  // ── ③ 出勤（跟著月曆選的日期連動）──
  const [ty, tm, td] = selectedDate.split('-').map(Number)
  const daySchedules = (data.schedules || []).filter(s => s.year === ty && s.month === tm && s.day === td)
  const dayWorking = daySchedules.filter(s => s.shift !== '休假')
  const dayResting = daySchedules.filter(s => s.shift === '休假')
  const isTodaySelected = selectedDate === today

  // ── ④ 我的任務（交辦清單：指派給我、未結案的）──
  const myTasks = useMemo(() => {
    const projMap = Object.fromEntries((data.projects || []).map(p => [p.id, p]))
    return (data.dispatches || [])
      .filter(Boolean)
      .filter(d => d.assignee === myName && ['待辦', '進行中', '暫停'].includes(d.status))
      .map(d => {
        const proj = projMap[d.projectId]
        return { type: 'dispatch', id: d.id, title: d.title, status: d.status, dueDate: d.dueDate, project: proj?.name || '', color: proj?.color, category: d.category }
      })
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  }, [data.dispatches, data.projects, myName])

  // ── ⑤ 團隊進度 ──
  const teamProgress = useMemo(() => {
    const projects = (data.projects || []).filter(p => p.status === '執行中')
    const workItems = data.workItems || []
    const subTasks = data.subTasks || []
    const wiMap = Object.fromEntries(workItems.map(w => [w.id, w]))

    // 案件進度
    const projProgress = projects.map(p => {
      const wis = workItems.filter(w => w.projectId === p.id)
      const total = wis.length
      const done = wis.filter(w => w.status === '完成').length
      return { id: p.id, name: p.name, color: p.color, total, done, pct: total ? Math.round(done / total * 100) : 0 }
    })

    // 人員統計
    const personMap = {}
    for (const wi of workItems) {
      if (wi.assignee && wi.status !== '完成') {
        personMap[wi.assignee] = personMap[wi.assignee] || { total: 0, done: 0 }
        personMap[wi.assignee].total++
      }
    }
    for (const st of subTasks) {
      if (st.assignee) {
        personMap[st.assignee] = personMap[st.assignee] || { total: 0, done: 0 }
        personMap[st.assignee].total++
        if (st.status === '完成') personMap[st.assignee].done++
      }
    }
    const personStats = Object.entries(personMap).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.total - a.total)

    return { projProgress, personStats }
  }, [data.projects, data.workItems, data.subTasks])

  // ── handlers ──
  function cycleStatus(type, id, currentStatus) {
    if (type === 'dispatch') {
      const cyc = ['待辦', '進行中', '已完成']
      const next = cyc[(cyc.indexOf(currentStatus) + 1) % cyc.length]
      updateItem('dispatches', id, { status: next })
      return
    }
    const idx = STATUS_CYCLE.indexOf(currentStatus)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    const collection = type === 'workItem' ? 'workItems' : 'subTasks'
    updateItem(collection, id, { status: next })
  }

  // ── 日期格式 ──
  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`
  }

  const todayLabel = (() => {
    const d = new Date()
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']
    return `${d.getMonth() + 1} 月 ${d.getDate()} 日（${weekdays[d.getDay()]}）`
  })()

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div className="card-animate d1 page-header">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#f2f7f0', margin: 0, letterSpacing: '-0.01em' }}>
            {myName ? `嗨，${myName}` : '儀表板'}
          </h1>
          <span style={{ fontSize: '13px', color: 'rgba(242,247,240,0.65)', fontWeight: '500' }}>{todayLabel}</span>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(242,247,240,0.55)' }}>深活共構管理系統</p>
      </div>

      {/* ① 交辦追蹤（管理員置頂：紅字區 / 本週結算） */}
      {isAdmin && (
        <div className="card-animate d2" style={{ backgroundColor: '#ffffff', border: '1px solid #e8c8a0', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 2px 12px rgba(60,30,0,0.10)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <AlertTriangle size={15} style={{ color: '#c06020' }} />
            <span style={{ fontWeight: '700', fontSize: '13px', color: '#8a4a18' }}>交辦追蹤</span>
            {dispatchTrack.overdueCount > 0 && <span style={{ fontSize: '11px', color: '#fff', fontWeight: '700', backgroundColor: '#c0202a', padding: '1px 9px', borderRadius: '999px' }}>逾期 {dispatchTrack.overdueCount}</span>}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', backgroundColor: '#f5f0e8', borderRadius: '999px', padding: '3px' }}>
              {[['red', '🔴 待處理'], ['week', '📊 本週結算']].map(([k, label]) => (
                <button key={k} onClick={() => setTrackTab(k)} style={{
                  fontSize: '11px', fontWeight: '700', padding: '5px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                  backgroundColor: trackTab === k ? '#fff' : 'transparent', color: trackTab === k ? '#8a4a18' : '#a08868',
                  boxShadow: trackTab === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {trackTab === 'red' && (
            dispatchTrack.red.length === 0
              ? <div style={{ fontSize: '13px', color: '#8aa878', textAlign: 'center', padding: '16px 0' }}>✓ 沒有逾期或近 3 天到期的交辦</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {dispatchTrack.red.map(t => {
                    const over = t.days < 0
                    return (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px',
                        backgroundColor: over ? '#fbe4e0' : t.days <= 1 ? '#fce8e0' : '#fdf0e0',
                        border: `1px solid ${over ? '#e0a8a0' : t.days <= 1 ? '#e8b8a0' : '#e8d0a0'}`,
                      }}>
                        <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', backgroundColor: '#fff', color: '#8a4a18', fontWeight: '700', flexShrink: 0 }}>{t.category}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#3d2510', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                        <span style={{ fontSize: '11px', color: '#9a7a5a', flexShrink: 0 }}>{t.assignee}</span>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: over ? '#c0202a' : t.days <= 1 ? '#c04030' : '#c08a30', flexShrink: 0, minWidth: '54px', textAlign: 'right' }}>
                          {over ? `逾期${-t.days}天` : t.days === 0 ? '今天！' : `${t.days} 天後`}
                        </span>
                      </div>
                    )
                  })}
                </div>
          )}

          {trackTab === 'week' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[['本週完成', dispatchTrack.doneThisWeek.length, '#2e6040'], ['未結', dispatchTrack.openCount, '#8a6a20'], ['逾期', dispatchTrack.overdueCount, '#c0202a']].map(([k, v, c]) => (
                  <div key={k} style={{ backgroundColor: '#faf7f2', borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: c }}>{v}</div>
                    <div style={{ fontSize: '11px', color: '#9a8070' }}>{k}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9a8070', fontWeight: '700', marginBottom: '6px' }}>誰手上積最多（未結）</div>
                {Object.keys(dispatchTrack.openByPerson).length === 0
                  ? <div style={{ fontSize: '12px', color: '#b09070' }}>目前無人有未結交辦</div>
                  : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.entries(dispatchTrack.openByPerson).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
                        <span key={name} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', backgroundColor: '#f0ece5', color: '#5f5a4e', fontWeight: '600' }}>
                          {name} <strong style={{ color: '#8a4a18' }}>{cnt}</strong>
                        </span>
                      ))}
                    </div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ② 行事曆（左月曆 + 右事件） */}
      <div className="card-animate d3 card-accent-sand" style={{ ...E.card, padding: '18px', display: 'grid', gridTemplateColumns: mob ? '1fr' : '280px 1fr', gap: '20px' }}>
        <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} eventDates={eventDates} onMonthChange={handleMonthChange} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '8px', borderBottom: '2px solid #ede5d8' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#3d2510' }}>
              {formatDate(selectedDate)} 的事件
            </div>
            <button onClick={openEventModal}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: '600', color: '#3a6d31', backgroundColor: '#edf2ea', border: '1px solid #b0ccb0', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer' }}>
              <Plus size={13} /> 新增
            </button>
          </div>
          {selectedEvents.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#b09070', padding: '20px 0', textAlign: 'center' }}>當日無事件</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedEvents.map(e => {
                const chip = EVENT_CHIP[e.type] || { bg: '#eee', color: '#666', border: '#ccc' }
                const proj = e.project ? (data.projects || []).find(p => p.id === e.project) : null
                const isGoogle = e.source === 'google'
                const subtitle = isGoogle
                  ? [e.startTime && !e.allDay ? `${e.startTime}–${e.endTime}` : '整天', e.location].filter(Boolean).join(' · ')
                  : [proj?.name, e.note].filter(Boolean).join(' · ')
                return (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '10px', backgroundColor: '#faf7f2', border: '1px solid #ede5d8',
                  }}>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', backgroundColor: chip.bg, color: chip.color, border: `1px solid ${chip.border}`, fontWeight: '600', flexShrink: 0 }}>
                      {e.type}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#2c1a0e' }}>{e.title}</div>
                      {subtitle && (
                        <div style={{ fontSize: '11px', color: '#9a7a5a', marginTop: '2px' }}>{subtitle}</div>
                      )}
                    </div>
                    {!isGoogle && (
                      <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                        <button onClick={() => openEditEventModal(e)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a08060', padding: '4px', display: 'flex' }}
                          title="編輯">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => removeEvent(e.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c09070', padding: '4px', display: 'flex' }}
                          title="刪除">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 新增／編輯事件 Modal */}
      {showEventModal && (
        <Modal title={editingEventId ? '編輯行事曆事件' : '新增行事曆事件'}
          onClose={() => { setShowEventModal(false); setEditingEventId(null) }} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>日期 *</label>
              <input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))}
                style={E.input} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>類型</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['活動日', '截止日', '繳款日'].map(t => (
                  <button key={t} onClick={() => setNewEvent(p => ({ ...p, type: t }))}
                    style={{
                      flex: 1, padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                      border: `1px solid ${newEvent.type === t ? (EVENT_CHIP[t]?.border || E.coffee) : E.divider}`,
                      backgroundColor: newEvent.type === t ? (EVENT_CHIP[t]?.bg || E.sandLight) : 'transparent',
                      color: newEvent.type === t ? (EVENT_CHIP[t]?.color || E.coffee) : E.textSecond,
                      cursor: 'pointer',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>標題 *</label>
              <input type="text" value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))}
                placeholder="例：RME 展覽開幕" style={E.input} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>關聯案件（選填）</label>
              <select value={newEvent.project} onChange={e => setNewEvent(p => ({ ...p, project: e.target.value }))}
                style={E.input}>
                <option value="">無</option>
                {(data.projects || []).filter(p => p.status !== '結案').map(p => (
                  <option key={p.id} value={p.id}>{p.id.replace('_sl', '')} · {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>備註（選填）</label>
              <textarea value={newEvent.note} onChange={e => setNewEvent(p => ({ ...p, note: e.target.value }))}
                rows={2} style={{ ...E.input, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            {!editingEventId && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', padding: '8px 10px', borderRadius: '8px', backgroundColor: syncToGoogle ? '#e3ecf6' : '#f5f0e8', border: `1px solid ${syncToGoogle ? '#b0c8e8' : '#e0d0b8'}`, transition: 'all 0.15s' }}>
                <input type="checkbox" checked={syncToGoogle} onChange={e => setSyncToGoogle(e.target.checked)}
                  style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#1a56a0' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: syncToGoogle ? '#1a56a0' : '#7a6a5a' }}>
                    📅 同步到 Google 日曆
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#8a7a6a', marginTop: '2px', lineHeight: 1.4 }}>
                    儲存後會開新分頁帶好日期與標題，你在 Google 日曆按「儲存」就完成
                  </div>
                </div>
              </label>
            )}
            {editingEventId && (
              <div style={{ fontSize: '11px', color: E.textMuted, padding: '6px 10px', backgroundColor: '#f5f0e8', borderRadius: '6px', lineHeight: 1.5 }}>
                ℹ️ 編輯系統內事件不會自動更新已同步到 Google 日曆的那筆。如需同步變更請去 Google 日曆手動修改。
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button onClick={() => { setShowEventModal(false); setEditingEventId(null) }}
                style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
              <button onClick={saveEvent}
                disabled={!newEvent.title.trim() || !newEvent.date}
                style={{ ...E.btnPrimary, padding: '8px 18px',
                  opacity: !newEvent.title.trim() || !newEvent.date ? 0.5 : 1,
                  cursor: !newEvent.title.trim() || !newEvent.date ? 'not-allowed' : 'pointer' }}>
                儲存
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ③ 出勤（跟著月曆選的日期連動） */}
      <div className="card-animate d4 card-accent-coffee" style={{ ...E.card, padding: '16px 18px' }}>
        <SectionTitle icon={Users} color="#a97248" right={
          <span style={{ fontSize: '12px', color: '#b09070', fontWeight: '600' }}>出勤 {dayWorking.length} 人</span>
        }>{isTodaySelected ? '今日出勤' : `${formatDate(selectedDate)} 出勤`}</SectionTitle>
        {daySchedules.length === 0
          ? <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '16px 0' }}>{isTodaySelected ? '今日' : '當日'}無排班</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {dayWorking.map(s => {
                  const emp = data.employees.find(e => e.id === s.empId)
                  return (
                    <span key={s.id} style={{
                      fontSize: '12px', padding: '5px 12px', borderRadius: '999px',
                      backgroundColor: '#edf2ea', color: '#3a6d31', fontWeight: '500',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4d8843' }} />
                      {emp?.name || s.empId}
                      <span style={{ fontSize: '10px', color: '#5a8a52', opacity: 0.8 }}>{s.shift}</span>
                    </span>
                  )
                })}
                {dayWorking.length === 0 && <span style={{ fontSize: '12px', color: '#b09070' }}>無人出勤</span>}
              </div>
              {dayResting.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {dayResting.map(s => {
                    const emp = data.employees.find(e => e.id === s.empId)
                    return (
                      <span key={s.id} style={{
                        fontSize: '12px', padding: '5px 12px', borderRadius: '999px',
                        backgroundColor: '#f5ece8', color: '#9a5240', fontWeight: '500',
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c08a70' }} />
                        {emp?.name || s.empId}
                        <span style={{ fontSize: '10px', color: '#b07860', opacity: 0.9 }}>休假</span>
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
        }
      </div>

      {/* ④ 我的任務 */}
      <div className="card-animate d5 card-accent" style={{ ...E.card, padding: '16px 18px' }}>
        <SectionTitle icon={ListTodo} color="#3a6d31" right={
          <span style={{ fontSize: '12px', color: '#b09070' }}>{myTasks.length} 項</span>
        }>我的任務</SectionTitle>
        {myTasks.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '20px 0' }}>目前沒有指派給你的任務</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
            {myTasks.map(t => {
              const d = daysUntil(t.dueDate)
              return (
                <div key={`${t.type}-${t.id}`} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '9px 12px', borderRadius: '10px',
                  backgroundColor: t.status === '完成' ? '#f8f5f0' : '#faf7f2',
                  border: '1px solid #ede5d8',
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: t.color || '#b09070', flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: '#9a7a5a', minWidth: '55px', flexShrink: 0 }}>{t.project}</span>
                  {t.category && (
                    <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', backgroundColor: t.category === '設計' ? '#e8e4f0' : '#e0e8f0', color: t.category === '設計' ? '#5a4a8a' : '#305080', fontWeight: '600', flexShrink: 0 }}>
                      {t.category}
                    </span>
                  )}
                  <span style={{
                    flex: 1, fontSize: '13px', fontWeight: '500',
                    color: t.status === '完成' ? '#b09070' : '#3d2510',
                    textDecoration: t.status === '完成' ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{t.title}</span>
                  {t.dueDate && (
                    <span style={{ fontSize: '11px', color: d !== null && d <= 3 ? '#c04030' : '#9a7a5a', fontWeight: d !== null && d <= 3 ? '600' : '400', flexShrink: 0 }}>
                      {t.dueDate.slice(5)}
                    </span>
                  )}
                  <span onClick={() => cycleStatus(t.type, t.id, t.status)} style={stChip(t.status)} title="點擊切換狀態">
                    {t.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ⑤ 團隊進度總覽 */}
      <div className="card-animate d6 card-accent-coffee" style={{ ...E.card, padding: '16px 18px' }}>
        <SectionTitle icon={BarChart3} color="#8f5b38">團隊進度總覽</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, ${mob ? 'minmax(140px, 1fr)' : 'minmax(280px, 1fr)'})`, gap: '20px' }}>

          {/* 案件工項完成率 */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#7a6050', marginBottom: '10px' }}>案件工項完成率</div>
            {teamProgress.projProgress.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#b09070' }}>目前無執行中案件</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {teamProgress.projProgress.map(p => (
                  <div key={p.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.color }} />
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#3d2510' }}>{p.name}</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#7a6050' }}>{p.done}/{p.total}</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '4px', backgroundColor: '#ede5d8', overflow: 'hidden' }}>
                      <div className="progress-bar" style={{ height: '100%', borderRadius: '4px', backgroundColor: p.color || '#3a6d31', width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 人員任務統計 */}
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#7a6050', marginBottom: '10px' }}>人員任務統計</div>
            {teamProgress.personStats.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#b09070' }}>無任務資料</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {teamProgress.personStats.map(p => (
                  <div key={p.name} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '7px 10px', borderRadius: '8px', backgroundColor: '#faf7f2',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#edf2ea',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '700', color: '#3a6d31', flexShrink: 0,
                    }}>
                      {p.name.slice(0, 1)}
                    </div>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: '#3d2510' }}>{p.name}</span>
                    <span style={{ fontSize: '12px', color: '#7a6050' }}>{p.done} 完成</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#3a6d31' }}>{p.total} 項</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
