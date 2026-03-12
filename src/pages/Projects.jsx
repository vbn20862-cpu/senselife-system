import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, ArrowLeft, Trash2, FileText, ExternalLink, Pencil } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS } from '../styles/earth'

/* ══════════ 常數 ══════════ */
const STATUS_OPTIONS  = ['企劃中', '執行中', '結案', '長期', '暫停', '提案中']
const TASK_STATUS     = ['待開始', '進行中', '完成', '暫停']
const TASK_TYPES      = ['設計', '行銷', '行政', '採購', '活動']
const PRIORITIES      = ['高', '中', '低']
const HEALTH_OPTS     = ['正常', '延遲', '危險']
const DEFAULT_PHASES  = ['開案', '執行', '結案']
const COLORS          = ['#4d8843', '#8f5b38', '#c89a62', '#5a7a9a', '#8a5890', '#c04040', '#3a8a7a', '#8a8030']
const DEFAULT_TYPES   = ['展覽', '活動', '教育', '市集', '行銷', '其他']

const TYPE_COLORS = {
  '展覽': '#4d8843', '活動': '#c89a62', '教育': '#5a7a9a',
  '市集': '#8f5b38', '行銷': '#8a5890', '其他': '#9a8a7a',
}
const TASK_STYLE = {
  '待開始': { color: '#6a5a4a', bg: '#ece8e4' },
  '進行中': { color: '#305080', bg: '#e0e8f0' },
  '完成':   { color: '#2e6040', bg: '#e4f0e8' },
  '暫停':   { color: '#8a3020', bg: '#f5e4e0' },
}
const PRIORITY_STYLE = {
  '高': { color: '#c04030', bg: '#fde8e4' },
  '中': { color: '#a07020', bg: '#fdf5e0' },
  '低': { color: '#707070', bg: '#f0f0f0' },
}
const HEALTH_STYLE = {
  '正常': { emoji: '🟢', color: '#3a6d31', bg: '#edf2ea' },
  '延遲': { emoji: '🟡', color: '#a07020', bg: '#fdf5e0' },
  '危險': { emoji: '🔴', color: '#c04030', bg: '#fde8e4' },
}
const PRIORITY_ORDER = { '高': 0, '中': 1, '低': 2 }

function statusChip(status) {
  const s = STATUS[status] || { bg: '#eee', color: '#666' }
  return { display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: s.bg, color: s.color }
}
function daysLeft(deadline) {
  if (!deadline) return null
  return Math.ceil((new Date(deadline) - new Date()) / 86400000)
}
function getBudgetWarning(pct) {
  if (pct >= 90) return { emoji: '🔴', color: '#c04030', barColor: '#c04030' }
  if (pct >= 70) return { emoji: '🟡', color: '#a07020', barColor: '#c89040' }
  return { emoji: '🟢', color: '#3a6d31', barColor: '#4d8843' }
}

/* ══════════ 列表卡片 ══════════ */
function ProjectCard({ project, onClick }) {
  const { data } = useApp()
  const spent = data.expenses.filter(e => e.project === project.id && e.direction !== '稅抵用').reduce((s, e) => s + (e.amount || 0), 0)
  const cA = Number(project.contractAmount) || 0
  const dA = Number(project.deductionAmount) || 0
  const effectiveBudget = cA > 0 ? cA - dA : Number(project.budget) || 0
  const pct = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : 0
  const taskCount = (data.workItems || []).filter(w => w.projectId === project.id).length
  const dl = daysLeft(project.deadline)
  const bw = getBudgetWarning(pct)
  const health = project.health
  const hs = health ? HEALTH_STYLE[health] : null
  const dotColor = TYPE_COLORS[project.type] || project.color

  return (
    <div onClick={onClick} style={{ ...E.card, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(60,30,0,0.16)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = E.card.boxShadow; e.currentTarget.style.transform = 'none' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dotColor, marginTop: '5px', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
          <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.client || '—'}</div>
          <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {project.type && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', backgroundColor: `${dotColor}22`, color: dotColor, fontWeight: '600' }}>
                {project.type}
              </span>
            )}
            <span style={{ ...statusChip(project.status), fontSize: '10px', padding: '1px 7px' }}>{project.status}</span>
            {hs && health !== '正常' && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', backgroundColor: hs.bg, color: hs.color, fontWeight: '600' }}>
                {hs.emoji} {health}
              </span>
            )}
          </div>
        </div>
      </div>

      {effectiveBudget > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: E.textPrimary }}>NT${spent.toLocaleString()}</span>
            <span style={{ fontSize: '11px', color: E.textMuted }}>
              / NT${effectiveBudget.toLocaleString()}
              <span style={{ marginLeft: '4px', fontWeight: '700', color: bw.color }}>{bw.emoji} {pct.toFixed(1)}%</span>
            </span>
          </div>
          <div style={{ height: '5px', backgroundColor: '#ede5d8', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '999px', backgroundColor: bw.barColor, width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px', flexWrap: 'wrap' }}>
        {dl !== null && (
          <span style={{ color: dl < 0 ? '#c04030' : dl <= 30 ? '#a07020' : E.textMuted }}>
            {dl < 0 ? `超期 ${Math.abs(dl)} 天` : dl === 0 ? '今日截止！' : `剩 ${dl} 天`}
          </span>
        )}
        {taskCount > 0 && <span style={{ color: E.textMuted }}>工項 {taskCount}</span>}
      </div>
    </div>
  )
}

