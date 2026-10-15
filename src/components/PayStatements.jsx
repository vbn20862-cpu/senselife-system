import { useEffect, useRef, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { db } from '../firebase'
import Modal from './Modal'
import { E } from '../styles/earth'
import { localTimestamp } from '../utils/salaryCalc'

// 已審核薪資明細：存在 /payStatements/<empId>/<YYYY-MM>（不放 appData，點開才讀，避免拖慢全站同步）
// 由 ops/publish-statement.mjs 發布；員工可點開閱讀、列印並按「我已確認」
export default function PayStatements({ emp, isAdmin, viewerName }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(null)
  const frameRef = useRef(null)

  useEffect(() => {
    if (!emp?.id) return
    return onValue(ref(db, `payStatements/${emp.id}`), snap => {
      const v = snap.val() || {}
      setItems(Object.entries(v).map(([key, s]) => ({ key, ...s })).sort((a, b) => b.key.localeCompare(a.key)))
    })
  }, [emp?.id])

  if (!items.length) return null
  const pending = items.filter(s => !s.ackAt)

  function confirm(s) {
    update(ref(db, `payStatements/${emp.id}/${s.key}`), { ackAt: localTimestamp(), ackBy: viewerName || emp.name })
    setOpen(null)
  }

  return (
    <div style={{ ...E.card, border: pending.length && !isAdmin ? '1.5px solid #c9a227' : E.card.border, backgroundColor: pending.length && !isAdmin ? '#fffaf0' : E.card.backgroundColor }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: E.textPrimary }}>📄 已審核薪資明細</span>
        {!isAdmin && pending.length > 0 && <span style={{ fontSize: '11px', color: '#8a6d1a', fontWeight: '600' }}>{pending.length} 份待確認</span>}
      </div>
      {items.map(s => (
        <div key={s.key} onClick={() => setOpen(s)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '9px 0', borderTop: `1px solid ${E.divider}`, cursor: 'pointer' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: E.textPrimary }}>{s.title || s.key}</div>
            <div style={{ fontSize: '11px', color: E.textMuted, marginTop: '1px' }}>審核發布 {s.publishedAt}</div>
          </div>
          {s.ackAt
            ? <span style={{ fontSize: '11px', color: E.green, fontWeight: '600', textAlign: 'right', flexShrink: 0 }}>✓ 已確認<br /><span style={{ fontWeight: '400', color: E.textMuted }}>{s.ackAt}</span></span>
            : <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', backgroundColor: isAdmin ? '#b9a98f' : '#3a6d31', borderRadius: '999px', padding: '5px 12px', flexShrink: 0 }}>{isAdmin ? '員工未確認' : '點開確認'}</span>}
        </div>
      ))}

      {open && (
        <Modal title={open.title || open.key} onClose={() => setOpen(null)} size="xl">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: '#3a6d31', backgroundColor: '#edf2ea', border: '1px solid #cfe0c8', borderRadius: '8px', padding: '8px 12px' }}>
              ✔ 此為審核過的版本（{open.publishedAt} 發布），金額以本文件為準。
            </div>
            <iframe ref={frameRef} title={open.title || open.key} srcDoc={open.html} sandbox="allow-same-origin allow-modals"
              style={{ width: '100%', height: '62vh', border: `1px solid ${E.divider}`, borderRadius: '8px', backgroundColor: '#fff' }} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => frameRef.current?.contentWindow?.print()} style={{ ...E.btnGhost, padding: '8px 16px' }}>列印 / 存成 PDF</button>
              {!isAdmin && !open.ackAt && <button onClick={() => confirm(open)} style={{ ...E.btnPrimary, padding: '8px 18px' }}>我已確認</button>}
              {open.ackAt && <span style={{ fontSize: '12px', color: E.green, alignSelf: 'center' }}>✓ {open.ackBy} 已於 {open.ackAt} 確認</span>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
