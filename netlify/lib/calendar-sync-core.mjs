// 共用：Google 日曆同步邏輯（排程 calendar-sync.mjs 與網址觸發 calendar-sync-now.mjs 共用）
import crypto from 'node:crypto'


const FB = 'https://senselifemaker-default-rtdb.firebaseio.com'
const TZ = 'Asia/Taipei'
const pad2 = n => String(n).padStart(2, '0')
const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const monthRange = (ym) => { const [y, m] = ym.split('-').map(Number); return [`${ym}-01`, `${m === 12 ? y + 1 : y}-${pad2(m === 12 ? 1 : m + 1)}-01`] }

// ── 想要存在的事件（從系統資料算出來）──
export function desiredEvents(data, months) {
  const emps = (data.employees || []).filter(Boolean)
  const nameOf = id => emps.find(e => e.id === id)?.name || ''
  const holidays = new Set((data.holidays || []).filter(Boolean).map(h => h.date))
  const out = new Map()
  for (const ym of months) {
    const [from, to] = monthRange(ym)
    // 已核准請假（含跨月，裁到當月）
    for (const l of (data.leaveRequests || []).filter(Boolean)) {
      if (l.status !== '已核准' || !l.empId) continue
      const s = l.startDate || l.date, e = l.endDate || s
      if (!s || e < from || s >= to) continue
      const name = nameOf(l.empId); if (!name) continue
      const half = l.halfDay || (s === e && Number(l.days) === 0.5)
      out.set(`leave:${l.id}`, { key: `leave:${l.id}`, start: s, end: addDays(e, 1), summary: `${name} ${l.type}${half ? '（半天）' : ''}`, description: `請假 ${l.type}${l.relation ? `（${l.relation}）` : ''} ${s}${e !== s ? `～${e}` : ''}` })
    }
    // 排班表平日休假（週一～週五、非國定假日）
    const [yr, mo] = ym.split('-').map(Number)
    for (const sc of (data.schedules || []).filter(Boolean)) {
      if (sc.year !== yr || sc.month !== mo || sc.shift !== '休假') continue
      const ds = `${ym}-${pad2(sc.day)}`
      const dow = new Date(ds + 'T00:00:00Z').getUTCDay()
      if (dow === 0 || dow === 6 || holidays.has(ds)) continue
      const name = nameOf(sc.empId); if (!name) continue
      out.set(`sched:${sc.empId}:${ds}`, { key: `sched:${sc.empId}:${ds}`, start: ds, end: addDays(ds, 1), summary: `${name} 休假`, description: '排班表平日休假（調休）' })
    }
  }
  return out
}

// ── Google 服務帳號 → access token ──
async function accessToken() {
  const b64 = process.env.GOOGLE_SA_JSON_B64
  if (!b64) throw new Error('缺 GOOGLE_SA_JSON_B64')
  const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))
  const now = Math.floor(Date.now() / 1000)
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/calendar', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }) })
  if (!res.ok) throw new Error('token ' + res.status + ' ' + await res.text())
  return (await res.json()).access_token
}

async function gcal(token, path, init = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) } })
  if (res.status === 204) return null
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : null
}

export async function syncMonths(months, { dry = false } = {}) {
  const data = await (await fetch(`${FB}/appData.json`)).json()
  const want = desiredEvents(data, months)
  if (dry) return { months, planned: [...want.values()] }
  const token = await accessToken()
  const cal = encodeURIComponent(process.env.GOOGLE_CALENDAR_ID || process.env.VITE_GOOGLE_CALENDAR_ID || 'senselife2017@gmail.com')
  const [from] = monthRange(months[0]), [, to] = monthRange(months[months.length - 1])
  // 既有（本系統建立的）事件
  const have = new Map(); let pageToken
  do {
    const q = new URLSearchParams({ privateExtendedProperty: 'slSource=senselife', timeMin: `${from}T00:00:00+08:00`, timeMax: `${to}T00:00:00+08:00`, singleEvents: 'true', maxResults: '2500', showDeleted: 'false' })
    if (pageToken) q.set('pageToken', pageToken)
    const page = await gcal(token, `/calendars/${cal}/events?${q}`)
    for (const ev of page.items || []) { const k = ev.extendedProperties?.private?.slKey; if (k) have.set(k, ev) }
    pageToken = page.nextPageToken
  } while (pageToken)
  const log = { created: 0, updated: 0, deleted: 0, unchanged: 0 }
  for (const [key, w] of want) {
    const body = { summary: w.summary, description: w.description, start: { date: w.start }, end: { date: w.end }, transparency: 'transparent', extendedProperties: { private: { slSource: 'senselife', slKey: key } } }
    const ev = have.get(key)
    if (!ev) { await gcal(token, `/calendars/${cal}/events`, { method: 'POST', body: JSON.stringify(body) }); log.created++ }
    else if (ev.summary !== w.summary || ev.start?.date !== w.start || ev.end?.date !== w.end) { await gcal(token, `/calendars/${cal}/events/${ev.id}`, { method: 'PATCH', body: JSON.stringify(body) }); log.updated++ }
    else log.unchanged++
  }
  for (const [key, ev] of have) { if (!want.has(key)) { await gcal(token, `/calendars/${cal}/events/${ev.id}`, { method: 'DELETE' }); log.deleted++ } }
  return { months, ...log }
}

export const defaultMonths = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
  const y = now.getFullYear(), m = now.getMonth() + 1
  return [`${y}-${pad2(m)}`, `${m === 12 ? y + 1 : y}-${pad2(m === 12 ? 1 : m + 1)}`]
}
