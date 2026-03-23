import { useState, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, ArrowLeft, MapPin, Truck, Package, ExternalLink, Palette, Wrench, ChevronDown, ChevronRight, Home } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS, useIsMobile } from '../styles/earth'

/* ── 常數 ── */
const STATUS_OPTIONS = ['待開始', '進行中', '待審核', '完成']
const DESIGN_TYPES = ['海報', '社群貼文', 'Banner', 'DM / 傳單', '名片', '識別設計', '簡報', '其他']
const TOP_TABS = ['總覽', '設計任務', '執行任務']

const EMPTY_DESIGN = {
  title: '', workItemId: '', category: '設計', status: '待開始', assignee: '',
  dueDate: '', type: '', size: '', purpose: '', quantity: '', textContent: '', note: '', parentId: null,
}
const EMPTY_EXEC = {
  title: '', workItemId: '', category: '執行', status: '待開始', assignee: '',
  dueDate: '', location: '', vendor: '', materials: '', note: '', parentId: null,
}

/* ── 狀態顏色 ── */
const STATUS_DOT = {
  '待開始': '#b09070',
  '進行中': '#3a7caa',
  '待審核': '#c08a30',
  '完成': '#3a6d31',
}

function nextStatus(current) {
  const i = STATUS_OPTIONS.indexOf(current)
  return STATUS_OPTIONS[(i + 1) % STATUS_OPTIONS.length]
}

/* ── 共用小元件 ── */
function Field({ label, value, icon }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>{icon}{label}</div>
      <div style={{ fontSize: '13px', color: E.textPrimary, fontWeight: '500' }}>{value}</div>
    </div>
  )
}

function MiniProgressBar({ done, total, color }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '3px', backgroundColor: '#ede5d8', borderRadius: '3px', overflow: 'hidden', minWidth: '40px' }}>
        <div style={{ height: '100%', borderRadius: '3px', backgroundColor: color || E.green, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '10px', fontWeight: '600', color: color || E.green, whiteSpace: 'nowrap' }}>{done}/{total}</span>
    </div>
  )
}

/* ── 匯總計算 Hook ── */
function useStats(subTasks, workItems) {
  // wiMap: workItemId → projectId
  const wiMap = useMemo(() => {
    const m = {}
    for (const wi of workItems) m[wi.id] = wi.projectId
    return m
  }, [workItems])

  // 取得任務的 projectId（從 workItemId 推導）
  const getProjectId = useCallback((task) => {
    return wiMap[task.workItemId] || ''
  }, [wiMap])

  // 主任務 (parentId === null)
  const mainTasks = useMemo(() => subTasks.filter(t => !t.parentId), [subTasks])

  // 匯總：子任務進度（含孫任務）
  const taskStats = useMemo(() => {
    const map = {} // taskId → { total, done, computed }
    for (const t of mainTasks) {
      const children = subTasks.filter(c => c.parentId === t.id)
      if (children.length > 0) {
        const done = children.filter(c => c.status === '完成').length
        // 計算狀態：全完成→完成, 有進行中/待審核→進行中, 全待開始→待開始
        let computed = '待開始'
        if (done === children.length) computed = '完成'
        else if (children.some(c => c.status === '進行中' || c.status === '待審核' || c.status === '完成')) computed = '進行中'
        map[t.id] = { total: children.length, done, computed }
      } else {
        map[t.id] = { total: 0, done: 0, computed: t.status }
      }
    }
    return map
  }, [mainTasks, subTasks])

  // 匯總：工項進度
  const wiStats = useMemo(() => {
    const map = {} // wiId → { total, done, computed, designCount, execCount }
    for (const wi of workItems) {
      const tasks = mainTasks.filter(t => t.workItemId === wi.id)
      const done = tasks.filter(t => (taskStats[t.id]?.computed || t.status) === '完成').length
      let computed = '待開始'
      if (tasks.length > 0 && done === tasks.length) computed = '完成'
      else if (tasks.some(t => {
        const s = taskStats[t.id]?.computed || t.status
        return s === '進行中' || s === '待審核' || s === '完成'
      })) computed = '進行中'
      map[wi.id] = {
        total: tasks.length, done, computed,
        designCount: tasks.filter(t => t.category === '設計').length,
        execCount: tasks.filter(t => t.category === '執行').length,
      }
    }
    return map
  }, [workItems, mainTasks, taskStats])

  // 匯總：案件進度
  const projStats = useMemo(() => {
    const map = {} // projId → { total, done, pct }
    for (const wi of workItems) {
      const pid = wi.projectId
      if (!map[pid]) map[pid] = { total: 0, done: 0 }
      const ws = wiStats[wi.id]
      map[pid].total += ws.total
      map[pid].done += ws.done
    }
    for (const pid of Object.keys(map)) {
      map[pid].pct = map[pid].total > 0 ? Math.round((map[pid].done / map[pid].total) * 100) : 0
    }
    return map
  }, [workItems, wiStats])

  return { getProjectId, mainTasks, taskStats, wiStats, projStats }
}

