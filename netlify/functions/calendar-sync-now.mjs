// 網址觸發：前端在核准請假／補登／改班表時 POST，或管理員按「同步 Google 日曆」
// body { months: ['YYYY-MM', ...] }（最多 3 個月）；只回傳筆數，不回傳事件內容
import { syncMonths, defaultMonths } from '../lib/calendar-sync-core.mjs'

export default async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const tok = process.env.CALENDAR_SYNC_TOKEN
  if (tok && new URL(req.url).searchParams.get('token') !== tok) return new Response('forbidden', { status: 403 })
  let months = defaultMonths()
  try { const b = await req.json(); if (Array.isArray(b?.months) && b.months.length) months = b.months.filter(m => /^\d{4}-\d{2}$/.test(m)).slice(0, 3) } catch {}
  try {
    const r = await syncMonths(months)
    return new Response(JSON.stringify({ months: r.months, created: r.created, updated: r.updated, deleted: r.deleted, unchanged: r.unchanged }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
  } catch (err) {
    console.error('[calendar-sync-now] failed', err)
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
  }
}
