import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, Trash2, Check } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS } from '../styles/earth'

const STATUS_OPTIONS = ['待開始', '進行中', '待審核', '完成']

export default function Design() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('全部')
  const [newTask, setNewTask] = useState({ title: '', project: '', status: '待開始', assignee: '全體', dueDate: '', note: '' })

  const filtered = filter === '全部' ? data.designTasks : data.designTasks.filter(t => t.status === filter)

  function handleAdd() {
    if (!newTask.title.trim()) return
    addItem('designTasks', { id: Date.now(), ...newTask })
    setNewTask({ title: '', project: '', status: '待開始', assignee: '全體', dueDate: '', note: '' })
    setShowAdd(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>設計任務</h1>
        <button onClick={() => setShowAdd(true)} style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> 新增任務
        </button>
      </div>

      {/* 篩選 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {['全部', ...STATUS_OPTIONS].map(s => {
          const active = filter === s
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', border: 'none',
              backgroundColor: active ? E.green : '#fdfaf5',
              color: active ? '#f2f7f0' : E.textSecond,
              boxShadow: active ? 'none' : '0 1px 3px rgba(60,30,0,0.1)',
            }}>
              {s} {s !== '全部' && <span style={{ opacity: 0.6 }}>({data.designTasks.filter(t => t.status === s).length})</span>}
            </button>
          )
        })}
      </div>

      {/* 任務列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.length === 0 && (
          <div style={{ ...E.card, textAlign: 'center', color: E.textMuted, fontSize: '13px', padding: '32px' }}>沒有任務</div>
        )}
        {filtered.map(task => {
          const st = STATUS[task.status] || { bg: '#eee', color: '#666' }
          return (
            <div key={task.id} style={{ ...E.card, display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <button onClick={() => updateItem('designTasks', task.id, { status: task.status === '完成' ? '進行中' : '完成' })}
                style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${task.status === '完成' ? E.green : '#c8b8a0'}`, backgroundColor: task.status === '完成' ? E.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '2px', transition: 'all 0.15s' }}>
                {task.status === '完成' && <Check size={11} color="#f2f7f0" />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: task.status === '完成' ? E.textMuted : E.textPrimary, textDecoration: task.status === '完成' ? 'line-through' : 'none' }}>
                  {task.title}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                  {task.project && (
                    <span style={{ fontSize: '11px', backgroundColor: E.sandLight, color: E.textSecond, padding: '2px 8px', borderRadius: '6px' }}>
                      {data.projects.find(p => p.id === task.project)?.name || task.project}
                    </span>
                  )}
                  {task.dueDate && <span style={{ fontSize: '11px', color: E.textMuted }}>截止：{task.dueDate}</span>}
                  {task.note && <span style={{ fontSize: '11px', color: E.textMuted, fontStyle: 'italic' }}>{task.note}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select value={task.status} onChange={e => updateItem('designTasks', task.id, { status: e.target.value })}
                  style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: '600', border: 'none', cursor: 'pointer', backgroundColor: st.bg, color: st.color }}>
                  {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => deleteItem('designTasks', task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showAdd && (
        <Modal title="新增設計任務" onClose={() => setShowAdd(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
              placeholder="任務名稱 *" style={E.input} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
                <select value={newTask.project} onChange={e => setNewTask(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">不綁定</option>
                  {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>截止日期</label>
                <input type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} style={E.input} />
              </div>
            </div>
            <input value={newTask.note} onChange={e => setNewTask(p => ({ ...p, note: e.target.value }))}
              placeholder="備註（可選）" style={E.input} />
          </div>
          <button onClick={handleAdd} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增</button>
        </Modal>
      )}
    </div>
  )
}
