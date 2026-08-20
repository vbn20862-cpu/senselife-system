// 人員顏色與內/外部判斷
export const PERSON_COLOR_INTERNAL = '#c04030'  // 山紅
export const PERSON_COLOR_EXTERNAL = '#2d7a7a'  // 山湖青

// 預設暱稱對照（補充員工資料沒填 nicknames 時的 fallback）
const DEFAULT_NICKNAMES = {
  '林家慶': ['阿慶'],
  '陳毓雯': ['阿雯', '阿玟', '毓雯'],
  '祖珠·卡查妮蘭': ['祖珠', '卡查妮蘭'],
  '黃宝琳': ['宝琳'],
  '梁庭瑜': ['庭瑜'],
}

function getNicknamesFor(emp) {
  const stored = emp.nicknames
  if (Array.isArray(stored) && stored.length) return stored
  return DEFAULT_NICKNAMES[emp.name] || []
}

/**
 * 判斷某個名字是否為內部員工
 * 規則：名字 = 員工名 OR 員工名包含名字 OR 名字包含員工名 OR 名字 = 員工暱稱
 */
export function isInternalPerson(name, employees) {
  if (!name || !employees?.length) return false
  const n = name.trim()
  if (!n) return false
  for (const emp of employees) {
    if (!emp?.name) continue
    if (emp.name === n) return true
    if (emp.name.includes(n) && n.length >= 2) return true
    if (n.includes(emp.name) && emp.name.length >= 2) return true
    const nicks = getNicknamesFor(emp)
    if (nicks.some(nk => nk === n || nk.includes(n) || n.includes(nk))) return true
  }
  return false
}

export function personColor(name, employees) {
  return isInternalPerson(name, employees) ? PERSON_COLOR_INTERNAL : PERSON_COLOR_EXTERNAL
}

// 判斷括號內的內容看起來是否像「人名列表」
// 例如 (阿雯、庭瑜) → 是；(6*6) → 不是；(ext 123) → 不是
// 規則：去除空白後，每個逗號/頓號分隔的片段都是 2-5 個中文字（可含 ·）
const NAME_CHARS = /^[\u4e00-\u9fff·]{2,5}$/
export function isLikelyNameList(inner) {
  if (!inner) return false
  const parts = inner.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return false
  return parts.every(p => NAME_CHARS.test(p))
}

/**
 * 把文字裡的 (人名1、人名2) 標註顏色
 * 返回 JSX 節點陣列
 */
export function renderTextWithPeople(text, employees, React) {
  if (!text) return null
  const regex = /\(([^()]+)\)/g
  const parts = []
  let lastIdx = 0
  let match
  let key = 0
  while ((match = regex.exec(text)) !== null) {
    const [full, inner] = match
    const start = match.index
    if (start > lastIdx) parts.push(text.slice(lastIdx, start))
    if (isLikelyNameList(inner)) {
      const names = inner.split(/[、,，]/).map(s => s.trim()).filter(Boolean)
      parts.push(React.createElement('span', { key: key++, style: { color: '#b09070' } }, '('))
      names.forEach((name, idx) => {
        if (idx > 0) parts.push(React.createElement('span', { key: key++, style: { color: '#b09070' } }, '、'))
        parts.push(React.createElement('span', {
          key: key++,
          style: {
            color: personColor(name, employees),
            fontWeight: 700,
          },
        }, name))
      })
      parts.push(React.createElement('span', { key: key++, style: { color: '#b09070' } }, ')'))
    } else {
      parts.push(full)
    }
    lastIdx = start + full.length
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx))
  return parts
}
