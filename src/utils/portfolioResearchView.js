/** Display helpers for Portfolio Research (no network, no Vue refs). */

export const UNIVERSE_OPTIONS = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi500', label: 'csi500 - 中证500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'csi2000', label: 'csi2000 - 中证2000' },
  { value: 'star50', label: 'star50 - 科创50' },
]

export const PROGRESS_STAGE_LABELS = {
  loading_scores: '加载评分',
  building_dataset: '构建数据集',
  running_sweep: '参数扫描',
  rendering_report: '生成报告',
  generating_combo_details: '生成组合明细',
  writing_result: '写入结果',
}

export function universeName(value, options = UNIVERSE_OPTIONS) {
  const option = options.find((item) => item.value === value)
  return option?.label || value || 'universe'
}

export function compactDate(value) {
  if (!value) return '-'
  const text = String(value)
  if (text.length === 8) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

export function parseJobDate(value) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (totalMinutes < 60) {
    return seconds ? `${totalMinutes} 分 ${seconds} 秒` : `${totalMinutes} 分`
  }
  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) {
    return minutes ? `${totalHours} 小时 ${minutes} 分` : `${totalHours} 小时`
  }
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours ? `${days} 天 ${hours} 小时` : `${days} 天`
}

export function jobWeightLabel(job) {
  const weights = job?.params?.growth_cycle_weights
  if (Array.isArray(weights) && weights.length) {
    return weights.join(', ')
  }
  if (typeof weights === 'string' && weights.trim()) {
    return weights.trim()
  }
  return ''
}

/**
 * @param {object|null|undefined} job
 * @param {number} nowMs wall-clock ms for running/pending elapsed labels
 */
export function jobElapsedLabel(job, nowMs) {
  if (!job) return ''
  const status = job.status
  if (status === 'completed') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    const end = parseJobDate(job.completed_at)
    if (!start || !end) return ''
    return `用时 ${formatDurationMs(end.getTime() - start.getTime())}`
  }
  if (status === 'running') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    if (!start) return ''
    return `已运行 ${formatDurationMs(nowMs - start.getTime())}`
  }
  if (status === 'pending') {
    const start = parseJobDate(job.created_at)
    if (!start) return ''
    return `排队 ${formatDurationMs(nowMs - start.getTime())}`
  }
  if (status === 'failed') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    const end = parseJobDate(job.completed_at) || parseJobDate(job.updated_at)
    if (!start || !end) return ''
    return `失败前运行 ${formatDurationMs(end.getTime() - start.getTime())}`
  }
  return ''
}

export function jobProgressStageLabel(job) {
  if (!job || job.status !== 'running' || !job.progress_stage) return ''
  return PROGRESS_STAGE_LABELS[job.progress_stage] || job.progress_stage
}

