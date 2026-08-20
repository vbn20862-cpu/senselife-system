// ── 勞基法薪資計算引擎 ──
// 依《中華民國勞動基準法》最低基準，計算員工某月：
//   時薪、正常工時、加班費（分級費率）、遲到早退不計薪、請假薪資調整、合規警示
//
// 設計原則：寧可多給、不可少給；寧可少扣、不可溢扣。
// 加班費：小數無條件進位。遲到早退：金額無條件捨去。

import { GOVT_WORK_DAYS, breakMinutesFor, computeOTSpans, computeDayMinutes, capNormalMin } from './salaryCalc'
import { getHolidays } from './holidays'

// ── 2025–2026 國定假日（勞基法第 37 條認定）──
// 民國 114-115 年。若放假調整有出入，由管理員在此處微調。
export const TAIWAN_HOLIDAYS = new Set([
  // 2025
  '2025-01-01', // 元旦
  '2025-01-28', // 除夕
  '2025-01-29', // 春節（初一）
  '2025-01-30', // 春節（初二）
  '2025-01-31', // 春節（初三）
  '2025-02-28', // 和平紀念日
  '2025-04-03', // 兒童節
  '2025-04-04', // 民族掃墓節
  '2025-05-01', // 勞動節
  '2025-05-31', // 端午節
  '2025-10-06', // 中秋節
  '2025-10-10', // 國慶日
  // 2026（與 holidays.js DEFAULT_HOLIDAYS 對齊；此表僅為 data.holidays 不存在時的 fallback）
  '2026-01-01', // 元旦
  '2026-02-16', // 除夕
  '2026-02-17', // 春節（初一）
  '2026-02-18', // 春節（初二）
  '2026-02-19', // 春節（初三）
  '2026-02-20', // 春節（初四）
  '2026-02-28', // 和平紀念日
  '2026-04-03', // 兒童節（調整放假）
  '2026-04-04', // 兒童節
  '2026-04-05', // 清明節
  '2026-04-06', // 清明節（補假）
  '2026-05-01', // 勞動節
  '2026-06-19', // 端午節
  '2026-09-25', // 中秋節
  '2026-10-09', // 國慶日（調整放假）
  '2026-10-10', // 國慶日
])

// 一例一休預設：週日例假、週六休息日。可由設定覆寫。
const DEFAULT_REGULAR_OFF_DAY = 0 // 週日
const DEFAULT_REST_DAY = 6        // 週六

// 一日工時上限（勞基法第 32 條）
export const MAX_DAILY_HOURS = 12

// ── 工具函式 ──────────────────────────────────────

export function dayType(dateStr, opts = {}) {
  // 活動工作日：手動標記的日期強制為平日（活動廠商週末有檔常見）
  // 仍要由管理員確認該週是否有調休，否則違反勞基法第 36 條
  if (opts.activityWorkDays?.has?.(dateStr) || opts.activityWorkDays?.includes?.(dateStr)) {
    return 'weekday'
  }
  // 優先使用使用者在班表自訂的國定假日（data.holidays），否則用內建表
  if (opts.holidaySet?.has?.(dateStr)) return 'holiday'
  if (!opts.holidaySet && TAIWAN_HOLIDAYS.has(dateStr)) return 'holiday'
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  const regularOff = opts.regularOff ?? DEFAULT_REGULAR_OFF_DAY
  const rest = opts.restDay ?? DEFAULT_REST_DAY
  if (dow === regularOff) return 'regularoff'
  if (dow === rest) return 'restday'
  return 'weekday'
}

