// 人事管理 →「出勤」：待處理審核（延續加班、缺卡、加班卡、跨日、補登）＋打卡清單（可改時間／類型、刪除、新增）
// 取代原「打卡記錄」頁籤、選單的「出勤審核」與另開的「打卡後台」
import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { E } from '../../styles/earth'
import { mapLink } from '../../utils/geo'
import AttendanceReview, { myMissingPunches } from '../../pages/AttendanceReview'

const TYPES = ['上班', '下班', '加班開始', '加班結束']
const TYPE_STYLE = {
  '上班': ['#3a6d31', '#edf2ea'], '下班': ['#5a4a8a', '#f0eef8'],
  '加班開始': ['#b45309', '#fef3c7'], '加班結束': ['#0369a1', '#e0f2fe'],
}
const W = '日一二三四五六'
const ymNow = () => new Date().toLocaleDateString('sv-SE').slice(0, 7)

export default function AttendanceTab() {
  const { data, addItem, updateItem, deleteItem } = useApp()
  const { currentUser, isAdmin } = useAuth()
  const [month, setMonth] = useState(ymNow())
  const [who, setWho] = useState('all')
  const [editing, setEditing] = useState(null) // { id, time, type }
  const [adding, setAdding] = useState(null)   // { empId, date, time, type, note }

  const emps = (data.employees || []).filter(Boolean)
  const me = emps.find(e => e.name === currentUser?.name)
  const list = useMemo(() => (data.clockins || [])
    .filter(c => c && c.date?.startsWith(month))
    .filter(c => isAdmin ? (who === 'all' || c.empId === Number(who)) : c.empId === me?.id)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [data.clockins, month, who, isAdmin, me])

  const shiftMonth = n => { const [y, m] = month.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const saveEdit = () => {
    if (!/^\d{2}:\d{2}$/.test(editing.time)) return alert('時間格式 HH:MM')
    const c = list.find(x => x.id === editing.id)
    const changed = c.time !== editing.time || c.type !== editing.type
    if (changed) updateItem('clockins', c.id, { time: editing.time, type: editing.type, note: [c.note && !/^更正（原/.test(c.note) ? c.note : '', `更正（原 ${c.type === editing.type ? c.time : `${c.type} ${c.time}`}）`].filter(Boolean).join('；') })
    setEditing(null)
  }
  const remove = c => { if (window.confirm(`刪除 ${c.empName} ${c.date} ${c.time} ${c.type}？`)) deleteItem('clockins', c.id) }
  const saveAdd = () => {
    const a = adding, emp = emps.find(e => e.id === Number(a.empId))
    if (!emp || !a.date || !/^\d{2}:\d{2}$/.test(a.time)) return alert('請填員工、日期、時間')
    addItem('clockins', { id: Date.now(), empId: emp.id, empName: emp.name, date: a.date, time: a.time, type: a.type, note: (a.note || '').trim() || '補登' })
    setAdding(null)
  }

  const cell = { padding: '8px 10px', borderBottom: `1px solid ${E.divider}`, fontSize: '13px', verticalAlign: 'top' }
  const btn = { ...E.btnGhost, padding: '3px 9px', fontSize: '12px', display: 'inline-flex' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {isAdmin && <div style={{ ...E.card }}><AttendanceReview embedded /></div>}
      {!isAdmin && (() => {
        const miss = myMissingPunches(data, me?.id)
        if (!miss.length) return null
        return (
          <div style={{ ...E.card, background: '#fef3c7', border: '1px solid #f0d080' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#8a5a10' }}>⚠ 你有 {miss.length} 天缺下班卡</div>
            <div style={{ fontSize: '13px', color: '#7a5a20', marginTop: '4px', lineHeight: 1.6 }}>
              {miss.map(d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`).join('、')}：只有上班卡、沒有下班卡，這幾天目前不計工時。請在下一個工作日前用 LINE 告訴管理員實際下班時間並附佐證，經核定後補登；逾期不補登。
            </div>
          </div>
        )
      })()}

      <div style={{ ...E.card, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: E.textPrimary }}>打卡紀錄</div>
          <button onClick={() => shiftMonth(-1)} style={btn}>◀</button>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{month.replace('-', ' 年 ')} 月</span>
          <button onClick={() => shiftMonth(1)} style={btn}>▶</button>
          {isAdmin && (
            <select value={who} onChange={e => setWho(e.target.value)} style={{ ...E.input, width: 'auto', padding: '5px 8px', fontSize: '13px' }}>
              <option value="all">全部人員</option>
              {emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
          <span style={{ fontSize: '12px', color: E.textMuted }}>{list.length} 筆</span>
          {isAdmin && <button onClick={() => setAdding({ empId: who === 'all' ? '' : who, date: new Date().toLocaleDateString('sv-SE'), time: '', type: '上班', note: '' })} style={{ ...E.btnPrimary, padding: '6px 12px', fontSize: '12px', marginLeft: 'auto' }}>＋ 新增打卡</button>}
        </div>

        {adding && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', background: E.sandLight, padding: '10px', borderRadius: '10px' }}>
            <select value={adding.empId} onChange={e => setAdding(a => ({ ...a, empId: e.target.value }))} style={{ ...E.input, width: 'auto', fontSize: '13px' }}>
              <option value="">選員工</option>{emps.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input type="date" value={adding.date} onChange={e => setAdding(a => ({ ...a, date: e.target.value }))} style={{ ...E.input, width: 'auto', fontSize: '13px' }} />
            <input type="time" value={adding.time} onChange={e => setAdding(a => ({ ...a, time: e.target.value }))} style={{ ...E.input, width: 'auto', fontSize: '13px' }} />
            <select value={adding.type} onChange={e => setAdding(a => ({ ...a, type: e.target.value }))} style={{ ...E.input, width: 'auto', fontSize: '13px' }}>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <input value={adding.note} onChange={e => setAdding(a => ({ ...a, note: e.target.value }))} placeholder="備註（預設：補登）" style={{ ...E.input, width: '200px', fontSize: '13px' }} />
            <button onClick={saveAdd} style={{ ...E.btnPrimary, padding: '6px 12px', fontSize: '12px' }}>新增</button>
            <button onClick={() => setAdding(null)} style={btn}>取消</button>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '820px' }}>
            <thead><tr style={{ background: E.sandLight }}>
              {['日期', '姓名', '時間', '類型', '備註／加班原因', '地點', isAdmin ? '' : null].filter(x => x !== null).map(h => <th key={h} style={{ ...cell, textAlign: 'left', fontSize: '12px', color: E.textSecond, fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(c => {
                const [fg, bg] = TYPE_STYLE[c.type] || ['#555', '#eee']
                const isEdit = editing?.id === c.id
                const remark = [c.note, c.otReason ? `延續加班原因：${c.otReason}` : '', c.otStatus ? `（${c.otStatus}${c.otRejectReason ? `：${c.otRejectReason}` : ''}）` : ''].filter(Boolean).join(' ')
                return (
                  <tr key={c.id}>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{Number(c.date.slice(5, 7))}/{Number(c.date.slice(8))}（{W[new Date(c.date + 'T00:00:00').getDay()]}）</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap', fontWeight: 600 }}>{c.empName}</td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>{isEdit ? <input value={editing.time} onChange={e => setEditing(x => ({ ...x, time: e.target.value }))} style={{ ...E.input, width: '70px', padding: '3px 6px', fontSize: '13px' }} /> : c.time}</td>
                    <td style={cell}>{isEdit
                      ? <select value={editing.type} onChange={e => setEditing(x => ({ ...x, type: e.target.value }))} style={{ ...E.input, width: 'auto', padding: '3px 6px', fontSize: '12px' }}>{TYPES.map(t => <option key={t}>{t}</option>)}</select>
                      : <span style={{ fontSize: '12px', fontWeight: 600, color: fg, background: bg, padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{c.type}</span>}</td>
                    <td style={{ ...cell, color: E.textSecond, fontSize: '12px' }}>{remark}</td>
                    <td style={{ ...cell, fontSize: '12px' }}>{c.lat ? <a href={mapLink(c.lat, c.lng)} target="_blank" rel="noopener noreferrer" style={{ color: '#1a56a0' }}>{(c.address || '地圖').replace('屏東縣', '')}</a> : <span style={{ color: E.textMuted }}>—</span>}</td>
                    {isAdmin && <td style={{ ...cell, whiteSpace: 'nowrap', textAlign: 'right', minWidth: '96px' }}>
                      {isEdit
                        ? <><button onClick={saveEdit} style={{ ...btn, color: '#3a6d31' }}>儲存</button> <button onClick={() => setEditing(null)} style={btn}>取消</button></>
                        : <><button onClick={() => setEditing({ id: c.id, time: c.time, type: c.type })} style={btn}>改</button> <button onClick={() => remove(c)} style={{ ...btn, color: '#b42318' }}>刪</button></>}
                    </td>}
                  </tr>
                )
              })}
              {!list.length && <tr><td colSpan={7} style={{ ...cell, color: E.textMuted, textAlign: 'center' }}>這個月沒有打卡紀錄</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
