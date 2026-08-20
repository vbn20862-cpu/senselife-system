// ── 交辦任務（dispatches）共用 helper ──

// 一行快速派工解析：「任務名 @人名 M/D」→ { title, assignee, dueDate }
// 人名比對 employees（模糊）；日期支援 M/D、YYYY-MM-DD，年份預設今年
export function parseQuickAdd(text, employees = []) {
  let rest = (text || '').trim()
  let assignee = ''
  let dueDate = ''

  const atMatch = rest.match(/@(\S+)/)
  if (atMatch) {
    const q = atMatch[1]
    const emp = employees.find(e => e.name === q || e.name.includes(q) || q.includes(e.name))
    assignee = emp?.name || ''
    rest = rest.replace(atMatch[0], ' ')
  }

  const isoMatch = rest.match(/(\d{4}-\d{2}-\d{2})/)
  const mdMatch = rest.match(/(\d{1,2})\/(\d{1,2})/)
  if (isoMatch) {
    dueDate = isoMatch[1]
    rest = rest.replace(isoMatch[0], ' ')
  } else if (mdMatch) {
    const y = new Date().getFullYear()
    dueDate = `${y}-${String(mdMatch[1]).padStart(2, '0')}-${String(mdMatch[2]).padStart(2, '0')}`
    rest = rest.replace(mdMatch[0], ' ')
  }

  return { title: rest.replace(/\s+/g, ' ').trim(), assignee, dueDate }
}

// 依交付日分段：逾期 / 今天 / 本週 / 之後 / 未定
export function bucketByDue(tasks, todayStr) {
  const today = todayStr || new Date().toLocaleDateString('sv-SE')
  const week = new Date(today + 'T00:00:00')
  week.setDate(week.getDate() + 7)
  const weekStr = week.toLocaleDateString('sv-SE')
  const buckets = { overdue: [], today: [], week: [], later: [], noDue: [] }
  for (const t of tasks) {
    if (!t.dueDate) buckets.noDue.push(t)
    else if (t.dueDate < today) buckets.overdue.push(t)
    else if (t.dueDate === today) buckets.today.push(t)
    else if (t.dueDate <= weekStr) buckets.week.push(t)
    else buckets.later.push(t)
  }
  const byDue = (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
  Object.values(buckets).forEach(arr => arr.sort(byDue))
  return buckets
}

export const DUE_SEGMENTS = [
  ['overdue', '⚠ 逾期', '#c04030'],
  ['today', '今天', '#c85c28'],
  ['week', '本週', '#7a6a50'],
  ['later', '之後', '#9a8a76'],
  ['noDue', '未定交付日', '#b0a090'],
]
