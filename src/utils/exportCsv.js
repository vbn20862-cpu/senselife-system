/**
 * 匯出 CSV 工具
 * 支援中文（BOM for Excel）
 */
export function downloadCsv(filename, headers, rows) {
  const BOM = '\uFEFF'
  const escape = v => {
    const str = String(v ?? '')
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }
  const headerLine = headers.map(h => escape(h.label)).join(',')
  const dataLines = rows.map(row =>
    headers.map(h => escape(typeof h.value === 'function' ? h.value(row) : row[h.key] ?? '')).join(',')
  )
  const csv = BOM + [headerLine, ...dataLines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
