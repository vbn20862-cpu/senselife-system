// 亂碼修復：empName 依 empId 還原、打卡 type 依當日上下文判定、地址修不掉就清空
// 預設 dry-run 只列出；加 --fix 才寫入。
// 用法：node ops/repair-garbled.mjs [--fix]
import { fbGet, fbWrite, arr } from './_fb.mjs'

const FIX = process.argv.includes('--fix')
const data = await fbGet('/appData.json')
const emps = Object.fromEntries(arr(data.employees).map(e => [e.id, e.name]))
const all = arr(data.clockins)
const ADDR_FIX = [[/三地�+鄉/, '三地門鄉'], [/霧�+鄉|�+臺鄉/, '霧臺鄉'], [/北�+村/, '北葉村'], [/瑪�+鄉/, '瑪家鄉'], [/屏�+縣|�+東縣/, '屏東縣']]
let n = 0

for (const c of all) {
  if (!/�/.test(JSON.stringify(c))) continue
  const before = JSON.stringify(c)
  // 名字：依 empId 還原；empId 缺失時借同日同人另一筆
  if (/�/.test(c.empName || '')) {
    if (emps[c.empId]) c.empName = emps[c.empId]
    else {
      const partner = all.find(x => x !== c && x.empId === c.empId && x.date === c.date && !/�/.test(x.empName || ''))
      if (partner) c.empName = partner.empName
    }
  }
  // 打卡類型：關鍵字 → 時段與上下文
  if (/�/.test(c.type || '')) {
    const day = all.filter(x => x.empId === c.empId && x.date === c.date && x !== c)
    const hour = Number((c.time || '0').split(':')[0])
    const hasEarlierIn = day.some(x => x.type === '上班' && x.time < c.time)
    if (/結束/.test(c.type)) c.type = '加班結束'
    else if (/開始/.test(c.type)) c.type = '加班開始'
    else if (/^下/.test(c.type) || (hour >= 17 && hasEarlierIn)) c.type = '下班'
    else c.type = '上班'
  }
  // 其他字串欄（主要是 address）：套已知地名，修不掉就清空
  for (const k of Object.keys(c)) {
    if (typeof c[k] === 'string' && /�/.test(c[k])) {
      let v = c[k]
      for (const [re, rep] of ADDR_FIX) v = v.replace(re, rep)
      if (/�/.test(v) && k === 'address') v = ''
      c[k] = v
    }
  }
  if (JSON.stringify(c) !== before) { n++; console.log(`${FIX ? '✓修' : '將修'} id:${c.id} ${c.date} ${c.time} → ${c.empName} ${c.type}`) }
}

if (n === 0) { console.log('✅ 無亂碼'); process.exit(0) }
if (FIX) {
  await fbWrite('PUT', '/appData/clockins.json', all)
  const after = arr(await fbGet('/appData/clockins.json')).filter(c => /�/.test(JSON.stringify(c)))
  console.log(`已修 ${n} 筆｜寫回後殘留 ${after.length} 筆`)
  process.exit(after.length ? 1 : 0)
} else {
  console.log(`共 ${n} 筆待修（dry-run）。確認無誤後加 --fix 執行。`)
  process.exit(1)
}
