import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, ArrowLeft, Trash2, FileText, MessageSquare, ListChecks, ExternalLink, Pencil } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS } from '../styles/earth'

const STATUS_OPTIONS = ['企劃中', '執行中', '結案', '長期', '暫停', '提案中']
const TASK_STATUS   = ['待開始', '進行中', '完成', '暫停']
const COLORS = ['#4d8843', '#8f5b38', '#c89a62', '#5a7a9a', '#8a5890', '#c04040', '#3a8a7a', '#8a8030']
const TASK_STYLE = {
  '待開始': { color: '#6a5a4a', bg: '#ece8e4' },
  '進行中': { color: '#305080', bg: '#e0e8f0' },
  '完成':   { color: '#2e6040', bg: '#e4f0e8' },
  '暫停':   { color: '#8a3020', bg: '#f5e4e0' },
}
function chip(status) {
  const s = STATUS[status] || { bg: '#eee', color: '#666' }
  return { display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: s.bg, color: s.color }
}

/* ══════════ 列表卡片 ══════════ */
function ProjectCard({ project, onClick }) {
  const { data } = useApp()
  const spent = data.expenses.filter(e => e.project === project.id).reduce((s, e) => s + (e.amount || 0), 0)
  const pct = project.budget > 0 ? Math.min((spent / project.budget) * 100, 100) : 0
  const taskCount = (data.workItems || []).filter(w => w.projectId === project.id).length

  return (
    <div onClick={onClick} style={{ ...E.card, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(60,30,0,0.16)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = E.card.boxShadow; e.currentTarget.style.transform = 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: project.color, marginTop: '5px', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
          <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '3px' }}>{project.client || '—'}</div>
        </div>
        <span style={chip(project.status)}>{project.status}</span>
      </div>

      {project.budget > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: E.textPrimary }}>
              NT${spent.toLocaleString()}
            </span>
            <span style={{ fontSize: '11px', color: E.textMuted }}>
              / NT${project.budget.toLocaleString()}
              <span style={{ marginLeft: '5px', fontWeight: '700', color: pct > 80 ? '#c04030' : pct > 50 ? '#c89040' : '#4d8843' }}>
                {pct.toFixed(1)}%
              </span>
            </span>
          </div>
          <div style={{ height: '5px', backgroundColor: '#ede5d8', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: '999px', backgroundColor: pct > 80 ? '#c04030' : pct > 50 ? '#c89040' : '#4d8843', width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px', color: E.textMuted }}>
        {project.deadline && <span>截止 {project.deadline}</span>}
        {taskCount > 0 && <span>工項 {taskCount}</span>}
      </div>
    </div>
  )
}

/* ══════════ 案件詳細 ══════════ */
function ProjectDetail({ project, onBack }) {
  const { data, updateItem, deleteItem, addItem } = useApp()
  const [tab, setTab] = useState('tasks')
  const [edit, setEdit]             = useState({ ...project })
  const [showAddTask, setShowAddTask]       = useState(false)
  const [newTask, setNewTask]               = useState({ title: '', assignee: '', status: '待開始', dueDate: '', note: '' })
  const [editingTaskId, setEditingTaskId]   = useState(null)
  const [editTaskVals, setEditTaskVals]     = useState({})
  const [newCheckItem, setNewCheckItem]     = useState('')
  const [newDoc, setNewDoc]                 = useState({ title: '', url: '' })
  const [showDocForm, setShowDocForm]       = useState(false)
  const [newMeeting, setNewMeeting]         = useState({ date: '', summary: '', decisions: '' })
  const [showMeetingForm, setShowMeetingForm] = useState(false)

  const workItems  = (data.workItems || []).filter(w => w.projectId === project.id)
  const checklists = data.projectDocs.filter(d => d.type === 'checklist' && d.project === project.id)
  const docs       = data.projectDocs.filter(d => d.type === 'doc'       && d.project === project.id)
  const meetings   = data.meetings.filter(m => m.project === project.id)
  const spent = data.expenses.filter(e => e.project === project.id).reduce((s, e) => s + (e.amount || 0), 0)
  const pct   = project.budget > 0 ? Math.min((spent / project.budget) * 100, 100) : 0

  function saveField(key, value) {
    updateItem('projects', project.id, { [key]: value })
    setEdit(p => ({ ...p, [key]: value }))
  }

  const SM = { ...E.input, padding: '7px 10px', fontSize: '13px' }

  const TABS = [
    { key: 'tasks',    label: '工項',     count: workItems.length },
    { key: 'checklist',label: 'Checklist', count: checklists.length },
    { key: 'docs',     label: '文件',     count: docs.length },
    { key: 'meetings', label: '會議記錄', count: meetings.length },
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

      {/* 案件基本資訊（可編輯） */}
      <div style={E.card}>
        {/* 名稱 + 狀態 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: edit.color, flexShrink: 0 }} />
          <input
            value={edit.name}
            onChange={e => setEdit(p => ({ ...p, name: e.target.value }))}
            onBlur={e => saveField('name', e.target.value)}
            style={{ ...E.input, flex: 1, minWidth: '160px', fontSize: '16px', fontWeight: '700', padding: '6px 10px' }}
          />
          <select value={edit.status} onChange={e => saveField('status', e.target.value)}
            style={{ ...chip(edit.status), border: 'none', cursor: 'pointer', appearance: 'none', paddingRight: '10px' }}>
            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* 顏色 */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => saveField('color', c)}
              style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: c, cursor: 'pointer', border: edit.color === c ? '2px solid #2c1a0e' : '2px solid transparent', transition: 'all 0.12s' }} />
          ))}
        </div>

        {/* 欄位 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '12px' }}>
          {[
            { label: '業主 / 客戶', key: 'client',   type: 'text' },
            { label: '核定預算 NT$', key: 'budget',   type: 'number' },
            { label: '截止日期',     key: 'deadline', type: 'date' },
          ].map(f => (
            <div key={f.key}>
              <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>{f.label}</label>
              <input type={f.type} value={edit[f.key] || ''}
                onChange={e => setEdit(p => ({ ...p, [f.key]: e.target.value }))}
                onBlur={e => saveField(f.key, f.type === 'number' ? Number(e.target.value) || 0 : e.target.value)}
                style={SM} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>備註</label>
            <textarea value={edit.note || ''}
              onChange={e => setEdit(p => ({ ...p, note: e.target.value }))}
              onBlur={e => saveField('note', e.target.value)}
              rows={2} style={{ ...SM, resize: 'none', width: '100%' }} />
          </div>
        </div>

        {/* 預算條 */}
        {project.budget > 0 && (
          <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: `1px solid ${E.divider}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: E.textSecond, marginBottom: '6px' }}>
              <span>預算使用</span>
              <span style={{ fontWeight: '600' }}>NT${spent.toLocaleString()} / NT${project.budget.toLocaleString()} ({pct.toFixed(1)}%)</span>
            </div>
            <div style={{ height: '8px', backgroundColor: '#ede5d8', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: '999px', backgroundColor: pct > 80 ? '#c04030' : pct > 50 ? '#c89040' : '#4d8843', width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
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
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>負責人</label>
                    <select value={newTask.assignee} onChange={e => setNewTask(p => ({ ...p, assignee: e.target.value }))} style={{ ...SM, cursor: 'pointer', width: '100%' }}>
                      <option value="">（不指定）</option>
                      {data.employees.map(emp => <option key={emp.id} value={emp.name}>{emp.name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '100px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>狀態</label>
                    <select value={newTask.status} onChange={e => setNewTask(p => ({ ...p, status: e.target.value }))} style={{ ...SM, cursor: 'pointer', width: '100%' }}>
                      {TASK_STATUS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ fontSize: '11px', color: E.textMuted, display: 'block', marginBottom: '4px' }}>截止日</label>
                    <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} style={{ ...SM, width: '100%' }} />
                  </div>
                </div>
                <input value={newTask.note} onChange={e => setNewTask(p => ({ ...p, note: e.target.value }))} placeholder="備註" style={SM} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => {
                    if (!newTask.title.trim()) return
                    addItem('workItems', { id: Date.now(), projectId: project.id, ...newTask })
                    setNewTask({ title: '', assignee: '', status: '待開始', dueDate: '', note: '' })
                    setShowAddTask(false)
                  }} style={E.btnPrimary}>新增</button>
                  <button onClick={() => setShowAddTask(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textSecond, fontSize: '13px' }}>取消</button>
                </div>
              </div>
            )}

            {/* 工項列表 */}
            {workItems.map(task => {
              const ts = TASK_STYLE[task.status] || { color: '#666', bg: '#eee' }
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
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ backgroundColor: ts.bg, color: ts.color, padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', flexShrink: 0, marginTop: '1px' }}>{task.status}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{task.title}</div>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {task.assignee && <span style={{ fontSize: '11px', color: E.textSecond }}>👤 {task.assignee}</span>}
                          {task.dueDate  && <span style={{ fontSize: '11px', color: E.textSecond }}>📅 {task.dueDate}</span>}
                          {task.note     && <span style={{ fontSize: '11px', color: E.textMuted }}>{task.note}</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditingTaskId(task.id); setEditTaskVals({ title: task.title, assignee: task.assignee || '', status: task.status, dueDate: task.dueDate || '', note: task.note || '' }) }}
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

        {/* ── Checklist ── */}
        {tab === 'checklist' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {checklists.length === 0 && <div style={{ fontSize: '12px', color: E.textMuted, textAlign: 'center', padding: '16px' }}>尚無項目</div>}
            {checklists.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={item.done} onChange={() => updateItem('projectDocs', item.id, { done: !item.done })}
                  style={{ width: '15px', height: '15px', accentColor: E.green, cursor: 'pointer' }} />
                <span style={{ fontSize: '13px', flex: 1, color: item.done ? E.textMuted : E.textPrimary, textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</span>
                <button onClick={() => deleteItem('projectDocs', item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}><Trash2 size={12} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && newCheckItem.trim() && (addItem('projectDocs', { id: Date.now(), type: 'checklist', project: project.id, text: newCheckItem.trim(), done: false }), setNewCheckItem(''))}
                placeholder="新增項目（按 Enter）" style={{ ...E.input, flex: 1 }} />
              <button onClick={() => { if (!newCheckItem.trim()) return; addItem('projectDocs', { id: Date.now(), type: 'checklist', project: project.id, text: newCheckItem.trim(), done: false }); setNewCheckItem('') }}
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
    </div>
  )
}

/* ══════════ 主頁面 ══════════ */
export default function Projects() {
  const { data, addItem } = useApp()
  const [selectedId, setSelectedId] = useState(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [newProject, setNewProject] = useState({ name: '', client: '', budget: '', deadline: '', status: '企劃中', color: '#4d8843', note: '' })

  const selectedProject = data.projects.find(p => p.id === selectedId)

  function handleAdd() {
    if (!newProject.name.trim()) return
    addItem('projects', { id: `PRJ_${Date.now()}`, ...newProject, budget: Number(newProject.budget) || 0 })
    setNewProject({ name: '', client: '', budget: '', deadline: '', status: '企劃中', color: '#4d8843', note: '' })
    setShowAdd(false)
  }

  /* 已選案件 → 顯示詳細 */
  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={() => setSelectedId(null)} />
  }

  /* 列表 */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>案件管理</h1>
        <button onClick={() => setShowAdd(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} />新增案件
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
        {data.projects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedId(p.id)} />)}
      </div>

      {showAdd && (
        <Modal title="新增案件" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: '案件名稱 *', key: 'name',     type: 'text' },
              { label: '業主 / 客戶', key: 'client',  type: 'text' },
              { label: '核定預算 NT$', key: 'budget', type: 'number', placeholder: '0' },
              { label: '截止日期',   key: 'deadline', type: 'date' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{f.label}</label>
                <input type={f.type} value={newProject[f.key]} onChange={e => setNewProject(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder || ''} style={E.input} />
              </div>
            ))}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>初始狀態</label>
              <select value={newProject.status} onChange={e => setNewProject(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
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
