import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CATEGORIES, CAT_COLOR, STATUSES, ST_STYLE, OPEN_STATUSES } from './Dispatch'
import { parseQuickAdd } from '../utils/tasks'
import { localTimestamp } from '../utils/salaryCalc'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, ArrowLeft, Trash2, ExternalLink, Pencil, Search, ChevronDown, ChevronUp, X } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS, useIsMobile } from '../styles/earth'

/* ══════════ 常數 ══════════ */
const STATUS_OPTIONS  = ['執行中', '結案', '長期', '暫停']
const TASK_STATUS     = ['待開始', '進行中', '完成', '暫停']
const TASK_TYPES      = ['設計', '行銷', '行政', '採購', '活動']
const PRIORITIES      = ['高', '中', '低']
const HEALTH_OPTS     = ['正常', '延遲', '危險']
const COLORS          = ['#4d8843', '#8f5b38', '#c89a62', '#5a7a9a', '#8a5890', '#c04040', '#3a8a7a', '#8a8030']
const DEFAULT_TYPES   = ['展覽', '活動', '教育', '市集', '行銷', '其他']
const DEFAULT_MILESTONES = ['簽約', '提企劃', '送審', '執行', '期中報告', '驗收', '結案']

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

const STATUS_FILTERS = ['全部', '執行中', '結案', '長期', '暫停']

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

function createDefaultMilestones() {
  return DEFAULT_MILESTONES.map((name, index) => ({
    id: Date.now() + index,
    name,
    date: '',
    done: false,
  }))
}

