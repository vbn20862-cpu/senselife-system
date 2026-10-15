// 每月薪資明細草稿（手動版）：替每位員工產出上個月的工時統計＋薪資計算（HTML＋PDF），供阿慶審核
// 用法：node ops/monthly-statements.mjs [YYYY-MM] [--upload]　（省略月份＝上個月）
//   --upload：同時把草稿存到 Firebase /payDrafts/<empId>/<YYYY-MM>（員工看不到），阿慶在系統薪資頁審核後按「發布」
// 輸出：~/senselife-statements/<YYYY-MM>/<姓名>.html／.pdf＋摘要.txt（含個資，放 repo 外）
// 每月 5 號的自動版是 Netlify 排程函式 netlify/functions/monthly-drafts.mjs，兩者共用 ops/lib/statements-core.mjs
process.env.TZ = 'Asia/Taipei'
import { fbGet, fbWrite } from './_fb.mjs'
import { buildStatements, defaultTargetMonth } from './lib/statements-core.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2), UPLOAD = argv.includes('--upload')
const target = argv.find(a => /^\d{4}-\d{2}$/.test(a)) || defaultTargetMonth()

// 引擎是給 Vite 用的（import 無副檔名），複製到暫存資料夾補上 .js 後載入
const eng = fs.mkdtempSync(path.join(os.tmpdir(), 'sl-engine-'))
fs.writeFileSync(path.join(eng, 'package.json'), '{"type":"module"}')
for (const f of fs.readdirSync(path.join(here, '../src/utils')).filter(f => f.endsWith('.js')))
  fs.writeFileSync(path.join(eng, f), fs.readFileSync(path.join(here, '../src/utils', f), 'utf8').replace(/from '(\.\/[^']+?)'/g, (m, p) => `from '${p.endsWith('.js') ? p : p + '.js'}'`))
const SC = await import(path.join(eng, 'salaryCalc.js')), PE = await import(path.join(eng, 'payrollEngine.js')), HO = await import(path.join(eng, 'holidays.js'))

const { results, summary } = buildStatements({ raw: await fbGet('/appData.json'), target, SC, PE, HO })
const [YR, MO] = target.split('-').map(Number), now = new Date().toLocaleString('sv-SE').slice(0, 16)
const outDir = path.join(os.homedir(), 'senselife-statements', target)
fs.mkdirSync(outDir, { recursive: true })
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
for (const r of results) {
  const base = path.join(outDir, r.emp.name)
  fs.writeFileSync(base + '.html', r.html)
  if (fs.existsSync(chrome)) { try { execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${base}.pdf`, 'file://' + base + '.html'], { stdio: 'ignore', timeout: 60000 }) } catch {} }
  if (UPLOAD) await fbWrite('PUT', `/payDrafts/${r.emp.id}/${target}.json`, { month: target, empName: r.emp.name, title: `${YR} 年 ${MO} 月薪資明細`, html: r.html, generatedAt: now, net: r.net })
}
fs.writeFileSync(path.join(outDir, '摘要.txt'), summary.join('\n') + '\n')
if (UPLOAD) await fbWrite('PUT', `/payDrafts/_runs/${target}.json`, { generatedAt: now, summary: summary.join('\n') })
fs.rmSync(eng, { recursive: true, force: true })
console.log(summary.join('\n'))
console.log(`\n輸出：${outDir}`)