const parseTime = (t) => {
  if (!t || typeof t !== 'string') return null
  const [h, m] = t.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

// 取得某員工某日的：[配對 in/out segments]
export function getDaySegments(dayRecs) {
  const ins  = dayRecs.filter(c => c.type === '上班').sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const outs = dayRecs.filter(c => c.type === '下班').sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const segs = []
  const pairs = Math.min(ins.length, outs.length)
  for (let i = 0; i < pairs; i++) {
    const s = parseTime(ins[i].time)
    let e = parseTime(outs[i].time)
    if (s == null || e == null) continue
    if (e < s) e += 24 * 60
    segs.push({ startMin: s, endMin: e, durationMin: e - s })
  }
  return segs
}

// 某日加班配對（加班開始/加班結束打卡）
export function getDayOvertimeSegments(dayRecs) {
  const starts = dayRecs.filter(c => c.type === '加班開始').sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const ends   = dayRecs.filter(c => c.type === '加班結束').sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const segs = []
  const pairs = Math.min(starts.length, ends.length)
  for (let i = 0; i < pairs; i++) {
    const s = parseTime(starts[i].time)
    let e = parseTime(ends[i].time)
    if (s == null || e == null) continue
    if (e < s) e += 24 * 60
    segs.push({ startMin: s, endMin: e, durationMin: e - s })
  }
  return segs
}

// ── 時薪計算 ─────────────────────────────────────

// 月工資總額（含經常性給與）：底薪 + 伙食津貼 + 全勤獎金 + 活動加給
// 不含：三節獎金、年終、不固定獎金、加班費本身
export function monthlyTotalRegularPay(setting) {
  if (!setting) return 0
  return Number(setting.baseSalary || 0)
       + Number(setting.mealAllowance || 0)
       + Number(setting.fullAttendanceBonus || 0)
       + Number(setting.activityAttendance || 0)
}

// 平日每小時工資（時薪基準）：月工資總額 ÷ 240
// 時薪制員工直接用 hourlyRate
export function hourlyRate(setting) {
  if (!setting) return 0
  if (setting.payType === 'hourly') {
    return Number(setting.hourlyRate || setting.baseSalary || 0)
  }
  const total = monthlyTotalRegularPay(setting)
  return total / 240
}

// ── 加班分級費率 ────────────────────────────────
// 倍率用 1.34 / 1.67 / 2.67（避免低於法定「以上」標準）

// 平日加班費（時數已扣除正常 8h）
//   第 9–10 小時 × 1.34
//   第 11–12 小時 × 1.67
function weekdayOTPay(otMin, hr) {
  const min1 = Math.min(otMin, 120) // 第 9–10 小時
  const min2 = Math.max(0, otMin - 120) // 第 11–12 小時
  const pay = (min1 / 60) * hr * 1.34 + (min2 / 60) * hr * 1.67
  return Math.ceil(pay) // 小數無條件進位
}

// 休息日加班費（全部視為加班，不分正常工時）
//   前 2 小時 × 1.34
//   第 3–8 小時 × 1.67
//   第 9–12 小時 × 2.67
function restdayOTPay(workMin, hr) {
  const min1 = Math.min(workMin, 120)
  const min2 = Math.min(Math.max(0, workMin - 120), 360) // 第 3–8 小時，共 6h = 360min
  const min3 = Math.max(0, workMin - 480)                // 第 9–12 小時
  const pay = (min1 / 60) * hr * 1.34 + (min2 / 60) * hr * 1.67 + (min3 / 60) * hr * 2.67
  return Math.ceil(pay)
}

// 國定假日／特休出勤
//   8 小時內 → 加發 1 日工資（時薪 × 8，不論實際時數）
//   第 9–10 小時 × 1.34
//   第 11–12 小時 × 1.67
function holidayPay(workMin, hr) {
  if (workMin <= 0) return 0
  const base = hr * 8 // 加發 1 日，無條件全給
  const ot1 = Math.min(Math.max(0, workMin - 480), 120) // 第 9–10
  const ot2 = Math.max(0, workMin - 600)                // 第 11–12
  const pay = base + (ot1 / 60) * hr * 1.34 + (ot2 / 60) * hr * 1.67
  return Math.ceil(pay)
}

// 例假日出勤
//   8 小時內 → 加發 1 日工資
//   第 9–12 小時 × 2
function regularoffPay(workMin, hr) {
  if (workMin <= 0) return 0
  const base = hr * 8
  const ot = Math.max(0, workMin - 480)
  const pay = base + (ot / 60) * hr * 2
  return Math.ceil(pay)
}

// ── 主引擎 ──────────────────────────────────────

// 計算某員工某月薪資（依勞基法）
// 回傳：{ summary（人類可讀文字）, json（規格化物件）, warnings, byDay }
export function computePayroll(emp, yr, mo, data, options = {}) {
  if (!emp) return null
  const monthStr = `${yr}-${String(mo).padStart(2, '0')}`
  const setting = (data.salarySettings || []).find(s => s.empId === emp.id)
  const hr = hourlyRate(setting)
  const monthlyPay = monthlyTotalRegularPay(setting)
  const contractHoursPerDay = options.contractHoursPerDay
    ?? emp.contractHoursPerDay
    ?? 8
  const minRestPerDayMin = contractHoursPerDay * 60 // 應上時數（分鐘）

  // 蒐集當月各日打卡
  const myClockins = (data.clockins || []).filter(c =>
    c.empName && c.date?.startsWith(monthStr) &&
    (c.empName === emp.name || emp.name.includes(c.empName) || c.empName.includes(emp.name))
  )
  const dates = [...new Set(myClockins.map(c => c.date))].sort()

  // 蒐集當月各日請假
  const myLeaves = (data.leaveRequests || []).filter(l =>
    l.empId === emp.id && (l.date || '').startsWith(monthStr)
  )
  const leavesByDate = {}
  for (const lv of myLeaves) {
    if (!leavesByDate[lv.date]) leavesByDate[lv.date] = []
    leavesByDate[lv.date].push(lv)
  }

  // 當月每一日（從 1 號開始 enumerate，含未打卡日，方便計算遲到早退）
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const byDay = []
  const warnings = []

  let totalNormalMin = 0
  let weekdayOTMin = 0
  let restdayWorkMin = 0
  let holidayWorkMin = 0
  let regularoffWorkMin = 0
  let weekdayOTPaySum = 0
  let restdayOTPaySum = 0
  let holidayPaySum = 0
  let regularoffPaySum = 0
  let shortMinSum = 0
  let leaveAdjustment = 0
  const leaveBreakdown = []

  const activityWorkSet = new Set(
    options.activityWorkDays
    ?? data.activityWorkDays
    ?? []
  )
  // 國定假日：使用班表可編輯的 data.holidays（與 HR 班表一致）
  const holidaySet = new Set(getHolidays(data).map(h => h.date))

  // 加班用跨日 span 配對，依「開始日」歸戶（與 HR 工時統計一致，支援跨午夜誤記日期）
  const otMinByDate = {}
  for (const sp of computeOTSpans(myClockins)) {
    if (sp.missingEnd || sp.missingStart || !sp.startDate) continue
    otMinByDate[sp.startDate] = (otMinByDate[sp.startDate] || 0) + sp.minutes
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${monthStr}-${String(d).padStart(2, '0')}`
    const t = dayType(dateStr, { activityWorkDays: activityWorkSet, holidaySet })
    const dayRecs = myClockins.filter(c => c.date === dateStr)
    const dayLeaves = leavesByDate[dateStr] || []
    // 是否有「正常上班」打卡（區分純加班結束 spillover 的日子，避免誤判短少）
    const hasRegularPunch = dayRecs.some(c => c.type === '上班' || c.type === '下班')

    const segs = getDaySegments(dayRecs)

    // 扣除休息時間後的「實際出勤分鐘數」
    let workedMin = 0
    for (const s of segs) {
      workedMin += Math.max(0, s.durationMin - breakMinutesFor(s.durationMin))
    }
    // 加班打卡（跨日 span，歸戶到開始日）
    const otMin = otMinByDate[dateStr] || 0
    const totalWorkedMin = workedMin + otMin

    // 一日工時上限警示
    if (totalWorkedMin > MAX_DAILY_HOURS * 60) {
      warnings.push(`${dateStr} 總工時 ${(totalWorkedMin / 60).toFixed(2)}h 已超過勞基法上限 12h`)
    }

    const dayRecord = {
      date: dateStr,
      dayType: t,
      workedMin,
      otMin,
      totalWorkedMin,
      leaveTypes: dayLeaves.map(l => l.type),
      pay: 0,
      shortMin: 0,
    }

    if (t === 'weekday') {
      // 平日：前 8h 算正常工時，超過分入加班費
      const normalCap = minRestPerDayMin
      const normal = Math.min(workedMin, normalCap)
      const otFromRegular = Math.max(0, workedMin - normalCap)
      const allOT = otFromRegular + otMin
      totalNormalMin += normal
      weekdayOTMin += allOT
      const otPay = weekdayOTPay(allOT, hr)
      weekdayOTPaySum += otPay
      dayRecord.pay = otPay

      // 活動工作日（週末被覆寫為平日）→ 提醒檢查調休
      const d2 = new Date(dateStr + 'T00:00:00').getDay()
      if (activityWorkSet.has(dateStr) && (d2 === 0 || d2 === 6) && dayRecs.length > 0) {
        warnings.push(`${dateStr} 活動工作日（週末）— 確認該週是否有調休，否則違反勞基法第 36 條（7 日內 2 日休息）`)
        dayRecord.isActivityDay = true
      }

      // 遲到早退（出勤短少）— 僅平日、有正常上班打卡、非請假覆蓋
      // （純加班結束 spillover 的日子沒有正常上班卡，不計短少）
      const fullLeaveHrs = dayLeaves.reduce((s, l) => s + Number(l.hours || 0), 0) * 60
      const expectedMin = Math.max(0, minRestPerDayMin - fullLeaveHrs)
      if (workedMin < expectedMin && hasRegularPunch) {
        const short = expectedMin - workedMin
        shortMinSum += short
        dayRecord.shortMin = short
      }
    } else if (t === 'restday') {
      const allWork = workedMin + otMin
      restdayWorkMin += allWork
      const pay = restdayOTPay(allWork, hr)
      restdayOTPaySum += pay
      dayRecord.pay = pay
      if (allWork > 0) {
        warnings.push(`${dateStr} 休息日出勤 ${(allWork / 60).toFixed(2)}h — 確認加班是否經員工同意`)
      }
    } else if (t === 'holiday') {
      const allWork = workedMin + otMin
      holidayWorkMin += allWork
      const pay = holidayPay(allWork, hr)
      holidayPaySum += pay
      dayRecord.pay = pay
      if (allWork > 0) {
        warnings.push(`${dateStr} 國定假日出勤 ${(allWork / 60).toFixed(2)}h — 須加發 1 日工資`)
      }
    } else if (t === 'regularoff') {
      const allWork = workedMin + otMin
      regularoffWorkMin += allWork
      const pay = regularoffPay(allWork, hr)
      regularoffPaySum += pay
      dayRecord.pay = pay
      if (allWork > 0) {
        warnings.push(`${dateStr} 例假日出勤 — 須確認符合天災事變突發事件條件，並於 24 小時內報備`)
      }
    }

    if (dayRecs.length > 0 || dayLeaves.length > 0) byDay.push(dayRecord)
  }

  // 請假薪資調整
  for (const lv of myLeaves) {
    const hrs = Number(lv.hours || 0)
    let factor = 0
    let label = lv.type
    switch (lv.type) {
      case '特休': factor = 0; label = '特休（全薪）'; break
      case '婚假': case '喪假': case '公假': case '公傷病假':
        factor = 0; label = `${lv.type}（給薪）`; break
      case '生理假': case '產假': case '產檢假': case '育嬰假': case '陪產假':
        factor = 0; label = `${lv.type}（性平法）`; break
      case '普通傷病假': case '病假':
        factor = -0.5; label = `${lv.type}（半薪）`; break
      case '事假':
        factor = -1; label = '事假（不給薪）'; break
      default:
        factor = 0; label = `${lv.type || '其他'}（未認定）`
    }
    const adj = Math.floor(hrs * hr * factor)
    leaveAdjustment += adj
    leaveBreakdown.push({ type: label, hours: hrs, adj })
  }

  // 遲到早退不計薪金額（無條件捨去）
  const lateEarlyDeduction = Math.floor((shortMinSum / 60) * hr)

  // 加班費總計
  const overtimePaySum = weekdayOTPaySum + restdayOTPaySum + holidayPaySum + regularoffPaySum

  // 每月加班合規檢查
  const totalOTHours = (weekdayOTMin + restdayWorkMin + Math.max(0, holidayWorkMin - 480 * 0) + regularoffWorkMin) / 60
  // 嚴格意義下，平日加班 + 休息日加班 計入第 32 條 46h/月 上限；國定/例假日另計
  const ot32Hours = (weekdayOTMin + restdayWorkMin) / 60
  const cap = options.relaxedCap ? 54 : 46
  if (ot32Hours > cap) {
    warnings.push(`當月加班 ${ot32Hours.toFixed(2)}h 超過第 32 條 ${cap}h 上限（${options.relaxedCap ? '勞資會議放寬' : '未經放寬'}）`)
  }

  // 本薪部分（月薪制）
  const baseForMonth = setting?.payType === 'monthly'
    ? monthlyPay
    : Math.round(((totalNormalMin + weekdayOTMin) / 60) * hr) // 時薪制就是時數 × 時薪（粗估）

  const netPay = baseForMonth + overtimePaySum + leaveAdjustment - lateEarlyDeduction

  const json = {
    employee: emp.name,
    month: monthStr,
    hourly_rate: Math.round(hr * 100) / 100,
    monthly_regular_pay: monthlyPay,
    normal_hours: +(totalNormalMin / 60).toFixed(2),
    overtime: {
      weekday: +(weekdayOTMin / 60).toFixed(2),
      restday: +(restdayWorkMin / 60).toFixed(2),
      holiday: +(holidayWorkMin / 60).toFixed(2),
      regularoff: +(regularoffWorkMin / 60).toFixed(2),
      pay: overtimePaySum,
    },
    comp_time_added: 0, // 不再自動轉補休
    late_early_short_min: shortMinSum,
    late_early_deduction: lateEarlyDeduction,
    leave_adjustment: leaveAdjustment,
    leave_breakdown: leaveBreakdown,
    net_pay: netPay,
    warnings,
  }

  // 人類可讀摘要
  const fmtMoney = (n) => 'NT$' + Number(n).toLocaleString()
  const fmtH = (m) => (m / 60).toFixed(2)
  const lines = []
  lines.push(`員工：${emp.name}　月份：${monthStr}`)
  lines.push(`時薪基準：${Math.round(hr * 100) / 100} 元${setting?.payType === 'monthly' ? `（月薪總額 ${monthlyPay} ÷ 240）` : '（時薪制）'}`)
  lines.push('─────────────────────────')
  lines.push(`正常出勤時數：${fmtH(totalNormalMin)} 小時`)
  lines.push(`加班明細：`)
  lines.push(`  平日加班　${fmtH(weekdayOTMin)} 小時 → ${fmtMoney(weekdayOTPaySum)}`)
  lines.push(`  休息日加班 ${fmtH(restdayWorkMin)} 小時 → ${fmtMoney(restdayOTPaySum)}`)
  lines.push(`  國定假日　${fmtH(holidayWorkMin)} 小時 → ${fmtMoney(holidayPaySum)}`)
  lines.push(`  例假日　　${fmtH(regularoffWorkMin)} 小時 → ${fmtMoney(regularoffPaySum)}`)
  lines.push(`加班費小計：${fmtMoney(overtimePaySum)}`)
  lines.push(`補休轉入：0 小時（補休須員工申請、雇主同意；不再自動換）`)
  lines.push('─────────────────────────')
  lines.push(`遲到早退不計薪：-${fmtMoney(lateEarlyDeduction)}（短少 ${shortMinSum} 分）`)
  if (leaveBreakdown.length) {
    lines.push(`請假調整：`)
    for (const lb of leaveBreakdown) {
      lines.push(`  ${lb.type} ${lb.hours}h → ${lb.adj < 0 ? '' : '+'}${fmtMoney(lb.adj)}`)
    }
  } else {
    lines.push(`請假調整：無`)
  }
  lines.push('─────────────────────────')
  lines.push(`本薪：${fmtMoney(baseForMonth)}　當月實發（含加班費）：${fmtMoney(netPay)}`)
  if (warnings.length) {
    lines.push(`⚠️ 警示：`)
    for (const w of warnings) lines.push(`  - ${w}`)
  } else {
    lines.push(`⚠️ 警示：無`)
  }

  return {
    summary: lines.join('\n'),
    json,
    warnings,
    byDay,
  }
}

// ── 特別休假（第 38 條）─────────────────────────────
// 依年資給假天數（曆年制：以該曆年 12/31 的年資計，較有利勞工）
export function annualLeaveDaysForYears(years) {
  if (years < 0.5) return 0
  if (years < 1) return 3
  if (years < 2) return 7
  if (years < 3) return 10
  if (years < 5) return 14
  if (years < 10) return 15
  return Math.min(30, 16 + (Math.floor(years) - 10)) // 10年起每年+1，上限30
}

// 員工某曆年的特休額度（天）
export function annualLeaveEntitlement(hireDate, year) {
  if (!hireDate) return 0
  const hire = new Date(hireDate + 'T00:00:00')
  const refEnd = new Date(`${year}-12-31T00:00:00`)
  if (isNaN(hire) || hire > refEnd) return 0
  const years = (refEnd - hire) / (365.25 * 86400000)
  return annualLeaveDaysForYears(years)
}

// 員工某曆年的特休狀態
// 已用(usedHours) = 僅「已核准」；待審核(pendingHours) 另計。
// remaining（可申請）= 額度 − 已核准 − 待審核（保守，避免重複佔額度）
// payableHours（年底折現基準）= 額度 − 已核准（待審核不預先扣）
export function annualLeaveStatus(emp, year, data) {
  const entitledDays = annualLeaveEntitlement(emp?.hireDate, year)
  const hoursOf = (l) => {
    // 請假以 startDate/endDate/days 記錄，計入該年的天數 ×8 小時
    const start = l.startDate || l.date
    const end = l.endDate || l.startDate || l.date
    if (!start) return 0
    if (start === end && Number(l.days) === 0.5) return new Date(start).getFullYear() === year ? 4 : 0
    let h = 0
    const d = new Date(start), last = new Date(end)
    while (d <= last) {
      if (d.getFullYear() === year) h += 8
      d.setDate(d.getDate() + 1)
    }
    return h
  }
  let usedHours = 0, pendingHours = 0
  for (const l of (data.leaveRequests || [])) {
    if (l.empId !== emp?.id || l.type !== '特休') continue
    if (l.status === '已核准') usedHours += hoursOf(l)
    else if (l.status === '待審核') pendingHours += hoursOf(l)
    // 已駁回不算
  }
  const entitledHours = entitledDays * 8
  const remainingHours = Math.max(0, entitledHours - usedHours - pendingHours)
  const payableHours = Math.max(0, entitledHours - usedHours)
  return {
    entitledDays,
    entitledHours,
    usedHours,
    usedDays: Math.round((usedHours / 8) * 10) / 10,
    pendingHours,
    pendingDays: Math.round((pendingHours / 8) * 10) / 10,
    remainingHours,
    remainingDays: Math.round((remainingHours / 8) * 10) / 10,
    payableHours,
  }
}

// 年底未休特休折現（時薪 × 剩餘時數，無條件進位＝寧可多給）
// 折現只認「已核准」的已用；待審核不預先扣（駁回後額度自動回來）
export function annualLeavePayout(emp, year, data) {
  const setting = (data.salarySettings || []).find(s => s.empId === emp?.id)
  const hr = hourlyRate(setting)
  const { payableHours } = annualLeaveStatus(emp, year, data)
  return { hours: payableHours, amount: Math.ceil(payableHours * hr) }
}

// ════════════════════════════════════════════════════════════
//  走法 B：加班折補休 + 月缺口扣薪 + 季底折現
//  起算：2026-06。3-5月已手動結算，不納入。
// ════════════════════════════════════════════════════════════

export const COMP_START = { year: 2026, month: 6 } // 補休新制起算

const pad2 = (n) => String(n).padStart(2, '0')
const round2 = (n) => Math.round(n * 100) / 100
const nameMatch = (c, emp) => c.empName && (c.empName === emp.name || emp.name.includes(c.empName) || c.empName.includes(emp.name))
const quarterOf = (month) => Math.ceil(month / 3)

// 某員工某月「正常工時」(上班/下班，扣休息，排除國定假日與加班) — 用於月缺口判斷
export function computeMonthNormalHours(emp, yr, mo, data, holidaySet) {
  const monthStr = `${yr}-${pad2(mo)}`
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const recs = (data.clockins || []).filter(c => c.date?.startsWith(monthStr) && nameMatch(c, emp))
  const dates = [...new Set(recs.map(c => c.date))]
  let min = 0
  for (const date of dates) {
    if (holidaySet.has(date)) continue // 國定假日工時歸補休，不計入正常工時
    const { dayMin } = computeDayMinutes(recs.filter(c => c.date === date), date === todayStr)
    min += capNormalMin(dayMin) // 正常工時每日上限 8h
  }
  return round2(min / 60)
}

// 某員工某月「補休入帳」{hours, weighted, lots}
//   平日：只認加班打卡(超過8h部分)，前2h×1.34、其餘×1.67
//   國定假日：當天所有出勤(正常+加班) ×2
//   lots：依費率分桶 { '1.34': h, '1.67': h, '2': h } — 供「先扣低費率」消耗用
export function computeMonthCompAccrual(emp, yr, mo, data, holidaySet) {
  const monthStr = `${yr}-${pad2(mo)}`
  const recs = (data.clockins || []).filter(c => c.date?.startsWith(monthStr) && nameMatch(c, emp))
  // 加班用跨日 span 配對，歸戶到開始日
  const otMinByDate = {}
  for (const sp of computeOTSpans(recs)) {
    if (sp.missingEnd || sp.missingStart || !sp.startDate) continue
    otMinByDate[sp.startDate] = (otMinByDate[sp.startDate] || 0) + sp.minutes
  }
  const dates = [...new Set(recs.map(c => c.date))]
  let hours = 0, weighted = 0
  const lots = { '1.34': 0, '1.67': 0, '2': 0 }
  for (const date of dates) {
    const dayRecs = recs.filter(c => c.date === date)
    const otMin = otMinByDate[date] || 0
    if (holidaySet.has(date)) {
      const { dayMin } = computeDayMinutes(dayRecs, false)
      const h = (capNormalMin(dayMin) + otMin) / 60 // 假日正常出勤上限 8h，超過要打加班卡
      hours += h; weighted += h * 2.0; lots['2'] += h
    } else {
      // 加班費級距只算「當天總工時超過 8h」的部分。
      // 正常工時(上班/下班)填滿前 8h，加班打卡疊在上面，超過 8h 才算加班。
      const { dayMin: regMin } = computeDayMinutes(dayRecs, false)
      const otBeyond8Min = Math.max(0, capNormalMin(regMin) + otMin - 480)
      const h = otBeyond8Min / 60
      const t1 = Math.min(h, 2), t2 = Math.max(0, h - 2)
      hours += h
      weighted += t1 * 1.34 + t2 * 1.67
      lots['1.34'] += t1; lots['1.67'] += t2
    }
  }
  return { hours: round2(hours), weighted: round2(weighted), lots }
}

// 時薪制國定假日加給：假日出勤工時 × 時薪 × 1（補足到 ×2，因時薪底薪已含 ×1）
//   回傳 { hours, amount }
export function computeHourlyHolidayPremium(emp, yr, mo, data, rate) {
  const holidaySet = new Set(getHolidays(data).map(h => h.date))
  const monthStr = `${yr}-${pad2(mo)}`
  const recs = (data.clockins || []).filter(c => c.date?.startsWith(monthStr) && nameMatch(c, emp))
  // 加班用跨日 span 配對（歸開始日），與月時數一致
  const otMinByDate = {}
  for (const sp of computeOTSpans(recs)) {
    if (sp.missingEnd || sp.missingStart || !sp.startDate) continue
    otMinByDate[sp.startDate] = (otMinByDate[sp.startDate] || 0) + sp.minutes
  }
  const dates = [...new Set(recs.map(c => c.date))].filter(d => holidaySet.has(d))
  let holHours = 0
  for (const date of dates) {
    const dayRecs = recs.filter(c => c.date === date)
    const { dayMin } = computeDayMinutes(dayRecs, false)
    holHours += (capNormalMin(dayMin) + (otMinByDate[date] || 0)) / 60 // 正常出勤上限 8h
  }
  holHours = round2(holHours)
  return { hours: holHours, amount: Math.round(holHours * rate) }
}

// ── 假別定義（cat：paid=全薪 / half=半薪 / unpaid=無薪）──
export const LEAVE_TYPES = [
  { type: '特休',    cat: 'paid',   annual: true,  desc: '扣特休額度，全薪' },
  { type: '補休',    cat: 'paid',   usesComp: true, desc: '消耗補休餘額，全薪' },
  { type: '婚假',    cat: 'paid',   desc: '8 天，全薪' },
  { type: '喪假',    cat: 'paid',   desc: '依親等 3~8 天，全薪' },
  { type: '公假',    cat: 'paid',   desc: '依事由，全薪' },
  { type: '公傷病假', cat: 'paid',   desc: '職災醫療期間，全薪' },
  { type: '產假',    cat: 'paid',   desc: '8 週，全薪' },
  { type: '陪產假',  cat: 'paid',   desc: '7 天，全薪' },
  { type: '病假',    cat: 'half',   desc: '一年 30 天內，半薪' },
  { type: '事假',    cat: 'unpaid', desc: '一年 14 天，無薪' },
]
export const PAY_FACTOR = { paid: 1.0, half: 0.5, unpaid: 0 }
export function leaveTypeCat(type) {
  return LEAVE_TYPES.find(t => t.type === type)?.cat || 'paid'
}

// 計算一筆請假在某年月內的天數（支援半天）
function leaveDaysInMonth(l, yr, mo) {
  const monthStr = `${yr}-${pad2(mo)}`
  const start = l.startDate || l.date
  const end = l.endDate || l.startDate || l.date
  if (!start) return 0
  let cal = 0
  const d = new Date(start), last = new Date(end)
  while (d <= last) {
    if (d.toLocaleDateString('sv-SE').startsWith(monthStr)) cal++
    d.setDate(d.getDate() + 1)
  }
  // 單日半天假
  if (start === end && Number(l.days) === 0.5) return cal * 0.5
  return cal
}

// 某員工某月「請假折算有效工時」：全薪假×8h、半薪假×4h、無薪假×0h（僅計已核准）
// 用於月缺口判斷：有效工時 = 正常工時 + 此值
export function leaveEffectiveHoursInMonth(emp, yr, mo, data) {
  let hours = 0
  for (const l of (data.leaveRequests || [])) {
    if (l.empId !== emp.id) continue
    if (l.status && l.status !== '已核准') continue // 只算已核准（無 status 視為舊資料已生效）
    const factor = PAY_FACTOR[leaveTypeCat(l.type)] ?? 1.0
    hours += leaveDaysInMonth(l, yr, mo) * 8 * factor
  }
  return round2(hours)
}

// 某日員工的已核准請假折算有效時數（全薪 8h、半薪 4h、無薪 0h；半天減半）
function leaveEffectiveHoursOnDate(emp, dateStr, data) {
  let h = 0
  for (const l of (data.leaveRequests || [])) {
    if (l.empId !== emp.id) continue
    if (l.status && l.status !== '已核准') continue
    const start = l.startDate || l.date
    const end = l.endDate || l.startDate || l.date
    if (!start || dateStr < start || dateStr > end) continue
    const factor = PAY_FACTOR[leaveTypeCat(l.type)] ?? 1.0
    const dayHours = (start === end && Number(l.days) === 0.5) ? 4 : 8
    h += dayHours * factor
  }
  return h
}
function dateHasLeave(emp, dateStr, data) {
  return (data.leaveRequests || []).some(l => {
    if (l.empId !== emp.id || (l.status && l.status !== '已核准')) return false
    const start = l.startDate || l.date, end = l.endDate || l.startDate || l.date
    return start && dateStr >= start && dateStr <= end
  })
}

// 按「排班表」逐日計算缺時（遲到/早退/曠職）— 扣薪基準
//   排班 出勤=8h、上午/下午班=4h、休假=0；排除國定假日與今天/未來
//   每日缺時 = max(0, 排班時數 − 當日實際工時(上限8h) − 當日請假折算)
//   曠職 = 完全沒打卡又沒請假（整天缺時）；待補登 = 有上班沒下班（暫不計缺時）
// ── 停班 / 豪雨假 ─────────────────────────────
// data.suspensions = { '2026-06-26': { label:'豪雨假', scope:'full' },
//                      '2026-06-25': { label:'豪雨假', scope:'partial', fromTime:'14:00' } }
// 停班日規則（依天災要點：可不發工資、但不得視為曠工）：
//   月薪制沒出勤 → 缺的時數「無薪」（計入缺時扣薪），但歸類為「停班未出勤」、不算曠職/遲到早退
//   有出勤 → 工時照正常薪 1× 計，不自動加給
export function getSuspensions(data) {
  return data?.suspensions || {}
}
// 部分停班日的「停班時段時數」
// 時窗優先用「當日實際上班卡」定錨（活動日 7:30 上班也算得對）；沒打卡才用預設窗
const SHIFT_WINDOW = { '出勤': [9, 18], 'W': [9, 18], '上午班': [9, 13], '下午班': [13, 17] }
function suspendedHours(susp, shiftCode, shiftHours, dayRecs = []) {
  if (susp.scope === 'full') return shiftHours
  if (!susp.fromTime) return shiftHours
  const [fh, fm] = susp.fromTime.split(':').map(Number)
  const fromH = fh + (fm || 0) / 60
  // 定錨窗尾：實際上班卡 + 班別時數 + 休息（8h 班含 1h 午休）
  const firstIn = dayRecs.filter(c => c.type === '上班').map(c => c.time).sort()[0]
  let winEnd
  if (firstIn) {
    const [ih, im] = firstIn.split(':').map(Number)
    winEnd = ih + (im || 0) / 60 + shiftHours + (shiftHours >= 8 ? 1 : 0)
  } else {
    const win = SHIFT_WINDOW[shiftCode]
    if (!win) return shiftHours
    winEnd = win[1]
  }
  return Math.max(0, Math.min(shiftHours, winEnd - fromH))
}

export function computeScheduledStats(emp, yr, mo, data, holidaySet) {
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const SHIFT_H = { '出勤': 8, 'W': 8, '上午班': 4, '下午班': 4 }
  const suspensions = getSuspensions(data)
  let scheduledH = 0, deficitMin = 0
  let absentDays = 0, missingPunchDays = 0, lateLeaveDays = 0, suspShortDays = 0
  const absentDates = [], missingPunchDates = [], deficitDates = [], suspShortDates = []
  for (const sc of (data.schedules || []).filter(s => s.empId === emp.id && s.year === yr && s.month === mo)) {
    const sh = SHIFT_H[sc.shift]
    if (!sh) continue
    const dateStr = `${yr}-${pad2(mo)}-${pad2(sc.day)}`
    if (holidaySet.has(dateStr) || dateStr >= todayStr) continue // 今天與未來不算（尚未結束）
    const susp = suspensions[dateStr]
    const dayRecs = (data.clockins || []).filter(c => c.date === dateStr && nameMatch(c, emp))
    const hasIn = dayRecs.some(c => c.type === '上班')
    const hasOut = dayRecs.some(c => c.type === '下班')
    const leaveH = leaveEffectiveHoursOnDate(emp, dateStr, data)
    const onLeave = leaveH > 0 || dateHasLeave(emp, dateStr, data)
    // 有上班沒下班 = 忘打卡，待補登：不計缺時、不算曠職（等補登）
    if (hasIn && !hasOut && !onLeave) { missingPunchDays++; missingPunchDates.push(dateStr); continue }
    scheduledH += sh
    const workedMin = capNormalMin(computeDayMinutes(dayRecs, false).dayMin)
    const fulfilledMin = workedMin + leaveH * 60
    let dMin = Math.max(0, sh * 60 - fulfilledMin)
    // 部分停班日：只要當日未做滿全班，停班時段整塊無薪（多留的零頭不抵扣；
    // 停班時段內有出勤要給的，一律走手動補休入帳，如 6/25 傍晚案例）
    if (dMin > 0 && susp && susp.scope === 'partial') {
      dMin = Math.min(sh * 60, Math.max(dMin, suspendedHours(susp, sc.shift, sh, dayRecs) * 60))
    }
    if (dMin > 0) {
      deficitMin += dMin
      deficitDates.push({ date: dateStr, hours: round2(dMin / 60) })
      if (susp) { suspShortDays++; suspShortDates.push(dateStr) } // 停班未出勤：無薪但不算曠職（天災要點）
      else if (!hasIn && !hasOut && !onLeave) { absentDays++; absentDates.push(dateStr) } // 整天曠職
      else lateLeaveDays++ // 遲到/早退缺時
    }
  }
  return {
    scheduledH: round2(scheduledH),
    deficitHours: round2(deficitMin / 60),
    absentDays, absentDates, lateLeaveDays, deficitDates,
    missingPunchDays, missingPunchDates,
    suspShortDays, suspShortDates,
  }
}

// 某員工某月「請補休」時數（已核准的補休假，1 天 = 8 小時）— 直接消耗補休餘額
export function compLeaveTakenInMonth(emp, yr, mo, data) {
  let hours = 0
  for (const l of (data.leaveRequests || [])) {
    if (l.empId !== emp.id || l.type !== '補休') continue
    if (l.status && l.status !== '已核准') continue
    hours += leaveDaysInMonth(l, yr, mo) * 8
  }
  return round2(hours)
}

// 某員工某月特休使用時數（請假以 startDate/endDate/days 記錄，1 天 = 8 小時）
function annualLeaveUsedInMonth(emp, yr, mo, data) {
  const monthStr = `${yr}-${pad2(mo)}`
  let hours = 0
  for (const l of (data.leaveRequests || [])) {
    if (l.empId !== emp.id || l.type !== '特休') continue
    if (l.status && l.status !== '已核准') continue // 僅計已核准
    const start = l.startDate || l.date
    const end = l.endDate || l.startDate || l.date
    if (!start) continue
    const d = new Date(start), last = new Date(end)
    while (d <= last) {
      if (d.toLocaleDateString('sv-SE').startsWith(monthStr)) hours += 8
      d.setDate(d.getDate() + 1)
    }
  }
  return hours
}

// 某月份依到職日比例計算「應上時數」(到職日當月才用)，再扣掉縣府停班時數
// （停班日沒出勤＝無薪，應上時數不因停班減少）
function proratedGovtHours(emp, yr, mo) {
  const govt = GOVT_WORK_DAYS[`${yr}-${pad2(mo)}`]?.hours || 0
  if (!emp.hireDate) return govt
  const hire = new Date(emp.hireDate)
  const hY = hire.getFullYear(), hM = hire.getMonth() + 1
  if (yr < hY || (yr === hY && mo < hM)) return 0            // 到職前：無應上時數
  if (yr > hY || (yr === hY && mo > hM)) return govt          // 到職後整月
  // 到職當月：依當月剩餘日曆天比例
  const daysInMo = new Date(yr, mo, 0).getDate()
  const remaining = daysInMo - hire.getDate() + 1
  return Math.round(govt * remaining / daysInMo)
}

// 補休水庫總帳：從 2026-06 逐月走到 asOf，回傳逐月明細 + 季結 + 餘額
//   asOf = { year, month }
export function computeCompLedger(emp, data, asOf) {
  const holidaySet = new Set(getHolidays(data).map(h => h.date))
  const setting = (data.salarySettings || []).find(s => s.empId === emp.id)
  const hr = hourlyRate(setting)
  const isHourly = (setting?.payType || 'monthly') === 'hourly' // 時薪制：按時數給薪，不另扣缺口

  // 月份序列 2026-06 → asOf
  const months = []
  let y = COMP_START.year, m = COMP_START.month
  while (y < asOf.year || (y === asOf.year && m <= asOf.month)) {
    months.push({ year: y, month: m })
    m++; if (m > 12) { m = 1; y++ }
  }

  // 補休依費率分桶（先扣低費率：缺口優先消耗便宜的，把假日×2 留到季底折現）
  const RATE_ORDER = ['1.34', '1.67', '2'] // 由便宜到貴
  const bal = { '1.34': 0, '1.67': 0, '2': 0 }
  const sumLots = () => RATE_ORDER.reduce((s, r) => s + bal[r], 0)
  const weightedLots = () => RATE_ORDER.reduce((s, r) => s + bal[r] * Number(r), 0)
  const monthly = []
  const settlements = []

  for (const { year, month } of months) {
    // 時薪制：加班已含在時薪內（時數×時薪），不另累積補休，避免加班付兩次
    const accr = isHourly ? { hours: 0, weighted: 0, lots: { '1.34': 0, '1.67': 0, '2': 0 } } : computeMonthCompAccrual(emp, year, month, data, holidaySet)
    RATE_ORDER.forEach(r => { bal[r] += accr.lots[r] || 0 })

    // 手動補休調整（compLeaveManual，基準費率 1.34 估值）；時薪制不適用
    const manual = isHourly ? 0 : (data.compLeaveManual || [])
      .filter(r => r.empId === emp.id && (r.date || '').startsWith(`${year}-${pad2(month)}`))
      .reduce((s, r) => s + Number(r.hours || 0), 0)
    if (manual) bal['1.34'] += manual

    // 員工「請補休」→ 直接從補休餘額扣（先扣低費率）。補休假本身算全薪(不扣缺口)
    const compTaken = isHourly ? 0 : compLeaveTakenInMonth(emp, year, month, data)
    let compTakenRemain = compTaken
    for (const r of RATE_ORDER) {
      if (compTakenRemain <= 0) break
      const take = Math.min(compTakenRemain, bal[r])
      bal[r] = round2(bal[r] - take)
      compTakenRemain = round2(compTakenRemain - take)
    }

    // 缺時(扣薪基準)：依「排班表」逐日算 — 遲到/早退/曠職 的少做時數
    //   每日缺時 = max(0, 排班時數 − 實際工時 − 請假折算)；忘打卡(待補登)不計
    //   應上時數(政府行事曆)另存供顯示參考。時薪制按時數給薪、不扣缺時。
    const normalH = computeMonthNormalHours(emp, year, month, data, holidaySet)
    const govtH = proratedGovtHours(emp, year, month)
    const sched = computeScheduledStats(emp, year, month, data, holidaySet)
    const shortfall = isHourly ? 0 : sched.deficitHours
    // 缺口優先扣低費率補休（1.34 → 1.67 → 2）
    let remain = shortfall
    let consumed = 0
    for (const r of RATE_ORDER) {
      if (remain <= 0) break
      const take = Math.min(remain, bal[r])
      bal[r] = round2(bal[r] - take)
      remain = round2(remain - take)
      consumed = round2(consumed + take)
    }
    const dockHours = round2(shortfall - consumed)
    const dockAmount = isHourly ? 0 : Math.floor(dockHours * hr) // 扣薪無條件捨去（少扣）；時薪制不扣

    monthly.push({
      year, month, govtH, scheduledH: sched.scheduledH,
      deficitHours: sched.deficitHours, deficitDates: sched.deficitDates,
      absentDays: sched.absentDays, absentDates: sched.absentDates, lateLeaveDays: sched.lateLeaveDays,
      missingPunchDays: sched.missingPunchDays, missingPunchDates: sched.missingPunchDates,
      suspShortDays: sched.suspShortDays, suspShortDates: sched.suspShortDates,
      normalH, compTaken,
      accruedHours: accr.hours, manualHours: manual,
      shortfall, consumed, dockHours, dockAmount,
      balHours: round2(sumLots()),
    })

    // 季底結算（6/9/12 月）：未休補休依「各費率桶」折現（高費率留到此時）
    if (month === 6 || month === 9 || month === 12) {
      const wl = weightedLots()
      if (sumLots() > 0.01) {
        settlements.push({
          year, quarter: quarterOf(month),
          hours: round2(sumLots()),
          amount: Math.ceil(wl * hr), // 折現無條件進位（多給）
          avgRate: sumLots() > 0 ? round2(wl / sumLots()) : 0,
          lots: { ...bal },
        })
      }
      RATE_ORDER.forEach(r => { bal[r] = 0 })
    }
  }

  return { balanceHours: round2(sumLots()), monthly, settlements, hourlyRate: round2(hr) }
}

// 把舊資料的「行政機關辦公時數」做為參考（顯示用，不再當基準）
export function govtHoursOf(yr, mo) {
  const key = `${yr}-${String(mo).padStart(2, '0')}`
  return GOVT_WORK_DAYS[key]?.hours ?? null
}

// ── 補休（第 32-1 條）─────────────────────────────

// 曆年制補休到期日：加班發生年份的 12/31
export function compLeaveExpiryDate(otDateStr) {
  const y = otDateStr?.slice(0, 4)
  return y ? `${y}-12-31` : null
}

// 一段加班轉補休的「最高費率」（過期折錢採最高費率＝寧可多給、不可少給）
// 回傳 { rate, label }
export function otSpanCompRate(hours, dt) {
  if (dt === 'restday') {
    if (hours <= 2) return { rate: 1.34, label: '休息日加班 前2h' }
    if (hours <= 8) return { rate: 1.67, label: '休息日加班 第3–8h' }
    return { rate: 2.67, label: '休息日加班 第9–12h' }
  }
  if (dt === 'holiday')    return { rate: 1.67, label: '國定假日加班' }
  if (dt === 'regularoff') return { rate: 2.0,  label: '例假日加班' }
  // 平日加班（第 9 小時起）
  if (hours <= 2) return { rate: 1.34, label: '平日加班 第9–10h' }
  return { rate: 1.67, label: '平日加班 第11–12h' }
}

const daysBetween = (fromStr, toStr) => {
  if (!fromStr || !toStr) return Infinity
  const [y1, m1, d1] = fromStr.split('-').map(Number)
  const [y2, m2, d2] = toStr.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

// 計算某員工補休庫存：進帳(compLeaveAccruals) 對 出帳(compLeaveRecords) 做 FIFO 沖銷
// 回傳每筆進帳的剩餘時數與狀態，及彙總。
//   state: active 在庫 / used 已休完 / expired 過期未折 / expired_paid 已折錢
export function computeCompLeave(empId, data, todayStr) {
  const accruals = (data.compLeaveAccruals || [])
    .filter(a => a.empId === empId)
    .sort((a, b) => (a.sourceOtDate || '').localeCompare(b.sourceOtDate || '')) // 最舊先沖
    .map(a => ({ ...a }))
  const usageRecs = (data.compLeaveRecords || [])
    .filter(r => r.empId === empId)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  const totalUsed = usageRecs.reduce((s, r) => s + Number(r.hours || 0), 0)

  // FIFO：補休使用先扣最舊（最快到期）的進帳
  let toAllocate = totalUsed
  for (const a of accruals) {
    const used = Math.min(Number(a.hours || 0), Math.max(0, toAllocate))
    a.usedHours = used
    a.remaining = Number(a.hours || 0) - used
    toAllocate -= used
    if (a.status === 'expired_paid') { a.state = 'expired_paid'; continue }
    if (a.remaining <= 0) a.state = 'used'
    else if (a.expiryDate && a.expiryDate < todayStr) a.state = 'expired'
    else a.state = 'active'
    // 過期折錢金額（剩餘時數 × 最高費率 × 當時時薪，無條件進位）
    a.payoutAmount = a.state === 'expired'
      ? Math.ceil(a.remaining * Number(a.rate || 0) * Number(a.hourlyRateSnap || 0))
      : 0
    a.daysToExpiry = a.expiryDate ? daysBetween(todayStr, a.expiryDate) : Infinity
  }

  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0)
  return {
    accruals,
    usageRecs,
    totalEarned: sum(accruals, a => Number(a.hours || 0)),
    totalUsed,
    activeHours:  sum(accruals.filter(a => a.state === 'active'),  a => a.remaining),
    expiredHours: sum(accruals.filter(a => a.state === 'expired'), a => a.remaining),
    soonHours:    sum(accruals.filter(a => a.state === 'active' && a.daysToExpiry <= 30), a => a.remaining),
    expiredPayout: sum(accruals.filter(a => a.state === 'expired'), a => a.payoutAmount),
  }
}
