// 國定假日 — 預載 2026（民國115年）政府行事曆，可在班表介面細修
// 注意：農曆假日（春節/端午/中秋）日期為最佳估計，請上線後在介面核對調整

export const DEFAULT_HOLIDAYS = [
  { date: '2026-01-01', name: '元旦' },
  { date: '2026-02-16', name: '除夕' },
  { date: '2026-02-17', name: '春節' },
  { date: '2026-02-18', name: '春節' },
  { date: '2026-02-19', name: '春節' },
  { date: '2026-02-20', name: '春節' },
  { date: '2026-02-28', name: '和平紀念日' },
  { date: '2026-04-03', name: '兒童節(調整放假)' },
  { date: '2026-04-04', name: '兒童節' },
  { date: '2026-04-05', name: '清明節' },
  { date: '2026-04-06', name: '清明節(補假)' },
  { date: '2026-05-01', name: '勞動節' },
  { date: '2026-06-19', name: '端午節' },
  { date: '2026-09-25', name: '中秋節' },
  { date: '2026-10-09', name: '國慶日(調整放假)' },
  { date: '2026-10-10', name: '國慶日' },
]

// 取得有效假日清單：使用者自訂優先，否則用預設
export function getHolidays(data) {
  return (data?.holidays && data.holidays.length) ? data.holidays : DEFAULT_HOLIDAYS
}

// 某日是否國定假日（回傳假日名或 null）
export function holidayOn(data, dateStr) {
  if (!dateStr) return null
  const h = getHolidays(data).find(x => x.date === dateStr)
  return h ? h.name : null
}

// 該年月的假日清單（給班表用）
export function holidaysInMonth(data, year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getHolidays(data).filter(h => h.date?.startsWith(prefix))
}
