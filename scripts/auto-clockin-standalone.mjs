#!/usr/bin/env node
/**
 * 林家慶自動打卡（獨立版 — 零依賴，只需 Node.js）
 *
 * 邏輯（沿用原版）：
 * - 上班時間：09:00~09:30 隨機
 * - 下班時間：上班 + 9 小時 + 0~60 分鐘隨機浮動
 * - 只在排班表標記「出勤（W）」的日子打卡
 * - 同日已有打卡紀錄則跳過（idempotent）
 *
 * 用法：
 *   node auto-clockin-standalone.mjs              # 打今天的卡
 *   node auto-clockin-standalone.mjs --month      # 補打整個月
 *   node auto-clockin-standalone.mjs --fix-hours  # 修正已有紀錄的下班時間（加隨機浮動）
 *
 * 部署：
 *   1. Node.js 18+ 安裝好（https://nodejs.org）
 *   2. 把這個檔案放到不會關機的電腦
 *   3. 設排程（crontab / Windows 工作排程器）
 *   4. 建議每日執行兩次：早上 09:35、下午 18:30
 *
 * 排程範例：
 *   # crontab (Mac/Linux)
 *   35 9  * * 1-5 /usr/local/bin/node /path/to/auto-clockin-standalone.mjs >> /path/to/clockin.log 2>&1
 *   30 18 * * 1-5 /usr/local/bin/node /path/to/auto-clockin-standalone.mjs >> /path/to/clockin.log 2>&1
 */

import https from 'node:https'

// ═══════════════════════ 設定 ═══════════════════════
const DB_URL = 'https://senselifemaker-default-rtdb.firebaseio.com'
const EMP_ID = 1
const EMP_NAME = '林家慶'
const NAME_ALIASES = [EMP_NAME, '阿慶', '家慶']  // 判斷「已打卡」時用
const WORK_HOURS = 9
// ════════════════════════════════════════════════════

function httpsRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${DB_URL}${path}`)
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    const req = https.request(url, opts, res => {
      let buf = ''
      res.on('data', chunk => buf += chunk)
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(buf ? JSON.parse(buf) : null) } catch (e) { reject(e) }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${buf}`))
        }
      })
    })
    req.on('error', reject)
    if (body != null) req.write(typeof body === 'string' ? body : JSON.stringify(body))
    req.end()
  })
}

const getAppData = () => httpsRequest('GET', '/appData.json')
const setClockins = clockins => httpsRequest('PUT', '/appData/clockins.json', clockins)

// ───────────────────── 工具 ─────────────────────
function randomClockIn() {
  // 09:00 ~ 09:30 隨機
  const min = Math.floor(Math.random() * 31)
  return { h: 9, m: min }
}
function randomClockOut(inH, inM) {
  // 上班時間 + 9 小時 + 0~60 分鐘
  const extraMin = Math.floor(Math.random() * 61)
  const total = (inH * 60 + inM) + WORK_HOURS * 60 + extraMin
  return { h: Math.floor(total / 60), m: total % 60 }
}
const formatTime = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
const parseTime = t => { const [h, m] = t.split(':').map(Number); return { h, m } }
const formatDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