export function pct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${(number * 100).toFixed(2)}%`
}

/** Trailing-stop ratio: decimal (0.15) or legacy percent points (15). */
export function pctTrailingStop(value) {
  if (value == null || value === '' || value === 0 || value === 0.0) return '关闭'
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '关闭'
  const ratio = number > 1 ? number / 100 : number
  if (ratio <= 0 || ratio > 1) return '-'
  return `${(ratio * 100).toFixed(2)}%`
}

export function num(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toFixed(digits)
}

export function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function formatList(value, formatter = (item) => item) {
  if (Array.isArray(value)) {
    return value.map(formatter).join(', ')
  }
  if (value === undefined || value === null || value === '') return '-'
  return formatter(value)
}

export function formatBool(value) {
  if (value === undefined || value === null) return '-'
  return value ? 'true' : 'false'
}

export function formatTrailingStopParamValue(params) {
  if (Array.isArray(params?.trailing_stop_pcts) && params.trailing_stop_pcts.length) {
    return params.trailing_stop_pcts.map((value) => pctTrailingStop(value)).join(', ')
  }
  if (params?.trailing_stop_pct == null) return '-'
  return pctTrailingStop(params.trailing_stop_pct)
}

export function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return 'mut'
  return number > 0 ? 'pos' : 'neg'
}

export function buildComboSummaryCards(summary = {}) {
  const values = summary || {}
  return [
    { k: '累计收益(净)', v: pct(values.cumulative_return), cls: signClass(values.cumulative_return) },
    { k: '年化收益', v: pct(values.annualized_return), cls: signClass(values.annualized_return) },
    { k: 'Sharpe', v: num(values.sharpe), cls: '' },
    { k: '最大回撤', v: pct(values.max_drawdown), cls: 'neg' },
    {
      k: '超额(对指数)',
      v: pct(values.index_excess_cumulative_return),
      cls: signClass(values.index_excess_cumulative_return),
    },
    { k: '平均换手', v: pct(values.average_turnover), cls: '' },
    { k: '调仓期数', v: num(values.periods, 0), cls: '' },
  ]
}

export function buildYearlyReturnRows(summary = {}) {
  const yearlyReturns = summary?.yearly_returns || {}
  const yearlyExcess = summary?.yearly_index_excess || {}
  return Object.keys(yearlyReturns)
    .sort()
    .map((year) => ({
      year,
      portfolioReturn: yearlyReturns[year],
      indexExcess: yearlyExcess[year],
    }))
}

export function filterAndSortTrades(
  trades = [],
  {
    dateFilter = '',
    symFilter = '',
    sortKey = 'score_date',
    sortDir = 1,
  } = {},
) {
  const df = dateFilter
  const sf = String(symFilter || '').trim()
  let rows = trades.slice()
  if (df) rows = rows.filter((row) => String(row.score_date) === df)
  if (sf) {
    rows = rows.filter((row) =>
      String(row.symbol || '').includes(sf) || String(row.name || '').includes(sf))
  }
  rows.sort((a, b) => {
    let x = a[sortKey]
    let y = b[sortKey]
    if (typeof x === 'string' || typeof y === 'string') {
      x = String(x)
      y = String(y)
      return sortDir * (x < y ? -1 : x > y ? 1 : 0)
    }
    x = x == null || Number.isNaN(Number(x)) ? -Infinity : Number(x)
    y = y == null || Number.isNaN(Number(y)) ? -Infinity : Number(y)
    return sortDir * (x - y)
  })
  return rows
}

export function buildEquityChart(periods = []) {
  if (!Array.isArray(periods) || !periods.length) return null
  const w = 1100
  const h = 300
  const padL = 52
  const padR = 16
  const padT = 14
  const padB = 28
  const stratEq = [1]
  const idxEq = [1]
  for (const period of periods) {
    const portfolioReturn = period.portfolio_return_net ?? period.portfolio_return ?? 0
    stratEq.push(stratEq[stratEq.length - 1] * (1 + portfolioReturn))
    const indexReturn = period.index_benchmark_return ?? null
    idxEq.push(idxEq[idxEq.length - 1] * (1 + (indexReturn == null ? 0 : indexReturn)))
  }
  const hasIdx = periods.some((period) => period.index_benchmark_return != null)
  const all = stratEq.concat(hasIdx ? idxEq : [])
  const mn = Math.min(...all)
  const mx = Math.max(...all)
  const n = stratEq.length - 1
  const X = (i) => padL + (w - padL - padR) * (n === 0 ? 0 : i / n)
  const Y = (value) => padT + (h - padT - padB) * (1 - (value - mn) / ((mx - mn) || 1))
  const poly = (values) =>
    values.map((value, index) => `${X(index).toFixed(1)},${Y(value).toFixed(1)}`).join(' ')
  const ticks = 4
  const grid = []
  for (let i = 0; i <= ticks; i++) {
    const value = mn + ((mx - mn) * i) / ticks
    grid.push({ y: Y(value), label: `${value.toFixed(2)}x` })
  }
  return {
    w,
    h,
    padL,
    padR,
    grid,
    hasIdx,
    stratPoints: poly(stratEq),
    idxPoints: poly(idxEq),
    firstDate: periods[0].score_date,
    lastDate: periods[periods.length - 1].score_date,
  }
}

export function buildResearchParamRows(job, options = UNIVERSE_OPTIONS) {
  if (!job) return []
  const params = job.params || {}
  const rows = [
    { key: 'start_date', label: 'start_date', value: compactDate(params.start_date || job.start_date) },
    { key: 'end_date', label: 'end_date', value: compactDate(params.end_date || job.end_date) },
    { key: 'universe_index', label: 'universe', value: universeName(params.universe_index || job.universe_index, options) },
    { key: 'score_column', label: 'score_column', value: params.score_column || '-' },
    { key: 'growth_cycle_weights', label: 'growth:cycle 权重', value: formatList(params.growth_cycle_weights) },
    { key: 'top_n_values', label: 'Top N', value: formatList(params.top_n_values) },
    { key: 'horizon', label: 'horizon', value: params.horizon ?? '-' },
    { key: 'rebalance_interval_days', label: 'rebalance intervals', value: formatList(params.rebalance_interval_days, (item) => `${item}d`) },
    { key: 'active_caps', label: 'active caps', value: formatList(params.active_caps, pct) },
    { key: 'transaction_cost', label: 'legacy transaction_cost', value: pct(params.transaction_cost) },
    { key: 'buy_commission_rate', label: 'buy commission', value: pct(params.buy_commission_rate) },
    { key: 'sell_commission_rate', label: 'sell commission', value: pct(params.sell_commission_rate) },
    { key: 'stamp_tax_rate', label: 'stamp tax', value: pct(params.stamp_tax_rate) },
    { key: 'index_benchmark_symbol', label: 'benchmark', value: params.index_benchmark_symbol || '-' },
    { key: 'cash_buffer', label: 'cash_buffer', value: pct(params.cash_buffer) },
    { key: 'initial_capital', label: 'initial_capital', value: money(params.initial_capital) },
    { key: 'trailing_stop_pcts', label: 'trailing_stop', value: formatTrailingStopParamValue(params) },
    { key: 'force', label: 'force', value: formatBool(params.force) },
  ]
  return rows.map((row) => ({ ...row, value: row.value || '-' }))
}
