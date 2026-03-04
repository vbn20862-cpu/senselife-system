import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import logo from '../assets/logo.jpeg'

const PUNCH_TYPES = [
  { type: '上班',   emoji: '☀️', color: '#3a6d31', bg: '#edf2ea', desc: '開始上班' },
  { type: '下班',   emoji: '🌙', color: '#5a4a8a', bg: '#f0eef8', desc: '結束下班' },
  { type: '加班開始', emoji: '⏰', color: '#b45309', bg: '#fef3c7', desc: '開始加班' },
  { type: '加班結束', emoji: '✅', color: '#0369a1', bg: '#e0f2fe', desc: '加班結束' },
]

export default function Checkin() {
  const { data, addItem } = useApp()
  const [selectedEmp, setSelectedEmp] = useState('')
  const [now, setNow] = useState(new Date())
  const [lastPunch, setLastPunch] = useState(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const today = now.toISOString().split('T')[0]
  const timeStr = now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = now.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

  const todayRecords = selectedEmp
    ? data.clockins
        .filter(c => c.empId === Number(selectedEmp) && c.date === today)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    : []

  function handlePunch(type) {
    const emp = data.employees.find(e => e.id === Number(selectedEmp))
    if (!emp) return
    const t = now.toTimeString().slice(0, 5)
    addItem('clockins', {
      id: Date.now(),
      empId: emp.id,
      empName: emp.name,
      date: today,
      time: t,
      type,
    })
    setLastPunch({ type, time: t })
    setTimeout(() => setLastPunch(null), 3000)
  }

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: '#1c2718',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', padding: '28px 20px', gap: '0',
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

        {/* 打卡類型按鈕 */}
        {selectedEmp && (
          <>
            <div style={{ fontSize: '12px', color: '#7a6050', fontWeight: '600' }}>選擇打卡類型</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
              </div>
            )}

            {/* 今日記錄 */}
            {todayRecords.length > 0 && (
              <div>
                <div style={{ fontSize: '12px', color: '#7a6050', fontWeight: '600', marginBottom: '8px' }}>今日打卡記錄</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {todayRecords.map(r => {
                    const pt = PUNCH_TYPES.find(p => p.type === r.type)
                    return (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '10px',
                        backgroundColor: pt?.bg || '#f5f0e8',
                      }}>
                        <span style={{ fontSize: '16px' }}>{pt?.emoji}</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: pt?.color || '#2c1a0e', flex: 1 }}>{r.type}</span>
                        <span style={{ fontSize: '14px', fontWeight: '700', color: '#2c1a0e' }}>{r.time}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ color: 'rgba(200,184,138,0.3)', fontSize: '11px', marginTop: '24px' }}>
        深活共構 · 員工打卡系統
      </div>
    </div>
  )
}
