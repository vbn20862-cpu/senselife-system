import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, Trash2, Edit3, Check, X, Lock, LogOut } from 'lucide-react'
import logo from '../assets/logo.jpeg'

const ADMIN_PASSWORD = 'admin1234'
const PUNCH_TYPES = ['上班', '下班', '加班開始', '加班結束']
const TYPE_STYLE = {
  '上班':   { color: '#3a6d31', bg: '#edf2ea' },
  '下班':   { color: '#5a4a8a', bg: '#f0eef8' },
  '加班開始': { color: '#b45309', bg: '#fef3c7' },
  '加班結束': { color: '#0369a1', bg: '#e0f2fe' },
}

const INPUT = {
  border: '1px solid #d8cbb8', borderRadius: '8px', padding: '7px 10px',
  fontSize: '13px', backgroundColor: '#fdfaf5', color: '#2c1a0e',
  outline: 'none', cursor: 'pointer',
}
const BTN_SM = (variant) => ({
  border: variant === 'green' ? 'none' : `1px solid ${variant === 'red' ? '#f0c0b8' : '#d8cbb8'}`,
  borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '4px',
  backgroundColor: variant === 'green' ? '#3a6d31' : 'transparent',
  color: variant === 'green' ? '#fff' : variant === 'red' ? '#c04030' : '#7a6050',
})

