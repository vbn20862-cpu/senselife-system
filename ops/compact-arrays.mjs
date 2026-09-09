// 壓實資料陣列的 null 空洞（斷網寫入失敗殘留）。安全、冪等。
// 用法：node ops/compact-arrays.mjs
import { fbGet, fbWrite } from './_fb.mjs'

const data = await fbGet('/appData.json')
let fixed = 0
for (const [k, v] of Object.entries(data)) {
  if (!Array.isArray(v)) continue
  const dense = v.filter(x => x != null)
  if (dense.length !== v.length) {
    await fbWrite('PUT', `/appData/${k}.json`, dense)
    console.log(`✓ ${k}: ${v.length} → ${dense.length}（補實 ${v.length - dense.length} 個空洞）`)
    fixed++
  }
}
console.log(fixed ? `完成，${fixed} 個陣列已壓實` : '✅ 無空洞')
