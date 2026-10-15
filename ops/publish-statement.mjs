// 發布「已審核薪資明細」到系統，員工於薪資頁自行點開、確認
// 用法：node ops/publish-statement.mjs <員工姓名> <YYYY-MM> <html檔> [--net=實領金額] [--title=標題]
//   例：node ops/publish-statement.mjs 黃宝琳 2026-09 ./bao9.html --net=21105
// 存放：/payStatements/<empId>/<YYYY-MM>（不在 appData；重發同月會覆蓋並清除確認紀錄）
// --net＝本次應領：員工在系統按「我已確認」時，系統自動記一筆 Admin_sl／人事／人事費用 支出（日期＝次月 16 日）
process.env.TZ = 'Asia/Taipei'
import { fbGet, fbWrite } from './_fb.mjs'
import fs from 'node:fs'

const args = process.argv.slice(2)
const opt = k => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const [name, month, file] = args.filter(a => !a.startsWith('--'))
if (!name || !/^\d{4}-\d{2}$/.test(month || '') || !file) { console.error('用法：node ops/publish-statement.mjs <員工姓名> <YYYY-MM> <html檔> [--net=實領金額] [--title=標題]'); process.exit(1) }
const emps = (await fbGet('/appData/employees.json') || []).filter(Boolean)
const emp = emps.find(e => e.name === name)
if (!emp) { console.error(`找不到員工：${name}`); process.exit(1) }
const now = new Date().toLocaleString('sv-SE').slice(0, 16)
let html = fs.readFileSync(file, 'utf8')
if (/阿慶/.test(html)) { console.error('⛔ 文件含「阿慶」字樣，員工看得到的文件不可出現，請先移除'); process.exit(1) }
html = html.replace(/(<div class="date">[^<]*)(<\/div>)/, `$1｜<b style="color:#3a6d31">✔ 已審核版本（${now} 發布）</b>$2`)
const [y, m] = month.split('-').map(Number)
const net = opt('net') != null ? Math.round(Number(opt('net'))) : null
if (net != null && !Number.isFinite(net)) { console.error('--net 必須是數字'); process.exit(1) }

const doc = { month, title: opt('title') || `${y} 年 ${m} 月薪資明細`, html, publishedAt: now, publishedBy: '管理員', ...(net != null ? { net } : {}) }
await fbWrite('PUT', `/payStatements/${emp.id}/${month}.json`, doc)
console.log(`✅ 已發布：${name} ${doc.title}（${Math.round(html.length / 1024)} KB）`)
