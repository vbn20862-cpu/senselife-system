// ── 薪資計算共用常數 & helper ──
// 由 Finance.jsx 與 HR.jsx 共用

export const MONTHS = ['一','二','三','四','五','六','七','八','九','十','十一','十二']

// 行政機關辦公日曆（依行政院人事行政總處公告）
export const GOVT_WORK_DAYS = {
  // 114年 (2025)
  '2025-01': { days: 17, hours: 136 },
  '2025-02': { days: 19, hours: 152 },
  '2025-03': { days: 21, hours: 168 },
  '2025-04': { days: 19, hours: 152 },
  '2025-05': { days: 22, hours: 176 },
  '2025-06': { days: 20, hours: 160 },
  '2025-07': { days: 23, hours: 184 },
  '2025-08': { days: 21, hours: 168 },
  '2025-09': { days: 21, hours: 168 },
  '2025-10': { days: 20, hours: 160 },
  '2025-11': { days: 21, hours: 168 },
  '2025-12': { days: 21, hours: 168 },
  // 115年 (2026)
  '2026-01': { days: 21, hours: 168 },
  '2026-02': { days: 14, hours: 112 },
  '2026-03': { days: 22, hours: 176 },
  '2026-04': { days: 20, hours: 160 },
  '2026-05': { days: 20, hours: 160 },
  '2026-06': { days: 21, hours: 168 },
  '2026-07': { days: 23, hours: 184 },
  '2026-08': { days: 21, hours: 168 },
  '2026-09': { days: 20, hours: 160 },
  '2026-10': { days: 20, hours: 160 },
  '2026-11': { days: 21, hours: 168 },
  '2026-12': { days: 22, hours: 176 },
}

// 時數捨去規則：小數 .0~.4 捨去，.5~.9 取 .5
// 注意：此為 UI 顯示用粗略單位（半小時粒度）。
// 真實薪資／加班費計算請用 minutesToDecimalHours（分鐘級精度），
// 並由 utils/payrollEngine.js 的勞基法引擎執行。
export const roundHours = (minutes) => Math.floor((minutes / 60) * 2) / 2

// 分鐘 → 小數小時（不捨去，保留分鐘精度）
export const minutesToDecimalHours = (minutes) => Math.round((minutes / 60) * 100) / 100

// 平日正常工時每日上限 = 8 小時（480 分）。超過的部分要打「加班開始/結束」才算加班，
// 否則一律不計入正常工時。
export const NORMAL_DAILY_CAP_MIN = 480
export const capNormalMin = (minutes) => Math.min(minutes, NORMAL_DAILY_CAP_MIN)

// 本地時間時間戳「YYYY-MM-DD HH:MM」— 給 createdAt/updatedAt/editLogs 使用
// （toISOString() 會用 UTC，台灣顯示時間會少 8 小時）
export function localTimestamp() {
  return new Date().toLocaleString('sv-SE').slice(0, 16)
}

