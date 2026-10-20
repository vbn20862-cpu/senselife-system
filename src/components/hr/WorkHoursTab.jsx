// 人事管理 →「工時」：與薪資同一套引擎（computeCompLedger），每人一列，點開看逐日
// 取代原「工時統計」（舊算法加班只看打卡、沒有缺時與請假，與薪資頁對不起來）
import { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { E } from '../../styles/earth'
import { computeCompLedger, leavesInMonth, effectiveSetting } from '../../utils/payrollEngine'
import { normalDayMinutes, activityExtraOTMinutes, computeOTSpans, extendedOTInfo, isActivityDay } from '../../utils/salaryCalc'

const W = '日一二三四五六'
const pad = n => String(n).padStart(2, '0')
const h = m => Math.round(m / 6) / 10
const ymNow = () => new Date().toLocaleDateString('sv-SE').slice(0, 7)
const SHIFT_H = { '出勤': 8, 'W': 8, '上午班': 4, '下午班': 4 }

function dayRows(emp, yr, mo, data, tm) {
  const ym = `${yr}-${pad(mo)}`
  const recs = (data.clockins || []).filter(c => c && c.empId === emp.id && c.date?.startsWith(ym))
  const otByDate = {}
  for (const sp of computeOTSpans(recs)) if (!sp.missingEnd && !sp.missingStart && sp.startDate) otByDate[sp.startDate] = (otByDate[sp.startDate] || 0) + sp.minutes
  const sched = Object.fromEntries((data.schedules || []).filter(s => s && s.empId === emp.id && s.year === yr && s.month === mo).map(s => [`${ym}-${pad(s.day)}`, s.shift]))
  const defMap = Object.fromEntries((tm.deficitDates || []).map(x => [x.date, x.hours]))
  const leaves = (data.leaveRequests || []).filter(l => l && l.empId === emp.id && l.status === '已核准')
  const dates = [...new Set([...recs.map(c => c.date), ...Object.keys(sched).filter(d => SHIFT_H[sched[d]])])].sort()
  return dates.map(d => {
    const dr = recs.filter(c => c.date === d).sort((a, b) => a.time.localeCompare(b.time))
    const pick = t => dr.filter(c => c.type === t).map(c => c.time).join('/')
    const ext = extendedOTInfo(dr, d, data)
    const lv = leaves.filter(l => d >= (l.startDate || l.date) && d <= (l.endDate || l.startDate)).map(l => l.type + (l.halfDay ? '半天' : ''))
    const hasIn = dr.some(c => c.type === '上班'), hasOut = dr.some(c => c.type === '下班')
    const past = d < new Date().toLocaleDateString('sv-SE')
    const flags = [
      past && !dr.length && !lv.length && SHIFT_H[sched[d]] ? '無打卡' : '', past && hasIn && !hasOut ? '缺下班卡' : '', !past && !dr.length ? '未到' : '',
      isActivityDay(d, data) ? '活動日' : '', ext ? `延續加班 ${h(ext.extMin)}h（${ext.status}）` : '',
      dr.some(c => /補登|更正|跨日/.test(c.note || '')) ? '有補登／更正' : '',
    ].filter(Boolean)
    return {
      d, w: W[new Date(d + 'T00:00:00').getDay()], shift: sched[d] || '—', in: pick('上班'), out: pick('下班'),
      normal: h(normalDayMinutes(dr, d, data)), ot: h((otByDate[d] || 0) + activityExtraOTMinutes(dr, d, data)),
      leave: lv.join('、'), def: defMap[d] || 0, flags,
    }
  })
}

export default function WorkHoursTab() {
  const { data } = useApp()
  const { currentUser, isAdmin } = useAuth()
  const [month, setMonth] = useState(ymNow())
  const [open, setOpen] = useState(null)
  const [yr, mo] = month.split('-').map(Number)
  const emps = (data.employees || []).filter(Boolean).filter(e => isAdmin || e.name === currentUser?.name)

  const rows = useMemo(() => emps.map(emp => {
    const L = computeCompLedger(emp, data, { year: yr, month: mo })
    const tm = L.monthly.find(m => m.year === yr && m.month === mo) || {}
    const setting = effectiveSetting((data.salarySettings || []).find(s => s && s.empId === emp.id), yr, mo)
    const lv = leavesInMonth(emp, yr, mo, data).filter(l => l.status === '已核准')
    const leaveDays = lv.reduce((s, l) => s + (l.halfDay ? 0.5 : l.daysInMonth), 0)
    const recs = (data.clockins || []).filter(c => c && c.empId === emp.id && c.date?.startsWith(month))
    const byDay = {}; for (const c of recs) (byDay[c.date] ||= []).push(c)
    let extPend = 0, extOk = 0
    for (const [d, dr] of Object.entries(byDay)) { const x = extendedOTInfo(dr, d, data); if (x) x.status === '核准' ? extOk += x.extMin : x.status === '待核准' ? extPend += x.extMin : 0 }
    return { emp, tm, hourly: setting?.payType === 'hourly', leaveDays, extPend: h(extPend), extOk: h(extOk) }
  }), [data, month])

  const shiftMonth = n => { const d = new Date(yr, mo - 1 + n, 1); setMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`) }
  const stat = (label, val, color) => (
    <div style={{ minWidth: '74px' }}>
      <div style={{ fontSize: '11px', color: E.textMuted }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 800, color: color || E.textPrimary }}>{val}</div>
    </div>
  )
  const cell = { padding: '6px 8px', borderBottom: `1px solid ${E.divider}`, fontSize: '12px', whiteSpace: 'nowrap' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => shiftMonth(-1)} style={{ ...E.btnGhost, padding: '4px 10px' }}>◀</button>
        <span style={{ fontSize: '15px', fontWeight: 700, color: E.textPrimary }}>{yr} 年 {mo} 月 工時</span>
        <button onClick={() => shiftMonth(1)} style={{ ...E.btnGhost, padding: '4px 10px' }}>▶</button>
        <span style={{ fontSize: '12px', color: E.textMuted }}>與薪資頁同一套算法；今天與未來的日子不計缺時</span>
      </div>

      {rows.map(({ emp, tm, hourly, leaveDays, extPend, extOk }) => (
        <div key={emp.id} style={{ ...E.card }}>
          <div onClick={() => setOpen(o => o === emp.id ? null : emp.id)} style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', cursor: 'pointer' }}>
            <div style={{ width: '72px', fontWeight: 700, fontSize: '15px', color: E.textPrimary }}>{emp.name}</div>
            {stat('排班應到', `${tm.scheduledH ?? 0}h`)}
            {stat('實際正常', `${tm.normalH ?? 0}h`)}
            {stat('請假', `${leaveDays} 天`)}
            {!hourly && stat('缺時', `${tm.deficitHours ?? 0}h`, tm.deficitHours > 0 ? '#b42318' : null)}
            {stat('加班→補休', `${tm.accruedHours ?? 0}h`, '#3a6d31')}
            {(extPend > 0 || extOk > 0) && stat('延續加班', `${extOk}h${extPend ? ` ＋待核 ${extPend}h` : ''}`, extPend ? '#b45309' : '#3a6d31')}
            {!hourly && stat('補休餘額', `${tm.balHours ?? 0}h`)}
            {tm.ledgerOn
              ? stat('時數帳', `欠 ${tm.ledger?.close ?? 0}h`, '#b42318')
              : !hourly && stat('缺時扣薪', tm.dockAmount ? `NT$${tm.dockAmount.toLocaleString()}` : '—', tm.dockAmount ? '#b42318' : null)}
            {hourly && <span style={{ fontSize: '12px', color: E.textMuted }}>時薪制：依打卡時數計薪，不計缺時</span>}
            {(tm.missingPunchDates || []).length > 0 && <span style={{ fontSize: '12px', color: '#b45309' }}>⚠ 缺下班卡 {tm.missingPunchDates.map(d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`).join('、')}</span>}
            <span style={{ marginLeft: 'auto', color: E.textMuted }}>{open === emp.id ? '▲' : '▼'}</span>
          </div>
          {open === emp.id && (
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
                <thead><tr style={{ background: E.sandLight }}>
                  {['日期', '排班', '上班', '下班', '正常', '加班', '請假', '缺時', '備註'].map(x => <th key={x} style={{ ...cell, textAlign: 'left', color: E.textSecond }}>{x}</th>)}
                </tr></thead>
                <tbody>
                  {dayRows(emp, yr, mo, data, tm).map(r => (
                    <tr key={r.d} style={{ background: r.def > 0 ? '#fdf3f1' : 'transparent' }}>
                      <td style={cell}>{Number(r.d.slice(5, 7))}/{Number(r.d.slice(8))}（{r.w}）</td>
                      <td style={cell}>{r.shift}</td>
                      <td style={cell}>{r.in || '—'}</td>
                      <td style={cell}>{r.out || '—'}</td>
                      <td style={cell}>{r.normal || ''}</td>
                      <td style={{ ...cell, color: '#3a6d31' }}>{r.ot || ''}</td>
                      <td style={cell}>{r.leave}</td>
                      <td style={{ ...cell, color: '#b42318', fontWeight: r.def ? 700 : 400 }}>{r.def || ''}</td>
                      <td style={{ ...cell, whiteSpace: 'normal', color: E.textSecond }}>{r.flags.join('、')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
