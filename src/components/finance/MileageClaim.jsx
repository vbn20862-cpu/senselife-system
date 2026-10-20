// 費用報支 → 交通費（自用車里程）：起點、中間點（可多個）、終點 → Google 開車路線算公里數（無條件捨去）× 每公里 3 元
// 送出狀態「待審核」，管理員核准後才入帳目並轉「待還款」（2026-10-20 阿慶定）；其他交通（客運、火車、計程車、過路費）走一般報支、實報實銷
import { useState } from 'react'
import { E } from '../../styles/earth'

export const MILEAGE_RATE = 3

export default function MileageClaim({ data, isAdmin, currentUser, onSubmit, onCancel }) {
  const [f, setF] = useState({ date: new Date().toLocaleDateString('sv-SE'), person: isAdmin ? '' : (currentUser?.name || ''), project: '', purpose: '', origin: '', destination: '', waypoints: [] })
  const [calc, setCalc] = useState(null) // { km, meters, mapUrl, key }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const routeKey = [f.origin, ...f.waypoints, f.destination].map(s => s.trim()).join('→')
  const stale = calc && calc.key !== routeKey
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  async function compute() {
    setErr('')
    if (!f.origin.trim() || !f.destination.trim()) return setErr('請填起點和終點')
    setBusy(true)
    try {
      const res = await fetch('/.netlify/functions/route-distance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: f.origin, destination: f.destination, waypoints: f.waypoints.filter(w => w.trim()) }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `查詢失敗（${res.status}）`)
      setCalc({ ...j, key: routeKey })
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  function submit() {
    if (!f.date || !f.person.trim() || !f.project || !f.purpose.trim()) return setErr('日期、申請人、案件、事由都要填')
    if (!calc || stale) return setErr('路線有改過，請先按「計算公里數」')
    if (calc.km <= 0) return setErr('距離不到 1 公里，不需要報支')
    const route = [f.origin, ...f.waypoints.filter(w => w.trim()), f.destination].join(' → ')
    onSubmit({
      date: f.date, person: f.person.trim(), project: f.project, method: '轉帳',
      vendor: '自用車里程', receiptNo: '', category: '交通', account: '旅費',
      description: `交通費（自用車）${f.purpose.trim()}：${route}，${calc.km} 公里`,
      amount: calc.km * MILEAGE_RATE, status: '待審核', claimType: 'mileage',
      mileage: { origin: f.origin.trim(), waypoints: f.waypoints.filter(w => w.trim()), destination: f.destination.trim(), meters: calc.meters, km: calc.km, rate: MILEAGE_RATE, mapUrl: calc.mapUrl, purpose: f.purpose.trim() },
    })
  }

  const L = ({ children }) => <label style={{ fontSize: '12px', color: E.textSecond, display: 'block', marginBottom: '4px' }}>{children}</label>
  const projects = (data.projects || []).filter(p => p && (p.status === '執行中' || p.status === '長期'))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '12px', color: '#7a5a20', background: '#fef3c7', borderRadius: '8px', padding: '8px 10px', lineHeight: 1.6 }}>
        自用車（汽車、機車）依 Google 開車路線公里數計算，<b>每公里 {MILEAGE_RATE} 元</b>，小數點無條件捨去。送出後由管理員審核，核准才入帳。客運、火車、計程車、過路費、停車費請用「一般費用」附收據實報實銷。
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div><L>日期 *</L><input type="date" value={f.date} onChange={e => set('date', e.target.value)} style={E.input} /></div>
        <div><L>申請人 *</L><input value={f.person} onChange={e => set('person', e.target.value)} readOnly={!isAdmin} style={{ ...E.input, ...(isAdmin ? {} : { background: '#f5f0e8', color: E.textSecond }) }} /></div>
      </div>
      <div><L>關聯案件 *</L>
        <select value={f.project} onChange={e => set('project', e.target.value)} style={E.input}>
          <option value="">請選擇</option><option value="Admin_sl">Admin_sl 行政用</option>
          {projects.map(p => <option key={p.id} value={p.id}>[{p.code || p.id}] {p.name}</option>)}
        </select>
      </div>
      <div><L>事由 *</L><input value={f.purpose} onChange={e => set('purpose', e.target.value)} placeholder="例：霧臺鄉公所開會、載活動器材" style={E.input} /></div>
      <div><L>起點 *</L><input value={f.origin} onChange={e => set('origin', e.target.value)} placeholder="例：屏東縣瑪家鄉和平路一段65號" style={E.input} /></div>
      {f.waypoints.map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><L>中間點 {i + 1}</L><input value={w} onChange={e => setF(x => ({ ...x, waypoints: x.waypoints.map((v, j) => j === i ? e.target.value : v) }))} placeholder="經過的地點" style={E.input} /></div>
          <button onClick={() => setF(x => ({ ...x, waypoints: x.waypoints.filter((_, j) => j !== i) }))} style={{ ...E.btnGhost, padding: '8px 10px', color: '#b42318' }}>✕</button>
        </div>
      ))}
      <button onClick={() => setF(x => ({ ...x, waypoints: [...x.waypoints, ''] }))} style={{ ...E.btnGhost, alignSelf: 'flex-start', padding: '4px 10px', fontSize: '12px' }}>＋ 新增中間點</button>
      <div><L>終點 *</L><input value={f.destination} onChange={e => set('destination', e.target.value)} placeholder="例：屏東縣霧臺鄉公所（來回請把終點填回起點）" style={E.input} /></div>
      <button onClick={compute} disabled={busy} style={{ ...E.btnGhost, padding: '9px 0', fontWeight: 600 }}>{busy ? '計算中…' : '📍 用 Google 地圖計算公里數'}</button>
      {calc && (
        <div style={{ background: stale ? '#fce8e0' : '#edf2ea', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.7 }}>
          {stale ? '路線改過了，請重新計算。' : (<>
            距離 {(calc.meters / 1000).toFixed(1)} 公里 → 計 <b>{calc.km} 公里 × {MILEAGE_RATE} 元 ＝ NT${(calc.km * MILEAGE_RATE).toLocaleString()}</b>
            {' '}<a href={calc.mapUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1a56a0' }}>看路線</a>
          </>)}
        </div>
      )}
      {err && <div style={{ background: '#fce8e0', color: '#8a3020', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>⚠ {err}</div>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onCancel} style={{ ...E.btnGhost, flex: 1, padding: '11px 0' }}>取消</button>
        <button onClick={submit} style={{ ...E.btnPrimary, flex: 2, padding: '11px 0' }}>送出審核</button>
      </div>
    </div>
  )
}
