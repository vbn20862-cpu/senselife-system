// 觸發 Netlify 函式把「已核准請假」與「排班表平日休假」同步到公司 Google 日曆（老闆只看日曆）
// 函式：netlify/functions/calendar-sync.mjs（每天 06:00 也會自動跑一次）；本機 Vite dev 沒有函式，呼叫會失敗但不影響操作
const ym = d => (typeof d === 'string' && d.length >= 7) ? d.slice(0, 7) : null
let timer = null, pending = new Set()

export function triggerCalendarSync(months = []) {
  for (const m of months) { const k = ym(m) || (m && /^\d{4}-\d{2}$/.test(m) ? m : null); if (k) pending.add(k) }
  clearTimeout(timer)
  timer = setTimeout(() => {
    const list = [...pending].sort().slice(0, 3); pending = new Set()
    if (!list.length) return
    const tok = import.meta.env.VITE_CALENDAR_SYNC_TOKEN || ''
    fetch(`/.netlify/functions/calendar-sync-now${tok ? `?token=${encodeURIComponent(tok)}` : ''}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ months: list }),
    }).catch(() => {})
  }, 1500)
}

// 手動同步（管理員按鈕用）：回傳結果物件或丟錯
export async function runCalendarSync(months) {
  const tok = import.meta.env.VITE_CALENDAR_SYNC_TOKEN || ''
  const res = await fetch(`/.netlify/functions/calendar-sync-now${tok ? `?token=${encodeURIComponent(tok)}` : ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ months }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`)
  return j
}
