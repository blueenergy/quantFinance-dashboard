/**
 * 日线 → 周/月 K 线聚合（客户端）。
 * 输入 rows 必须按 trade_date 升序；month key = YYYYMM，week key = 当周周一。
 */

export function compactDate (value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8)
}

export function weekKey (ymd) {
  const date = new Date(Date.UTC(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(4, 6)) - 1,
    Number(ymd.slice(6, 8)),
  ))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date.toISOString().slice(0, 10)
}

export function resampleBars (rows, period) {
  if (period === '1d' || !Array.isArray(rows)) return rows || []
  const groups = new Map()
  for (const row of rows) {
    const date = compactDate(row.trade_date)
    if (date.length !== 8) continue
    const key = period === '1w' ? weekKey(date) : date.slice(0, 6)
    const open = Number(row.open)
    const high = Number(row.high)
    const low = Number(row.low)
    const close = Number(row.close)
    if (![open, high, low, close].every(Number.isFinite)) continue
    const volume = Number(row.volume ?? row.vol)
    const amount = Number(row.amount)
    const current = groups.get(key)
    if (!current) {
      groups.set(key, {
        trade_date: date,
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : null,
        amount: Number.isFinite(amount) ? amount : null,
      })
      continue
    }
    current.trade_date = date
    current.high = Math.max(current.high, high)
    current.low = Math.min(current.low, low)
    current.close = close
    if (Number.isFinite(volume)) current.volume = (current.volume || 0) + volume
    if (Number.isFinite(amount)) current.amount = (current.amount || 0) + amount
  }
  return [...groups.values()]
}
