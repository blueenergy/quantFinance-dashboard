export function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

// Summarize targets the backend refused to turn into orders. A dropped
// reduction can be a stop-loss the broker could not fill, so it must never be
// swallowed by an otherwise successful toast. Reason codes stay verbatim so
// they remain searchable in logs and reports.
export function describeDroppedTargets(dropped, limit = 4) {
  const rows = dropped || []
  const head = rows.slice(0, limit).map((row) => `${row.symbol}(${row.reason_code || 'unknown'})`)
  if (rows.length > head.length) return `${head.join('、')} 等 ${rows.length} 只`
  return head.join('、')
}

export function buildTargetsFromRows(rows) {
  const targets = {}
  for (const row of rows) targets[row.symbol] = Number(row.target)
  return targets
}

export function roundToLot(shares, lotSize = 100) {
  const lot = Math.max(1, Number(lotSize) || 100)
  const raw = Math.max(0, Math.floor(Number(shares) || 0))
  if (raw === 0) return 0
  return Math.floor(raw / lot) * lot
}

export function compactDateTimeForBatch(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}
