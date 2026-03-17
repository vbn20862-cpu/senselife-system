import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { AlertTriangle, Users, ChevronLeft, ChevronRight, ListTodo, BarChart3 } from 'lucide-react'
import { E, STATUS, useIsMobile } from '../styles/earth'

// ── 共用 ──
const EVENT_CHIP = {
  '截止日': { bg: '#f0e4de', color: '#8a3a28', border: '#e0b8a8' },
  '繳款日': { bg: '#f0ece0', color: '#8a7028', border: '#e0d0a0' },
  '活動日': { bg: '#e4ece4', color: '#3a6d31', border: '#b0ccb0' },
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
        <span style={{ fontWeight: '600', fontSize: '14px', color: '#3d2510' }}>{children}</span>
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
function MiniCalendar({ selectedDate, onSelect, eventDates }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(selectedDate)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const { year, month } = viewDate
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date().toISOString().split('T')[0]
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
  const { data, updateItem } = useApp()
  const { currentUser } = useAuth()
  const mob = useIsMobile()
  const today = new Date().toISOString().split('T')[0]
  const [selectedDate, setSelectedDate] = useState(today)
  const myName = currentUser?.name || ''

  // ── ① 近五天到期任務 ──
  const urgentTasks = useMemo(() => {
    const result = []
    const projects = data.projects || []
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]))
    const workItems = data.workItems || []
    const wiMap = Object.fromEntries(workItems.map(w => [w.id, w]))

    // 工項
    for (const wi of workItems) {
      const d = daysUntil(wi.dueDate)
      if (d !== null && d >= 0 && d <= 5 && wi.status !== '完成') {
        const proj = projMap[wi.projectId]
        result.push({ id: `wi-${wi.id}`, title: wi.title, project: proj?.name || '', dueDate: wi.dueDate, days: d, assignee: wi.assignee, color: proj?.color })
      }
    }

    // 子任務 + 孫任務
    for (const st of (data.subTasks || [])) {
      const d = daysUntil(st.dueDate)
      if (d !== null && d >= 0 && d <= 5 && st.status !== '完成') {
        const wi = wiMap[st.workItemId]
        const proj = wi ? projMap[wi.projectId] : null
        result.push({ id: `st-${st.id}`, title: st.title, project: proj?.name || '', dueDate: st.dueDate, days: d, assignee: st.assignee, color: proj?.color })
      }
    }

    return result.sort((a, b) => a.days - b.days)
  }, [data.workItems, data.subTasks, data.projects])

  // ── ② 行事曆事件 ──
  const events = data.events || []
  const eventDates = useMemo(() => new Set(events.map(e => e.date)), [events])
  const selectedEvents = events.filter(e => e.date === selectedDate).sort((a, b) => (a.title || '').localeCompare(b.title || ''))

  // ── ③ 今日出勤 ──
  const [ty, tm, td] = today.split('-').map(Number)
  const todaySchedules = (data.schedules || []).filter(
    s => s.year === ty && s.month === tm && s.day === td && s.shift !== '休假'
  )

  // ── ④ 我的任務 ──
  const myTasks = useMemo(() => {
    const result = []
    const projects = data.projects || []
    const projMap = Object.fromEntries(projects.map(p => [p.id, p]))
    const wiMap = Object.fromEntries((data.workItems || []).map(w => [w.id, w]))

    for (const wi of (data.workItems || [])) {
      if (wi.assignee === myName) {
        const proj = projMap[wi.projectId]
        result.push({ type: 'workItem', id: wi.id, title: wi.title, status: wi.status, dueDate: wi.dueDate, project: proj?.name || '', color: proj?.color })
      }
    }
    for (const st of (data.subTasks || [])) {
      if (st.assignee === myName) {
        const wi = wiMap[st.workItemId]
        const proj = wi ? projMap[wi.projectId] : null
        result.push({ type: 'subTask', id: st.id, title: st.title, status: st.status, dueDate: st.dueDate, project: proj?.name || '', color: proj?.color, category: st.category })
      }
    }
    return result.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  }, [data.workItems, data.subTasks, data.projects, myName])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#2c1a0e', margin: 0 }}>儀表板</h1>

      {/* ① 近五天到期任務（警示區） */}
      {urgentTasks.length > 0 && (
        <div style={{ backgroundColor: '#fdf5ec', border: '1px solid #e8c8a0', borderRadius: '14px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <AlertTriangle size={15} style={{ color: '#c06020' }} />
            <span style={{ fontWeight: '700', fontSize: '13px', color: '#8a4a18' }}>近 5 天到期任務</span>
            <span style={{ fontSize: '11px', color: '#b08050', fontWeight: '500' }}>{urgentTasks.length} 項</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {urgentTasks.map(t => (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '10px',
                backgroundColor: t.days <= 1 ? '#fce8e0' : t.days <= 3 ? '#fdf0e0' : '#fdfaf2',
                border: `1px solid ${t.days <= 1 ? '#e8b8a0' : t.days <= 3 ? '#e8d0a0' : '#e8e0c8'}`,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: t.color || '#b09070', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: '#9a7a5a', minWidth: '60px', flexShrink: 0 }}>{t.project}</span>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#3d2510', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                {t.assignee && <span style={{ fontSize: '11px', color: '#9a7a5a', flexShrink: 0 }}>{t.assignee}</span>}
                <span style={{ fontSize: '12px', fontWeight: '700', color: t.days <= 1 ? '#c04030' : t.days <= 3 ? '#c08a30' : '#8a7a5a', flexShrink: 0, minWidth: '50px', textAlign: 'right' }}>
                  {t.days === 0 ? '今天！' : `${t.days} 天後`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ② 行事曆（左月曆 + 右事件） */}
      <div style={{ ...E.card, padding: '18px', display: 'grid', gridTemplateColumns: mob ? '1fr' : '280px 1fr', gap: '20px' }}>
        <MiniCalendar selectedDate={selectedDate} onSelect={setSelectedDate} eventDates={eventDates} />
        <div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#3d2510', marginBottom: '10px', paddingBottom: '8px', borderBottom: '2px solid #ede5d8' }}>
            {formatDate(selectedDate)} 的事件
          </div>
          {selectedEvents.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#b09070', padding: '20px 0', textAlign: 'center' }}>當日無事件</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedEvents.map(e => {
                const chip = EVENT_CHIP[e.type] || { bg: '#eee', color: '#666', border: '#ccc' }
                const proj = e.project ? (data.projects || []).find(p => p.id === e.project) : null
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
                      {(proj || e.note) && (
                        <div style={{ fontSize: '11px', color: '#9a7a5a', marginTop: '2px' }}>
                          {proj ? proj.name : ''}{proj && e.note ? ' · ' : ''}{e.note || ''}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ③ 今日出勤 */}
      <div style={{ ...E.card, padding: '16px 18px' }}>
        <SectionTitle icon={Users} color="#a97248" right={
          <span style={{ fontSize: '12px', color: '#b09070', fontWeight: '600' }}>{todaySchedules.length} 人</span>
        }>今日出勤</SectionTitle>
        {todaySchedules.length === 0
          ? <div style={{ fontSize: '13px', color: '#b09070', textAlign: 'center', padding: '16px 0' }}>今日無排班</div>
          : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {todaySchedules.map(s => {
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
            </div>
        }
      </div>

      {/* ④ 我的任務 */}
      <div style={{ ...E.card, padding: '16px 18px' }}>
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
      <div style={{ ...E.card, padding: '16px 18px' }}>
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
                    <div style={{ height: '6px', borderRadius: '3px', backgroundColor: '#ede5d8', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: '3px', backgroundColor: p.color || '#3a6d31', width: `${p.pct}%`, transition: 'width 0.3s' }} />
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
