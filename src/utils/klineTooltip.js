/** Compact YYYYMMDD from daily or minute `trade_date`. */
export function compactYmd(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}

export function finitePrice(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Last daily close strictly before `ymd` (yesterday's close for that session). */
export function prevCloseForCompactDay(ymd, dailyRows) {
  const day = compactYmd(ymd)
  if (!day) return null
  const rows = Array.isArray(dailyRows) ? dailyRows : []
  let bestDay = ''
  let bestClose = null
  for (const row of rows) {
    const rowDay = compactYmd(row?.trade_date)
    const close = finitePrice(row?.close)
    if (!rowDay || rowDay >= day || close == null) continue
    if (rowDay > bestDay) {
      bestDay = rowDay
      bestClose = close
    }
  }
  return bestClose
}

export function changePct(close, prevClose) {
  const c = finitePrice(close)
  const p = finitePrice(prevClose)
  if (c == null || p == null || !(p > 0)) return null
  return ((c - p) / p) * 100
}

/**
 * 当天涨跌幅：相对上一交易日收盘。
 * 日/分时/30m/60m 用日线昨收；找不到则退回序列里更早一根收盘。
 */
export function dayChangePctForBar(row, index, seriesRows, dailyRows) {
  const close = finitePrice(row?.close)
  if (close == null) return null
  let prev = prevCloseForCompactDay(row?.trade_date, dailyRows)
  if (prev == null) {
    const rows = Array.isArray(seriesRows) ? seriesRows : []
    const ymd = compactYmd(row?.trade_date)
    for (let i = index - 1; i >= 0; i -= 1) {
      const earlier = rows[i]
      if (ymd && compactYmd(earlier?.trade_date) >= ymd) continue
      const candidate = finitePrice(earlier?.close)
      if (candidate != null) {
        prev = candidate
        break
      }
    }
  }
  if (prev == null && index > 0) {
    prev = finitePrice(seriesRows?.[index - 1]?.close)
  }
  return changePct(close, prev)
}

export function formatPctChange(pct) {
  const n = finitePrice(pct)
  if (n == null) return ''
  const abs = Math.abs(n).toFixed(2)
  return n > 0 ? `+${abs}%` : n < 0 ? `-${abs}%` : `${abs}%`
}

export function pctChangeColor(pct, { up = '#ef5350', down = '#26a69a', flat = '#768390' } = {}) {
  const n = finitePrice(pct)
  if (n == null || n === 0) return flat
  return n > 0 ? up : down
}

export function formatChartNum2(value) {
  const n = finitePrice(value)
  return n == null ? '-' : n.toFixed(2)
}
