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
