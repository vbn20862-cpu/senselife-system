import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { Plus, Trash2, Edit3, Check, X, Lock, LogOut } from 'lucide-react'
import { useIsMobile } from '../styles/earth'
import { resolveEmpName } from '../utils/salaryCalc'
import { mapLink } from '../utils/geo'
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
  const mob = useIsMobile()
  const [authed, setAuthed]   = useState(false)
  const [pw, setPw]           = useState('')
  const [pwErr, setPwErr]     = useState(false)
  const [filterEmp, setFilterEmp]   = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [editingId, setEditingId]   = useState(null)
  const [editVals, setEditVals]     = useState({})
  const [showAdd, setShowAdd] = useState(false)
  const [newRec, setNewRec]   = useState({
    empId: '', date: new Date().toLocaleDateString('sv-SE'), time: '09:00', type: '上班',
  })
  // 活動日批次補登
  const [showBatch, setShowBatch] = useState(false)
  const [batch, setBatch] = useState({
    date: new Date().toLocaleDateString('sv-SE'),
    empIds: [], inTime: '09:00', outTime: '18:00',
    otStart: '', otEnd: '',
  })
  const [batchMsg, setBatchMsg] = useState('')

  function toggleBatchEmp(id) {
    setBatch(p => ({ ...p, empIds: p.empIds.includes(id) ? p.empIds.filter(x => x !== id) : [...p.empIds, id] }))
  }
  function handleBatchAdd() {
    if (batch.empIds.length === 0) { setBatchMsg('請至少選一位員工'); return }
    if (!batch.date || !batch.inTime || !batch.outTime) { setBatchMsg('請填日期與上下班時間'); return }
    let added = 0, skipped = 0
    const ts = Date.now()
    let k = 0
    for (const empId of batch.empIds) {
      const emp = data.employees.find(e => e.id === empId)
      if (!emp) continue
      // 跳過當天已有上班卡的員工，避免重複
      const dup = data.clockins.some(c => c.empId === empId && c.date === batch.date && c.type === '上班')
      if (dup) { skipped++; continue }
      addItem('clockins', { id: ts + (k++), empId, empName: emp.name, date: batch.date, time: batch.inTime, type: '上班' })
      addItem('clockins', { id: ts + (k++), empId, empName: emp.name, date: batch.date, time: batch.outTime, type: '下班' })
      if (batch.otStart && batch.otEnd) {
        addItem('clockins', { id: ts + (k++), empId, empName: emp.name, date: batch.date, time: batch.otStart, type: '加班開始' })
        addItem('clockins', { id: ts + (k++), empId, empName: emp.name, date: batch.date, time: batch.otEnd, type: '加班結束' })
      }
      added++
    }
    setBatchMsg(`✅ 補登 ${added} 人${skipped > 0 ? `（跳過 ${skipped} 人：當天已有打卡）` : ''}`)
    setBatch(p => ({ ...p, empIds: [] }))
    setTimeout(() => setBatchMsg(''), 4000)
  }

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
    setNewRec({ empId: '', date: new Date().toLocaleDateString('sv-SE'), time: '09:00', type: '上班' })
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
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
        <div style={{ backgroundColor: '#fdfaf5', borderRadius: '14px', padding: mob ? '12px 14px' : '14px 18px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.22)' }}>
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
          <button onClick={() => { setShowBatch(v => !v); setShowAdd(false) }} style={{ backgroundColor: showBatch ? '#a85420' : '#c06a30', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📅 活動日批次補登
          </button>
          <button onClick={() => { setShowAdd(v => !v); setShowBatch(false) }} style={{ backgroundColor: '#3a6d31', color: '#f2f7f0', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} />補登打卡
          </button>
        </div>

        {/* 活動日批次補登 */}
        {showBatch && (
          <div style={{ backgroundColor: '#fdfaf5', borderRadius: '14px', padding: '18px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.22)' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c1a0e', marginBottom: '4px' }}>📅 活動日批次補登</div>
            <div style={{ fontSize: '11px', color: '#9a8070', marginBottom: '14px' }}>選日期 + 勾選員工 + 統一上下班時間，一次補完。當天已有打卡的員工會自動跳過。</div>
            {/* 日期 + 時間 */}
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#7a6050', fontWeight: '600' }}>活動日期</label>
                <input type="date" value={batch.date} onChange={e => setBatch(p => ({ ...p, date: e.target.value }))} style={INPUT} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#7a6050', fontWeight: '600' }}>上班時間</label>
                <input type="time" value={batch.inTime} onChange={e => setBatch(p => ({ ...p, inTime: e.target.value }))} style={INPUT} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#7a6050', fontWeight: '600' }}>下班時間</label>
                <input type="time" value={batch.outTime} onChange={e => setBatch(p => ({ ...p, outTime: e.target.value }))} style={INPUT} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#7a6050', fontWeight: '600' }}>加班開始（選填）</label>
                <input type="time" value={batch.otStart} onChange={e => setBatch(p => ({ ...p, otStart: e.target.value }))} style={INPUT} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', color: '#7a6050', fontWeight: '600' }}>加班結束（選填）</label>
                <input type="time" value={batch.otEnd} onChange={e => setBatch(p => ({ ...p, otEnd: e.target.value }))} style={INPUT} />
              </div>
            </div>
            {/* 員工勾選 */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', color: '#7a6050', fontWeight: '600' }}>選擇員工（{batch.empIds.length} 人）</span>
                <button onClick={() => setBatch(p => ({ ...p, empIds: p.empIds.length === data.employees.length ? [] : data.employees.map(e => e.id) }))}
                  style={{ fontSize: '11px', color: '#3a6d31', background: 'none', border: '1px solid #d8cbb8', borderRadius: '6px', padding: '2px 10px', cursor: 'pointer' }}>
                  {batch.empIds.length === data.employees.length ? '取消全選' : '全選'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.employees.map(e => {
                  const on = batch.empIds.includes(e.id)
                  return (
                    <button key={e.id} onClick={() => toggleBatchEmp(e.id)}
                      style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', fontWeight: '600',
                        border: `1.5px solid ${on ? '#3a6d31' : '#d8cbb8'}`, backgroundColor: on ? '#edf2ea' : '#fff', color: on ? '#3a6d31' : '#7a6050' }}>
                      {on ? '✓ ' : ''}{e.name}
                    </button>
                  )
                })}
              </div>
            </div>
            {batchMsg && <div style={{ fontSize: '13px', color: batchMsg.startsWith('✅') ? '#3a6d31' : '#c04030', fontWeight: '600', marginBottom: '10px' }}>{batchMsg}</div>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleBatchAdd} disabled={batch.empIds.length === 0}
                style={{ backgroundColor: batch.empIds.length ? '#3a6d31' : '#c8b8a8', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: '700', cursor: batch.empIds.length ? 'pointer' : 'default' }}>
                批次補登 {batch.empIds.length > 0 ? `（${batch.empIds.length} 人）` : ''}
              </button>
              <button onClick={() => setShowBatch(false)} style={{ backgroundColor: 'transparent', color: '#9a8070', border: '1px solid #d8cbb8', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer' }}>關閉</button>
            </div>
          </div>
        )}

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
                    {['姓名', '日期', '時間', '打卡類型', '地點', '操作'].map(h => (
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
                        <td style={{ padding: '10px 16px', fontWeight: '600', color: '#2c1a0e', whiteSpace: 'nowrap' }}>{resolveEmpName(c.empName, data.employees)}</td>

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

                        {/* 地點 */}
                        <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {Number.isFinite(c.lat) && Number.isFinite(c.lng) ? (
                            <a href={mapLink(c.lat, c.lng)} target="_blank" rel="noreferrer"
                              style={{ color: '#3a6d31', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                              title={`誤差約 ${c.accuracy ?? '?'} 公尺，點擊看地圖`}>
                              📍 {c.address || '查看地圖'}
                            </a>
                          ) : (
                            <span style={{ color: '#c8b8a8' }}>—</span>
                          )}
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
