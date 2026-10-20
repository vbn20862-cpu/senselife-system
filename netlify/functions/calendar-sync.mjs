// 排程：每天 06:00（台灣）把「已核准請假」與「排班表平日休假」同步到公司 Google 日曆
// 注意：Netlify 排程函式在正式站不接受網址呼叫，前端觸發走 calendar-sync-now.mjs
// 需要環境變數 GOOGLE_SA_JSON_B64、GOOGLE_CALENDAR_ID（說明見 netlify/lib/calendar-sync-core.mjs）
import { syncMonths, defaultMonths } from '../lib/calendar-sync-core.mjs'

export const config = { schedule: '0 22 * * *' }

export default async () => {
  try { console.log('[calendar-sync]', JSON.stringify(await syncMonths(defaultMonths()))) }
  catch (err) { console.error('[calendar-sync] failed', err) }
}