export default function CheckinAdmin() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const [authed, setAuthed]   = useState(false)
  const [pw, setPw]           = useState('')
  const [pwErr, setPwErr]     = useState(false)
  const [filterEmp, setFilterEmp]   = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [editingId, setEditingId]   = useState(null)
  const [editVals, setEditVals]     = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newRec, setNewRec]   = useState({
    empId: '', date: new Date().toISOString().split('T')[0], time: '09:00', type: '上班',
  })

  /* ── 登入 ── */
  function handleLogin() {
    if (pw === ADMIN_PASSWORD) { setAuthed(true); setPwErr(false) }
    else setPwErr(true)
  }

  /* ── 篩選 ── */
  const filtered = [...data.clockins]
    .filter(c => {
      if (filterEmp  && !c.empName?.includes(filterEmp)) return false
      if (filterDate && c.date !== filterDate) return false
      return true
    })
    .sort((a, b) => {
      const d = (b.date || '').localeCompare(a.date || '')
      return d !== 0 ? d : (b.time || '').localeCompare(a.time || '')
    })

  /* ── 編輯 ── */
  function startEdit(c) { setEditingId(c.id); setEditVals({ date: c.date, time: c.time, type: c.type }) }
  function saveEdit()   { updateItem('clockins', editingId, editVals); setEditingId(null) }

  /* ── 補登 ── */
  function handleAdd() {
    if (!newRec.empId) return
    const emp = data.employees.find(e => e.id === Number(newRec.empId))
    if (!emp) return
    addItem('clockins', { id: Date.now(), empId: emp.id, empName: emp.name, date: newRec.date, time: newRec.time, type: newRec.type })
    setShowAdd(false)
    setNewRec({ empId: '', date: new Date().toISOString().split('T')[0], time: '09:00', type: '上班' })
  }

  /* ══════════ 密碼頁 ══════════ */
  if (!authed) return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#1c2718', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <img src={logo} alt="深活共構" style={{ height: '52px', filter: 'invert(1)', mixBlendMode: 'screen', marginBottom: '32px' }} />
      <div style={{ backgroundColor: '#fdfaf5', borderRadius: '20px', padding: '32px 28px', width: '100%', maxWidth: '320px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ textAlign: 'center' }}>
          <Lock size={28} style={{ color: '#3a6d31', marginBottom: '10px' }} />
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#2c1a0e' }}>打卡後台管理</div>
          <div style={{ fontSize: '12px', color: '#9a8070', marginTop: '4px' }}>請輸入管理員密碼</div>
        </div>
        <input
          type="password" value={pw}
          onChange={e => { setPw(e.target.value); setPwErr(false) }}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          placeholder="密碼"
          style={{ width: '100%', border: `1px solid ${pwErr ? '#c04030' : '#d8cbb8'}`, borderRadius: '10px', padding: '11px 12px', fontSize: '15px', backgroundColor: '#fdfaf5', color: '#2c1a0e', outline: 'none', boxSizing: 'border-box' }}
        />
        {pwErr && <div style={{ fontSize: '12px', color: '#c04030', textAlign: 'center', marginTop: '-6px' }}>密碼錯誤，請再試一次</div>}
        <button onClick={handleLogin} style={{ backgroundColor: '#3a6d31', color: '#f2f7f0', border: 'none', borderRadius: '10px', padding: '12px 0', fontSize: '14px', fontWeight: '700', cursor: 'pointer', width: '100%' }}>
          進入後台
        </button>
      </div>
      <div style={{ color: 'rgba(200,184,138,0.3)', fontSize: '11px', marginTop: '24px' }}>深活共構 · 打卡後台管理系統</div>
    </div>
  )

  /* ══════════ 後台主介面 ══════════ */
  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#1c2718', padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* 標題列 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img src={logo} alt="深活共構" style={{ height: '38px', filter: 'invert(1)', mixBlendMode: 'screen' }} />
          <div style={{ flex: 1 }}>
            <div style={{ color: '#c8b88a', fontSize: '17px', fontWeight: '700' }}>打卡後台管理</div>
            <div style={{ color: 'rgba(200,184,138,0.5)', fontSize: '11px' }}>管理員模式</div>
          </div>
          <a href="/checkin" target="_blank" rel="noreferrer" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#c8b88a', border: '1px solid rgba(200,184,138,0.25)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>
            📱 員工打卡頁
          </a>
          <button onClick={() => setAuthed(false)} style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#c8b88a', border: '1px solid rgba(200,184,138,0.25)', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <LogOut size={12} />登出
          </button>
        </div>

        {/* 篩選列 + 補登按鈕 */}
        <div style={{ backgroundColor: '#fdfaf5', borderRadius: '14px', padding: '14px 18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.22)' }}>
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)} style={INPUT}>
            <option value="">全部員工</option>
            {data.employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ ...INPUT, color: filterDate ? '#2c1a0e' : '#9a8070' }} />
          {(filterEmp || filterDate) && (
            <button onClick={() => { setFilterEmp(''); setFilterDate('') }} style={{ ...INPUT, backgroundColor: 'transparent', fontSize: '12px', color: '#9a8070' }}>
              ✕ 清除
            </button>
          )}
          <span style={{ fontSize: '12px', color: '#9a8070', marginLeft: 'auto' }}>共 {filtered.length} 筆</span>
          <button onClick={() => setShowAdd(v => !v)} style={{ backgroundColor: '#3a6d31', color: '#f2f7f0', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} />補登打卡
          </button>
        </div>

        {/* 補登表單 */}
        {showAdd && (
          <div style={{ backgroundColor: '#fdfaf5', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.22)' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c1a0e', marginBottom: '14px' }}>📝 補登打卡記錄</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {[
                { label: '員工', node: (
                  <select value={newRec.empId} onChange={e => setNewRec(p => ({ ...p, empId: e.target.value }))} style={{ ...INPUT, minWidth: '120px' }}>
                    <option value="">選擇員工</option>
                    {data.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                )},
                { label: '日期', node: <input type="date" value={newRec.date} onChange={e => setNewRec(p => ({ ...p, date: e.target.value }))} style={INPUT} /> },
                { label: '時間', node: <input type="time" value={newRec.time} onChange={e => setNewRec(p => ({ ...p, time: e.target.value }))} style={INPUT} /> },
                { label: '類型', node: (
                  <select value={newRec.type} onChange={e => setNewRec(p => ({ ...p, type: e.target.value }))} style={INPUT}>
                    {PUNCH_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                )},
              ].map(({ label, node }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#7a6050', fontWeight: '600' }}>{label}</label>
                  {node}
                </div>
              ))}
              <button onClick={handleAdd} disabled={!newRec.empId} style={{ backgroundColor: newRec.empId ? '#3a6d31' : '#c8b8a8', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: newRec.empId ? 'pointer' : 'default', marginBottom: '1px' }}>
                新增
              </button>
              <button onClick={() => setShowAdd(false)} style={{ backgroundColor: 'transparent', color: '#9a8070', border: '1px solid #d8cbb8', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', cursor: 'pointer', marginBottom: '1px' }}>
                取消
              </button>
            </div>
          </div>
        )}

        {/* 記錄表格 */}
        <div style={{ backgroundColor: '#fdfaf5', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.22)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#b09070', fontSize: '14px' }}>
              {data.clockins.length === 0 ? '尚無任何打卡記錄' : '沒有符合篩選條件的記錄'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#f5f0e8' }}>
                  <tr>
                    {['姓名', '日期', '時間', '打卡類型', '操作'].map(h => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', color: '#7a6050', fontWeight: '600', borderBottom: '1px solid #ede5d8', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const isEditing = editingId === c.id
                    const ts = TYPE_STYLE[c.type] || { color: '#666', bg: '#eee' }
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #ede5d8', backgroundColor: isEditing ? '#fffef2' : 'transparent' }}>
                        {/* 姓名 */}
                        <td style={{ padding: '10px 16px', fontWeight: '600', color: '#2c1a0e', whiteSpace: 'nowrap' }}>{c.empName}</td>

                        {/* 日期 */}
                        <td style={{ padding: '10px 16px', color: '#7a6050', whiteSpace: 'nowrap' }}>
                          {isEditing
                            ? <input type="date" value={editVals.date} onChange={e => setEditVals(p => ({ ...p, date: e.target.value }))}
                                style={{ border: '1px solid #d8cbb8', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', backgroundColor: '#fdfaf5', color: '#2c1a0e', outline: 'none' }} />
                            : c.date}
                        </td>

                        {/* 時間 */}
                        <td style={{ padding: '10px 16px', fontWeight: '600', color: '#2c1a0e', whiteSpace: 'nowrap' }}>
                          {isEditing
                            ? <input type="time" value={editVals.time} onChange={e => setEditVals(p => ({ ...p, time: e.target.value }))}
                                style={{ border: '1px solid #d8cbb8', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', backgroundColor: '#fdfaf5', color: '#2c1a0e', outline: 'none' }} />
                            : c.time}
                        </td>

                        {/* 類型 */}
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          {isEditing
                            ? <select value={editVals.type} onChange={e => setEditVals(p => ({ ...p, type: e.target.value }))}
                                style={{ border: '1px solid #d8cbb8', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', backgroundColor: '#fdfaf5', color: '#2c1a0e', cursor: 'pointer', outline: 'none' }}>
                                {PUNCH_TYPES.map(t => <option key={t}>{t}</option>)}
                              </select>
                            : <span style={{ backgroundColor: ts.bg, color: ts.color, padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '600' }}>{c.type}</span>
                          }
                        </td>

                        {/* 操作 */}
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={saveEdit} style={BTN_SM('green')}><Check size={12} />儲存</button>
                              <button onClick={() => setEditingId(null)} style={BTN_SM('gray')}><X size={12} />取消</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => startEdit(c)} style={BTN_SM('gray')}><Edit3 size={12} />修改</button>
                              <button onClick={() => { if (window.confirm(`確定刪除 ${c.empName} ${c.date} ${c.time} ${c.type} 的記錄？`)) deleteItem('clockins', c.id) }} style={BTN_SM('red')}><Trash2 size={12} />刪除</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ color: 'rgba(200,184,138,0.25)', fontSize: '11px', textAlign: 'center' }}>
          深活共構 · 打卡後台管理系統
        </div>
      </div>
    </div>
  )
}
