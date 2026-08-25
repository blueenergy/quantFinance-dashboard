export const STRATEGY_POOL_TABLE_LOOKBACK_DAYS = 30

function metricNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY
}

export function toYyyymmdd(value = new Date()) {
  const dt = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(dt.getTime())) return ''
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function shiftYyyymmdd(dateStr, days) {
  const stamp = String(dateStr || '').replace(/-/g, '').slice(0, 8)
  if (!/^\d{8}$/.test(stamp)) return ''
  const dt = new Date(
    Number(stamp.slice(0, 4)),
    Number(stamp.slice(4, 6)) - 1,
    Number(stamp.slice(6, 8)),
  )
  dt.setDate(dt.getDate() + Number(days || 0))
  return toYyyymmdd(dt)
}

export function poolTableRange(
  lookbackDays = STRATEGY_POOL_TABLE_LOOKBACK_DAYS,
  today = toYyyymmdd(),
) {
  return {
    startDate: shiftYyyymmdd(today, -Math.abs(Number(lookbackDays) || 0)),
    endDate: today,
  }
}

export function comparePoolStocks(a, b, strategyKey) {
  if (strategyKey === 'k_regime') {
    const sharpe = metricNumber(b?.hist_sharpe_ratio) - metricNumber(a?.hist_sharpe_ratio)
    if (sharpe) return sharpe
  }
  const ret = metricNumber(b?.hist_return) - metricNumber(a?.hist_return)
  if (ret) return ret
  return String(b?.date || '').localeCompare(String(a?.date || ''))
}

export function rankPoolStocks(stocks, strategyKey) {
  return [...(stocks || [])]
    .sort((left, right) => comparePoolStocks(left, right, strategyKey))
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

export function isPoolTopRow(row) {
  return Number(row?.rank) >= 1 && Number(row.rank) <= 3
}

export function rankingCaption(strategyKey) {
  if (strategyKey === 'k_regime') {
    return '近 30 日新开仓 · 默认按夏普、再按路径收益排名。路径收益是约 2020 至今满仓/空仓，不是这一笔买卖。'
  }
  return '近 30 日新开仓 · 默认按路径收益排名。该收益是约一年、部分仓位的账户成绩，不是单笔股价涨跌。'
}
