import { useState, useEffect } from 'react'

// 可打卡區域（公司所在地）：阿慶 2026-10-16 在地圖上畫的多邊形（涵蓋瑪家和平路與北葉辦公室），區域內才能打卡；
// 手機定位誤差最多再寬限 GEO_TOLERANCE_M 公尺（離邊界不超過此距離也算在內）
export const PUNCH_ZONES = [
  { name: '公司範圍', points: [[22.68118, 120.63623], [22.70478, 120.60722], [22.71444, 120.63108], [22.7089, 120.65237]] },
]
export const GEO_TOLERANCE_M = 50
// 經緯度 → 以區域中心為原點的公尺座標（等距圓柱近似，區域只有幾公里，誤差可忽略）
function toXY(lat, lng, lat0) { const k = 111320; return [(lng) * k * Math.cos(lat0 * Math.PI / 180), lat * k] }
function pointInPolygon(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
function distToSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]; const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}
// 回傳 { name, inside, edgeDist }：inside＝在區域內；edgeDist＝到最近邊界的公尺數
function nearestSite(lat, lng) {
  let best = null
  for (const z of PUNCH_ZONES) {
    const lat0 = z.points.reduce((s, q) => s + q[0], 0) / z.points.length
    const poly = z.points.map(q => toXY(q[0], q[1], lat0)), p = toXY(lat, lng, lat0)
    const inside = pointInPolygon(p, poly)
    let edgeDist = Infinity
    for (let i = 0; i < poly.length; i++) edgeDist = Math.min(edgeDist, distToSegment(p, poly[i], poly[(i + 1) % poly.length]))
    const dist = inside ? 0 : edgeDist
    if (!best || dist < best.dist) best = { name: z.name, inside, dist }
  }
  return best
}
import { useApp } from '../context/AppContext'
import { useIsMobile } from '../styles/earth'
import { getCurrentCoords, reverseGeocode } from '../utils/geo'
import { localTimestamp, extendedOTInfo } from '../utils/salaryCalc'
import { myMissingPunches } from './AttendanceReview'
import logo from '../assets/logo.jpeg'

const PUNCH_TYPES = [
  { type: '上班',   emoji: '☀️', color: '#3a6d31', bg: '#edf2ea', desc: '開始上班' },
  { type: '下班',   emoji: '🌙', color: '#5a4a8a', bg: '#f0eef8', desc: '結束下班' },
  { type: '加班開始', emoji: '⏰', color: '#b45309', bg: '#fef3c7', desc: '開始加班' },
  { type: '加班結束', emoji: '✅', color: '#0369a1', bg: '#e0f2fe', desc: '加班結束' },
]

