/**
 * Pure formatters and small helpers for Stock Workbench panels.
 * Keep Vue/reactive dependencies out of this module.
 */

export function formatDetail(detail) {
  if (!detail || !Object.keys(detail).length) return '暂无详情'
  return JSON.stringify(detail, null, 2)
}

export function scorePercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

export function scoreRowComposite(row) {
  const composite = row?.composite_score
  if (composite && typeof composite === 'object') {
    if (composite.balanced != null) return composite.balanced
    const firstKey = Object.keys(composite).find((key) => composite[key] != null)
    return firstKey ? composite[firstKey] : null
  }
  return composite
}

export function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function firstFinite(values) {
  for (const value of values) {
    const n = toNumber(value)
    if (n != null) return n
  }
  return null
}

export function reportYear(period) {
  const text = String(period || '')
  const year = Number(text.slice(0, 4))
  return Number.isFinite(year) ? year : null
}

export function reportQuarter(period) {
  const suffix = String(period || '').slice(4)
  return {
    '0331': 1,
    '0630': 2,
    '0930': 3,
    '1231': 4,
  }[suffix] || null
}

export function diffOrNull(current, previous) {
  const a = toNumber(current)
  const b = toNumber(previous)
  if (a == null || b == null) return null
  return a - b
}

export function calcYoy(current, previous) {
  const a = toNumber(current)
  const b = toNumber(previous)
  if (a == null || b == null || b === 0) return null
  return ((a - b) / Math.abs(b)) * 100
}

export function reportRcTargetRange(row = {}) {
  const minPrice = toNumber(row.min_price)
  const maxPrice = toNumber(row.max_price)
  if (minPrice != null && maxPrice != null && minPrice > 0 && maxPrice > 0) {
    return minPrice === maxPrice
      ? `目标价 ${fmtNumber(minPrice)}元`
      : `目标价 ${fmtNumber(minPrice)}-${fmtNumber(maxPrice)}元`
  }
  if (maxPrice != null && maxPrice > 0) return `目标价 ${fmtNumber(maxPrice)}元`
  if (minPrice != null && minPrice > 0) return `目标价 ${fmtNumber(minPrice)}元`
  return ''
}

export function blankDash(value) {
  const text = String(value ?? '').trim()
  return text || '-'
}

export function statementPeriod(row = {}) {
  return blankDash(row.end_date || row.period || row.report_date)
}

export function statementReportTypeLabel(value) {
  const text = String(value ?? '').trim()
  if (text === '1') return '合并报表（report_type=1）'
  if (text === '2') return '单季度报表（report_type=2）'
  return text ? `report_type=${text}` : '未标注口径'
}

export function fmtNullableNumber(value, digits = 2) {
  const n = toNumber(value)
  return n == null ? '-' : n.toFixed(digits)
}

export function fmtNullablePct(value) {
  const n = toNumber(value)
  return n == null ? '-' : `${n.toFixed(2)}%`
}

export function fmtWanAmount(value) {
  const n = toNumber(value)
  if (n == null) return '-'
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}亿`
  return `${n.toFixed(2)}万`
}

export function ratioPct(numerator, denominator) {
  const a = toNumber(numerator)
  const b = toNumber(denominator)
  if (a == null || b == null || b === 0) return null
  return (a / Math.abs(b)) * 100
}

export function sumFinite(...values) {
  const numbers = values.map(toNumber).filter((value) => value != null)
  if (!numbers.length) return null
  return numbers.reduce((sum, value) => sum + value, 0)
}

export function canonicalSymbol(value) {
  return String(value || '').trim().toUpperCase().split('.')[0]
}

export function fmtNumber(value, digits = 2, suffix = '') {
  if (value === null || value === undefined) return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(digits)}${suffix}`
}

export function fmtPct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`
}

export function fmtPctPlain(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(1)}%`
}

export function fmtPctFromRatio(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${(n * 100).toFixed(2)}%`
}

export function ddmGrowthSourceLabel(src, scenarioName) {
  const name = String(scenarioName || '')
  if (name === 'conservative') return '保守档：永续增长固定为 0'
  if (name === 'optimistic') return '乐观档：在中性 g 基础上小幅上探（受上限与 ke 约束）'
  const key = String(src || '')
  const map = {
    sustainable_growth_roe_times_one_minus_payout: 'ROE×(1−分红率)',
    sustainable_growth_roe_with_default_50pct_retention: 'ROE×留存率（默认 50%）',
    fallback_config_ddm_growth: '配置回退',
  }
  return map[key] || (key ? key : '-')
}

export function valuationScenarioLabel(value) {
  return {
    conservative: '保守',
    base: '中性',
    optimistic: '乐观',
  }[value] || value || '-'
}

export function valuationRelativeLabel(value) {
  return {
    below_own_history: '低于自身历史',
    near_own_history_midrange: '接近历史中枢',
    above_own_history: '高于自身历史',
    insufficient_data: '样本不足',
  }[value] || value || '-'
}

export function fmtAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}亿`
  return `${n.toFixed(2)}万`
}

export function fmtKlineAmount(row) {
  const n = Number(row?.amount)
  if (!Number.isFinite(n)) return '-'
  const unit = String(row?.amount_unit || 'qian_yuan').toLowerCase()
  if (unit === 'yuan') return `${(n / 100000000).toFixed(2)}亿`
  if (unit === 'wan_yuan') return `${(n / 10000).toFixed(2)}亿`
  return `${(n / 100000).toFixed(2)}亿`
}

export function fmtStatementAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万`
  return `${n.toFixed(2)}元`
}

export function valueClass(value) {
  const n = Number(value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
}

export function nineturnSignalClass(signal) {
  if (!signal) return ''
  return signal.direction === 'up' ? 'is-up' : signal.direction === 'down' ? 'is-down' : ''
}

export function formatCheck(value) {
  if (value === true) return '通过'
  if (value === false) return '未通过'
  return '不适用'
}

export function fmtShares(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿股`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万股`
  return `${n.toFixed(0)}股`
}

export function fmtSignedShares(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const absText = fmtShares(Math.abs(n))
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}${absText}`
}

export function signedPctPoint(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}pct`
}

export function signedRelativePct(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}

export function top10RatioChangeText(row) {
  if (!row) return '-'
  const pointText = signedPctPoint(row.hold_ratio_chg)
  const relText = signedRelativePct(row.hold_ratio_rel_chg_pct)
  if (pointText === '-' && relText === '-') return '-'
  if (relText === '-') return `占比 ${pointText}`
  if (pointText === '-') return `相对 ${relText}`
  return `占比 ${pointText}（相对 ${relText}）`
}

export function top10ChangeLabel(value) {
  const labels = {
    increased: '增持',
    decreased: '减持',
    new: '新进',
    exited: '退出',
    unchanged: '不变',
  }
  return labels[value] || '变化未知'
}

/** 股东户数下降视为筹码集中（利多→红），上升视为分散（利空→绿）。 */
export function holderTrendClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return n < 0 ? 'is-up' : 'is-down'
}

export function inDeLabel(value) {
  return value === 'IN' ? '增持' : value === 'DE' ? '减持' : (value || '-')
}

export function isFutureDate(value) {
  const s = String(value || '').replace(/-/g, '')
  if (s.length !== 8) return false
  const today = new Date()
  const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  return s > ymd
}

export function pctClass(value) {
  return valueClass(value)
}
