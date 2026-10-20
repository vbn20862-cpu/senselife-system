// 出勤審核（管理員）：延續加班核准／駁回、加班卡內容、跨日下班、缺下班卡補登、補登更正紀錄
// 延續加班規則見 utils/salaryCalc.js extendedOTInfo（第 10 小時起進加班池，核准才計入）
import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { E } from '../styles/earth'
import { extendedOTInfo, EXT_OT_FROM, localTimestamp } from '../utils/salaryCalc'

export const REJECT_REASONS = [
  '下班後處理私人事務，非提供勞務',
  '等候交通、接送或休息，非工作時間',
  '忘記打下班卡，實際下班時間較早',
  '該時段已另打加班卡，不重複計算',
  '當日為活動日，已依集合至解散時間計入',
  '其他',
]
const W = '日一二三四五六'
const md = d => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}（${W[new Date(d + 'T00:00:00').getDay()]}）`
const H = m => `${Math.round(m / 6) / 10}h`

// 員工自己的缺下班卡日期（過去日子、有上班沒下班），選單紅點與打卡頁提醒用
export function myMissingPunches(data, empId) {
  if (!empId) return []
  return collect(data).missing.filter(m => m.empId === empId).map(m => m.date).sort()
}

// 給選單紅點用：待核准延續加班＋過去日子缺下班卡
export function pendingReviewCount(data) {
  const { ext, missing } = collect(data)
  return ext.filter(x => x.info.status === '待核准').length + missing.length
}

function collect(data) {
  const today = new Date().toLocaleDateString('sv-SE')
  const recs = (data.clockins || []).filter(c => c && c.date >= EXT_OT_FROM)
  const byDay = {}
  for (const c of recs) (byDay[`${c.empId}|${c.date}`] ||= []).push(c)
  const ext = [], missing = [], otCards = [], cross = [], edits = []
  for (const [k, dayRecs] of Object.entries(byDay)) {
    const [, date] = k.split('|')
    const info = extendedOTInfo(dayRecs, date, data)
    if (info) ext.push({ date, name: dayRecs[0].empName, dayRecs, info })
    const hasIn = dayRecs.some(c => c.type === '上班'), hasOut = dayRecs.some(c => c.type === '下班')
    if (hasIn && !hasOut && date < today) missing.push({ date, name: dayRecs[0].empName, empId: dayRecs[0].empId, inRec: dayRecs.find(c => c.type === '上班') })
  }
  for (const c of recs) {
    if (c.type === '加班結束') otCards.push(c)
    if ((c.note || '').startsWith('跨日下班')) cross.push(c)
    if (/補登|更正/.test(c.note || '') && !(c.note || '').startsWith('跨日下班')) edits.push(c)
  }
  const byDate = (a, b) => b.date.localeCompare(a.date)
  return { ext: ext.sort(byDate), missing: missing.sort(byDate), otCards: otCards.sort(byDate), cross: cross.sort(byDate), edits: edits.sort(byDate) }
}

const tag = (txt, bg, color) => <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color, whiteSpace: 'nowrap' }}>{txt}</span>
const STATUS = { '待核准': ['#fef3c7', '#8a6d1a'], '核准': ['#e4f0e8', '#2e6040'], '駁回': ['#fce8e0', '#b42318'] }

export default function AttendanceReview({ embedded = false }) {
  const { data, updateItem, addItem } = useApp()
  const { currentUser } = useAuth()
  const [tab, setTab] = useState('ext')
  const [rejecting, setRejecting] = useState(null) // { id, reason, other, outTime }
  const [fill, setFill] = useState({})             // 缺卡補登時間 { key: 'HH:MM' }
  const [showDone, setShowDone] = useState(false)  // 延續加班：顯示已處理（核准／駁回）
  const { ext, missing, otCards, cross, edits } = useMemo(() => collect(data), [data])
  const pendingExt = ext.filter(x => x.info.status === '待核准')
  const reviewer = currentUser?.name || '管理員'

  function approve(out) {
    updateItem('clockins', out.id, { otStatus: '核准', otReviewedAt: localTimestamp(), otReviewedBy: reviewer, otRejectReason: '' })
  }
  function reject() {
    const r = rejecting
    const reason = r.reason === '其他' ? (r.other || '').trim() : r.reason
    if (!reason) return alert('請選擇或填寫駁回理由')
    if (r.reason === REJECT_REASONS[2] && !/^\d{2}:\d{2}$/.test(r.outTime || '')) return alert('請填實際下班時間（HH:MM）')
    const upd = { otStatus: '駁回', otRejectReason: reason, otReviewedAt: localTimestamp(), otReviewedBy: reviewer }
    if (r.reason === REJECT_REASONS[2]) Object.assign(upd, { time: r.outTime, note: `更正（原 ${r.origTime}，忘記打下班卡）` })
    updateItem('clockins', r.id, upd)
    setRejecting(null)
  }
  function fillOut(m) {
    const t = fill[m.date + m.empId]
    if (!/^\d{2}:\d{2}$/.test(t || '')) return alert('請填下班時間（HH:MM）')
    addItem('clockins', { id: Date.now(), empId: m.empId, empName: m.name, date: m.date, time: t, type: '下班', note: '補登（忘記打卡）' })
  }

  const TABS = [
    ['ext', `延續加班${pendingExt.length ? `（待核 ${pendingExt.length}）` : ''}`],
    ['missing', `缺下班卡${missing.length ? `（${missing.length}）` : ''}`],
    ['ot', '加班卡'], ['cross', '跨日下班'], ['edits', '補登／更正'],
  ]
  const row = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '12px 0', borderBottom: `1px solid ${E.divider}` }
  const empty = txt => <div style={{ fontSize: '13px', color: E.textMuted, padding: '16px 0' }}>{txt}</div>

  return (
    <div className={embedded ? '' : 'page-enter'} style={{ display: 'flex', flexDirection: 'column', gap: embedded ? '10px' : '16px', maxWidth: '980px' }}>
      <div>
        {embedded
          ? <div style={{ fontSize: '15px', fontWeight: 700, color: E.textPrimary }}>待處理與審核</div>
          : <h1 style={{ fontSize: '20px', fontWeight: 700, color: E.textPrimary, margin: 0 }}>出勤審核</h1>}
        <p style={{ fontSize: '12px', color: E.textMuted, margin: '6px 0 0', lineHeight: 1.6 }}>
          {EXT_OT_FROM.slice(5).replace('-', '/')} 起。延續加班＝只打上下班、從上班起算第 10 小時之後的時間（第 9～10 小時為休息），核准後才計入加班；駁回不計。活動日不適用。
        </p>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...(tab === k ? E.btnPrimary : E.btnGhost), padding: '7px 14px', fontSize: '13px' }}>{label}</button>
        ))}
      </div>

      <div style={{ ...E.card }}>
        {tab === 'ext' && (() => {
          const done = ext.filter(x => x.info.status !== '待核准')
          const shown = showDone ? ext : pendingExt
          return (<>
          {done.length > 0 && <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '4px' }}><button onClick={() => setShowDone(v => !v)} style={{ ...E.btnGhost, padding: '4px 10px', fontSize: '12px' }}>{showDone ? '只看待核准' : `顯示已處理（${done.length}）`}</button></div>}
          {shown.length ? shown.map(x => {
          const o = x.info.outRec, [bg, fg] = STATUS[x.info.status]
          return (
            <div key={o.id} style={{ ...row, alignItems: 'flex-start' }}>
              <div style={{ width: '150px', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, color: E.textPrimary, fontSize: '14px' }}>{x.name}</div>
                <div style={{ fontSize: '12px', color: E.textSecond }}>{md(x.date)}</div>
              </div>
              <div style={{ flex: 1, minWidth: '220px', fontSize: '13px', color: E.textSecond, lineHeight: 1.7 }}>
                <div>{x.info.inRec.time} 上班 → {o.time} 下班{o.date !== x.date || (o.note || '').startsWith('跨日') ? '（跨日）' : ''}，跨度 {H(x.info.spanMin)}</div>
                <div style={{ color: E.textPrimary, fontWeight: 600 }}>延續加班 {H(x.info.extMin)}</div>
                <div>原因：{x.info.reason || <span style={{ color: '#b45309' }}>（未填，10/20 前的紀錄）</span>}</div>
                {x.info.status === '駁回' && <div style={{ color: '#b42318' }}>駁回理由：{x.info.rejectReason}</div>}
                {o.otReviewedAt && <div style={{ fontSize: '11px', color: E.textMuted }}>{x.info.status} · {o.otReviewedBy} · {o.otReviewedAt}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                {tag(x.info.status, bg, fg)}
                {rejecting?.id === o.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '260px' }}>
                    <select value={rejecting.reason} onChange={e => setRejecting(r => ({ ...r, reason: e.target.value }))} style={{ ...E.input, fontSize: '12px' }}>
                      <option value="">選擇駁回理由</option>
                      {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {rejecting.reason === '其他' && <input value={rejecting.other || ''} onChange={e => setRejecting(r => ({ ...r, other: e.target.value }))} placeholder="說明理由" style={{ ...E.input, fontSize: '12px' }} />}
                    {rejecting.reason === REJECT_REASONS[2] && <input value={rejecting.outTime || ''} onChange={e => setRejecting(r => ({ ...r, outTime: e.target.value }))} placeholder="實際下班時間 例 18:30" style={{ ...E.input, fontSize: '12px' }} />}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setRejecting(null)} style={{ ...E.btnGhost, padding: '5px 10px', fontSize: '12px' }}>取消</button>
                      <button onClick={reject} style={{ ...E.btnPrimary, padding: '5px 10px', fontSize: '12px', background: '#b42318' }}>確定駁回</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {x.info.status !== '核准' && <button onClick={() => approve(o)} style={{ ...E.btnPrimary, padding: '5px 12px', fontSize: '12px', background: '#3a6d31' }}>核准</button>}
                    {x.info.status !== '駁回' && <button onClick={() => setRejecting({ id: o.id, reason: '', origTime: o.time })} style={{ ...E.btnGhost, padding: '5px 12px', fontSize: '12px', color: '#b42318' }}>駁回</button>}
                  </div>
                )}
              </div>
            </div>
          )
        }) : empty(showDone ? '沒有延續加班紀錄' : '沒有待核准的延續加班')}
          </>)
        })()}

        {tab === 'missing' && (missing.length ? missing.map(m => (
          <div key={m.date + m.empId} style={row}>
            <div style={{ width: '150px' }}><b style={{ color: E.textPrimary }}>{m.name}</b><div style={{ fontSize: '12px', color: E.textSecond }}>{md(m.date)}</div></div>
            <div style={{ flex: 1, fontSize: '13px', color: E.textSecond }}>{m.inRec.time} 上班，沒有下班卡（不補登前這天不計時數）</div>
            <input value={fill[m.date + m.empId] || ''} onChange={e => setFill(f => ({ ...f, [m.date + m.empId]: e.target.value }))} placeholder="下班 18:00" style={{ ...E.input, width: '110px', fontSize: '13px' }} />
            <button onClick={() => fillOut(m)} style={{ ...E.btnPrimary, padding: '6px 12px', fontSize: '12px' }}>補登</button>
          </div>
        )) : empty('沒有缺下班卡'))}

        {tab === 'ot' && (otCards.length ? otCards.map(c => (
          <div key={c.id} style={row}>
            <div style={{ width: '150px' }}><b style={{ color: E.textPrimary }}>{c.empName}</b><div style={{ fontSize: '12px', color: E.textSecond }}>{md(c.date)} {c.time} 加班結束</div></div>
            <div style={{ flex: 1, fontSize: '13px', color: E.textSecond }}>{c.note || '（未填加班內容，10/19 前的紀錄）'}</div>
          </div>
        )) : empty('沒有加班卡紀錄'))}

        {tab === 'cross' && (cross.length ? cross.map(c => (
          <div key={c.id} style={row}>
            <div style={{ width: '150px' }}><b style={{ color: E.textPrimary }}>{c.empName}</b><div style={{ fontSize: '12px', color: E.textSecond }}>歸在 {md(c.date)}</div></div>
            <div style={{ flex: 1, fontSize: '13px', color: E.textSecond }}>{c.time} 下班｜{c.note}</div>
          </div>
        )) : empty('沒有跨日下班紀錄'))}

        {tab === 'edits' && (edits.length ? edits.map(c => (
          <div key={c.id} style={row}>
            <div style={{ width: '150px' }}><b style={{ color: E.textPrimary }}>{c.empName}</b><div style={{ fontSize: '12px', color: E.textSecond }}>{md(c.date)}</div></div>
            <div style={{ flex: 1, fontSize: '13px', color: E.textSecond }}>{c.time} {c.type}｜{c.note}</div>
          </div>
        )) : empty('沒有補登或更正紀錄'))}
      </div>
    </div>
  )
}