// ───────────────────── 主邏輯 ─────────────────────
async function main() {
  const isMonthMode = process.argv.includes('--month')
  const isFixMode   = process.argv.includes('--fix-hours')

  console.log(`🕐 ${EMP_NAME} 自動打卡系統`)
  console.log('='.repeat(40))

  const data = await getAppData()
  if (!data) { console.error('❌ 無法讀取 Firebase 資料'); process.exit(1) }

  let clockins = data.clockins || []
  const schedules = data.schedules || []

  // --fix-hours：為剛好 9 小時的下班紀錄加隨機浮動
  if (isFixMode) {
    console.log('🔧 修正模式：為已有的下班紀錄加上隨機浮動\n')
    let fixCount = 0
    const myRecords = clockins.filter(c => NAME_ALIASES.includes(c.empName))
    const dates = [...new Set(myRecords.map(c => c.date))].sort()
    for (const date of dates) {
      const day = myRecords.filter(c => c.date === date)
      const inRec = day.find(c => c.type === '上班')
      const outRec = day.find(c => c.type === '下班')
      if (!inRec || !outRec) continue
      const inT = parseTime(inRec.time), outT = parseTime(outRec.time)
      const diff = (outT.h * 60 + outT.m) - (inT.h * 60 + inT.m)
      if (diff === WORK_HOURS * 60) {
        const newOut = randomClockOut(inT.h, inT.m)
        const newTime = formatTime(newOut.h, newOut.m)
        const idx = clockins.findIndex(c => c.id === outRec.id)
        if (idx !== -1) {
          clockins[idx] = { ...clockins[idx], time: newTime }
          console.log(`  ${date}  ${inRec.time} → ${outRec.time} 改為 ${newTime}`)
          fixCount++
        }
      }
    }
    if (fixCount === 0) { console.log('  沒有需要修正的紀錄'); process.exit(0) }
    await setClockins(clockins)
    console.log(`\n✅ 修正了 ${fixCount} 筆下班紀錄`)
    process.exit(0)
  }

  // 確定要處理的日期
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  const datesToProcess = []

  if (isMonthMode) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const lastDay = Math.min(today.getDate(), daysInMonth)
    for (let d = 1; d <= lastDay; d++) datesToProcess.push(new Date(year, month - 1, d))
    console.log(`📅 整月模式：${year}/${month} (到 ${lastDay} 日)`)
  } else {
    datesToProcess.push(today)
    console.log(`📅 單日模式：${formatDate(today)}`)
  }

  // 過濾出排班「出勤」的日期
  const workDates = datesToProcess.filter(date => {
    const d = date.getDate()
    const sched = schedules.find(s =>
      s.empId === EMP_ID && s.year === year && s.month === month && s.day === d
    )
    return sched && (sched.shift === 'W' || sched.shift === '出勤')
  })

  if (workDates.length === 0) { console.log('😴 今天不是出勤日，不需要打卡'); process.exit(0) }

  // 過濾掉已有上班紀錄的日期
  const existingDates = new Set(
    clockins
      .filter(c => NAME_ALIASES.includes(c.empName) && c.type === '上班')
      .map(c => c.date)
  )
  const newDates = workDates.filter(d => !existingDates.has(formatDate(d)))

  if (newDates.length === 0) { console.log('✅ 所有出勤日都已有打卡紀錄，無需補打'); process.exit(0) }

  console.log(`\n📝 需要打卡 ${newDates.length} 天：`)

  const newRecords = []
  const ts = Date.now()
  const todayStr = formatDate(today)
  const nowTotal = today.getHours() * 60 + today.getMinutes()

  newDates.forEach((date, i) => {
    const dateStr = formatDate(date)
    const { h: inH, m: inM } = randomClockIn()
    const { h: outH, m: outM } = randomClockOut(inH, inM)
    const inTime  = formatTime(inH, inM)
    const outTime = formatTime(outH, outM)
    const isToday = dateStr === todayStr

    // 上班：過去日一律補，今天要等上班時間到
    if (!isToday || nowTotal >= inH * 60 + inM) {
      newRecords.push({ id: ts + i * 2, empId: EMP_ID, empName: EMP_NAME, date: dateStr, time: inTime, type: '上班' })
    }
    // 下班：過去日一律補，今天要等下班時間到
    if (!isToday || nowTotal >= outH * 60 + outM) {
      newRecords.push({ id: ts + i * 2 + 1, empId: EMP_ID, empName: EMP_NAME, date: dateStr, time: outTime, type: '下班' })
      console.log(`  ${dateStr}  ${inTime} → ${outTime}`)
    } else if (!isToday || nowTotal >= inH * 60 + inM) {
      console.log(`  ${dateStr}  ${inTime} → (下班時間未到，稍後補打)`)
    } else {
      console.log(`  ${dateStr}  (時間未到，稍後補打)`)
    }
  })

  if (newRecords.length === 0) { console.log('\n⏳ 時間未到，尚無紀錄可寫入'); process.exit(0) }

  const allClockins = [...clockins, ...newRecords]
  await setClockins(allClockins)

  console.log(`\n✅ 成功寫入 ${newRecords.length} 筆打卡紀錄！`)
  console.log(`   資料庫共 ${allClockins.length} 筆打卡紀錄`)
  process.exit(0)
}

main().catch(err => {
  console.error('❌ 執行失敗:', err.message)
  process.exit(1)
})
