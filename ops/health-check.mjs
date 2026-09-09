// 系統健檢（唯讀）。異常時 exit code = 1，機器人可據此決定要不要通知。
// 用法：node ops/health-check.mjs
import { fbGet, arr, todayStr } from './_fb.mjs'

const data = await fbGet('/appData.json')
const issues = []
const today = todayStr()

// 1. 亂碼掃描
let garbled = 0
for (const [k, v] of Object.entries(data)) {
  const n = JSON.stringify(v || '').split('�').length - 1
  if (n > 0) { garbled += n; issues.push(`${k} 含 ${n} 處亂碼(U+FFFD) → 跑 node ops/repair-garbled.mjs --fix`) }
}

// 2. 陣列空洞
for (const [k, v] of Object.entries(data)) {
  if (!Array.isArray(v)) continue
  const holes = v.length - v.filter(x => x != null).length
  if (holes > 0) issues.push(`${k} 有 ${holes} 個 null 空洞 → 跑 node ops/compact-arrays.mjs`)
}

// 3. 近 7 天有上班沒下班（待補登）
const clock = arr(data.clockins)
const since = new Date(Date.now() - 7 * 86400000).toLocaleDateString('sv-SE')
const byEmpDay = {}
for (const c of clock) {
  if (c.date < since || c.date >= today) continue
  ;(byEmpDay[`${c.empName}|${c.date}`] = byEmpDay[`${c.empName}|${c.date}`] || []).push(c.type)
}
const missing = Object.entries(byEmpDay).filter(([, t]) => t.includes('上班') && !t.includes('下班')).map(([k]) => k.replace('|', ' '))
if (missing.length) issues.push(`近7天有上班沒下班：${missing.join('、')}`)

// 4. 待審核請假
const pendingLeave = arr(data.leaveRequests).filter(l => l.status === '待審核')
if (pendingLeave.length) issues.push(`${pendingLeave.length} 筆請假待審核：${pendingLeave.map(l => `${l.empName} ${l.startDate} ${l.type}`).join('、')}`)

// 5. 逾期交辦
const overdue = arr(data.dispatches).filter(d => ['待辦', '進行中', '暫停'].includes(d.status) && d.dueDate && d.dueDate < today)
if (overdue.length) issues.push(`${overdue.length} 筆交辦逾期：${overdue.map(d => `${d.title}(${d.assignee} ${d.dueDate})`).join('、')}`)

// 6. 資料量概覽
console.log(`📊 ${today} 健檢 — 員工${arr(data.employees).length} 打卡${clock.length} 交辦${arr(data.dispatches).length} 請假${arr(data.leaveRequests).length} 活動${arr(data.activities).length}`)

if (issues.length === 0) {
  console.log('✅ 全部正常')
  process.exit(0)
} else {
  console.log(`⚠️ ${issues.length} 個待處理：`)
  issues.forEach(i => console.log('  - ' + i))
  process.exit(1)
}