/* ══════════ 列表卡片 ══════════ */
function ProjectCard({ project, onClick }) {
  const { data } = useApp()
  const items = (data.workItems || []).filter(w => w.projectId === project.id)
  const doneCount = items.filter(w => w.status === '完成').length
  const totalCount = items.length
  const completionPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : -1
  const taskCount = totalCount
  const dl = daysLeft(project.deadline)
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
            {(() => {
              const open = (data.dispatches || []).filter(d => String(d.projectId) === String(project.id) && OPEN_STATUSES.includes(d.status))
              if (!open.length) return null
              const today = new Date().toLocaleDateString('sv-SE')
              const hasOverdue = open.some(d => d.dueDate && d.dueDate < today)
              return (
                <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', fontWeight: '700',
                  backgroundColor: hasOverdue ? '#fde0dc' : '#fef3cd', color: hasOverdue ? '#c04030' : '#8a6d1a' }}>
                  📋 交辦 {open.length} 未結{hasOverdue ? '・逾期' : ''}
                </span>
              )
            })()}
            {hs && health !== '正常' && (
              <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '999px', backgroundColor: hs.bg, color: hs.color, fontWeight: '600' }}>
                {hs.emoji} {health}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Completion percentage */}
      <div style={{ marginTop: '12px' }}>
        {completionPct >= 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: E.textSecond }}>完成度</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: completionPct === 100 ? E.green : E.textPrimary }}>{completionPct}%</span>
            </div>
            <div style={{ height: '4px', backgroundColor: '#ede5d8', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '999px', backgroundColor: completionPct === 100 ? E.green : '#c89a62', width: `${completionPct}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: E.textMuted }}>尚無工項</div>
        )}
      </div>

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
function ProjectDetail({ project, onBack, initialTab }) {
  const { data, updateItem, deleteItem, addItem, update } = useApp()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const mob = useIsMobile()
  const [tab, setTab] = useState(initialTab || 'tasks')

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

  // 交付物
  const [showDelivs, setShowDelivs] = useState({})
  const [newDelivInputs, setNewDelivInputs] = useState({})

  // 案件流程 - milestone date editing
  const [editingMilestoneDate, setEditingMilestoneDate] = useState(null)
  const [newMilestoneName, setNewMilestoneName] = useState('')
  const [showAddMilestone, setShowAddMilestone] = useState(false)
  const [editingMilestoneName, setEditingMilestoneName] = useState(null)
  const [editMilestoneNameVal, setEditMilestoneNameVal] = useState('')

  /* ── 計算 ── */
  const projectTypes  = data.projectTypes || DEFAULT_TYPES
  const milestones    = project.milestones || []

  // 舊案件自動初始化預設流程節點
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!project.milestones || project.milestones.length === 0) {
        updateItem('projects', project.id, { milestones: createDefaultMilestones() })
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const workItems = useMemo(() =>
    (data.workItems || [])
      .filter(w => w.projectId === project.id)
      .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)),
    [data.workItems, project.id])

  const doneWorkItems = workItems.filter(w => w.status === '完成').length
  const completionPct = workItems.length > 0 ? ((doneWorkItems / workItems.length) * 100).toFixed(1) : 0

  const spent = useMemo(() =>
    data.expenses.filter(e => e.project === project.id && e.direction !== '稅抵用').reduce((s, e) => s + (e.amount || 0), 0),
    [data.expenses, project.id])
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
      contractAmount:   project.contractAmount || '',
      deductionAmount:  project.deductionAmount || '',
      budget:           project.budget || '',
      driveUrl:         project.driveUrl || '',
    })
    setShowEditModal(true)
  }

  function saveEdit() {
    const now = new Date().toLocaleString('sv-SE').slice(0, 16)
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
      contractAmount:   Number(editForm.contractAmount) || 0,
      deductionAmount:  Number(editForm.deductionAmount) || 0,
      budget:           Number(editForm.budget) || 0,
      driveUrl:         editForm.driveUrl || '',
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

  /* ── Milestone 函式 ── */
  function toggleMilestone(msId) {
    const updated = milestones.map(m => m.id === msId ? { ...m, done: !m.done } : m)
    updateItem('projects', project.id, { milestones: updated })
  }

  function setMilestoneDate(msId, date) {
    const updated = milestones.map(m => m.id === msId ? { ...m, date } : m)
    updateItem('projects', project.id, { milestones: updated })
    setEditingMilestoneDate(null)
  }

  function deleteMilestone(msId) {
    const updated = milestones.filter(m => m.id !== msId)
    updateItem('projects', project.id, { milestones: updated })
  }

  function addMilestone() {
    if (!newMilestoneName.trim()) return
    const updated = [...milestones, { id: Date.now(), name: newMilestoneName.trim(), date: '', done: false }]
    updateItem('projects', project.id, { milestones: updated })
    setNewMilestoneName('')
    setShowAddMilestone(false)
  }

  function renameMilestone(msId, newName) {
    const updated = milestones.map(m => m.id === msId ? { ...m, name: newName } : m)
    updateItem('projects', project.id, { milestones: updated })
    setEditingMilestoneName(null)
  }

  function toggleDeliverable(wi, delivId) {
    const current = wi.deliverables || []
    updateItem('workItems', wi.id, { deliverables: current.map(d => d.id === delivId ? { ...d, done: !d.done } : d) })
  }
  function addDeliverable(wi, name) {
    if (!name.trim()) return
    const current = wi.deliverables || []
    updateItem('workItems', wi.id, { deliverables: [...current, { id: Date.now(), name: name.trim(), done: false }] })
    setNewDelivInputs(p => ({ ...p, [wi.id]: '' }))
  }
  function removeDeliverable(wi, delivId) {
    updateItem('workItems', wi.id, { deliverables: (wi.deliverables || []).filter(d => d.id !== delivId) })
  }

  const TABS = [
    { key: 'tasks', label: '工項', count: workItems.length },
    { key: 'flow',  label: '案件流程', count: milestones.filter(m => m.done).length + '/' + milestones.length },
    { key: 'dispatch', label: '交辦', count: (data.dispatches || []).filter(d => String(d.projectId) === String(project.id) && OPEN_STATUSES.includes(d.status)).length },
  ]

  // Find current step (first not-done)
  const currentStepIndex = milestones.findIndex(m => !m.done)

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
              <h2 style={{ fontSize: '22px', fontWeight: '700', color: E.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>{project.name}</h2>
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
        <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px 24px', marginBottom: '16px' }}>
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

        {/* 雲端資料夾連結 */}
        <div style={{ marginBottom: '16px' }}>
          {project.driveUrl ? (
            <a href={project.driveUrl} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: E.green, textDecoration: 'none', fontWeight: '600', padding: '6px 12px', backgroundColor: E.greenLight, borderRadius: '8px', transition: 'opacity 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
              <span>📁</span> 案件雲端資料夾 <ExternalLink size={12} />
            </a>
          ) : (
            <span style={{ fontSize: '12px', color: E.textMuted, fontStyle: 'italic' }}>尚未設定雲端連結</span>
          )}
        </div>

        {/* 預算區塊 - simplified */}
        {effectiveBudget > 0 && (
          <div style={{ borderTop: `1px solid ${E.divider}`, paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: E.textSecond, fontWeight: '600' }}>預算使用</span>
              <span style={{ fontSize: '12px', color: E.textPrimary }}>
                預算總額 <strong>NT${effectiveBudget.toLocaleString()}</strong>
              </span>
              <span style={{ fontSize: '12px', color: E.textPrimary }}>
                已使用 <strong>NT${spent.toLocaleString()}</strong>
              </span>
              <span style={{ fontSize: '12px', color: pct >= 90 ? '#c04030' : pct >= 70 ? '#a07020' : E.green }}>
                剩餘 <strong>NT${(effectiveBudget - spent).toLocaleString()}</strong>
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: bw.color }}>{bw.emoji} {pct.toFixed(1)}%</span>
              <div style={{ flex: 1 }} />
              <button onClick={openEdit}
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${E.divider}`, backgroundColor: 'transparent', color: E.textSecond, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Pencil size={11} /> 改預算金額
              </button>
              <button onClick={() => navigate(`/finance?tab=budget&project=${project.id}`)}
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${E.divider}`, backgroundColor: 'transparent', color: E.coffee, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                💰 看帳目明細
              </button>
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
      <div style={{ display: 'flex', gap: '4px', backgroundColor: E.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        {TABS.map(({ key, label, count }) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...E.tab(tab === key), display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {label}
            {count !== undefined && <span style={{ fontSize: '10px', backgroundColor: tab === key ? 'rgba(255,255,255,0.25)' : E.greenLight, color: tab === key ? '#f2f7f0' : E.green, borderRadius: '999px', padding: '1px 6px', fontWeight: '700' }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Tab 內容 */}
      <div style={E.card}>

        {/* ── 工項 ── */}
        {tab === 'tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>
                工項 {doneWorkItems}/{workItems.length} 完成
                {workItems.length > 0 && <span style={{ color: E.textSecond, fontWeight: '500' }}> ({completionPct}%)</span>}
              </span>
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
                    <div>
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
                        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                          <button
                            onClick={() => setShowDelivs(p => ({ ...p, [task.id]: !p[task.id] }))}
                            title="交付物 checklist"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: showDelivs[task.id] ? E.green : E.textMuted, fontWeight: '600', padding: '2px 6px', borderRadius: '6px', backgroundColor: showDelivs[task.id] ? E.greenLight : 'transparent' }}>
                            {(() => { const dv = task.deliverables || []; const done = dv.filter(d => d.done).length; return dv.length > 0 ? `✓ ${done}/${dv.length}` : '交付物' })()}
                          </button>
                          <button onClick={() => { setEditingTaskId(task.id); setEditTaskVals({ title: task.title, assignee: task.assignee || '', status: task.status, dueDate: task.dueDate || '', note: task.note || '', taskType: task.taskType || '', priority: task.priority || '中' }) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textMuted }}><Pencil size={14} /></button>
                          <button onClick={() => deleteItem('workItems', task.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {showDelivs[task.id] && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e8dece' }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: E.textSecond, marginBottom: '6px' }}>交付物 checklist</div>
                          {(task.deliverables || []).map(d => (
                            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                              <button onClick={() => toggleDeliverable(task, d.id)} style={{ width: 16, height: 16, borderRadius: '3px', border: `2px solid ${d.done ? E.green : '#c8b8a0'}`, backgroundColor: d.done ? E.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                                {d.done && <span style={{ color: '#fff', fontSize: '9px', lineHeight: 1 }}>✓</span>}
                              </button>
                              <span style={{ flex: 1, fontSize: '12px', color: d.done ? E.textMuted : E.textPrimary, textDecoration: d.done ? 'line-through' : 'none' }}>{d.name}</span>
                              <button onClick={() => removeDeliverable(task, d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', padding: '2px' }}><X size={11} /></button>
                            </div>
                          ))}
                          {(task.deliverables || []).length === 0 && (
                            <div style={{ fontSize: '11px', color: E.textMuted, fontStyle: 'italic', marginBottom: '4px' }}>尚無交付物</div>
                          )}
                          <input
                            value={newDelivInputs[task.id] || ''}
                            onChange={e => setNewDelivInputs(p => ({ ...p, [task.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') addDeliverable(task, newDelivInputs[task.id] || '') }}
                            placeholder="輸入交付物名稱，Enter 新增"
                            style={{ ...SM, marginTop: '6px', fontSize: '12px', width: '100%' }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── 案件流程 (Project Flow) ── */}
        {tab === 'dispatch' && <ProjectDispatchBlock project={project} />}

        {tab === 'flow' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>案件流程</span>
              <button onClick={() => setShowAddMilestone(true)} style={{ ...E.btnGhost, fontSize: '12px' }}>
                <Plus size={13} />新增節點
              </button>
            </div>

            {milestones.length === 0 && !showAddMilestone && (
              <div style={{ textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '28px' }}>
                尚無流程節點
              </div>
            )}

            {/* Horizontal Timeline */}
            {milestones.length > 0 && (
              <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: milestones.length * 110, padding: '10px 0' }}>
                  {milestones.map((ms, idx) => {
                    const isDone = ms.done
                    const isCurrent = idx === currentStepIndex
                    const nodeColor = isDone ? '#4d8843' : isCurrent ? '#c89a62' : '#d8cbb8'
                    const nodeSize = isCurrent ? 28 : 22
                    return (
                      <div key={ms.id} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: '100px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
                          {/* Line before */}
                          {idx > 0 && (
                            <div style={{
                              position: 'absolute', top: isCurrent ? '14px' : '11px', right: '50%', left: '-50%',
                              height: '3px', backgroundColor: milestones[idx - 1].done ? '#4d8843' : '#d8cbb8', zIndex: 0,
                            }} />
                          )}
                          {/* Node circle */}
                          <div
                            onClick={() => toggleMilestone(ms.id)}
                            style={{
                              width: nodeSize + 'px', height: nodeSize + 'px', borderRadius: '50%',
                              backgroundColor: isDone ? nodeColor : 'transparent',
                              border: `3px solid ${nodeColor}`,
                              cursor: 'pointer', zIndex: 1, position: 'relative',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s',
                              boxShadow: isCurrent ? `0 0 0 4px ${nodeColor}33` : 'none',
                            }}
                          >
                            {isDone && <span style={{ color: '#fff', fontSize: '12px', fontWeight: '700' }}>✓</span>}
                          </div>
                          {/* Name */}
                          <div style={{ marginTop: '8px', textAlign: 'center', position: 'relative' }}>
                            {editingMilestoneName === ms.id ? (
                              <input
                                value={editMilestoneNameVal}
                                onChange={e => setEditMilestoneNameVal(e.target.value)}
                                onBlur={() => { renameMilestone(ms.id, editMilestoneNameVal) }}
                                onKeyDown={e => { if (e.key === 'Enter') renameMilestone(ms.id, editMilestoneNameVal); if (e.key === 'Escape') setEditingMilestoneName(null) }}
                                autoFocus
                                style={{ ...E.input, fontSize: '11px', padding: '2px 4px', width: '80px', textAlign: 'center' }}
                              />
                            ) : (
                              <div
                                onClick={e => { e.stopPropagation(); setEditingMilestoneName(ms.id); setEditMilestoneNameVal(ms.name) }}
                                style={{
                                  fontSize: '12px', fontWeight: isCurrent ? '700' : '600',
                                  color: isDone ? '#4d8843' : isCurrent ? '#c89a62' : E.textSecond,
                                  cursor: 'pointer', whiteSpace: 'nowrap',
                                }}
                                title="點擊編輯名稱"
                              >
                                {ms.name}
                              </div>
                            )}
                          </div>
                          {/* Date */}
                          <div style={{ marginTop: '4px', textAlign: 'center' }}>
                            {editingMilestoneDate === ms.id ? (
                              <input
                                type="date"
                                value={ms.date || ''}
                                onChange={e => setMilestoneDate(ms.id, e.target.value)}
                                onBlur={() => setEditingMilestoneDate(null)}
                                autoFocus
                                style={{ ...E.input, fontSize: '10px', padding: '2px 4px', width: '110px' }}
                              />
                            ) : (
                              <div
                                onClick={e => { e.stopPropagation(); setEditingMilestoneDate(ms.id) }}
                                style={{ fontSize: '10px', color: ms.date ? E.textMuted : '#d0c8b8', cursor: 'pointer' }}
                                title="點擊設定日期"
                              >
                                {ms.date || '設定日期'}
                              </div>
                            )}
                          </div>
                          {/* Delete button */}
                          <button
                            onClick={e => { e.stopPropagation(); deleteMilestone(ms.id) }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', marginTop: '4px', padding: '2px', lineHeight: 1 }}
                            title="刪除節點"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Add milestone form */}
            {showAddMilestone && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  value={newMilestoneName}
                  onChange={e => setNewMilestoneName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addMilestone() }}
                  placeholder="新節點名稱"
                  autoFocus
                  style={{ ...E.input, flex: 1, fontSize: '13px' }}
                />
                <button onClick={addMilestone} style={{ ...E.btnPrimary, padding: '8px 14px' }}>新增</button>
                <button onClick={() => { setShowAddMilestone(false); setNewMilestoneName('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px' }}>取消</button>
              </div>
            )}
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
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
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

            {/* 預算金額 */}
            <div style={{ borderTop: `1px solid ${E.divider}`, paddingTop: '12px', marginTop: '2px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: E.textPrimary, marginBottom: '8px' }}>💰 預算金額</div>
              <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>標案總金額</label>
                  <input type="number" value={editForm.contractAmount} onChange={e => setEditForm(p => ({ ...p, contractAmount: e.target.value }))} placeholder="0" style={E.input} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>預扣金額（30%）</label>
                  <input type="number" value={editForm.deductionAmount} onChange={e => setEditForm(p => ({ ...p, deductionAmount: e.target.value }))} placeholder="0" style={E.input} />
                </div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>
                  預算金額（沒有標案時才用，直接填預算上限）
                </label>
                <input type="number" value={editForm.budget} onChange={e => setEditForm(p => ({ ...p, budget: e.target.value }))} placeholder="0" style={E.input} />
              </div>
              <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '6px', lineHeight: 1.5, backgroundColor: E.sandLight, padding: '6px 10px', borderRadius: '6px' }}>
                ℹ️ 顯示用「有效預算」計算邏輯：<br/>
                · 有填「標案總金額」→ <strong>有效預算 = 標案總金額 − 預扣金額</strong><br/>
                · 沒填標案 → 用「預算金額」
                {(() => {
                  const c = Number(editForm.contractAmount) || 0
                  const d = Number(editForm.deductionAmount) || 0
                  const b = Number(editForm.budget) || 0
                  const eff = c > 0 ? c - d : b
                  return <><br/>目前有效預算：<strong style={{ color: E.coffee }}>NT${eff.toLocaleString()}</strong></>
                })()}
              </div>
            </div>

            {/* 雲端資料夾連結 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>雲端資料夾連結</label>
              <input value={editForm.driveUrl} onChange={e => setEditForm(p => ({ ...p, driveUrl: e.target.value }))} style={E.input} placeholder="https://drive.google.com/..." />
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
  const { data, addItem, batchUpdate } = useApp()
  const { currentUser, isAdmin } = useAuth()
  const mob = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState(searchParams.get('detail') || null)
  const [initialTab] = useState(searchParams.get('tab') === 'workItems' ? 'tasks' : null)
  const [showAdd, setShowAdd]       = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [statusFilter, setStatusFilter] = useState('全部')
  const [searchText, setSearchText] = useState('')
  const [codeTableOpen, setCodeTableOpen] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '', code: '', client: '', budget: '', deadline: '', note: '',
    status: '執行中', color: '#4d8843', type: '', manager: '', health: '正常',
  })

  const projectTypes    = data.projectTypes || DEFAULT_TYPES
  const selectedProject = data.projects.find(p => p.id === selectedId)

  /* ── 統計 ── */
  const statusCounts = useMemo(() => {
    const counts = {}
    data.projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1 })
    return counts
  }, [data.projects])

  /* ── 過濾 ── */
  const filteredProjects = useMemo(() => {
    const searchLower = searchText.toLowerCase()
    return data.projects.filter(p => {
      if (statusFilter === '全部') {
        if (p.status === '結案') return false
      } else {
        if (p.status !== statusFilter) return false
      }
      if (searchText) {
        const nameMatch = (p.name || '').toLowerCase().includes(searchLower)
        const clientMatch = (p.client || '').toLowerCase().includes(searchLower)
        const codeMatch = (p.code || p.id || '').toLowerCase().includes(searchLower)
        if (!nameMatch && !clientMatch && !codeMatch) return false
      }
      return true
    })
  }, [data.projects, statusFilter, searchText])

  function handleAdd() {
    if (!newProject.name.trim()) return
    const codeVal    = newProject.code.trim() || `PRJ_${Date.now()}`
    const now        = new Date().toLocaleString('sv-SE').slice(0, 16)
    const autoColor  = TYPE_COLORS[newProject.type] || newProject.color
    addItem('projects', {
      id: codeVal, code: codeVal, ...newProject,
      budget: Number(newProject.budget) || 0,
      color: autoColor,
      milestones: createDefaultMilestones(),
      driveUrl: '',
      createdBy: currentUser?.name || currentUser?.username || '未知',
      createdAt: now,
    })
    setNewProject({ name: '', code: '', client: '', budget: '', deadline: '', note: '', status: '執行中', color: '#4d8843', type: '', manager: '', health: '正常' })
    setShowAdd(false)
  }

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} initialTab={initialTab} onBack={() => { setSelectedId(null); setSearchParams({}) }} />
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: E.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>案件管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isAdmin && (() => {
            const wiCount = (data.workItems || []).length
            const stCount = (data.subTasks || []).length
            const total = wiCount + stCount
            if (total === 0) return null
            return (
              <button
                onClick={() => {
                  console.log('[清除前] workItems:', data.workItems)
                  console.log('[清除前] subTasks:', data.subTasks)
                  if (!window.confirm(`即將清空所有工項（${wiCount} 筆）和子任務（${stCount} 筆）。\n\n此動作不可復原。確定？`)) return
                  batchUpdate(d => {
                    const newData = {
                      ...d,
                      workItems: [],
                      subTasks: [],
                      editLogs: [{
                        id: Date.now(),
                        timestamp: new Date().toLocaleString('sv-SE').slice(0, 16),
                        user: currentUser?.name || currentUser?.username || '未知',
                        action: '清除',
                        entityType: '案件管理',
                        entityName: '全部 demo 資料',
                        summary: `清空 ${wiCount} 筆工項 + ${stCount} 筆子任務`,
                      }, ...(d.editLogs || [])].slice(0, 500),
                    }
                    console.log('[清除後] 寫入 Firebase:', newData.workItems, newData.subTasks)
                    return newData
                  })
                  alert('已清除，請重新整理頁面確認')
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', backgroundColor: '#f5e8e0', color: '#8a3a20', border: '1px solid #e0b8a8', fontWeight: '600' }}
              >
                清空工項+子任務（{total}）
              </button>
            )
          })()}
          <button onClick={() => setShowAdd(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={15} />新增案件
          </button>
        </div>
      </div>

      {/* 統計列 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: E.textPrimary }}>
          共 {data.projects.length} 案
        </span>
        {['執行中', '結案', '長期', '暫停'].map(st => {
          const cnt = statusCounts[st]
          if (!cnt) return null
          const s = STATUS[st] || { bg: '#eee', color: '#666' }
          return (
            <span key={st} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', backgroundColor: s.bg, color: s.color, fontWeight: '500' }}>
              {st} {cnt}
            </span>
          )
        })}
      </div>

      {/* 狀態篩選 + 搜尋 */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: E.cardBg, borderRadius: '10px', padding: '3px', border: `1px solid ${E.cardBorder}`, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: statusFilter === f ? '600' : '500',
              backgroundColor: statusFilter === f ? E.green : 'transparent',
              color: statusFilter === f ? '#f2f7f0' : E.textSecond,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px', maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: E.textMuted }} />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="搜尋案件名稱、委託單位、代碼..."
            style={{ ...E.input, paddingLeft: '32px', fontSize: '12px' }}
          />
        </div>
      </div>

      {/* 案件卡片列表 */}
      <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
        {filteredProjects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedId(p.id)} />)}
      </div>
      {filteredProjects.length === 0 && (
        <div style={{ textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '28px' }}>
          {searchText ? '查無符合條件的案件' : '此狀態下無案件'}
        </div>
      )}

      {/* 案件代碼對照表 - collapsible */}
      <div style={{ ...E.card, padding: 0, overflow: 'hidden' }}>
        <div
          onClick={() => setCodeTableOpen(v => !v)}
          style={{ padding: '14px 18px 10px', borderBottom: codeTableOpen ? `1px solid ${E.divider}` : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>案件代碼對照表</span>
            <span style={{ fontSize: '11px', color: E.textMuted, marginLeft: '8px' }}>供採購申請、代墊填寫時參考</span>
          </div>
          {codeTableOpen ? <ChevronUp size={16} style={{ color: E.textMuted }} /> : <ChevronDown size={16} style={{ color: E.textMuted }} />}
        </div>
        {codeTableOpen && (
          <div style={{ overflowX: 'auto' }}>
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
        )}
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
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
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


// ── 案件 × 交辦掛勾：案件內的交辦區塊（類別分區＋鎖定案件的快速派工）──
function ProjectDispatchBlock({ project }) {
  const { data, addItem, updateItem } = useApp()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [quick, setQuick] = useState('')
  const [quickCat, setQuickCat] = useState('設計')
  const [quickErr, setQuickErr] = useState('')
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const list = (data.dispatches || []).filter(d => String(d.projectId) === String(project.id))

  function quickSubmit() {
    const parsed = parseQuickAdd(quick, data.employees)
    if (!parsed.title) { setQuickErr('要有任務名稱'); return }
    if (!parsed.assignee) { setQuickErr('用 @人名 指定負責人（如 @毓雯）'); return }
    addItem('dispatches', {
      id: Date.now(), category: quickCat, title: parsed.title,
      projectId: project.id, assignee: parsed.assignee, dueDate: parsed.dueDate, spec: '',
      status: '待辦', assignedBy: currentUser?.name || '', assignedDate: todayStr, createdAt: localTimestamp(),
    })
    setQuick(''); setQuickErr('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ ...E.card, padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={quickCat} onChange={e => setQuickCat(e.target.value)} style={{ ...E.input, width: 'auto', fontSize: '12px', padding: '7px 8px' }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input value={quick} onChange={e => { setQuick(e.target.value); setQuickErr('') }}
            onKeyDown={e => { if (e.key === 'Enter') quickSubmit() }}
            placeholder={`派工到「${project.name}」：任務名 @人名 交付日`}
            style={{ ...E.input, flex: 1, minWidth: '170px', fontSize: '13px', padding: '8px 10px' }} />
          <button onClick={quickSubmit} style={{ ...E.btnPrimary, fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap' }}>派工</button>
        </div>
        {quickErr && <div style={{ fontSize: '12px', color: '#c04030', marginTop: '6px' }}>⚠ {quickErr}</div>}
      </div>

      {list.length === 0 ? (
        <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '28px' }}>此案件尚無交辦，用上面一行派第一件</div>
      ) : CATEGORIES.filter(cat => list.some(d => d.category === cat)).map(cat => {
        const cs = CAT_COLOR[cat] || CAT_COLOR['其他']
        const items = list.filter(d => d.category === cat).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
        const done = items.filter(d => d.status === '已完成').length
        return (
          <div key={cat} style={{ ...E.card, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '999px', backgroundColor: cs.bg, color: cs.color, fontWeight: '800' }}>{cat}</span>
              <span style={{ fontSize: '10px', color: E.textMuted }}>{done}/{items.length}</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: E.divider }} />
            </div>
            {items.map(d => {
              const st = ST_STYLE[d.status] || ST_STYLE['待辦']
              const overdue = d.dueDate && d.dueDate < todayStr && OPEN_STATUSES.includes(d.status)
              const closed = d.status === '已完成' || d.status === '取消'
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '6px 0', borderBottom: `1px solid ${E.divider}`, flexWrap: 'wrap', opacity: closed ? 0.55 : 1 }}>
                  <span style={{ flex: 1, minWidth: '110px', color: E.textPrimary, fontWeight: '600', textDecoration: d.status === '取消' ? 'line-through' : 'none' }}>{d.title}</span>
                  <span style={{ color: E.textMuted }}>{d.assignee}</span>
                  {d.dueDate && <span style={{ color: overdue ? '#c0202a' : E.textMuted, fontWeight: overdue ? '800' : '500' }}>{d.dueDate.slice(5)}</span>}
                  <select value={d.status} onChange={e => updateItem('dispatches', d.id, { status: e.target.value, ...(e.target.value === '已完成' ? { completedAt: localTimestamp() } : {}) })}
                    style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '999px', border: 'none', backgroundColor: st.bg, color: st.color, cursor: 'pointer' }}>
                    {STATUSES.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
        )
      })}

      <button onClick={() => navigate(`/dispatch?project=${project.id}`)}
        style={{ ...E.btnGhost, fontSize: '12px', padding: '9px 0' }}>在交辦任務頁查看（含編輯/刪除）→</button>
    </div>
  )
}
