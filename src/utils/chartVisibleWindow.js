export const DEFAULT_VISIBLE_MONTHS = 6

/**
 * Normalize trade_date to YYYY-MM-DD (local calendar, no UTC shift).
 */
export function normalizeChartDate(d) {
  if (!d) return ''
  if (typeof d === 'string' && d.includes('T')) return d.split('T')[0]
  if (typeof d === 'string' && d.length === 8 && !d.includes('-')) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
  }
  return String(d)
}

/**
 * Format a Date as local YYYY-MM-DD (never toISOString).
 */
export function formatLocalYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse YYYY-MM-DD as local midnight.
 */
export function parseLocalYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function sortedTradeDates(records) {
  const rows = Array.isArray(records) ? records : []
  return rows
    .map((r) => normalizeChartDate(r?.trade_date))
    .filter(Boolean)
    .sort()
}

export function earliestTradeDate(records) {
  const dates = sortedTradeDates(records)
  return dates.length ? dates[0] : ''
}

export function latestTradeDate(records) {
  const dates = sortedTradeDates(records)
  return dates.length ? dates[dates.length - 1] : ''
}

/**
 * Subtract calendar months from YYYY-MM-DD, return local YMD.
 */
export function subtractMonthsYmd(ymd, months) {
  const d = parseLocalYmd(ymd)
  d.setMonth(d.getMonth() - months)
  return formatLocalYmd(d)
}

/**
 * Default visible toolbar range: latest bar minus N months, clamped to cache earliest.
 */
export function defaultVisibleRange(records, months = DEFAULT_VISIBLE_MONTHS) {
  const earliest = earliestTradeDate(records)
  const latest = latestTradeDate(records)
  if (!earliest || !latest) {
    return { start: '', end: '' }
  }
  const candidateStart = subtractMonthsYmd(latest, months)
  const start = candidateStart < earliest ? earliest : candidateStart
  return { start, end: latest }
}

/**
 * Decide next toolbar dates when symbol/records change.
 */
export function nextVisibleRange({
  symbol,
  prevSymbol,
  records,
  prevRecords,
  startDate,
  endDate,
  months = DEFAULT_VISIBLE_MONTHS,
}) {
  const keep = { start: startDate || '', end: endDate || '' }
  const dates = sortedTradeDates(records)
  if (!dates.length) {
    return keep
  }

  const symbolChanged = prevSymbol != null && symbol !== prevSymbol
  const needsDefault = symbolChanged || !startDate

  if (needsDefault) {
    return defaultVisibleRange(records, months)
  }

  const prevEarliest = earliestTradeDate(prevRecords)
  const newEarliest = dates[0]
  if (prevEarliest && newEarliest < prevEarliest) {
    const expandedStart = newEarliest < (startDate || newEarliest) ? newEarliest : startDate
    return {
      start: expandedStart,
      end: endDate || dates[dates.length - 1],
    }
  }

  return {
    start: startDate,
    end: endDate || dates[dates.length - 1],
  }
}

/**
 * Show entire cached range in toolbar (no fetch).
 */
export function fullCacheVisibleRange(records) {
  const earliest = earliestTradeDate(records)
  const latest = latestTradeDate(records)
  if (!earliest || !latest) {
    return { start: '', end: '' }
  }
  return { start: earliest, end: latest }
}

/**
 * Shift visible start earlier within cache, or signal load-more when at cache left edge.
 * @returns {{ action: 'shift' | 'load-more' | 'noop', start: string, end: string }}
 */
export function shiftVisibleEarlier({
  records,
  startDate,
  endDate,
  months = DEFAULT_VISIBLE_MONTHS,
}) {
  const cacheEarliest = earliestTradeDate(records)
  const cacheLatest = latestTradeDate(records)
  if (!cacheEarliest || !cacheLatest || !startDate) {
    return { action: 'noop', start: startDate || '', end: endDate || cacheLatest || '' }
  }

  const end = endDate || cacheLatest
  if (startDate > cacheEarliest) {
    const candidate = subtractMonthsYmd(startDate, months)
    const start = candidate < cacheEarliest ? cacheEarliest : candidate
    return { action: 'shift', start, end }
  }

  return { action: 'load-more', start: startDate, end }
}
