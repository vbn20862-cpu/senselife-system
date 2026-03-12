import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Check, ChevronDown, Pencil } from 'lucide-react'
import Modal from '../components/Modal'
import { E, STATUS } from '../styles/earth'

const STATUS_OPTIONS = ['待開始', '進行中', '待審核', '完成']
const TYPE_OPTIONS = ['海報', '社群貼文', 'Banner', 'DM / 傳單', '名片', '識別設計', '簡報', '其他']

const EMPTY = {
  title: '', project: '', type: '', size: '', dueDate: '',
  purpose: '', textContent: '', quantity: '', note: '', status: '待開始',
}

export default function Design() {
  const { data, addItem, updateItem, deleteItem, logEdit } = useApp()
  const { currentUser } = useAuth()
  const [showAdd, setShowAdd] = useState(false)
  const [filter, setFilter] = useState('全部')
  const [expandedId, setExpandedId] = useState(null)
  const [newTask, setNewTask] = useState(EMPTY)
  const [editTask, setEditTask] = useState(null)

  const filtered = filter === '全部' ? data.designTasks : data.designTasks.filter(t => t.status === filter)

  function handleAdd() {
    if (!newTask.title.trim()) return
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ')
    addItem('designTasks', {
      id: Date.now(), ...newTask,
      createdBy: currentUser?.name || currentUser?.username || '未知',
      createdAt: now,
    })
    setNewTask(EMPTY)
    setShowAdd(false)
  }

  function set(key, val) {
    setNewTask(p => ({ ...p, [key]: val }))
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
          const expanded = expandedId === task.id
          const hasDetail = task.purpose || task.textContent || task.quantity || task.size || task.type || task.note || task.createdBy
          return (
            <div key={task.id} style={{ ...E.card }}>
              {/* 主列 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {/* 完成圓鈕 */}
                <button onClick={() => updateItem('designTasks', task.id, { status: task.status === '完成' ? '進行中' : '完成' })}
                  style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${task.status === '完成' ? E.green : '#c8b8a0'}`, backgroundColor: task.status === '完成' ? E.green : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, marginTop: '2px', transition: 'all 0.15s' }}>
                  {task.status === '完成' && <Check size={11} color="#f2f7f0" />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: task.status === '完成' ? E.textMuted : E.textPrimary, textDecoration: task.status === '完成' ? 'line-through' : 'none' }}>
                    {task.title}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                    {task.project && (
                      <span style={{ fontSize: '11px', backgroundColor: E.sandLight, color: E.textSecond, padding: '2px 8px', borderRadius: '6px' }}>
                        {data.projects.find(p => p.id === task.project)?.name || task.project}
                      </span>
                    )}
                    {task.type && (
                      <span style={{ fontSize: '11px', backgroundColor: '#ede0f0', color: '#6a3a80', padding: '2px 8px', borderRadius: '6px' }}>
                        {task.type}
                      </span>
                    )}
                    {task.size && (
                      <span style={{ fontSize: '11px', color: E.textMuted, padding: '2px 6px' }}>{task.size}</span>
                    )}
                    {task.dueDate && (
                      <span style={{ fontSize: '11px', color: E.textMuted }}>截止：{task.dueDate}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <select value={task.status} onChange={e => updateItem('designTasks', task.id, { status: e.target.value })}
                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: '600', border: 'none', cursor: 'pointer', backgroundColor: st.bg, color: st.color }}>
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                  {hasDetail && (
                    <button onClick={() => setExpandedId(expanded ? null : task.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: E.textMuted, padding: '2px', display: 'flex', alignItems: 'center' }}>
                      <ChevronDown size={14} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
                    </button>
                  )}
                  <button onClick={() => setEditTask({ ...task })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a09080', padding: '2px' }}>
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteItem('designTasks', task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d0b8a8', padding: '2px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* 展開詳情 */}
              {expanded && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${E.divider}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                  {task.purpose && (
                    <div>
                      <div style={{ fontSize: '10px', color: E.textMuted, marginBottom: '2px' }}>使用目的</div>
                      <div style={{ fontSize: '12px', color: E.textSecond }}>{task.purpose}</div>
                    </div>
                  )}
                  {task.quantity && (
                    <div>
                      <div style={{ fontSize: '10px', color: E.textMuted, marginBottom: '2px' }}>數量</div>
                      <div style={{ fontSize: '12px', color: E.textSecond }}>{task.quantity}</div>
                    </div>
                  )}
                  {task.textContent && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '10px', color: E.textMuted, marginBottom: '2px' }}>文字內容</div>
                      <div style={{ fontSize: '12px', color: E.textSecond, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{task.textContent}</div>
                    </div>
                  )}
                  {task.note && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '10px', color: E.textMuted, marginBottom: '2px' }}>備註</div>
                      <div style={{ fontSize: '12px', color: E.textSecond, whiteSpace: 'pre-wrap', lineHeight: '1.6', fontStyle: 'italic' }}>{task.note}</div>
                    </div>
                  )}
                  {(task.createdBy || task.updatedBy) && (
                    <div style={{ gridColumn: '1 / -1', paddingTop: '8px', borderTop: `1px solid ${E.divider}`, display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {task.createdBy && (
                        <span style={{ fontSize: '11px', color: E.textMuted }}>
                          建立：{task.createdBy}{task.createdAt ? ` · ${task.createdAt}` : ''}
                        </span>
                      )}
                      {task.updatedBy && (
                        <span style={{ fontSize: '11px', color: E.textMuted, fontStyle: 'italic' }}>
                          最後編輯：{task.updatedBy} · {task.updatedAt}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 新增 Modal */}
      {showAdd && (
        <Modal title="新增設計任務" onClose={() => { setShowAdd(false); setNewTask(EMPTY) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* 品項名稱 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>設計品項名稱 *</label>
              <input value={newTask.title} onChange={e => set('title', e.target.value)}
                placeholder="例：主視覺海報、FB貼文封面" style={E.input} />
            </div>

            {/* 關聯案件 + 截止日期 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
                <select value={newTask.project} onChange={e => set('project', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">不綁定</option>
                  {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>截止日期</label>
                <input type="date" value={newTask.dueDate} onChange={e => set('dueDate', e.target.value)} style={E.input} />
              </div>
            </div>

            {/* 設計類型 + 尺寸規格 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>設計類型</label>
                <select value={newTask.type} onChange={e => set('type', e.target.value)} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">請選擇</option>
                  {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>尺寸規格</label>
                <input value={newTask.size} onChange={e => set('size', e.target.value)}
                  placeholder="例：A3直、1080×1080px" style={E.input} />
              </div>
            </div>

            {/* 使用目的 + 數量 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>使用目的 <span style={{ color: E.textMuted, fontWeight: 400 }}>選填</span></label>
                <input value={newTask.purpose} onChange={e => set('purpose', e.target.value)}
                  placeholder="例：活動宣傳、記者會發放" style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>數量 <span style={{ color: E.textMuted, fontWeight: 400 }}>選填</span></label>
                <input value={newTask.quantity} onChange={e => set('quantity', e.target.value)}
                  placeholder="例：500張、3個版本" style={E.input} />
              </div>
            </div>

            {/* 文字內容 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>文字內容 <span style={{ color: E.textMuted, fontWeight: 400 }}>選填 — 需放在設計上的文字</span></label>
              <textarea value={newTask.textContent} onChange={e => set('textContent', e.target.value)}
                placeholder="標題、副標、時間地點、主辦單位..."
                rows={3} style={{ ...E.input, resize: 'vertical', lineHeight: '1.6' }} />
            </div>

            {/* 備註 */}
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註 <span style={{ color: E.textMuted, fontWeight: 400 }}>選填</span></label>
              <input value={newTask.note} onChange={e => set('note', e.target.value)}
                placeholder="其他補充說明" style={E.input} />
            </div>
          </div>

          <button onClick={handleAdd} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>新增任務</button>
        </Modal>
      )}

      {/* 編輯任務 Modal */}
      {editTask && (
        <Modal title="編輯設計任務" onClose={() => setEditTask(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>設計品項名稱 *</label>
              <input value={editTask.title} onChange={e => setEditTask(p => ({ ...p, title: e.target.value }))} style={E.input} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>關聯案件</label>
                <select value={editTask.project} onChange={e => setEditTask(p => ({ ...p, project: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">不綁定</option>
                  {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>截止日期</label>
                <input type="date" value={editTask.dueDate || ''} onChange={e => setEditTask(p => ({ ...p, dueDate: e.target.value }))} style={E.input} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>設計類型</label>
                <select value={editTask.type} onChange={e => setEditTask(p => ({ ...p, type: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                  <option value="">請選擇</option>
                  {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>尺寸規格</label>
                <input value={editTask.size || ''} onChange={e => setEditTask(p => ({ ...p, size: e.target.value }))} placeholder="例：A3直、1080×1080px" style={E.input} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>使用目的</label>
                <input value={editTask.purpose || ''} onChange={e => setEditTask(p => ({ ...p, purpose: e.target.value }))} style={E.input} />
              </div>
              <div>
                <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>數量</label>
                <input value={editTask.quantity || ''} onChange={e => setEditTask(p => ({ ...p, quantity: e.target.value }))} style={E.input} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>狀態</label>
              <select value={editTask.status} onChange={e => setEditTask(p => ({ ...p, status: e.target.value }))} style={{ ...E.input, cursor: 'pointer' }}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>文字內容</label>
              <textarea value={editTask.textContent || ''} onChange={e => setEditTask(p => ({ ...p, textContent: e.target.value }))}
                rows={3} style={{ ...E.input, resize: 'vertical', lineHeight: '1.6' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>備註</label>
              <input value={editTask.note || ''} onChange={e => setEditTask(p => ({ ...p, note: e.target.value }))} style={E.input} />
            </div>
          </div>
          <button onClick={() => {
            if (!editTask.title.trim()) return
            const now = new Date().toISOString().slice(0,16).replace('T',' ')
            const who = currentUser?.name || currentUser?.username || '未知'
            updateItem('designTasks', editTask.id, { ...editTask, updatedBy: who, updatedAt: now })
            logEdit({ user: who, action: '編輯', entityType: '設計任務', entityName: editTask.title, summary: `${editTask.status} · ${editTask.dueDate || '無截止'}` })
            setEditTask(null)
          }} style={{ ...E.btnPrimary, marginTop: '16px', width: '100%', padding: '11px 0' }}>儲存</button>
        </Modal>
      )}
    </div>
  )
}
