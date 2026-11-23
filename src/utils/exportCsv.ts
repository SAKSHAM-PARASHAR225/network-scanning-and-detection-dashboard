// Real client-side CSV export of whatever data is passed in — no server
// round-trip needed since the data is already in memory from live state.
export function exportToCsv(filename: string, rows: Array<Record<string, string | number | boolean | null>>) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const lines = [headers.join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
