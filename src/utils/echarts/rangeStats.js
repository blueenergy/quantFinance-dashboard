/**
 * 区间统计：给定 K 线数组和两个索引，算出涨跌幅、振幅、区间高低、量与额。
 * 两个索引顺序不限；单根或非法输入返回 null。
 */

function toNumber (value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function computeRangeStats (rows, startIndex, endIndex) {
  if (!Array.isArray(rows) || !rows.length) return null

  const last = rows.length - 1
  let a = Math.round(Number(startIndex))
  let b = Math.round(Number(endIndex))
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (a > b) [a, b] = [b, a]
  a = Math.max(0, Math.min(last, a))
  b = Math.max(0, Math.min(last, b))
  if (b <= a) return null

  const start = rows[a]
  const end = rows[b]
  const startClose = toNumber(start?.close)
  const endClose = toNumber(end?.close)
  if (startClose == null || endClose == null || startClose === 0) return null

  let high = -Infinity
  let low = Infinity
  let volume = 0
  let amount = 0
  let hasVolume = false
  let hasAmount = false

  for (let i = a; i <= b; i += 1) {
    const row = rows[i]
    const h = toNumber(row?.high)
    const l = toNumber(row?.low)
    if (h != null) high = Math.max(high, h)
    if (l != null) low = Math.min(low, l)
    const v = toNumber(row?.volume ?? row?.vol)
    if (v != null) {
      volume += v
      hasVolume = true
    }
    const amt = toNumber(row?.amount)
    if (amt != null) {
      amount += amt
      hasAmount = true
    }
  }

  const change = endClose - startClose
  return {
    startIndex: a,
    endIndex: b,
    startDate: String(start?.trade_date ?? start?.date ?? ''),
    endDate: String(end?.trade_date ?? end?.date ?? ''),
    startClose,
    endClose,
    change,
    pct: change / startClose,
    high: Number.isFinite(high) ? high : null,
    low: Number.isFinite(low) ? low : null,
    amplitude: Number.isFinite(high) && Number.isFinite(low) && low > 0
      ? (high - low) / low
      : null,
    bars: b - a + 1,
    volume: hasVolume ? volume : null,
    amount: hasAmount ? amount : null,
  }
}