/* ══════════ 案件詳細 ══════════ */
function ProjectDetail({ project, onBack }) {
  const { data, updateItem, deleteItem, addItem, update } = useApp()
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('tasks')

  // 編輯 Modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm]           = useState({})
  const [showAddType, setShowAddType]     = useState(false)
  const [newTypeInput, setNewTypeInput]   = useState('')

  // 工項
  const [showAddTask, setShowAddTask]     = useState(false)
  const [newTask, setNewTask]             = useState({ title: '', assignee: '', status: '待開始', dueDate: '', note: '', taskType: '', priority: '中' })
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskVals, setEditTaskVals]   = useState({})

  // Checklist
  const [activePhase, setActivePhase]   = useState(0)
  const [newCheckItem, setNewCheckItem] = useState('')

  // 文件
  const [newDoc, setNewDoc]           = useState({ title: '', url: '' })
  const [showDocForm, setShowDocForm] = useState(false)

  // 會議記錄
  const [newMeeting, setNewMeeting]             = useState({ date: '', summary: '', decisions: '' })
  const [showMeetingForm, setShowMeetingForm]   = useState(false)

  /* ── 計算 ── */
  const projectTypes  = data.projectTypes || DEFAULT_TYPES
  const phases        = project.checklistPhases || DEFAULT_PHASES
  const workItems     = (data.workItems || [])
    .filter(w => w.projectId === project.id)
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
  const allChecklists = data.projectDocs.filter(d => d.type === 'checklist' && d.project === project.id)
  const phaseItems    = phases.map((_, i) => allChecklists.filter(d => (d.phase ?? 0) === i))
  const phasePcts     = phaseItems.map(items => items.length === 0 ? 0 : Math.round(items.filter(i => i.done).length / items.length * 100))
  const docs          = data.projectDocs.filter(d => d.type === 'doc'       && d.project === project.id)
  const meetings      = data.meetings.filter(m => m.project === project.id)

  const spent          = data.expenses.filter(e => e.project === project.id && e.direction !== '稅抵用').reduce((s, e) => s + (e.amount || 0), 0)
  const cA             = Number(project.contractAmount) || 0
  const dA             = Number(project.deductionAmount) || 0
  const effectiveBudget = cA > 0 ? cA - dA : Number(project.budget) || 0
  const pct            = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : 0
  const bw             = getBudgetWarning(pct)
  const dl             = daysLeft(project.deadline)
  const dotColor       = TYPE_COLORS[project.type] || project.color
  const hs             = HEALTH_STYLE[project.health || '正常']

  const SM = { ...E.input, padding: '7px 10px', fontSize: '13px' }

  /* ── 編輯 Modal 函式 ── */
  function openEdit() {
    setEditForm({
      name:             project.name || '',
      client:           project.client || '',
      manager:          project.manager || '',
      type:             project.type || '',
      health:           project.health || '正常',
      status:           project.status,
      deadline:         project.deadline || '',
      note:             project.note || '',
      color:            project.color,
      checklistPhases:  project.checklistPhases ? [...project.checklistPhases] : [...DEFAULT_PHASES],
      contractAmount:   project.contractAmount || '',
      deductionAmount:  project.deductionAmount || '',
      budget:           project.budget || '',
    })
    setShowEditModal(true)
  }

  function saveEdit() {
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const autoColor = TYPE_COLORS[editForm.type] || editForm.color
    updateItem('projects', project.id, {
      name:             editForm.name,
      client:           editForm.client,
      manager:          editForm.manager,
      type:             editForm.type,
      health:           editForm.health,
      status:           editForm.status,
      deadline:         editForm.deadline,
      note:             editForm.note,
      color:            autoColor,
      checklistPhases:  editForm.checklistPhases,
      contractAmount:   Number(editForm.contractAmount) || 0,
      deductionAmount:  Number(editForm.deductionAmount) || 0,
      budget:           Number(editForm.budget) || 0,
      updatedBy:        currentUser?.name || currentUser?.username || '未知',
      updatedAt:        now,
    })
    setShowEditModal(false)
  }

  function addProjectType() {
    const t = newTypeInput.trim()
    if (!t || projectTypes.includes(t)) return
    update('projectTypes', [...projectTypes, t])
    setEditForm(p => ({ ...p, type: t }))
    setNewTypeInput('')
    setShowAddType(false)
  }

  const TABS = [
    { key: 'tasks',     label: '工項',      count: workItems.length },
    { key: 'checklist', label: 'Checklist', count: allChecklists.length },
    { key: 'docs',      label: '文件',      count: docs.length },
    { key: 'meetings',  label: '會議記錄',  count: meetings.length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* 頂部列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={14} />返回列表
        </button>
        <button onClick={() => { if (window.confirm(`確定刪除「${project.name}」案件？`)) { deleteItem('projects', project.id); onBack() } }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c04030', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Trash2 size={13} />刪除案件
        </button>
      </div>

      {/* ── 專案總覽卡片（唯讀）── */}
      <div style={E.card}>
        {/* 標題 + 標籤列 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: dotColor, flexShrink: 0 }} />
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>{project.name}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {project.type && (
                <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', backgroundColor: `${dotColor}22`, color: dotColor, fontWeight: '600' }}>
                  {project.type}
                </span>
              )}
              <span style={statusChip(project.status)}>{project.status}</span>
              <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '999px', backgroundColor: hs.bg, color: hs.color, fontWeight: '600' }}>
                {hs.emoji} {project.health || '正常'}
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: E.coffee, backgroundColor: '#f5ede0', padding: '2px 8px', borderRadius: '6px' }}>
                {project.code || project.id}
              </span>
            </div>
          </div>
          <button onClick={openEdit} style={{ ...E.btnGhost, display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, fontSize: '13px' }}>
            <Pencil size={13} />編輯
          </button>
        </div>

        {/* 資訊格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 24px', marginBottom: effectiveBudget > 0 ? '16px' : '0' }}>
          {project.client && (
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>委託單位</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{project.client}</div>
            </div>
          )}
          {project.manager && (
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>負責人</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{project.manager}</div>
            </div>
          )}
          {project.deadline && (
            <div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>截止日期</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>
                {project.deadline}
                {dl !== null && (
                  <span style={{ marginLeft: '5px', fontSize: '11px', fontWeight: '500', color: dl < 0 ? '#c04030' : dl <= 30 ? '#a07020' : E.textMuted }}>
                    （{dl < 0 ? `超期 ${Math.abs(dl)} 天` : dl === 0 ? '今日截止' : `剩 ${dl} 天`}）
                  </span>
                )}
              </div>
            </div>
          )}
          {project.note && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '11px', color: E.textMuted, marginBottom: '2px' }}>備註</div>
              <div style={{ fontSize: '13px', color: E.textSecond }}>{project.note}</div>
            </div>
          )}
        </div>

        {/* 預算區塊 */}
        {effectiveBudget > 0 && (
          <div style={{ borderTop: `1px solid ${E.divider}`, paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: E.textSecond }}>預算使用</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: bw.color }}>{bw.emoji} {pct.toFixed(1)}%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px', marginBottom: '10px' }}>
              {[
                { label: '預算總額', value: `NT$${effectiveBudget.toLocaleString()}`, color: E.textPrimary },
                { label: '已使用',   value: `NT$${spent.toLocaleString()}`,            color: E.textPrimary },
                { label: '剩餘',     value: `NT$${(effectiveBudget - spent).toLocaleString()}`, color: pct >= 90 ? '#c04030' : pct >= 70 ? '#a07020' : E.green },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: '10px', color: E.textMuted, marginBottom: '2px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ height: '7px', backgroundColor: '#ede5d8', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '999px', backgroundColor: bw.barColor, width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* 操作記錄 */}
        {(project.createdBy || project.updatedBy) && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${E.divider}`, display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            {project.createdBy && <span style={{ fontSize: '11px', color: E.textMuted }}>建立：{project.createdBy}{project.createdAt ? ` · ${project.createdAt}` : ''}</span>}
            {project.updatedBy && <span style={{ fontSize: '11px', color: E.textMuted }}>最後修改：{project.updatedBy}{project.updatedAt ? ` · ${project.updatedAt}` : ''}</span>}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#fdfaf5', borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto' }}>
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...E.tab(tab === key), display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {label}
            {count > 0 && <span style={{ fontSize: '10px', backgroundColor: tab === key ? 'rgba(255,255,255,0.25)' : E.greenLight, color: tab === key ? '#f2f7f0' : E.green, borderRadius: '999px', padding: '1px 6px', fontWeight: '700' }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Tab 內容 */}
      <div style={E.card}>

        {/* ── 工項 ── */}
        {tab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddTask(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <Plus size={14} />新增工項
              </button>
            </div>

            {workItems.length === 0 && !showAddTask && (
              <div style={{ textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '28px' }}>
                尚無工項<br /><span style={{ fontSize: '11px' }}>點上方按鈕新增執行工項</span>
              </div>
            )}

            {/* 新增表單 */}
            {showAddTask && (
              <div style={{ backgroundColor: E.sandLight, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary }}>新增工項</div>
                <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="工項名稱 *" style={SM} />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>負責人</label>
                    <select value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))} style={{ ...SM, cursor: 'pointer', width: '100%' }}>
                      <option value="">（不指定）</option>
                      {data.employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>類型</label>
                    <select value={newTask.taskType} onChange={e => setNewTask(p => ({ ...p, taskType: e.target.value }))} style={{ ...SM, cursor: 'pointer', width: '100%' }}>
                      <option value="">——</option>
                      {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '90px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>優先級</label>
                    <select value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value }))} style={{ ...SM, cursor: 'pointer', width: '100%' }}>
                      {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>狀態</label>
                    <select value={newTask.status} onChange={e => setNewTask(p => ({ ...p, status: e.target.value }))} style={{ ...SM, cursor: 'pointer', width: '100%' }}>
                      {TASK_STATUS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '3px' }}>截止日</label>
                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} style={{ ...SM, width: '100%' }} />
                  </div>
                </div>
                <input value={newTask.note} onChange={e => setNewTask(p => ({ ...p, note: e.target.value }))} placeholder="備註" style={SM} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => {
                    if (!newTask.title.trim()) return
                    addItem('workItems', { id: Date.now(), projectId: project.id, ...newTask })
                    setNewTask({ title: '', assignee: '', status: '待開始', dueDate: '', note: '', taskType: '', priority: '中' })
                    setShowAddTask(false)
                  }} style={E.btnPrimary}>新增</button>
                  <button onClick={() => setShowAddTask(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px' }}>取消</button>
                </div>
              </div>
            )}

            {/* 工項列表 */}
            {workItems.map(task => {
              const ts = TASK_STYLE[task.status] || { color: '#666', bg: '#eee' }
              const ps = task.priority ? PRIORITY_STYLE[task.priority] : null
              const isEditing = editingTaskId === task.id
              return (
                <div key={task.id} style={{ backgroundColor: E.sandLight, borderRadius: '10px', padding: '12px 14px' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <input value={editTaskVals.title} onChange={e => setEditTaskVals(p => ({ ...p, title: e.target.value }))} style={SM} />
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <select value={editTaskVals.assignee} onChange={e => setEditTaskVals(p => ({ ...p, assignee: e.target.value }))} style={{ ...SM, flex: 1, minWidth: '120px', cursor: 'pointer' }}>
                          <option value="">（不指定）</option>
                          {data.employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                        </select>
                        <select value={editTaskVals.taskType || ''} onChange={e => setEditTaskVals(p => ({ ...p, taskType: e.target.value }))} style={{ ...SM, flex: 1, minWidth: '100px', cursor: 'pointer' }}>
                          <option value="">——</option>
                          {TASK_TYPES.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <select value={editTaskVals.priority || '中'} onChange={e => setEditTaskVals(p => ({ ...p, priority: e.target.value }))} style={{ ...SM, flex: 1, minWidth: '90px', cursor: 'pointer' }}>
                          {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                        </select>
                        <select value={editTaskVals.status} onChange={e => setEditTaskVals(p => ({ ...p, status: e.target.value }))} style={{ ...SM, flex: 1, minWidth: '100px', cursor: 'pointer' }}>
                          {TASK_STATUS.map(s => <option key={s}>{s}</option>)}
                        </select>
                        <input type="date" value={editTaskVals.dueDate} onChange={e => setEditTaskVals(p => ({ ...p, dueDate: e.target.value }))} style={{ ...SM, flex: 1, minWidth: '130px' }} />
                      </div>
                      <input value={editTaskVals.note} onChange={e => setEditTaskVals(p => ({ ...p, note: e.target.value }))} placeholder="備註" style={SM} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => { updateItem('workItems', task.id, editTaskVals); setEditingTaskId(null) }} style={E.btnPrimary}>儲存</button>
                        <button onClick={() => setEditingTaskId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px' }}>取消</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      {ps && (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '999px', backgroundColor: ps.bg, color: ps.color, fontWeight: '700', flexShrink: 0, marginTop: '2px' }}>
                          {task.priority}
                        </span>
                      )}
                      <span style={{ backgroundColor: ts.bg, color: ts.color, padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', flexShrink: 0, marginTop: '1px' }}>{task.status}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{task.title}</div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {task.taskType && <span style={{ fontSize: '11px', color: E.textSecond, backgroundColor: '#ede8de', padding: '1px 6px', borderRadius: '4px' }}>{task.taskType}</span>}
                          {task.assignee && <span style={{ fontSize: '11px', color: E.textSecond }}>👤 {task.assignee}</span>}
                          {task.dueDate  && <span style={{ fontSize: '11px', color: E.textSecond }}>📅 {task.dueDate}</span>}
                          {task.note     && <span style={{ fontSize: '11px', color: E.textMuted }}>{task.note}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => { setEditingTaskId(task.id); setEditTaskVals({ title: task.title, assignee: task.assignee || '', status: task.status, dueDate: task.dueDate || '', note: task.note || '', taskType: task.taskType || '', priority: task.priority || '中' }) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textMuted }}><Pencil size={14} /></button>
                        <button onClick={() => deleteItem('workItems', task.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Checklist（三階段）── */}
        {tab === 'checklist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 階段選擇器 */}
            <div style={{ display: 'flex', gap: '6px', borderBottom: `1px solid ${E.divider}`, paddingBottom: '12px' }}>
              {phases.map((phaseName, idx) => {
                const phasePct = phasePcts[idx]
                const isActive = activePhase === idx
                const isDone   = phasePct === 100 && phaseItems[idx].length > 0
                return (
                  <button key={idx} onClick={() => setActivePhase(idx)} style={{
                    flex: 1, padding: '10px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    backgroundColor: isActive ? E.green : isDone ? '#edf2ea' : E.sandLight,
                    color: isActive ? '#f2f7f0' : isDone ? '#3a6d31' : E.textSecond,
                    fontWeight: '600', fontSize: '12px', transition: 'all 0.15s', textAlign: 'center',
                  }}>
                    <div>{isDone && !isActive ? '✓ ' : ''}{phaseName}</div>
                    <div style={{ fontSize: '10px', fontWeight: '500', marginTop: '3px', opacity: 0.8 }}>{phasePct}%</div>
                  </button>
                )
              })}
            </div>

            {/* 當前階段項目 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {phaseItems[activePhase].length === 0 && (
                <div style={{ fontSize: '12px', color: E.textMuted, textAlign: 'center', padding: '12px' }}>
                  尚無「{phases[activePhase]}」項目
                </div>
              )}
              {phaseItems[activePhase].map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={item.done} onChange={() => updateItem('projectDocs', item.id, { done: !item.done })}
                    style={{ width: '15px', height: '15px', accentColor: E.green, cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', flex: 1, color: item.done ? E.textMuted : E.textPrimary, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                  <button onClick={() => deleteItem('projectDocs', item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>

            {/* 新增項目 */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newCheckItem.trim()) { addItem('projectDocs', { id: Date.now(), type: 'checklist', project: project.id, text: newCheckItem.trim(), done: false, phase: activePhase }); setNewCheckItem('') } }}
                placeholder={`新增「${phases[activePhase]}」項目（按 Enter）`} style={{ ...E.input, flex: 1 }} />
              <button onClick={() => { if (!newCheckItem.trim()) return; addItem('projectDocs', { id: Date.now(), type: 'checklist', project: project.id, text: newCheckItem.trim(), done: false, phase: activePhase }); setNewCheckItem('') }}
                style={{ ...E.btnPrimary, padding: '8px 14px' }}><Plus size={14} /></button>
            </div>
          </div>
        )}

        {/* ── 文件 ── */}
        {tab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {docs.length === 0 && <div style={{ fontSize: '12px', color: E.textMuted, textAlign: 'center', padding: '16px' }}>尚無文件</div>}
            {docs.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: E.sandLight, borderRadius: '8px', padding: '8px 12px' }}>
                <FileText size={13} style={{ color: E.textMuted }} />
                <span style={{ fontSize: '13px', color: E.textPrimary, flex: 1 }}>{doc.title}</span>
                {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" style={{ color: E.green }}><ExternalLink size={13} /></a>}
                <button onClick={() => deleteItem('projectDocs', doc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={12} /></button>
              </div>
            ))}
            {!showDocForm
              ? <button onClick={() => setShowDocForm(true)} style={{ ...E.btnGhost, fontSize: '12px' }}><Plus size={13} />新增文件連結</button>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={newDoc.title} onChange={e => setNewDoc(p => ({ ...p, title: e.target.value }))} placeholder="文件名稱 *" style={E.input} />
                  <input value={newDoc.url}   onChange={e => setNewDoc(p => ({ ...p, url: e.target.value }))}   placeholder="連結（可選）" style={E.input} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { if (!newDoc.title.trim()) return; addItem('projectDocs', { id: Date.now(), type: 'doc', project: project.id, ...newDoc }); setNewDoc({ title: '', url: '' }); setShowDocForm(false) }} style={E.btnPrimary}>新增</button>
                    <button onClick={() => setShowDocForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px' }}>取消</button>
                  </div>
                </div>
            }
          </div>
        )}

        {/* ── 會議記錄 ── */}
        {tab === 'meetings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {meetings.length === 0 && <div style={{ fontSize: '12px', color: E.textMuted, textAlign: 'center', padding: '16px' }}>尚無會議記錄</div>}
            {meetings.map(m => (
              <div key={m.id} style={{ backgroundColor: E.sandLight, borderRadius: '10px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '11px', color: E.textMuted }}>{m.date}</span>
                  <button onClick={() => deleteItem('meetings', m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={12} /></button>
                </div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary, marginTop: '4px' }}>{m.summary}</div>
                {m.decisions && <div style={{ fontSize: '12px', color: E.textSecond, marginTop: '4px', whiteSpace: 'pre-wrap' }}>{m.decisions}</div>}
              </div>
            ))}
            {!showMeetingForm
              ? <button onClick={() => setShowMeetingForm(true)} style={{ ...E.btnGhost, fontSize: '12px' }}><Plus size={13} />新增會議記錄</button>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input type="date" value={newMeeting.date}    onChange={e => setNewMeeting(p => ({ ...p, date: e.target.value }))}    style={E.input} />
                  <input value={newMeeting.summary}             onChange={e => setNewMeeting(p => ({ ...p, summary: e.target.value }))} placeholder="會議摘要" style={E.input} />
                  <textarea value={newMeeting.decisions}        onChange={e => setNewMeeting(p => ({ ...p, decisions: e.target.value }))} placeholder="決議事項（每行一項）" rows={3} style={{ ...E.input, resize: 'none', lineHeight: '1.5' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => { if (!newMeeting.date || !newMeeting.summary.trim()) return; addItem('meetings', { id: Date.now(), project: project.id, ...newMeeting }); setNewMeeting({ date: '', summary: '', decisions: '' }); setShowMeetingForm(false) }} style={E.btnPrimary}>新增</button>
                    <button onClick={() => setShowMeetingForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px' }}>取消</button>
                  </div>
                </div>
            }
          </div>
        )}
      </div>

      {/* ── 編輯案件 Modal ── */}
      {showEditModal && (
        <Modal title="編輯案件資訊" onClose={() => setShowEditModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* 名稱 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>案件名稱 *</label>
              <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} style={E.input} />
            </div>

            {/* 類型 + 狀態 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>專案類型</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <select value={editForm.type} onChange={e => setEditForm(p => ({ ...p, type: e.target.value, color: TYPE_COLORS[e.target.value] || p.color }))} style={{ ...E.input, cursor: 'pointer', flex: 1 }}>
                    <option value="">——</option>
                    {projectTypes.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button onClick={() => setShowAddType(v => !v)} title="新增類型"
                    style={{ ...E.btnGhost, padding: '6px 10px', flexShrink: 0, fontSize: '16px', lineHeight: 1 }}>+</button>
                </div>
                {showAddType && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <input value={newTypeInput} onChange={e => setNewTypeInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addProjectType()}
                      placeholder="新類型名稱" style={{ ...E.input, flex: 1, fontSize: '12px' }} />
                    <button onClick={addProjectType} style={{ ...E.btnPrimary, padding: '6px 12px', fontSize: '12px' }}>新增</button>
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>狀態</label>
                <select value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* 委託單位 + 負責人 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>委託單位</label>
                <input value={editForm.client} onChange={e => setEditForm(p => ({ ...p, client: e.target.value }))} style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>負責人</label>
                <select value={editForm.manager} onChange={e => setEditForm(p => ({ ...p, manager: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">——</option>
                  {data.employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                </select>
              </div>
            </div>

            {/* 健康度 + 截止日 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>健康度</label>
                <select value={editForm.health} onChange={e => setEditForm(p => ({ ...p, health: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  {HEALTH_OPTS.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>截止日期</label>
                <input type="date" value={editForm.deadline} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} style={E.input} />
              </div>
            </div>

            {/* Checklist 階段名稱 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>
                Checklist 階段名稱 <span style={{ color: E.textMuted, fontWeight: '400' }}>（可自訂）</span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(editForm.checklistPhases || DEFAULT_PHASES).map((name, i) => (
                  <input key={i} value={name}
                    onChange={e => {
                      const arr = [...(editForm.checklistPhases || DEFAULT_PHASES)]
                      arr[i] = e.target.value
                      setEditForm(p => ({ ...p, checklistPhases: arr }))
                    }}
                    style={{ ...E.input, flex: 1, fontSize: '13px' }} placeholder={DEFAULT_PHASES[i]} />
                ))}
              </div>
            </div>

            {/* 顏色 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '6px' }}>顏色標籤</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setEditForm(p => ({ ...p, color: c }))}
                    style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: editForm.color === c ? '2px solid #2c1a0e' : '2px solid transparent', transition: 'all 0.12s' }} />
                ))}
              </div>
            </div>

            {/* 備註 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <textarea value={editForm.note} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                rows={2} style={{ ...E.input, resize: 'none', width: '100%', lineHeight: '1.5', boxSizing: 'border-box' }} />
            </div>
          </div>
          <button onClick={saveEdit} disabled={!editForm.name?.trim()}
            style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0', opacity: editForm.name?.trim() ? 1 : 0.5, cursor: editForm.name?.trim() ? 'pointer' : 'not-allowed' }}>
            儲存
          </button>
        </Modal>
      )}

    </div>
  )
}

/* ══════════ 主頁面 ══════════ */
export default function Projects() {
  const { data, addItem } = useApp()
  const { currentUser } = useAuth()
  const [selectedId, setSelectedId] = useState(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '', code: '', client: '', budget: '', deadline: '', note: '',
    status: '企劃中', color: '#4d8843', type: '', manager: '', health: '正常',
  })

  const projectTypes    = data.projectTypes || DEFAULT_TYPES
  const selectedProject = data.projects.find(p => p.id === selectedId)

  function handleAdd() {
    if (!newProject.name.trim()) return
    const codeVal    = newProject.code.trim() || `PRJ_${Date.now()}`
    const now        = new Date().toISOString().slice(0, 16).replace('T', ' ')
    const autoColor  = TYPE_COLORS[newProject.type] || newProject.color
    addItem('projects', {
      id: codeVal, code: codeVal, ...newProject,
      budget: Number(newProject.budget) || 0,
      color: autoColor,
      checklistPhases: [...DEFAULT_PHASES],
      createdBy: currentUser?.name || currentUser?.username || '未知',
      createdAt: now,
    })
    setNewProject({ name: '', code: '', client: '', budget: '', deadline: '', note: '', status: '企劃中', color: '#4d8843', type: '', manager: '', health: '正常' })
    setShowAdd(false)
  }

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={() => setSelectedId(null)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>案件管理</h1>
        <button onClick={() => setShowAdd(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} />新增案件
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
        {data.projects.filter(p => p.status !== '結案').map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedId(p.id)} />)}
      </div>

      {/* 案件代碼對照表 */}
      <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${E.divider}` }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>案件代碼對照表</span>
          <span style={{ fontSize: '11px', color: E.textMuted, marginLeft: '8px' }}>供採購申請、代墊填寫時參考</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: E.sandLight }}>
              <th style={{ textAlign: 'left', padding: '8px 18px', fontSize: '11px', fontWeight: '600', color: E.textSecond, width: '160px' }}>代碼</th>
              <th style={{ textAlign: 'left', padding: '8px 18px', fontSize: '11px', fontWeight: '600', color: E.textSecond }}>案件全名</th>
              <th style={{ textAlign: 'left', padding: '8px 18px', fontSize: '11px', fontWeight: '600', color: E.textSecond }}>委託單位</th>
              <th style={{ textAlign: 'left', padding: '8px 18px', fontSize: '11px', fontWeight: '600', color: E.textSecond, width: '80px' }}>狀態</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.filter(p => p.status !== '結案').map((p, i) => {
              const c = STATUS[p.status] || { bg: '#eee', color: '#666' }
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? 'transparent' : '#faf7f2', cursor: 'pointer' }}
                  onClick={() => setSelectedId(p.id)}>
                  <td style={{ padding: '10px 18px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: E.coffee, backgroundColor: '#f5ede0', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.03em' }}>
                      {p.code || p.id}
                    </span>
                  </td>
                  <td style={{ padding: '10px 18px', fontWeight: '600', color: E.textPrimary }}>{p.name}</td>
                  <td style={{ padding: '10px 18px', color: E.textSecond }}>{p.client || '—'}</td>
                  <td style={{ padding: '10px 18px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: c.bg, color: c.color, fontWeight: '600' }}>{p.status}</span>
                  </td>
                </tr>
              )
            })}
            {data.projects.some(p => p.status === '結案') && (
              <tr style={{ borderTop: `1px solid ${E.divider}`, backgroundColor: '#f5f0ea', cursor: 'pointer' }}
                onClick={() => setShowClosed(v => !v)}>
                <td colSpan={4} style={{ padding: '8px 18px', fontSize: '12px', color: E.textMuted, userSelect: 'none' }}>
                  {showClosed ? '▲' : '▼'} 結案案件（{data.projects.filter(p => p.status === '結案').length} 個）
                </td>
              </tr>
            )}
            {showClosed && data.projects.filter(p => p.status === '結案').map((p, i) => {
              const c = STATUS[p.status] || { bg: '#eee', color: '#666' }
              return (
                <tr key={p.id} style={{ borderTop: `1px solid ${E.divider}`, backgroundColor: i % 2 === 0 ? '#fdf8f3' : '#f7f2eb', cursor: 'pointer' }}
                  onClick={() => setSelectedId(p.id)}>
                  <td style={{ padding: '10px 18px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: E.coffee, backgroundColor: '#f5ede0', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.03em' }}>
                      {p.code || p.id}
                    </span>
                  </td>
                  <td style={{ padding: '10px 18px', fontWeight: '600', color: E.textPrimary }}>{p.name}</td>
                  <td style={{ padding: '10px 18px', color: E.textSecond }}>{p.client || '—'}</td>
                  <td style={{ padding: '10px 18px' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: c.bg, color: c.color, fontWeight: '600' }}>{p.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 新增案件 Modal */}
      {showAdd && (
        <Modal title="新增案件" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>案件名稱 *</label>
              <input value={newProject.name} onChange={e => setNewProject(p => ({ ...p, name: e.target.value }))} style={E.input} placeholder="例：魯凱小米文化特展" />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>案件代碼 <span style={{ color: E.textMuted, fontWeight: '400' }}>（留空自動產生）</span></label>
              <input value={newProject.code} onChange={e => setNewProject(p => ({ ...p, code: e.target.value }))} style={E.input} placeholder="例：PW_sl" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>專案類型</label>
                <select value={newProject.type} onChange={e => setNewProject(p => ({ ...p, type: e.target.value, color: TYPE_COLORS[e.target.value] || p.color }))} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">——</option>
                  {projectTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>初始狀態</label>
                <select value={newProject.status} onChange={e => setNewProject(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>委託單位</label>
                <input value={newProject.client} onChange={e => setNewProject(p => ({ ...p, client: e.target.value }))} style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>負責人</label>
                <select value={newProject.manager} onChange={e => setNewProject(p => ({ ...p, manager: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">——</option>
                  {data.employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>核定預算 NT$</label>
                <input type="number" value={newProject.budget} onChange={e => setNewProject(p => ({ ...p, budget: e.target.value }))} style={E.input} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>截止日期</label>
                <input type="date" value={newProject.deadline} onChange={e => setNewProject(p => ({ ...p, deadline: e.target.value }))} style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '6px' }}>顏色標籤</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewProject(p => ({ ...p, color: c }))}
                    style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: newProject.color === c ? '3px solid #2c1a0e' : '3px solid transparent', transition: 'all 0.15s' }} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={handleAdd} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增案件</button>
        </Modal>
      )}
    </div>
  )
}