/* ================================================================
   總覽 — 案件進度卡片
   ================================================================ */
function ProjectOverviewCard({ project, workItems, subTasks, wiStats, projStats, taskStats, onClickTask, onClickProject, mob }) {
  const color = project.color || '#888'
  const ps = projStats[project.id] || { total: 0, done: 0, pct: 0 }
  const projectWIs = workItems.filter(wi => wi.projectId === project.id)
  const mainTasks = subTasks.filter(t => !t.parentId)

  return (
    <div style={{ ...E.card, borderLeft: `5px solid ${color}`, padding: 0, overflow: 'hidden' }}>
      {/* 標題區 */}
      <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '15px', fontWeight: '700', color: E.textPrimary }}>
              {project.id.replace('_sl', '')}
            </span>
            <span style={{ fontSize: '13px', color: E.textSecond }}>{project.name}</span>
            <span style={{ ...E.chip(STATUS[project.status]?.bg || '#eee', STATUS[project.status]?.color || '#666'), fontSize: '10px' }}>
              {project.status}
            </span>
          </div>
          <MiniProgressBar done={ps.done} total={ps.total} />
        </div>
        <button onClick={() => onClickProject(project.id)}
          style={{ ...E.btnGhost, padding: '5px 10px', fontSize: '11px', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
          <ExternalLink size={11} /> 案件工項
        </button>
      </div>

      {/* 按工項分組顯示 */}
      <div style={{ borderTop: `1px solid ${E.divider}` }}>
        {projectWIs.length === 0 ? (
          <div style={{ padding: '14px 18px', fontSize: '12px', color: E.textMuted }}>尚無工項</div>
        ) : (
          projectWIs.map(wi => {
            const ws = wiStats[wi.id] || { total: 0, done: 0, computed: '待開始' }
            const wiTasks = mainTasks.filter(t => t.workItemId === wi.id)
            const designTasks = wiTasks.filter(t => t.category === '設計')
            const execTasks = wiTasks.filter(t => t.category === '執行')
            const wiSt = STATUS[ws.computed] || { bg: '#eee', color: '#666' }

            return (
              <div key={wi.id} style={{ borderBottom: `1px solid ${E.divider}` }}>
                {/* 工項標題 */}
                <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: E.textPrimary }}>{wi.title}</span>
                  <span style={{ fontSize: '10px', color: E.textMuted }}>{wi.assignee}</span>
                  <span style={{ ...E.chip(wiSt.bg, wiSt.color), fontSize: '9px', padding: '1px 8px' }}>
                    {ws.computed}
                  </span>
                  {ws.total > 0 && (
                    <span style={{ fontSize: '10px', color: E.green, fontWeight: '600', marginLeft: 'auto' }}>
                      {ws.done}/{ws.total}
                    </span>
                  )}
                </div>

                {/* 設計 / 執行 雙欄 */}
                {wiTasks.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', padding: '0 14px 10px' }}>
                    <div style={{ padding: '4px 6px', borderRight: mob ? 'none' : `1px solid ${E.divider}`, borderBottom: mob ? `1px solid ${E.divider}` : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontSize: '10px', fontWeight: '600', color: E.textMuted }}>
                        <Palette size={10} /> 設計 ({designTasks.length})
                      </div>
                      {designTasks.length === 0 ? (
                        <div style={{ fontSize: '10px', color: E.textMuted, padding: '2px 4px' }}>—</div>
                      ) : designTasks.map(t => <OverviewTaskRow key={t.id} task={t} stats={taskStats[t.id]} onClick={() => onClickTask(t)} />)}
                    </div>
                    <div style={{ padding: '4px 6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontSize: '10px', fontWeight: '600', color: E.textMuted }}>
                        <Wrench size={10} /> 執行 ({execTasks.length})
                      </div>
                      {execTasks.length === 0 ? (
                        <div style={{ fontSize: '10px', color: E.textMuted, padding: '2px 4px' }}>—</div>
                      ) : execTasks.map(t => <OverviewTaskRow key={t.id} task={t} stats={taskStats[t.id]} onClick={() => onClickTask(t)} />)}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '2px 18px 10px', fontSize: '10px', color: E.textMuted }}>尚無子任務</div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function OverviewTaskRow({ task, stats, onClick }) {
  const computedStatus = stats?.computed || task.status
  const dotColor = STATUS_DOT[computedStatus] || '#999'
  const isDone = computedStatus === '完成'
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px',
      borderRadius: '6px', cursor: 'pointer', transition: 'background 0.1s',
    }}
    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f0e8'}
    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: dotColor, opacity: isDone ? 0.4 : 1 }} />
      <span style={{
        flex: 1, fontSize: '11px',
        color: isDone ? E.textMuted : E.textPrimary,
        textDecoration: isDone ? 'line-through' : 'none',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{task.title}</span>
      {stats && stats.total > 0 && (
        <span style={{ fontSize: '9px', color: E.textMuted }}>{stats.done}/{stats.total}</span>
      )}
      {task.dueDate && <span style={{ fontSize: '9px', color: E.textMuted, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}
    </div>
  )
}

/* ================================================================
   麵包屑導航
   ================================================================ */
function Breadcrumb({ items }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '4px' }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {i > 0 && <span style={{ color: E.textMuted, fontSize: '11px' }}>/</span>}
          {item.onClick ? (
            <button onClick={item.onClick} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
              fontSize: '12px', color: E.coffee, fontWeight: '500', borderRadius: '4px',
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f0e8'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
              {item.icon && <span style={{ marginRight: '3px', verticalAlign: 'middle' }}>{item.icon}</span>}
              {item.label}
            </button>
          ) : (
            <span style={{ fontSize: '12px', color: E.textPrimary, fontWeight: '600', padding: '2px 4px' }}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

/* ================================================================
   子任務詳細頁面（含孫任務 + 麵包屑 + 進度匯總）
   ================================================================ */
function SubTaskDetail({ task, allSubTasks, onBack, onBackToList, projects, workItems, getProjectId, taskStats, onClickChild, onAddChild, onToggle, onCycleStatus, onDelete }) {
  const proj = projects.find(p => p.id === getProjectId(task))
  const wi = workItems.find(w => w.id === task.workItemId)
  const stats = taskStats[task.id]
  const computedStatus = stats?.computed || task.status
  const st = STATUS[computedStatus] || { bg: '#eee', color: '#666' }

  const childTasks = allSubTasks.filter(t => t.parentId === task.id)
  const hasChildren = childTasks.length > 0
  const parentTask = task.parentId ? allSubTasks.find(t => t.id === task.parentId) : null

  // 麵包屑
  const crumbs = [
    { label: '執行追蹤', onClick: onBackToList, icon: <Home size={11} /> },
  ]
  if (proj) crumbs.push({ label: proj.id.replace('_sl', ''), onClick: onBackToList })
  if (wi) crumbs.push({ label: wi.title, onClick: parentTask ? () => onBack() : undefined })
  if (parentTask) crumbs.push({ label: parentTask.title, onClick: () => onBack() })
  crumbs.push({ label: task.title })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Breadcrumb items={crumbs} />

      <div style={{ ...E.card }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>{task.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {hasChildren && <MiniProgressBar done={stats?.done || 0} total={stats?.total || 0} />}
            <span style={{ ...E.chip(st.bg, st.color), fontSize: '12px', padding: '4px 14px' }}>{computedStatus}</span>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          <Field label="所屬案件" value={proj ? `${proj.id.replace('_sl', '')} ${proj.name}` : '未指定'} />
          <Field label="所屬工項" value={wi ? wi.title : '未指定'} />
          <Field label="類型" value={task.category} />
          <Field label="負責人" value={task.assignee || '未指派'} />
          <Field label="截止日期" value={task.dueDate || '未設定'} />
          {parentTask && <Field label="父任務" value={parentTask.title} />}
        </div>
      </div>

      <div style={{ ...E.card }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary, margin: '0 0 14px 0' }}>
          {task.category === '設計' ? '設計資訊' : '執行資訊'}
        </h3>
        {task.category === '設計' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
            <Field label="設計類型" value={task.type || '—'} />
            <Field label="尺寸規格" value={task.size || '—'} />
            <Field label="使用目的" value={task.purpose || '—'} />
            <Field label="數量" value={task.quantity || '—'} />
            {task.textContent && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '4px' }}>文字內容</div>
                <div style={{ fontSize: '13px', color: E.textSecond, whiteSpace: 'pre-wrap', lineHeight: 1.6, backgroundColor: E.sandLight, borderRadius: '10px', padding: '12px' }}>
                  {task.textContent}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px' }}>
            <Field label="地點" value={task.location || '—'} icon={<MapPin size={12} />} />
            <Field label="配合廠商" value={task.vendor || '—'} icon={<Truck size={12} />} />
            <Field label="所需物資" value={task.materials || '—'} icon={<Package size={12} />} />
          </div>
        )}
      </div>

      {task.note && (
        <div style={{ ...E.card }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary, margin: '0 0 10px 0' }}>備註</h3>
          <div style={{ fontSize: '13px', color: E.textSecond, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{task.note}</div>
        </div>
      )}

      {/* 孫任務區塊 — 只在主任務時顯示 */}
      {!task.parentId && (
        <div style={{ ...E.card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary, margin: 0 }}>
              孫任務 {hasChildren && <span style={{ fontSize: '11px', color: E.textMuted, fontWeight: '400' }}>({childTasks.length})</span>}
            </h3>
            <button onClick={() => onAddChild(task)} style={{ ...E.btnGhost, padding: '4px 10px', fontSize: '11px', gap: '4px' }}>
              <Plus size={12} /> 新增孫任務
            </button>
          </div>
          {!hasChildren ? (
            <div style={{ fontSize: '12px', color: E.textMuted, textAlign: 'center', padding: '16px' }}>
              尚無孫任務（如：初稿、修改、定稿）
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', overflowX: 'auto' }}>
              {childTasks.map(child => {
                const cst = STATUS[child.status] || { bg: '#eee', color: '#666' }
                return (
                  <div key={child.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 12px', borderRadius: '10px',
                    backgroundColor: '#faf7f2', border: '1px solid #ede5d8',
                    cursor: 'pointer', transition: 'background-color 0.1s',
                  }}
                  onClick={() => onClickChild(child)}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f0e8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = '#faf7f2'}>
                    <button onClick={e => { e.stopPropagation(); onToggle(child) }}
                      style={{
                        width: 18, height: 18, borderRadius: '50%',
                        border: `2px solid ${child.status === '完成' ? E.green : '#c8b8a0'}`,
                        backgroundColor: child.status === '完成' ? E.green : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', flexShrink: 0,
                      }}>
                      {child.status === '完成' && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                    </button>
                    <span style={{
                      flex: 1, fontSize: '13px', fontWeight: '500',
                      color: child.status === '完成' ? E.textMuted : E.textPrimary,
                      textDecoration: child.status === '完成' ? 'line-through' : 'none',
                    }}>{child.title}</span>
                    <button onClick={e => { e.stopPropagation(); onCycleStatus(child) }}
                      style={{ ...E.chip(cst.bg, cst.color), fontSize: '10px', cursor: 'pointer', border: 'none', transition: 'opacity 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                      {child.status}
                    </button>
                    {child.assignee && <span style={{ fontSize: '11px', color: E.textMuted, flexShrink: 0 }}>{child.assignee}</span>}
                    {child.dueDate && <span style={{ fontSize: '11px', color: E.textMuted, flexShrink: 0 }}>{child.dueDate.slice(5)}</span>}
                    <button onClick={e => { e.stopPropagation(); onDelete(child.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', padding: '2px' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div style={{ ...E.card, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {task.createdBy && <span style={{ fontSize: '11px', color: E.textMuted }}>建立：{task.createdBy}{task.createdAt ? ` · ${task.createdAt}` : ''}</span>}
        {task.updatedBy && <span style={{ fontSize: '11px', color: E.textMuted, fontStyle: 'italic' }}>最後編輯：{task.updatedBy} · {task.updatedAt}</span>}
      </div>
    </div>
  )
}

/* ================================================================
   任務列表（按工項分組 + 狀態篩選 + 進度條）
   ================================================================ */
function TaskListView({ category, subTasks, projects, workItems, employees, getProjectId, taskStats, wiStats, onClickTask, onAdd, onCycleStatus, onDelete, onToggle }) {
  const [statusFilter, setStatusFilter] = useState('全部')
  const [collapsed, setCollapsed] = useState({})

  const mainTasks = useMemo(() => subTasks.filter(t => !t.parentId), [subTasks])

  const categoryTasks = useMemo(() =>
    mainTasks.filter(t => t.category === category)
  , [mainTasks, category])

  const filtered = useMemo(() =>
    statusFilter === '全部' ? categoryTasks : categoryTasks.filter(t => {
      const computed = taskStats[t.id]?.computed || t.status
      return computed === statusFilter
    })
  , [categoryTasks, statusFilter, taskStats])

  // 按案件 → 工項分組
  const grouped = useMemo(() => {
    const projMap = new Map()
    for (const t of filtered) {
      const pid = getProjectId(t)
      if (!projMap.has(pid)) projMap.set(pid, new Map())
      const wiMap = projMap.get(pid)
      const wiId = t.workItemId || '_none'
      if (!wiMap.has(wiId)) wiMap.set(wiId, [])
      wiMap.get(wiId).push(t)
    }
    return [...projMap.entries()].map(([pid, wiMap]) => ({
      project: projects.find(p => p.id === pid) || { id: pid, name: pid, color: '#888' },
      workItemGroups: [...wiMap.entries()].map(([wiId, tasks]) => ({
        workItem: workItems.find(w => w.id === wiId) || { id: wiId, title: '未指定工項' },
        tasks,
      })),
    }))
  }, [filtered, projects, workItems, getProjectId])

  const toggleCollapse = (id) => setCollapsed(p => ({ ...p, [id]: !p[id] }))

  // 狀態計數用 computed status
  const countByStatus = useCallback((s) => {
    if (s === '全部') return categoryTasks.length
    return categoryTasks.filter(t => (taskStats[t.id]?.computed || t.status) === s).length
  }, [categoryTasks, taskStats])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 狀態篩選 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {['全部', ...STATUS_OPTIONS].map(s => {
          const active = statusFilter === s
          const count = countByStatus(s)
          return (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '500',
              cursor: 'pointer', border: 'none',
              backgroundColor: active ? E.green : '#fdfaf5',
              color: active ? '#f2f7f0' : E.textSecond,
              boxShadow: active ? 'none' : '0 1px 3px rgba(60,30,0,0.1)',
            }}>
              {s} <span style={{ opacity: 0.6 }}>({count})</span>
            </button>
          )
        })}
        <div style={{ flex: 1 }} />
        <button onClick={onAdd} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', fontSize: '12px' }}>
          <Plus size={14} /> 新增{category}任務
        </button>
      </div>

      {grouped.length === 0 && (
        <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>
          沒有{category}任務
        </div>
      )}
      {grouped.map(({ project, workItemGroups }) => {
        const pColor = project.color || '#888'
        const totalTasks = workItemGroups.reduce((sum, g) => sum + g.tasks.length, 0)
        return (
          <div key={project.id} style={{ ...E.card, borderLeft: `4px solid ${pColor}`, padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: pColor, flexShrink: 0 }} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: E.textPrimary }}>
                {project.id.replace('_sl', '')} {project.name}
              </span>
              <span style={{ fontSize: '11px', color: E.textMuted }}>({totalTasks})</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {workItemGroups.map(({ workItem, tasks }) => {
                const isCollapsed = collapsed[workItem.id]
                const ws = wiStats[workItem.id]
                const wiSt = ws ? STATUS[ws.computed] || { bg: '#eee', color: '#666' } : null
                return (
                  <div key={workItem.id}>
                    <div onClick={() => toggleCollapse(workItem.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px',
                        borderRadius: '8px', cursor: 'pointer', backgroundColor: '#f8f5f0', marginBottom: isCollapsed ? 0 : '6px' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f2ede5'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8f5f0'}>
                      {isCollapsed ? <ChevronRight size={13} color={E.textMuted} /> : <ChevronDown size={13} color={E.textMuted} />}
                      <span style={{ fontSize: '12px', fontWeight: '600', color: E.textSecond }}>{workItem.title}</span>
                      {ws && <span style={{ ...E.chip(wiSt.bg, wiSt.color), fontSize: '9px', padding: '1px 6px' }}>{ws.computed}</span>}
                      <span style={{ fontSize: '10px', color: E.textMuted, marginLeft: 'auto' }}>({tasks.length})</span>
                    </div>

                    {!isCollapsed && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingLeft: '12px', overflowX: 'auto' }}>
                        {tasks.map(task => {
                          const ts = taskStats[task.id]
                          const computed = ts?.computed || task.status
                          const cst = STATUS[computed] || { bg: '#eee', color: '#666' }
                          return (
                            <div key={task.id} style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '9px 12px', borderRadius: '10px',
                              backgroundColor: '#faf7f2', border: '1px solid #ede5d8',
                              cursor: 'pointer', transition: 'background-color 0.1s',
                            }}
                            onClick={() => onClickTask(task)}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f0e8'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#faf7f2'}>
                              <button onClick={e => { e.stopPropagation(); onToggle(task) }}
                                style={{
                                  width: 18, height: 18, borderRadius: '50%',
                                  border: `2px solid ${computed === '完成' ? E.green : '#c8b8a0'}`,
                                  backgroundColor: computed === '完成' ? E.green : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', flexShrink: 0,
                                }}>
                                {computed === '完成' && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                              </button>
                              <span style={{
                                flex: 1, fontSize: '13px', fontWeight: '500',
                                color: computed === '完成' ? E.textMuted : E.textPrimary,
                                textDecoration: computed === '完成' ? 'line-through' : 'none',
                              }}>{task.title}</span>
                              {ts && ts.total > 0 && (
                                <span style={{ fontSize: '10px', color: E.textMuted, backgroundColor: '#ede5d8', borderRadius: '4px', padding: '1px 6px' }}>
                                  {ts.done}/{ts.total}
                                </span>
                              )}
                              <button onClick={e => { e.stopPropagation(); onCycleStatus(task) }}
                                style={{ ...E.chip(cst.bg, cst.color), fontSize: '10px', cursor: 'pointer', border: 'none', transition: 'opacity 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                {computed}
                              </button>
                              {task.assignee && <span style={{ fontSize: '11px', color: E.textMuted, flexShrink: 0 }}>{task.assignee}</span>}
                              {task.dueDate && <span style={{ fontSize: '11px', color: E.textMuted, flexShrink: 0 }}>{task.dueDate.slice(5)}</span>}
                              <button onClick={e => { e.stopPropagation(); onDelete(task.id) }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', padding: '2px' }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================
   主元件
   ================================================================ */
export default function Design() {
  const { data, addItem, updateItem, deleteItem, logEdit } = useApp()
  const { currentUser } = useAuth()
  const mob = useIsMobile()

  const [topTab, setTopTab] = useState('總覽')
  const [taskStack, setTaskStack] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addCategory, setAddCategory] = useState('設計')
  const [addParent, setAddParent] = useState(null)

  const navigate = useNavigate()
  const subTasks = data.subTasks || []
  const projects = data.projects || []
  const employees = data.employees || []
  const workItems = data.workItems || []

  const { getProjectId, taskStats, wiStats, projStats } = useStats(subTasks, workItems)

  const [newTask, setNewTask] = useState(EMPTY_DESIGN)
  function set(key, val) { setNewTask(p => ({ ...p, [key]: val })) }

  function setWorkItemId(wiId) {
    setNewTask(p => ({ ...p, workItemId: wiId }))
  }

  function handleAdd() {
    if (!newTask.title.trim()) return
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    addItem('subTasks', {
      id: Date.now(), ...newTask,
      createdBy: currentUser?.name || currentUser?.username || '未知',
      createdAt: now,
    })
    setNewTask(addCategory === '設計' ? EMPTY_DESIGN : EMPTY_EXEC)
    setAddParent(null)
    setShowAdd(false)
  }

  function openAdd(cat) {
    setAddCategory(cat)
    setAddParent(null)
    setNewTask(cat === '設計' ? { ...EMPTY_DESIGN } : { ...EMPTY_EXEC })
    setShowAdd(true)
  }

  function openAddChild(parentTask) {
    setAddCategory(parentTask.category)
    setAddParent(parentTask)
    const empty = parentTask.category === '設計' ? { ...EMPTY_DESIGN } : { ...EMPTY_EXEC }
    setNewTask({ ...empty, workItemId: parentTask.workItemId, parentId: parentTask.id, category: parentTask.category })
    setShowAdd(true)
  }

  function pushTask(task) { setTaskStack(prev => [...prev, task]) }
  function popTask() { setTaskStack(prev => prev.slice(0, -1)) }
  function backToList() { setTaskStack([]) }

  const workItemsByProject = useMemo(() => {
    const map = new Map()
    for (const wi of workItems) {
      if (!map.has(wi.projectId)) map.set(wi.projectId, [])
      map.get(wi.projectId).push(wi)
    }
    return map
  }, [workItems])

  // 詳細頁
  const selectedTask = taskStack.length > 0 ? taskStack[taskStack.length - 1] : null
  if (selectedTask) {
    const task = subTasks.find(t => t.id === selectedTask.id) || selectedTask
    return (
      <SubTaskDetail
        task={task}
        allSubTasks={subTasks}
        onBack={popTask}
        onBackToList={backToList}
        projects={projects}
        workItems={workItems}
        getProjectId={getProjectId}
        taskStats={taskStats}
        onClickChild={child => pushTask(child)}
        onAddChild={parentTask => openAddChild(parentTask)}
        onToggle={t => updateItem('subTasks', t.id, { status: t.status === '完成' ? '進行中' : '完成' })}
        onCycleStatus={t => updateItem('subTasks', t.id, { status: nextStatus(t.status) })}
        onDelete={id => deleteItem('subTasks', id)}
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>執行追蹤</h1>

      {/* 頂層 Tab */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: E.sandLight, borderRadius: '12px', padding: '4px', alignSelf: 'flex-start', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {TOP_TABS.map(tab => (
          <button key={tab} onClick={() => setTopTab(tab)} style={{
            padding: '8px 20px', borderRadius: '9px', fontSize: '13px', fontWeight: topTab === tab ? '600' : '500',
            backgroundColor: topTab === tab ? '#fff' : 'transparent',
            color: topTab === tab ? E.textPrimary : E.textMuted,
            border: 'none', cursor: 'pointer',
            boxShadow: topTab === tab ? '0 1px 4px rgba(60,30,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* 總覽 */}
      {topTab === '總覽' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', fontSize: '11px', color: E.textMuted }}>
            {Object.entries(STATUS_DOT).map(([label, color]) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
          {projects.filter(p => p.status !== '結案' && workItems.some(wi => wi.projectId === p.id)).map(proj => (
            <ProjectOverviewCard
              key={proj.id}
              project={proj}
              workItems={workItems}
              subTasks={subTasks}
              wiStats={wiStats}
              projStats={projStats}
              taskStats={taskStats}
              onClickTask={task => pushTask(task)}
              onClickProject={pid => navigate(`/projects?detail=${pid}&tab=workItems`)}
              mob={mob}
            />
          ))}
        </div>
      )}

      {/* 設計任務 */}
      {topTab === '設計任務' && (
        <TaskListView
          category="設計"
          subTasks={subTasks} projects={projects} workItems={workItems} employees={employees}
          getProjectId={getProjectId} taskStats={taskStats} wiStats={wiStats}
          onClickTask={task => pushTask(task)}
          onAdd={() => openAdd('設計')}
          onCycleStatus={task => updateItem('subTasks', task.id, { status: nextStatus(task.status) })}
          onDelete={id => deleteItem('subTasks', id)}
          onToggle={task => updateItem('subTasks', task.id, { status: task.status === '完成' ? '進行中' : '完成' })}
        />
      )}

      {/* 執行任務 */}
      {topTab === '執行任務' && (
        <TaskListView
          category="執行"
          subTasks={subTasks} projects={projects} workItems={workItems} employees={employees}
          getProjectId={getProjectId} taskStats={taskStats} wiStats={wiStats}
          onClickTask={task => pushTask(task)}
          onAdd={() => openAdd('執行')}
          onCycleStatus={task => updateItem('subTasks', task.id, { status: nextStatus(task.status) })}
          onDelete={id => deleteItem('subTasks', id)}
          onToggle={task => updateItem('subTasks', task.id, { status: task.status === '完成' ? '進行中' : '完成' })}
        />
      )}

      {/* 新增 Modal */}
      {showAdd && (
        <Modal title={addParent ? `新增孫任務 — ${addParent.title}` : `新增${addCategory}任務`} onClose={() => { setShowAdd(false); setAddParent(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={lbl}>任務名稱 *</label>
              <input value={newTask.title} onChange={e => set('title', e.target.value)} placeholder={addParent ? '例：初稿、二稿修正、定稿' : '例：活動主視覺設計'} style={E.input} />
            </div>
            {!addParent && (
              <div style={grid2(mob)}>
                <div>
                  <label style={lbl}>所屬工項 *</label>
                  <select value={newTask.workItemId || ''} onChange={e => setWorkItemId(e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
                    <option value="">請選擇</option>
                    {[...workItemsByProject.entries()].map(([pid, wis]) => {
                      const proj = projects.find(p => p.id === pid)
                      return (
                        <optgroup key={pid} label={proj ? `${proj.id.replace('_sl', '')} ${proj.name}` : pid}>
                          {wis.map(wi => <option key={wi.id} value={wi.id}>{wi.title}</option>)}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
                <div>
                  <label style={lbl}>負責人</label>
                  <select value={newTask.assignee} onChange={e => set('assignee', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
                    <option value="">請選擇</option>
                    {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                  </select>
                </div>
              </div>
            )}
            {addParent && (
              <div>
                <label style={lbl}>負責人</label>
                <select value={newTask.assignee} onChange={e => set('assignee', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">請選擇</option>
                  {employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                </select>
              </div>
            )}
            <div style={grid2(mob)}>
              <div>
                <label style={lbl}>截止日期</label>
                <input type="date" value={newTask.dueDate} onChange={e => set('dueDate', e.target.value)} style={E.input} />
              </div>
              <div>
                <label style={lbl}>狀態</label>
                <select value={newTask.status} onChange={e => set('status', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {addCategory === '設計' && (
              <>
                <div style={grid2(mob)}>
                  <div>
                    <label style={lbl}>設計類型</label>
                    <select value={newTask.type || ''} onChange={e => set('type', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
                      <option value="">請選擇</option>
                      {DESIGN_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>尺寸規格</label>
                    <input value={newTask.size || ''} onChange={e => set('size', e.target.value)} placeholder="A3直、1080×1080px" style={E.input} />
                  </div>
                </div>
                <div style={grid2(mob)}>
                  <div>
                    <label style={lbl}>使用目的</label>
                    <input value={newTask.purpose || ''} onChange={e => set('purpose', e.target.value)} style={E.input} />
                  </div>
                  <div>
                    <label style={lbl}>數量</label>
                    <input value={newTask.quantity || ''} onChange={e => set('quantity', e.target.value)} style={E.input} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>文字內容</label>
                  <textarea value={newTask.textContent || ''} onChange={e => set('textContent', e.target.value)} rows={3} style={{ ...E.input, resize: 'vertical' }} />
                </div>
              </>
            )}
            {addCategory === '執行' && (
              <>
                <div style={grid2(mob)}>
                  <div>
                    <label style={lbl}>地點</label>
                    <input value={newTask.location || ''} onChange={e => set('location', e.target.value)} placeholder="恒春古城" style={E.input} />
                  </div>
                  <div>
                    <label style={lbl}>配合廠商</label>
                    <input value={newTask.vendor || ''} onChange={e => set('vendor', e.target.value)} style={E.input} />
                  </div>
                </div>
                <div>
                  <label style={lbl}>所需物資 / 設備</label>
                  <input value={newTask.materials || ''} onChange={e => set('materials', e.target.value)} placeholder="展板、燈具、音響設備" style={E.input} />
                </div>
              </>
            )}
            <div>
              <label style={lbl}>備註</label>
              <input value={newTask.note} onChange={e => set('note', e.target.value)} style={E.input} />
            </div>
          </div>
          <button onClick={handleAdd} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}

    </div>
  )
}

const lbl = { fontSize: '12px', color: '#7a6050', display: 'block', marginBottom: '4px' }
const grid2 = (mob) => ({ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' })
