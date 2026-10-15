// Netlify 排程函式：每月 5 號 09:00（台灣）產生上個月全體員工的薪資明細草稿 → /payDrafts（只有管理員看得到）
// 阿慶在系統「財務管理 → 薪資管理」審核後按「審核通過，發布給員工」；員工確認後才自動入帳
// 只寫 /payDrafts，不動 /appData、/accounts、/payStatements
import { buildStatements, defaultTargetMonth } from '../../ops/lib/statements-core.mjs'
import * as SC from '../../src/utils/salaryCalc.js'
import * as PE from '../../src/utils/payrollEngine.js'
import * as HO from '../../src/utils/holidays.js'

const DB = 'https://senselifemaker-default-rtdb.firebaseio.com'

export default async () => {
  process.env.TZ = 'Asia/Taipei'
  const target = defaultTargetMonth()
  const raw = await fetch(`${DB}/appData.json`).then(r => r.json())
  const { results, summary } = buildStatements({ raw, target, SC, PE, HO })
  const [YR, MO] = target.split('-').map(Number), now = new Date().toLocaleString('sv-SE').slice(0, 16)
  const put = (p, body) => fetch(`${DB}${p}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) })
    .then(r => { if (!r.ok) throw new Error(`寫入 ${p} 失敗：HTTP ${r.status}`) })
  for (const r of results) await put(`/payDrafts/${r.emp.id}/${target}`, { month: target, empName: r.emp.name, title: `${YR} 年 ${MO} 月薪資明細`, html: r.html, generatedAt: now, net: r.net })
  await put(`/payDrafts/_runs/${target}`, { generatedAt: now, summary: summary.join('\n') })
  console.log(summary.join('\n'))
  return new Response(`ok ${target}：${results.length} 份草稿`)
}

// 每月 5 號 01:00 UTC ＝ 台灣 09:00
export const config = { schedule: '0 1 5 * *' }