export default function Checkin() {
  const { data, addItem, updateItem } = useApp()
  const mob = useIsMobile()
  const [selectedEmp, setSelectedEmp] = useState('')
  const [now, setNow] = useState(new Date())
  const [lastPunch, setLastPunch] = useState(null)
  const [otNoteOpen, setOtNoteOpen] = useState(false) // 加班結束（'加班結束'）或延續加班下班（'下班'）：填原因
  const [extInfo, setExtInfo] = useState(null)        // 延續加班試算 { hours, start }
  const [otNote, setOtNote] = useState('')
  // 定位狀態：idle | locating | ready | denied | unavailable
  const [geoStatus, setGeoStatus] = useState('idle')
  const [geo, setGeo] = useState(null)  // { lat, lng, accuracy, address }
  const [geoRetry, setGeoRetry] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // 選了員工就先在背景暖機定位（按打卡時才不會卡頓）
  useEffect(() => {
    if (!selectedEmp) { setGeoStatus('idle'); setGeo(null); return }
    let cancelled = false
    setGeoStatus('locating')
    setGeo(null)
    getCurrentCoords()
      .then(async coords => {
        if (cancelled) return
        setGeo(coords)
        setGeoStatus('ready')
        // 反向地理編碼（地址非必要，慢慢補）
        const address = await reverseGeocode(coords.lat, coords.lng)
        if (!cancelled && address) setGeo(g => g ? { ...g, address } : g)
      })
      .catch(err => {
        if (cancelled) return
        setGeoStatus(err.code === 'denied' ? 'denied' : 'unavailable')
      })
    return () => { cancelled = true }
  }, [selectedEmp, geoRetry])

  // 用「本地時區」日期，避免 toISOString() 以 UTC 計算造成早上 8 點前打卡被記成前一天
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  // 班表活動備註有填 = 活動日 → 不開放自助打卡（由管理員批次補登）
  const todayActivityNote = ((data.scheduleNotes || {})[today] || '').trim()
  const isActivityDay = !!todayActivityNote
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const todayRecords = selectedEmp
    ? data.clockins
        .filter(c => c.empId === Number(selectedEmp) && c.date === today)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    : []

  // 選了員工 → 顯示他的未結交辦（打卡順手更新狀態，不強制）
  const selEmpName = data.employees.find(e => e.id === Number(selectedEmp))?.name || ''
  const myDispatches = selEmpName
    ? (data.dispatches || []).filter(Boolean)
        .filter(d => d.assignee === selEmpName && ['待辦', '進行中', '暫停'].includes(d.status))
        .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    : []
  function setDispatchStatus(d, status) {
    updateItem('dispatches', d.id, { status, ...(status === '已完成' ? { completedAt: localTimestamp() } : {}) })
  }

  const hasGeo = geoStatus === 'ready' && geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)
  // 打卡地點限制：公司所在地半徑 100 公尺內才能打卡（2026-10-16 阿慶定）；定位誤差最多再寬限 50 公尺
  // 活動日、外勤由管理員在打卡後台統一登記，不受此限
  const site = hasGeo ? nearestSite(geo.lat, geo.lng) : null
  const tolerance = hasGeo ? Math.min(Number(geo.accuracy) || 0, GEO_TOLERANCE_M) : 0
  const inRange = !!site && (site.inside || site.dist <= tolerance)
  const canPunch = hasGeo && inRange
  // 加班卡（加班開始／加班結束）不設定位置限制（2026-10-19 阿慶定）；加班結束必須填加班內容
  const isOTType = t => t === '加班開始' || t === '加班結束'
  const canPunchType = t => isOTType(t) ? true : canPunch

  function handlePunch(type, note) {
    const emp = data.employees.find(e => e.id === Number(selectedEmp))
    if (!emp) return
    // 上班／下班：一定要有定位且在公司範圍內；加班卡不限位置（管理員補登走打卡後台，不受此限）
    if (!canPunchType(type)) return
    if (type === '加班結束' && !note) { setExtInfo(null); setOtNoteOpen('加班結束'); return } // 先填加班內容
    const t = now.toTimeString().slice(0, 5)
    // 跨日下班：凌晨 06:00 前打「下班」，且今天沒有上班卡、前一天有上班沒下班 → 記在前一天（工時計算會自動跨午夜）
    let punchDate = today, crossNote = ''
    if (type === '下班' && t < '06:00') {
      const y = new Date(now); y.setDate(y.getDate() - 1)
      const yday = y.toLocaleDateString('sv-SE')
      const mine = c => c.empId === emp.id
      const todayIn = data.clockins.some(c => mine(c) && c.date === today && c.type === '上班')
      const yIn = data.clockins.some(c => mine(c) && c.date === yday && c.type === '上班')
      const yOut = data.clockins.some(c => mine(c) && c.date === yday && c.type === '下班')
      if (!todayIn && yIn && !yOut) { punchDate = yday; crossNote = `跨日下班（實際 ${today.slice(5).replace('-', '/')} ${t}）` }
    }
    const rec = {
      id: Date.now(),
      empId: emp.id,
      empName: emp.name,
      date: punchDate,
      time: t,
      type,
      ...(crossNote ? { note: crossNote } : {}),
    }
    // 延續加班：下班時從上班起算超過 10 小時 → 第 10 小時之後進加班池（待核准），必填原因
    if (type === '下班') {
      const dayRecs = data.clockins.filter(c => c.empId === emp.id && c.date === punchDate)
      const info = extendedOTInfo([...dayRecs, rec], punchDate, data)
      if (info) {
        if (!note) { setExtInfo({ hours: Math.round(info.extMin / 6) / 10 }); setOtNoteOpen('下班'); return }
        rec.otReason = note; rec.otStatus = '待核准'
      }
    }
    if (hasGeo) {
      rec.lat = geo.lat
      rec.lng = geo.lng
      rec.accuracy = geo.accuracy
      if (geo.address) rec.address = geo.address
    }
    if (note && type === '加班結束') rec.note = `加班內容：${note}`
    addItem('clockins', rec)
    setLastPunch({ type, time: t, located: hasGeo })
    setOtNoteOpen(false); setOtNote('')
    setTimeout(() => setLastPunch(null), 3000)
  }

  // 定位狀態提示文字
  const geoHint = {
    idle:        null,
    locating:    { icon: '🔍', text: '定位中…', color: '#9a8070' },
    ready:       inRange
      ? { icon: '📍', text: `${site.name}內（誤差約 ${geo?.accuracy ?? '?'} 公尺）`, color: '#3a6d31' }
      : { icon: '⛔', text: `不在公司範圍內，無法打卡：距範圍邊界約 ${site ? Math.round(site.dist) : '?'} 公尺（誤差約 ${geo?.accuracy ?? '?'} 公尺）。外勤或活動請於打卡時間通知管理員登記。`, color: '#b42318' },
    denied:      { icon: '⛔', text: '未開啟定位權限，無法打卡。請到手機設定允許瀏覽器使用位置，再按「重新定位」。', color: '#b42318' },
    unavailable: { icon: '⛔', text: '抓不到位置，無法打卡。請確認手機定位已開啟，再按「重新定位」。', color: '#b42318' },
  }[geoStatus]

  return (
    <div style={{
      height: '100dvh', overflowY: 'auto', overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      backgroundColor: '#1c2718',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '28px 20px',
      paddingTop: 'calc(28px + env(safe-area-inset-top))',
      paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
      gap: '0',
      boxSizing: 'border-box',
    }}>
      {/* Logo */}
      <img src={logo} alt="深活共構" style={{ height: '60px', filter: 'invert(1)', mixBlendMode: 'screen', marginBottom: '4px' }} />

      {/* 時間 */}
      <div style={{ color: '#c8b88a', fontSize: '48px', fontWeight: '700', letterSpacing: '2px', lineHeight: 1.1, marginTop: '16px' }}>
        {timeStr}
      </div>
      <div style={{ color: 'rgba(200,184,138,0.55)', fontSize: '13px', marginTop: '6px', marginBottom: '24px' }}>
        {dateStr}
      </div>

      {/* 主卡片 */}
      <div style={{
        backgroundColor: '#fdfaf5', borderRadius: '20px', padding: '24px 20px',
        width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      }}>
        {/* 員工選擇 */}
        <div>
          <label style={{ fontSize: '12px', color: '#7a6050', fontWeight: '600', display: 'block', marginBottom: '6px' }}>請選擇姓名</label>
          <select value={selectedEmp} onChange={e => { setSelectedEmp(e.target.value); setLastPunch(null) }} style={{
            width: '100%', border: '1px solid #d8cbb8', borderRadius: '10px',
            padding: '11px 12px', fontSize: '15px', backgroundColor: '#fdfaf5',
            color: '#2c1a0e', cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
          }}>
            <option value="">-- 選擇員工 --</option>
            {data.employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </div>

        {/* 定位狀態 */}
        {selectedEmp && geoHint && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '10px',
            backgroundColor: (geoStatus === 'ready' && inRange) ? '#edf2ea' : geoStatus === 'locating' ? '#f5f0e8' : '#fef3e0',
            border: `1px solid ${(geoStatus === 'ready' && inRange) ? '#cfe0c8' : geoStatus === 'locating' ? '#e6dcc8' : '#f0d0a0'}`,
          }}>
            <span style={{ fontSize: '14px' }}>{geoHint.icon}</span>
            <span style={{ fontSize: '12px', color: geoHint.color, fontWeight: '500', lineHeight: 1.4, flex: 1 }}>{geoHint.text}</span>
            {(geoStatus === 'denied' || geoStatus === 'unavailable' || (geoStatus === 'ready' && !inRange)) && (
              <button onClick={() => setGeoRetry(n => n + 1)} style={{ flexShrink: 0, border: '1px solid #b42318', background: '#fff', color: '#b42318', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>重新定位</button>
            )}
          </div>
        )}

        {/* 活動日：不開放打卡 */}
        {selectedEmp && isActivityDay && (
          <div style={{
            textAlign: 'center', padding: '20px 16px', borderRadius: '14px',
            backgroundColor: '#fef3e0', border: '1px solid #f0d0a0',
          }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📅</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#8a4a18' }}>今日為活動日</div>
            <div style={{ fontSize: '13px', color: '#a86a30', marginTop: '4px' }}>{todayActivityNote}</div>
            <div style={{ fontSize: '12px', color: '#9a8070', marginTop: '10px', lineHeight: 1.5 }}>
              活動日出勤由管理員統一登記，<br />無需自行打卡。
            </div>
          </div>
        )}

        {/* 缺下班卡提醒 */}
        {selectedEmp && (() => {
          const miss = myMissingPunches(data, Number(selectedEmp))
          if (!miss.length) return null
          return (
            <div style={{ background: '#fef3c7', border: '1px solid #f0d080', borderRadius: '10px', padding: '10px 12px', fontSize: '12.5px', color: '#7a5a20', lineHeight: 1.6 }}>
              <b style={{ color: '#8a5a10' }}>⚠ 你有 {miss.length} 天缺下班卡：</b>{miss.map(d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`).join('、')}。這幾天目前不計工時，請用 LINE 告訴管理員實際下班時間並附佐證。
            </div>
          )
        })()}

        {/* 打卡類型按鈕 */}
        {selectedEmp && !isActivityDay && (
          <>
            <div style={{ fontSize: '12px', color: '#7a6050', fontWeight: '600' }}>選擇打卡類型{!hasGeo ? <span style={{ fontWeight: '400', color: '#9a8070' }}>（取得定位後才能打卡）</span> : null}</div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              {PUNCH_TYPES.map(({ type, emoji, color, bg, desc }) => (
                <button key={type} onClick={() => handlePunch(type)} disabled={!canPunchType(type)} style={{
                  backgroundColor: bg, border: `2px solid ${color}20`,
                  borderRadius: '14px', padding: '16px 10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  cursor: canPunchType(type) ? 'pointer' : 'not-allowed', opacity: canPunchType(type) ? 1 : 0.4, transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: '28px' }}>{emoji}</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color }}>{type}</span>
                  <span style={{ fontSize: '11px', color: '#9a8070' }}>{type === '加班結束' ? '結束後填加班內容' : desc}</span>
                </button>
              ))}
            </div>

            {/* 加班結束：必填加班內容 */}
            {otNoteOpen && (
              <div style={{ backgroundColor: '#e0f2fe', border: '1px solid #7fb8d8', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#0369a1' }}>{otNoteOpen === '下班' ? `🌙 今天從上班起算已超過 10 小時，第 10 小時之後約 ${extInfo?.hours ?? ''} 小時會進加班池，請說明延續加班原因（必填，主管核准後計入）` : '✅ 加班結束：請說明這次加班做了什麼（必填）'}</div>
                <textarea value={otNote} onChange={e => setOtNote(e.target.value)} rows={3} placeholder="例：慢城活動器材整理、報告修改到 20:30"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #b8d4e4', borderRadius: '8px', padding: '8px 10px', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setOtNoteOpen(false); setOtNote('') }} style={{ border: '1px solid #b8d4e4', background: '#fff', color: '#5a6a7a', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}>取消</button>
                  <button onClick={() => { const n = otNote.trim(); if (n.length < 4) { alert('加班內容至少 4 個字'); return } handlePunch(otNoteOpen === '下班' ? '下班' : '加班結束', n) }}
                    style={{ border: 'none', background: '#0369a1', color: '#fff', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>{otNoteOpen === '下班' ? '送出並打下班卡' : '送出並打加班結束卡'}</button>
                </div>
              </div>
            )}

            {/* 成功提示 */}
            {lastPunch && (
              <div style={{
                textAlign: 'center', fontSize: '15px', fontWeight: '600',
                color: '#3a6d31', backgroundColor: '#edf2ea',
                borderRadius: '10px', padding: '12px',
              }}>
                ✓ {lastPunch.type} 打卡成功！{lastPunch.time}
                <div style={{ fontSize: '11px', fontWeight: '500', color: lastPunch.located ? '#3a6d31' : '#b45309', marginTop: '4px' }}>
                  {lastPunch.located ? '📍 已記錄打卡位置' : '⚠️ 未記錄位置'}
                </div>
              </div>
            )}
          </>
        )}

        {/* 今日記錄（活動日也看得到，由管理員登記的） */}
        {selectedEmp && todayRecords.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: '#7a6050', fontWeight: '600', marginBottom: '8px' }}>今日打卡記錄</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {todayRecords.map(r => {
                const pt = PUNCH_TYPES.find(p => p.type === r.type)
                const hasLoc = Number.isFinite(r.lat) && Number.isFinite(r.lng)
                return (
                  <div key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '10px',
                    backgroundColor: pt?.bg || '#f5f0e8',
                  }}>
                    <span style={{ fontSize: '16px' }}>{pt?.emoji}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: pt?.color || '#2c1a0e', flex: 1 }}>
                      {r.type}
                      {hasLoc && (
                        <span style={{ fontSize: '11px', fontWeight: '500', color: '#7a6050', marginLeft: '6px' }}>
                          📍{r.address || '已定位'}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#2c1a0e' }}>{r.time}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {/* 未結交辦（順手更新，不強制） */}
        {selectedEmp && myDispatches.length > 0 && (
          <div>
            <div style={{ fontSize: '12px', color: '#7a6050', fontWeight: '600', marginBottom: '8px' }}>
              📋 你的未結交辦（{myDispatches.length}）<span style={{ fontWeight: '400', color: '#a89078' }}>順手更新一下進度</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {myDispatches.map(d => {
                const overdue = d.dueDate && d.dueDate < today
                return (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                    padding: '9px 12px', borderRadius: '10px',
                    backgroundColor: overdue ? '#fbecea' : '#f5f0e8',
                    border: overdue ? '1px solid #e8c4be' : '1px solid transparent',
                  }}>
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#2c1a0e' }}>{d.title}</div>
                      <div style={{ fontSize: '11px', color: overdue ? '#c0202a' : '#9a8070', fontWeight: overdue ? '700' : '500' }}>
                        {d.category}{d.dueDate ? ` · ${d.dueDate.slice(5)} 交付${overdue ? '（逾期）' : ''}` : ''} · {d.status}
                      </div>
                    </div>
                    {d.status === '待辦' && (
                      <button onClick={() => setDispatchStatus(d, '進行中')} style={{
                        fontSize: '12px', fontWeight: '700', padding: '7px 12px', borderRadius: '8px',
                        border: '1px solid #b8cce0', backgroundColor: '#e0edf8', color: '#2f5a80', cursor: 'pointer',
                      }}>▶ 開始</button>
                    )}
                    <button onClick={() => setDispatchStatus(d, '已完成')} style={{
                      fontSize: '12px', fontWeight: '700', padding: '7px 12px', borderRadius: '8px',
                      border: '1px solid #b8d4c0', backgroundColor: '#e4f0e8', color: '#2e6040', cursor: 'pointer',
                    }}>✓ 完成</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ color: 'rgba(200,184,138,0.3)', fontSize: '11px', marginTop: '24px' }}>
        深活共構 · 員工打卡系統
      </div>
    </div>
  )
}