// 「HH:MM」→ 分鐘數（防 NaN）
function parseTimeToMin(t) {
  if (!t || typeof t !== 'string') return null
  const parts = t.split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

// 每連續工作 4 小時須有至少 30 分鐘休息（勞基法第 35 條）
// 「繼續」工作超過 4h 才需休息，剛好 4h/8h/12h 停工不必再休息
//   ≤ 4h → 0；4 < x ≤ 8h → 30；8 < x ≤ 12h → 60；> 12h → 90
export function breakMinutesFor(continuousMin) {
  if (continuousMin <= 4 * 60) return 0
  if (continuousMin <= 8 * 60) return 30
  if (continuousMin <= 12 * 60) return 60
  return 90
}

// 配對某日的上班/下班並計算總工時（分鐘）
// 支援：多段班（早班+晚班）、跨午夜（下班 < 上班 自動 +24h）、進行中（最後上班沒下班且為今天）
// 休息扣除：每個 in→out 區段各自套 breakMinutesFor（勞基法第 35 條）
export function computeDayMinutes(dayRecs, isToday = false) {
  const ins  = dayRecs.filter(c => c.type === '上班').sort((a,b) => (a.time||'').localeCompare(b.time||''))
  const outs = dayRecs.filter(c => c.type === '下班').sort((a,b) => (a.time||'').localeCompare(b.time||''))
  let dayMin = 0
  let isOngoing = false

  const pairs = Math.min(ins.length, outs.length)
  for (let i = 0; i < pairs; i++) {
    const inMin = parseTimeToMin(ins[i].time)
    const outMinRaw = parseTimeToMin(outs[i].time)
    if (inMin == null || outMinRaw == null) continue
    let outMin = outMinRaw
    if (outMin < inMin) outMin += 24 * 60  // 跨午夜
    const segMin = outMin - inMin
    dayMin += Math.max(0, segMin - breakMinutesFor(segMin))
  }

  // 上班比下班多一筆 + 今天 = 進行中（用現在時間補末筆）
  if (isToday && ins.length > outs.length) {
    const lastIn = parseTimeToMin(ins[ins.length - 1].time)
    if (lastIn != null) {
      const now = new Date()
      let nowMin = now.getHours() * 60 + now.getMinutes()
      if (nowMin < lastIn) nowMin += 24 * 60
      const segMin = nowMin - lastIn
      dayMin += Math.max(0, segMin - breakMinutesFor(segMin))
      isOngoing = true
    }
  }

  return { dayMin, isOngoing, pairCount: pairs }
}

// 跨日加班配對：把整段期間的加班開始/結束按「日期+時間」時間軸串起來，
// 依序配對（先進先出）。一段加班的時數歸屬於「加班開始」那一天，可跨午夜。
// 休息扣除：每段加班獨立套 breakMinutesFor（與正常工時同規則，勞基法第 35 條）
// 回傳：[{ startDate, startTime, endDate, endTime, minutes(淨), rawMinutes, crossDay, missingEnd, missingStart }]
export function computeOTSpans(clockins) {
  const events = (clockins || [])
    .filter(c => c.type === '加班開始' || c.type === '加班結束')
    .map(c => ({ date: c.date, time: c.time, type: c.type, key: `${c.date} ${c.time || '00:00'}` }))
    .sort((a, b) => a.key.localeCompare(b.key))

  const spans = []
  let pending = null  // 等待配對的「加班開始」
  for (const ev of events) {
    if (ev.type === '加班開始') {
      if (pending) {
        // 連續兩筆開始、中間沒有結束 → 前一筆標記缺結束
        spans.push({ startDate: pending.date, startTime: pending.time, endDate: null, endTime: null, minutes: 0, crossDay: false, missingEnd: true, missingStart: false })
      }
      pending = ev
    } else { // 加班結束
      if (pending) {
        const sMin = toEpochMin(pending.date, pending.time)
        const eMin = toEpochMin(ev.date, ev.time)
        const rawMinutes = (sMin != null && eMin != null) ? Math.max(0, eMin - sMin) : 0
        const minutes = Math.max(0, rawMinutes - breakMinutesFor(rawMinutes))
        spans.push({
          startDate: pending.date, startTime: pending.time,
          endDate: ev.date, endTime: ev.time,
          minutes, rawMinutes, crossDay: ev.date !== pending.date, missingEnd: false, missingStart: false,
        })
        pending = null
      } else {
        // 沒有對應的開始 → 落單的結束
        spans.push({ startDate: null, startTime: null, endDate: ev.date, endTime: ev.time, minutes: 0, crossDay: false, missingEnd: false, missingStart: true })
      }
    }
  }
  if (pending) {
    spans.push({ startDate: pending.date, startTime: pending.time, endDate: null, endTime: null, minutes: 0, crossDay: false, missingEnd: true, missingStart: false })
  }
  return spans
}

// 「YYYY-MM-DD」+「HH:MM」→ 自紀元起算的分鐘數（跨日比較用）
function toEpochMin(dateStr, timeStr) {
  if (!dateStr) return null
  const [y, mo, d] = dateStr.split('-').map(Number)
  const tm = parseTimeToMin(timeStr)
  if (!Number.isFinite(y) || tm == null) return null
  // 用 UTC 避免時區位移；只需相對差值
  return Math.floor(Date.UTC(y, mo - 1, d) / 60000) + tm
}

// 配對某日的加班開始/結束，計算加班總分鐘（同日，舊版相容）
export function computeOTMinutes(dayRecs) {
  const starts = dayRecs.filter(c => c.type === '加班開始').sort((a,b) => (a.time||'').localeCompare(b.time||''))
  const ends   = dayRecs.filter(c => c.type === '加班結束').sort((a,b) => (a.time||'').localeCompare(b.time||''))
  let total = 0
  const pairs = Math.min(starts.length, ends.length)
  for (let i = 0; i < pairs; i++) {
    const s = parseTimeToMin(starts[i].time)
    const eRaw = parseTimeToMin(ends[i].time)
    if (s == null || eRaw == null) continue
    let e = eRaw
    if (e < s) e += 24 * 60  // 跨午夜
    total += e - s
  }
  return total
}

// 計算員工某月純打卡時數（含休息扣除，不含補休）
// 使用「每日各自 roundHours → 加總」以與 HR.jsx 卡片顯示一致，避免 floor 誤差累積
export function computeEmpMonthClockHours(emp, yr, mo, data) {
  const monthStr = `${yr}-${String(mo).padStart(2,'0')}`
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const myClockins = data.clockins.filter(c =>
    c.empName && c.date?.startsWith(monthStr) &&
    (c.empName === emp.name || emp.name.includes(c.empName) || c.empName.includes(emp.name))
  )
  // 加班用跨日 span 配對（歸開始日），避免跨午夜加班漏算
  const otMinByDate = {}
  for (const sp of computeOTSpans(myClockins)) {
    if (sp.missingEnd || sp.missingStart || !sp.startDate) continue
    otMinByDate[sp.startDate] = (otMinByDate[sp.startDate] || 0) + sp.minutes
  }
  const allDates = [...new Set(myClockins.map(c => c.date))].sort()
  let totalHours = 0
  for (const date of allDates) {
    const dayRecs = myClockins.filter(c => c.date === date)
    const { dayMin } = computeDayMinutes(dayRecs, date === todayStr)
    // 正常工時每日上限 8h，超過要打加班卡才算
    totalHours += roundHours(capNormalMin(dayMin))
    totalHours += roundHours(otMinByDate[date] || 0)
  }
  return totalHours
}

// 累計補休時數（僅計算「員工申請、雇主同意」之 compLeaveManual）
// ※ 勞基法第 32-1 條：補休選擇權在員工，禁止片面規定加班一律換補休。
//   原本「打卡時數 - 行政機關時數」的自動換算違反 spec §四 + §一.1，已停用。
//   若需保留歷史已轉補休時數，由管理員在補休管理頁面手動補登 compLeaveManual。
export function computeAllTimeEarned(empId, data) {
  return (data.compLeaveManual || [])
    .filter(r => r.empId === empId)
    .reduce((sum, r) => sum + Number(r.hours || 0), 0)
}

// 員工姓名模糊匹配
export const resolveEmpName = (name, employees) => {
  if (!name) return name
  const emp = employees.find(e => e.name === name || e.name.includes(name) || name.includes(e.name))
  return emp?.name || name
}
