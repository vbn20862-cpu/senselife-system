import { useEffect, useRef, useState } from 'react'
import { ref, onValue, update, set, remove } from 'firebase/database'
import { db } from '../firebase'
import Modal from './Modal'
import { E } from '../styles/earth'
import { localTimestamp } from '../utils/salaryCalc'

// 已審核薪資明細：存在 /payStatements/<empId>/<YYYY-MM>（不放 appData，點開才讀，避免拖慢全站同步）
// 草稿：每月 5 號雲端例行任務跑 ops/monthly-statements.mjs --upload 寫入 /payDrafts/<empId>/<YYYY-MM>
//   只有管理員看得到；審核後按「發布」→ 複製到 payStatements（加上已審核標記）並刪除草稿
export function stampReviewed(html, at) {
  return html.replace(/(<div class="date">[^<]*)(<\/div>)/, `$1｜<b style="color:#3a6d31">✔ 已審核版本（${at} 發布）</b>$2`)
}

export default function PayStatements({ emp, isAdmin, viewerName }) {
  const [items, setItems] = useState([])
  const [drafts, setDrafts] = useState([])
  const [open, setOpen] = useState(null)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!emp?.id) return
    const toList = v => Object.entries(v || {}).map(([key, s]) => ({ key, ...s })).sort((a, b) => b.key.localeCompare(a.key))
    const offs = [onValue(ref(db, `payStatements/${emp.id}`), snap => setItems(toList(snap.val())))]
    if (isAdmin) offs.push(onValue(ref(db, `payDrafts/${emp.id}`), snap => setDrafts(toList(snap.val()))))
    return () => offs.forEach(f => f())
  }, [emp?.id, isAdmin])

  if (!items.length && !drafts.length) return null
  const pending = items.filter(s => !s.ackAt)

  function confirm(s) {
    update(ref(db, `payStatements/${emp.id}/${s.key}`), { ackAt: localTimestamp(), ackBy: viewerName || emp.name })
    setOpen(null)
  }
  async function publish(d) {
    const replacing = items.some(s => s.key === d.key)
    if (!window.confirm(`發布「${emp.name} ${d.title}」給員工？${replacing ? '\n（會取代已發布的同月版本，員工需重新確認）' : ''}`)) return
    const at = localTimestamp()
    await set(ref(db, `payStatements/${emp.id}/${d.key}`), { month: d.month || d.key, title: d.title, html: stampReviewed(d.html, at), publishedAt: at, publishedBy: viewerName || '管理員' })
    await remove(ref(db, `payDrafts/${emp.id}/${d.key}`))
    setOpen(null)
  }

  const row = (s, draft) => (
    <div key={(draft ? 'd-' : '') + s.key} onClick={() => setOpen({ ...s, draft })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '9px 0', borderTop: `1px solid ${E.divider}`, cursor: 'pointer' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{s.title || s.key}</div>
        <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '1px' }}>{draft ? `草稿・系統產生 ${s.generatedAt}` : `審核發布 ${s.publishedAt}`}</div>
      </div>
      {draft
        ? <span style={{ fontSize: '12px', fontWeight: '700', color: '#8a6d1a', backgroundColor: '#fef3cd', border: '1px solid #f0d78c', borderRadius: '999px', padding: '4px 11px', flexShrink: 0 }}>待審核</span>
        : s.ackAt
          ? <span style={{ fontSize: '11px', color: E.green, fontWeight: '600', textAlign: 'right', flexShrink: 0 }}>✓ 已確認<br /><span style={{ fontWeight: '400', color: E.textMuted }}>{s.ackAt}</span></span>
          : <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', backgroundColor: isAdmin ? '#b9a98f' : '#3a6d31', borderRadius: '999px', padding: '5px 12px', flexShrink: 0 }}>{isAdmin ? '員工未確認' : '點開確認'}</span>}
    </div>
  )

  return (
    <div style={{ ...E.card, border: pending.length && !isAdmin ? '1.5px solid #c9a227' : E.card.border, backgroundColor: pending.length && !isAdmin ? '#fffaf0' : E.card.backgroundColor }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary }}>📄 {isAdmin ? '薪資明細' : '已審核薪資明細'}</span>
        {!isAdmin && pending.length > 0 && <span style={{ fontSize: '11px', color: '#8a6d1a', fontWeight: '600' }}>{pending.length} 份待確認</span>}
        {isAdmin && drafts.length > 0 && <span style={{ fontSize: '11px', color: '#8a6d1a', fontWeight: '600' }}>{drafts.length} 份草稿待審核</span>}
      </div>
      {drafts.map(d => row(d, true))}
      {items.map(s => row(s, false))}

      {open && (
        <Modal title={`${open.title || open.key}${open.draft ? '（草稿）' : ''}`} onClose={() => setOpen(null)} size="xl">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {open.draft
              ? <div style={{ fontSize: '12px', color: '#8a6d1a', backgroundColor: '#fef3cd', border: '1px solid #f0d78c', borderRadius: '8px', padding: '8px 12px' }}>
                  草稿（{open.generatedAt} 系統產生），員工看不到。只含系統計算；若有上月補扣等人工調整，請先請 Claude 修改再發布。
                </div>
              : <div style={{ fontSize: '12px', color: '#3a6d31', backgroundColor: '#edf2ea', border: '1px solid #cfe0c8', borderRadius: '8px', padding: '8px 12px' }}>
                  ✔ 此為審核過的版本（{open.publishedAt} 發布），金額以本文件為準。
                </div>}
            <iframe ref={frameRef} title={open.title || open.key} srcDoc={open.html} sandbox="allow-same-origin allow-modals"
              style={{ width: '100%', height: '62vh', border: `1px solid ${E.divider}`, borderRadius: '8px', backgroundColor: '#fff' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => frameRef.current?.contentWindow?.print()} style={{ ...E.btnGhost, padding: '8px 16px' }}>列印 / 存成 PDF</button>
              {open.draft && isAdmin && <button onClick={() => publish(open)} style={{ ...E.btnPrimary, padding: '8px 18px' }}>審核通過，發布給員工</button>}
              {!open.draft && !isAdmin && !open.ackAt && <button onClick={() => confirm(open)} style={{ ...E.btnPrimary, padding: '8px 18px' }}>我已確認</button>}
              {!open.draft && open.ackAt && <span style={{ fontSize: '12px', color: E.green, alignSelf: 'center' }}>✓ {open.ackBy} 已於 {open.ackAt} 確認</span>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// 管理員薪資總覽：所有員工的待審核草稿
export function PayDraftsOverview({ employees, onPick }) {
  const [all, setAll] = useState({})
  useEffect(() => onValue(ref(db, 'payDrafts'), snap => setAll(snap.val() || {})), [])
  const list = employees.flatMap(e => Object.entries(all[e.id] || {}).map(([month, d]) => ({ e, month, d }))).sort((a, b) => b.month.localeCompare(a.month))
  if (!list.length) return null
  return (
    <div style={{ ...E.card, border: '1.5px solid #c9a227', backgroundColor: '#fffaf0' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary, marginBottom: '8px' }}>📄 薪資明細草稿待審核（{list.length} 份）</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {list.map(({ e, month, d }) => (
          <button key={e.id + month} onClick={() => onPick(e.id)} style={{ border: '1px solid #e6d3a3', backgroundColor: '#fff', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', color: E.textPrimary }}>
            {e.name}・{Number(month.slice(5))} 月{d.net != null ? <span style={{ color: E.textMuted, marginLeft: '6px' }}>{Number(d.net).toLocaleString()}</span> : null}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '8px' }}>點名字進入該員工畫面預覽，確認無誤後按「審核通過，發布給員工」。</div>
    </div>
  )
}
