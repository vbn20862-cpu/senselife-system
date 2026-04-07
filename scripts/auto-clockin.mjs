#!/usr/bin/env node
/**
 * 林家慶自動打卡腳本
 *
 * 功能：每天自動產生上班/下班打卡紀錄
 * - 上班時間：09:00~09:30 隨機
 * - 下班時間：上班 + 9小時 + 0~60分鐘隨機浮動
 * - 只在排班表標記「出勤」的日子打卡
 * - 如果當天已有打卡紀錄則跳過
 *
 * 使用方式：
 *   node scripts/auto-clockin.mjs              # 打今天的卡
 *   node scripts/auto-clockin.mjs --month      # 補打整個月
 *   node scripts/auto-clockin.mjs --fix-hours  # 修正已有紀錄的下班時間（加隨機浮動）
 */

import { initializeApp } from 'firebase/app'
import { getDatabase, ref, get, set } from 'firebase/database'

const firebaseConfig = {
  apiKey: "AIzaSyDyhe4L4Q0SFWox0XCdm1g2JZWtu-pQHLI",
  authDomain: "senselifemaker.firebaseapp.com",
  databaseURL: "https://senselifemaker-default-rtdb.firebaseio.com",
  projectId: "senselifemaker",
  storageBucket: "senselifemaker.firebasestorage.app",
  messagingSenderId: "232028855315",
  appId: "1:232028855315:web:838ebbc814047099f673e6",
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const EMP_ID = 1
const EMP_NAME = '林家慶'
const WORK_HOURS = 9

function randomClockIn() {
  // 09:00 ~ 09:30 隨機
  const min = Math.floor(Math.random() * 31)
  return { h: 9, m: min }
}

function randomClockOut(inH, inM) {
  // 上班時間 + 9小時 + 0~60分鐘隨機浮動
  const extraMin = Math.floor(Math.random() * 61)
  const totalMin = (inH * 60 + inM) + WORK_HOURS * 60 + extraMin
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 }
}

