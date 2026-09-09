// 完整備份 appData + accounts 到 ~/senselife-backups/（repo 外，含薪資與密碼，勿入 git）
// 用法：node ops/backup.mjs　（建議 launchd/cron 每日跑）
import { fbGet } from './_fb.mjs'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const dir = path.join(os.homedir(), 'senselife-backups')
fs.mkdirSync(dir, { recursive: true })

const stamp = new Date().toLocaleString('sv-SE').replace(' ', '_').replace(/:/g, '') // 2026-09-09_1430xx
const appData = await fbGet('/appData.json')
const accounts = await fbGet('/accounts.json')
const out = path.join(dir, `backup-${stamp}.json`)
fs.writeFileSync(out, JSON.stringify({ exportedAt: new Date().toISOString(), appData, accounts }))
const kb = Math.round(fs.statSync(out).size / 1024)
console.log(`✅ 備份完成：${out}（${kb} KB）`)

// 保留最近 60 份，其餘刪除
const files = fs.readdirSync(dir).filter(f => f.startsWith('backup-')).sort()
for (const f of files.slice(0, Math.max(0, files.length - 60))) fs.unlinkSync(path.join(dir, f))
