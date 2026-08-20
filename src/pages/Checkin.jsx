import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useIsMobile } from '../styles/earth'
import { getCurrentCoords, reverseGeocode } from '../utils/geo'
import { localTimestamp } from '../utils/salaryCalc'
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
  // 定位狀態：idle | locating | ready | denied | unavailable
  const [geoStatus, setGeoStatus] = useState('idle')
  const [geo, setGeo] = useState(null)  // { lat, lng, accuracy, address }

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
  }, [selectedEmp])

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

  function handlePunch(type) {
    const emp = data.employees.find(e => e.id === Number(selectedEmp))
    if (!emp) return
    const t = now.toTimeString().slice(0, 5)
    const rec = {
      id: Date.now(),
      empId: emp.id,
      empName: emp.name,
      date: today,
      time: t,
      type,
    }
    // 有定位才寫入位置欄位（避免存 undefined 到 Firebase）
    if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
      rec.lat = geo.lat
      rec.lng = geo.lng
      rec.accuracy = geo.accuracy
      if (geo.address) rec.address = geo.address
    }
    addItem('clockins', rec)
    setLastPunch({ type, time: t, located: !!(geo && geo.lat) })
    setTimeout(() => setLastPunch(null), 3000)
  }

  // 定位狀態提示文字
  const geoHint = {
    idle:        null,
    locating:    { icon: '🔍', text: '定位中…', color: '#9a8070' },
    ready:       { icon: '📍', text: geo?.address ? geo.address : `已取得位置（誤差約 ${geo?.accuracy ?? '?'} 公尺）`, color: '#3a6d31' },
    denied:      { icon: '⚠️', text: '未提供位置權限（仍可打卡）', color: '#b45309' },
    unavailable: { icon: '⚠️', text: '無法定位（仍可打卡）', color: '#b45309' },
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
            backgroundColor: geoStatus === 'ready' ? '#edf2ea' : geoStatus === 'locating' ? '#f5f0e8' : '#fef3e0',
            border: `1px solid ${geoStatus === 'ready' ? '#cfe0c8' : geoStatus === 'locating' ? '#e6dcc8' : '#f0d0a0'}`,
          }}>
            <span style={{ fontSize: '14px' }}>{geoHint.icon}</span>
            <span style={{ fontSize: '12px', color: geoHint.color, fontWeight: '500', lineHeight: 1.4, flex: 1 }}>{geoHint.text}</span>
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

        {/* 打卡類型按鈕 */}
        {selectedEmp && !isActivityDay && (
          <>
            <div style={{ fontSize: '12px', color: '#7a6050', fontWeight: '600' }}>選擇打卡類型</div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: '10px' }}>
              {PUNCH_TYPES.map(({ type, emoji, color, bg, desc }) => (
                <button key={type} onClick={() => handlePunch(type)} style={{
                  backgroundColor: bg, border: `2px solid ${color}20`,
                  borderRadius: '14px', padding: '16px 10px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  <span style={{ fontSize: '28px' }}>{emoji}</span>
                  <span style={{ fontSize: '15px', fontWeight: '700', color }}>{type}</span>
                  <span style={{ fontSize: '11px', color: '#9a8070' }}>{desc}</span>
                </button>
              ))}
            </div>

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
