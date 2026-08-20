import { useState, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { E, useIsMobile } from '../styles/earth'
import Modal from '../components/Modal'
import { Plus, Trash2, Pencil, Zap } from 'lucide-react'
import { localTimestamp } from '../utils/salaryCalc'
import { parseQuickAdd, bucketByDue, DUE_SEGMENTS } from '../utils/tasks'

// 交辦清單：一列 = 一件事（類別｜任務｜案件｜負責人｜交付日｜規格備註｜狀態）
export const CATEGORIES = ['設計', '輸出印刷', '網宣', '策展場佈', '文書', '採購', '聯繫', '行政', '其他']
export const CAT_COLOR = {
  '設計':   { bg: '#efe6f5', color: '#6a3f8a' },
  '輸出印刷': { bg: '#e8e8f0', color: '#4a4a7a' },
  '網宣':   { bg: '#e0f0f0', color: '#1f6a6a' },
  '策展場佈': { bg: '#e4f0e8', color: '#2e6040' },
  '文書':   { bg: '#e6eef5', color: '#2f5a80' },
  '採購':   { bg: '#f5efe0', color: '#8a6a20' },
  '聯繫':   { bg: '#fdeee6', color: '#a05430' },
  '行政':   { bg: '#ece9e2', color: '#5f5a4e' },
  '其他':   { bg: '#f0ece5', color: '#7a7264' },
}
export const STATUSES = ['待辦', '進行中', '已完成', '暫停', '取消']
export const ST_STYLE = {
  '待辦':  { bg: '#fef3cd', color: '#8a6d1a' },
  '進行中': { bg: '#e0edf8', color: '#2f5a80' },
  '已完成': { bg: '#e4f0e8', color: '#2e6040' },
  '暫停':  { bg: '#ece9e2', color: '#6f6a5e' },
  '取消':  { bg: '#f5e4e0', color: '#8a3020' },
}
export const OPEN_STATUSES = ['待辦', '進行中', '暫停']

export default function Dispatch() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const { currentUser, isAdmin } = useAuth()
  const mob = useIsMobile()
  const myName = currentUser?.name || ''
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initProj = searchParams.get('project') || 'all'
  const [tab, setTab] = useState(initProj !== 'all' ? 'all' : (isAdmin ? 'all' : 'mine'))
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [fltPerson, setFltPerson] = useState('all')
  const [fltStatus, setFltStatus] = useState('open')
  const [fltProject, setFltProject] = useState(initProj)
  const [showDoneMine, setShowDoneMine] = useState(false)

  function emptyForm() {
    return { category: '設計', title: '', projectId: '', assignee: '', dueDate: '', spec: '' }
  }
  const dispatches = useMemo(() => (data.dispatches || []).filter(Boolean), [data.dispatches])
  const projects = (data.projects || []).filter(p => p.status !== '結案')
  const projName = id => (data.projects || []).find(p => String(p.id) === String(id))?.name || ''
  const todayStr = new Date().toLocaleDateString('sv-SE')

  const byDue = (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')

  // 一行快速派工：「任務名 @人 M/D」
  const [quick, setQuick] = useState('')
  const [quickCat, setQuickCat] = useState('設計')
  const [quickProj, setQuickProj] = useState('')
  const [quickErr, setQuickErr] = useState('')
  function quickSubmit() {
    const parsed = parseQuickAdd(quick, data.employees)
    if (!parsed.title) { setQuickErr('要有任務名稱'); return }
    if (!parsed.assignee) { setQuickErr('用 @人名 指定負責人（如 @毓雯）'); return }
    addItem('dispatches', {
      id: Date.now(), category: quickCat, title: parsed.title,
      projectId: quickProj, assignee: parsed.assignee, dueDate: parsed.dueDate, spec: '',
      status: '待辦', assignedBy: myName, assignedDate: todayStr, createdAt: localTimestamp(),
    })
    setQuick(''); setQuickErr('')
  }

  function submit() {
    if (!form.title.trim() || !form.assignee) return
    if (editId) {
      updateItem('dispatches', editId, { ...form })
    } else {
      addItem('dispatches', {
        id: Date.now(), ...form,
        status: '待辦',
        assignedBy: myName,
        assignedDate: todayStr,
        createdAt: localTimestamp(),
      })
    }
    setShowForm(false); setEditId(null); setForm(emptyForm())
  }
  function setStatus(d, status) {
    updateItem('dispatches', d.id, { status, ...(status === '已完成' ? { completedAt: localTimestamp() } : {}) })
  }
  function openEdit(d) {
    setEditId(d.id)
    setForm({ category: d.category, title: d.title, projectId: d.projectId || '', assignee: d.assignee, dueDate: d.dueDate || '', spec: d.spec || '' })
    setShowForm(true)
  }
  const canManage = d => isAdmin || d.assignedBy === myName

  // ── 視角資料 ──
  const mine = dispatches.filter(d => d.assignee === myName)
  const mineOpen = mine.filter(d => OPEN_STATUSES.includes(d.status)).sort(byDue)
  const mineDone = mine.filter(d => !OPEN_STATUSES.includes(d.status)).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 20)

  const allFiltered = dispatches
    .filter(d => fltPerson === 'all' || d.assignee === fltPerson)
    .filter(d => fltStatus === 'all' ? true : fltStatus === 'open' ? OPEN_STATUSES.includes(d.status) : d.status === fltStatus)
    .filter(d => fltProject === 'all' || String(d.projectId) === String(fltProject))
    .sort(byDue)

  const byProject = useMemo(() => {
    const groups = {}
    for (const d of dispatches) {
      const key = d.projectId || '_none'
      ;(groups[key] = groups[key] || []).push(d)
    }
    return Object.entries(groups).map(([key, list]) => ({
      key, name: key === '_none' ? '未分類' : (projName(key) || '（已刪除案件）'),
      list: list.sort(byDue),
      done: list.filter(d => d.status === '已完成').length,
      open: list.filter(d => OPEN_STATUSES.includes(d.status)).length,
    })).sort((a, b) => b.open - a.open)
  }, [dispatches, data.projects])

  const myOpenCount = mineOpen.length
  const TABS = [
    ['mine', `我的任務${myOpenCount > 0 ? ` (${myOpenCount})` : ''}`],
    ['all', '全部交辦'],
    ['project', '依案件'],
  ]

  function Row({ d, showAssignee }) {
    const cat = CAT_COLOR[d.category] || CAT_COLOR['其他']
    const st = ST_STYLE[d.status] || ST_STYLE['待辦']
    const overdue = d.dueDate && d.dueDate < todayStr && OPEN_STATUSES.includes(d.status)
    return (
      <div style={{ ...E.card, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', padding: '2px 9px', borderRadius: '999px', backgroundColor: cat.bg, color: cat.color, fontWeight: '700', flexShrink: 0 }}>{d.category}</span>
          <span style={{ fontSize: '14px', fontWeight: '700', color: E.textPrimary, flex: 1, minWidth: '120px' }}>{d.title}</span>
          <select value={d.status} onChange={e => setStatus(d, e.target.value)}
            style={{ fontSize: '11px', fontWeight: '700', padding: '4px 8px', borderRadius: '999px', border: 'none', backgroundColor: st.bg, color: st.color, cursor: 'pointer', appearance: 'auto' }}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: E.textMuted }}>
          {d.projectId && <span style={{ padding: '1px 8px', borderRadius: '6px', backgroundColor: '#f0ece5', color: E.coffee, fontWeight: '600' }}>{projName(d.projectId) || '—'}</span>}
          {showAssignee && <span>👤 {d.assignee}</span>}
          {d.dueDate && <span style={{ color: overdue ? '#c0202a' : E.textMuted, fontWeight: overdue ? '800' : '500' }}>📅 {d.dueDate}{overdue ? '（逾期）' : ''}</span>}
          <span style={{ opacity: 0.75 }}>由 {d.assignedBy} 交辦</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
            {canManage(d) && (
              <>
                <button onClick={() => openEdit(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b09070', padding: '3px', display: 'flex' }}><Pencil size={13} /></button>
                <button onClick={() => { if (window.confirm('確定刪除這筆交辦？')) deleteItem('dispatches', d.id) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c0a090', padding: '3px', display: 'flex' }}><Trash2 size={13} /></button>
              </>
            )}
          </span>
        </div>
        {d.spec && <div style={{ fontSize: '12px', color: E.textSecond, whiteSpace: 'pre-wrap', backgroundColor: '#faf7f2', borderRadius: '8px', padding: '7px 10px', lineHeight: 1.55 }}>{d.spec}</div>}
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '700', color: E.textPrimary, margin: 0 }}>交辦任務</h1>
        <button onClick={() => { setEditId(null); setForm({ ...emptyForm(), assignee: isAdmin ? '' : myName }); setShowForm(true) }}
          style={{ ...E.btnPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={15} /> 新增交辦
        </button>
      </div>

      {/* 一行快速派工：任務名 @人 M/D */}
      <div style={{ ...E.card, padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <Zap size={14} style={{ color: '#c85c28', flexShrink: 0 }} />
          <select value={quickCat} onChange={e => setQuickCat(e.target.value)} style={{ ...E.input, width: 'auto', fontSize: '12px', padding: '7px 8px' }}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input
            value={quick}
            onChange={e => { setQuick(e.target.value); setQuickErr('') }}
            onKeyDown={e => { if (e.key === 'Enter') quickSubmit() }}
            placeholder="任務名 @人名 交付日 — 例：燈籠圖樣 @毓雯 9/30"
            style={{ ...E.input, flex: 1, minWidth: '180px', fontSize: '13px', padding: '8px 10px' }}
          />
          <select value={quickProj} onChange={e => setQuickProj(e.target.value)} style={{ ...E.input, width: 'auto', fontSize: '12px', padding: '7px 8px', maxWidth: '140px' }}>
            <option value="">（無案件）</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={quickSubmit} style={{ ...E.btnPrimary, fontSize: '13px', padding: '8px 16px', whiteSpace: 'nowrap' }}>派工</button>
        </div>
        {quickErr && <div style={{ fontSize: '12px', color: '#c04030', marginTop: '6px' }}>⚠ {quickErr}</div>}
      </div>

      <div style={{ display: 'flex', gap: '4px', backgroundColor: E.cardBg, borderRadius: '12px', padding: '4px', border: `1px solid ${E.cardBorder}`, maxWidth: '440px' }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ ...E.tab(tab === key), flex: 1 }}>{label}</button>
        ))}
      </div>

      {/* 我的任務（逾期/今天/本週分段）*/}
      {tab === 'mine' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mineOpen.length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '32px', color: E.textMuted, fontSize: '13px' }}>目前沒有待辦的交辦 🎉</div>}
          {(() => {
            const buckets = bucketByDue(mineOpen, todayStr)
            return DUE_SEGMENTS.map(([key, label, color]) => {
              const arr = buckets[key]
              if (!arr.length) return null
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '0.05em', color, margin: '6px 2px 0' }}>{label}（{arr.length}）</div>
                  {arr.map(d => <Row key={d.id} d={d} showAssignee={false} />)}
                </div>
              )
            })
          })()}
          {mineDone.length > 0 && (
            <>
              <button onClick={() => setShowDoneMine(v => !v)} style={{ ...E.btnGhost, fontSize: '12px', padding: '8px 0' }}>
                {showDoneMine ? '收起' : `顯示已結束（${mineDone.length}）`}
              </button>
              {showDoneMine && mineDone.map(d => <div key={d.id} style={{ opacity: 0.65 }}><Row d={d} showAssignee={false} /></div>)}
            </>
          )}
        </div>
      )}

      {/* 全部交辦 */}
      {tab === 'all' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={fltPerson} onChange={e => setFltPerson(e.target.value)} style={{ ...E.input, width: 'auto', fontSize: '12px', padding: '7px 10px' }}>
              <option value="all">全部人員</option>
              {data.employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
            <select value={fltStatus} onChange={e => setFltStatus(e.target.value)} style={{ ...E.input, width: 'auto', fontSize: '12px', padding: '7px 10px' }}>
              <option value="open">未結（待辦+進行中+暫停）</option>
              <option value="all">全部狀態</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={fltProject} onChange={e => setFltProject(e.target.value)} style={{ ...E.input, width: 'auto', fontSize: '12px', padding: '7px 10px' }}>
              <option value="all">全部案件</option>
              {(data.projects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: E.textMuted, alignSelf: 'center' }}>{allFiltered.length} 筆</span>
          </div>
          {allFiltered.length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '32px', color: E.textMuted, fontSize: '13px' }}>沒有符合條件的交辦</div>}
          {allFiltered.map(d => <Row key={d.id} d={d} showAssignee />)}
        </div>
      )}

      {/* 依案件 */}
      {tab === 'project' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {byProject.length === 0 && <div style={{ ...E.card, textAlign: 'center', padding: '32px', color: E.textMuted, fontSize: '13px' }}>尚無交辦</div>}
          {byProject.map(g => (
            <div key={g.key} style={{ ...E.card }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span onClick={() => g.key !== '_none' && navigate(`/projects?detail=${g.key}`)}
                  style={{ fontSize: '14px', fontWeight: '700', color: g.key !== '_none' ? '#c85c28' : E.textPrimary, cursor: g.key !== '_none' ? 'pointer' : 'default', textDecoration: g.key !== '_none' ? 'underline' : 'none', textUnderlineOffset: '3px' }}>{g.name}</span>
                <span style={{ fontSize: '11px', color: E.textMuted }}>未結 {g.open}｜完成 {g.done}／{g.list.length}</span>
                <div style={{ flex: 1, minWidth: '80px', height: '6px', borderRadius: '999px', backgroundColor: '#efe9e0', overflow: 'hidden' }}>
                  <div style={{ width: `${g.list.length ? Math.round(g.done / g.list.length * 100) : 0}%`, height: '100%', backgroundColor: '#4d8843' }} />
                </div>
              </div>
              {/* 案件內按類別分區（開譜式：類別是標籤、檢視時分組）*/}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {CATEGORIES.filter(cat => g.list.some(d => d.category === cat)).map(cat => {
                  const catStyle = CAT_COLOR[cat] || CAT_COLOR['其他']
                  const items = g.list.filter(d => d.category === cat)
                  const catDone = items.filter(d => d.status === '已完成').length
                  return (
                    <div key={cat}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0 3px' }}>
                        <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '999px', backgroundColor: catStyle.bg, color: catStyle.color, fontWeight: '800' }}>{cat}</span>
                        <span style={{ fontSize: '10px', color: E.textMuted }}>{catDone}/{items.length}</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: E.divider }} />
                      </div>
                      {items.map(d => {
                        const st = ST_STYLE[d.status] || ST_STYLE['待辦']
                        const overdue = d.dueDate && d.dueDate < todayStr && OPEN_STATUSES.includes(d.status)
                        const closed = d.status === '已完成' || d.status === '取消'
                        return (
                          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '5px 0 5px 6px', borderBottom: `1px solid ${E.divider}`, flexWrap: 'wrap', opacity: closed ? 0.55 : 1 }}>
                            <span style={{ flex: 1, minWidth: '110px', color: E.textPrimary, fontWeight: '600', textDecoration: d.status === '取消' ? 'line-through' : 'none' }}>{d.title}</span>
                            <span style={{ color: E.textMuted }}>{d.assignee}</span>
                            {d.dueDate && <span style={{ color: overdue ? '#c0202a' : E.textMuted, fontWeight: overdue ? '800' : '500' }}>{d.dueDate.slice(5)}</span>}
                            <span style={{ fontSize: '10px', padding: '1px 8px', borderRadius: '999px', backgroundColor: st.bg, color: st.color, fontWeight: '700' }}>{d.status}</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增/編輯 Modal */}
      {showForm && (
        <Modal title={editId ? '編輯交辦' : '新增交辦'} onClose={() => { setShowForm(false); setEditId(null) }} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="類別 *">
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={E.input}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="負責人 *">
                <select value={form.assignee} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))} style={E.input}>
                  <option value="">選擇</option>
                  {data.employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="任務名稱 *">
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="例：市集攤位牌設計" style={E.input} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Field label="所屬案件">
                <select value={form.projectId} onChange={e => setForm(p => ({ ...p, projectId: e.target.value }))} style={E.input}>
                  <option value="">（不指定）</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="交付日期">
                <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={E.input} />
              </Field>
            </div>
            <Field label="規格 / 備註（尺寸、數量、文案都貼這）">
              <textarea value={form.spec} onChange={e => setForm(p => ({ ...p, spec: e.target.value }))} rows={4} style={{ ...E.input, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditId(null) }} style={{ ...E.btnGhost, padding: '8px 18px' }}>取消</button>
              <button onClick={submit} disabled={!form.title.trim() || !form.assignee}
                style={{ ...E.btnPrimary, padding: '8px 18px', opacity: (!form.title.trim() || !form.assignee) ? 0.5 : 1 }}>{editId ? '儲存' : '交辦'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '12px', color: E.textMuted, marginBottom: '4px', display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}