function formatTime(h, m) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function parseTime(t) {
  const [h, m] = t.split(':').map(Number)
  return { h, m }
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function main() {
  const isMonthMode = process.argv.includes('--month')
  const isFixMode = process.argv.includes('--fix-hours')

  console.log('🕐 林家慶自動打卡系統')
  console.log('='.repeat(40))

  // 讀取 Firebase 資料
  const snapshot = await get(ref(db, 'appData'))
  const data = snapshot.val()
  if (!data) {
    console.error('❌ 無法讀取 Firebase 資料')
    process.exit(1)
  }

  let clockins = data.clockins || []
  const schedules = data.schedules || []

  // --fix-hours 模式：修正已有紀錄中「下班 = 上班 + 剛好9小時」的紀錄
  if (isFixMode) {
    console.log('🔧 修正模式：為已有的下班紀錄加上隨機浮動\n')
    let fixCount = 0

    // 找出林家慶所有的打卡日期
    const myRecords = clockins.filter(c =>
      c.empName === EMP_NAME || c.empName === '阿慶' || c.empName === '家慶'
    )
    const dates = [...new Set(myRecords.map(c => c.date))].sort()

    for (const date of dates) {
      const dayRecs = myRecords.filter(c => c.date === date)
      const inRec = dayRecs.find(c => c.type === '上班')
      const outRec = dayRecs.find(c => c.type === '下班')

      if (!inRec || !outRec) continue

      const inT = parseTime(inRec.time)
      const outT = parseTime(outRec.time)
      const diff = (outT.h * 60 + outT.m) - (inT.h * 60 + inT.m)

      // 如果下班剛好是上班+9小時（差540分鐘），加上隨機浮動
      if (diff === WORK_HOURS * 60) {
        const newOut = randomClockOut(inT.h, inT.m)
        const oldTime = outRec.time
        const newTime = formatTime(newOut.h, newOut.m)

        // 直接修改 clockins 陣列中的紀錄
        const idx = clockins.findIndex(c => c.id === outRec.id)
        if (idx !== -1) {
          clockins[idx] = { ...clockins[idx], time: newTime }
          console.log(`  ${date}  ${inRec.time} → ${oldTime} 改為 ${newTime}`)
          fixCount++
        }
      }
    }

    if (fixCount === 0) {
      console.log('  沒有需要修正的紀錄')
      process.exit(0)
    }

    await set(ref(db, 'appData/clockins'), clockins)
    console.log(`\n✅ 修正了 ${fixCount} 筆下班紀錄`)
    process.exit(0)
  }

  // 確定要處理的日期
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1

  let datesToProcess = []

  if (isMonthMode) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const lastDay = Math.min(today.getDate(), daysInMonth)
    for (let d = 1; d <= lastDay; d++) {
      datesToProcess.push(new Date(year, month - 1, d))
    }
    console.log(`📅 整月模式：${year}/${month} (到 ${lastDay} 日)`)
  } else {
    datesToProcess.push(today)
    console.log(`📅 單日模式：${formatDate(today)}`)
  }

  // 過濾出排班「出勤」的日子
  const workDates = datesToProcess.filter(date => {
    const d = date.getDate()
    const sched = schedules.find(s =>
      s.empId === EMP_ID && s.year === year && s.month === month && s.day === d
    )
    return sched && (sched.shift === 'W' || sched.shift === '出勤')
  })

  if (workDates.length === 0) {
    console.log('😴 今天不是出勤日，不需要打卡')
    process.exit(0)
  }

  // 過濾掉已有打卡紀錄的日期
  const existingDates = new Set(
    clockins
      .filter(c => c.empName === EMP_NAME || c.empName === '阿慶' || c.empName === '家慶')
      .filter(c => c.type === '上班')
      .map(c => c.date)
  )

  const newDates = workDates.filter(d => !existingDates.has(formatDate(d)))

  if (newDates.length === 0) {
    console.log('✅ 所有出勤日都已有打卡紀錄，無需補打')
    process.exit(0)
  }

  console.log(`\n📝 需要打卡 ${newDates.length} 天：`)

  const newRecords = []
  const ts = Date.now()
  const todayStr = formatDate(today)
  const nowHour = today.getHours()
  const nowMinute = today.getMinutes()

  newDates.forEach((date, i) => {
    const dateStr = formatDate(date)
    const { h: inH, m: inM } = randomClockIn()
    const { h: outH, m: outM } = randomClockOut(inH, inM)

    const inTime = formatTime(inH, inM)
    const outTime = formatTime(outH, outM)

    const isToday = dateStr === todayStr
    const nowTotal = nowHour * 60 + nowMinute

    // 上班紀錄：今天的話，要在上班時間之後才能打
    if (!isToday || nowTotal >= inH * 60 + inM) {
      newRecords.push({
        id: ts + i * 2,
        empId: EMP_ID,
        empName: EMP_NAME,
        date: dateStr,
        time: inTime,
        type: '上班'
      })
    }

    // 下班紀錄：今天的話，要在下班時間之後才能打
    if (!isToday || nowTotal >= outH * 60 + outM) {
      newRecords.push({
        id: ts + i * 2 + 1,
        empId: EMP_ID,
        empName: EMP_NAME,
        date: dateStr,
        time: outTime,
        type: '下班'
      })
      console.log(`  ${dateStr}  ${inTime} → ${outTime}`)
    } else if (!isToday || nowTotal >= inH * 60 + inM) {
      console.log(`  ${dateStr}  ${inTime} → (下班時間未到，稍後補打)`)
    } else {
      console.log(`  ${dateStr}  (時間未到，稍後補打)`)
    }
  })

  if (newRecords.length === 0) {
    console.log('\n⏳ 時間未到，尚無紀錄可寫入')
    process.exit(0)
  }

  // 寫入 Firebase
  const allClockins = [...clockins, ...newRecords]
  await set(ref(db, 'appData/clockins'), allClockins)

  console.log(`\n✅ 成功寫入 ${newRecords.length} 筆打卡紀錄！`)
  console.log(`   資料庫共 ${allClockins.length} 筆打卡紀錄`)

  process.exit(0)
}

main().catch(err => {
  console.error('❌ 執行失敗:', err.message)
  process.exit(1)
})
