const API_KEY = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY
const CALENDAR_ID = import.meta.env.VITE_GOOGLE_CALENDAR_ID

/**
 * 從 Google Calendar API 抓取指定月份的事件
 * @param {number} year
 * @param {number} month  1-based
 * @returns {Promise<Array<{id, title, date, startTime, endTime, allDay, source}>>}
 */
const _cache = {}

export async function fetchGoogleCalendarEvents(year, month) {
  if (!API_KEY || !CALENDAR_ID) return []

  const cacheKey = `${year}-${month}`
  if (_cache[cacheKey]) return _cache[cacheKey]

  const timeMin = new Date(year, month - 1, 1).toISOString()
  const timeMax = new Date(year, month, 0, 23, 59, 59).toISOString()

  const params = new URLSearchParams({
    key: API_KEY,
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '200',
  })

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?${params}`
    )
    if (!res.ok) {
      console.warn('[Google Calendar] fetch failed:', res.status, await res.text())
      return []
    }
    const json = await res.json()
    const result = []
    for (const item of (json.items || [])) {
      const start = item.start?.dateTime || item.start?.date || ''
      const end = item.end?.dateTime || item.end?.date || ''
      const allDay = !item.start?.dateTime
      const startDate = allDay ? start : start.slice(0, 10)
      // Google 全天事件的 end.date 為「不含」的隔日；定時事件可能跨日，用結束日期當邊界
      const endDate = allDay
        ? (() => { const d = new Date(end); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
        : end.slice(0, 10)

      // 展開多天事件為每日一筆
      const days = []
      {
        const d = new Date(startDate)
        const last = new Date(endDate || startDate)
        while (d <= last) {
          days.push(d.toISOString().slice(0, 10))
          d.setDate(d.getDate() + 1)
        }
        if (days.length === 0) days.push(startDate)
      }

      const multiDay = days.length > 1
      days.forEach((date, idx) => {
        result.push({
          id: `gcal-${item.id}-${idx}`,
          title: multiDay ? `${item.summary || '（無標題）'}（第 ${idx + 1}/${days.length} 天）` : (item.summary || '（無標題）'),
          date,
          // 只在第一天顯示時間；中間日視為整天
          startTime: allDay || idx !== 0 ? null : start.slice(11, 16),
          endTime: allDay || idx !== days.length - 1 ? null : end.slice(11, 16),
          allDay: allDay || (multiDay && idx > 0 && idx < days.length - 1),
          source: 'google',
          location: item.location || '',
        })
      })
    }
    _cache[cacheKey] = result
    // 5 分鐘後清除快取，讓新事件能被抓到
    setTimeout(() => { delete _cache[cacheKey] }, 5 * 60 * 1000)
    return result
  } catch (err) {
    console.warn('[Google Calendar] error:', err)
    return []
  }
}
