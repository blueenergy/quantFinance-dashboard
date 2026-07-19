const AXIS_REGISTRY = [
  { key: 'trailing_stop_pct', label: '浮动止盈', rowKey: 'trailing_stop_pct', paramKeys: ['trailing_stop_pcts', 'trailing_stop_pct'] },
  { key: 'score_variant', label: 'Score', rowKey: 'score_variant', paramKeys: ['growth_cycle_weights'] },
  { key: 'top_n', label: 'Top N', rowKey: 'top_n', paramKeys: ['top_n_values'] },
  { key: 'max_industry_weight', label: '行业上限', rowKey: 'max_industry_weight', paramKeys: ['active_caps'] },
  { key: 'rebalance_interval_days', label: '调仓间隔', rowKey: 'rebalance_interval_days', paramKeys: ['rebalance_interval_days'] },
  { key: 'volatility_variant', label: '波动率', rowKey: 'volatility_variant', paramKeys: ['volatility_modes', 'target_vols'] },
]

export function normalizeAxisValue(key, value) {
  if (key === 'trailing_stop_pct') {
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return null
    return number
  }
  if (key === 'top_n' || key === 'rebalance_interval_days') {
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (key === 'max_industry_weight') {
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  return value ?? null
}

export function formatAxisValue(key, value) {
  const normalized = normalizeAxisValue(key, value)
  if (key === 'trailing_stop_pct') {
    return normalized == null ? '关闭' : `${normalized * 100}%`
  }
  if (key === 'max_industry_weight' && normalized != null) {
    return `${normalized * 100}%`
  }
  if (key === 'rebalance_interval_days' && normalized != null) {
    return `${normalized}d`
  }
  if (normalized == null || normalized === '') return '-'
  return String(normalized)
}

function valuesFromParams(params, axis) {
  for (const paramKey of axis.paramKeys) {
    const raw = params?.[paramKey]
    if (raw == null) continue
    if (paramKey === 'trailing_stop_pcts' && Array.isArray(raw)) {
      if (raw.length <= 1) return null
      return raw.map((item) => normalizeAxisValue(axis.key, item))
    }
    if (paramKey === 'trailing_stop_pct') {
      return [normalizeAxisValue(axis.key, raw)]
    }
    if (Array.isArray(raw) && raw.length > 1) {
      return raw.map((item) => normalizeAxisValue(axis.key, item))
    }
  }
  return null
}

function valuesFromRows(rows, axis) {
  const seen = []
  for (const row of rows || []) {
    const value = normalizeAxisValue(axis.key, row?.[axis.rowKey])
    if (!seen.some((item) => axisValuesEqual(axis.key, item, value))) {
      seen.push(value)
    }
  }
  return seen.length > 1 ? seen : null
}

function axisValuesEqual(key, left, right) {
  return normalizeAxisValue(key, left) === normalizeAxisValue(key, right)
}

export function inferSweepAxes(params = {}, rows = []) {
  const axes = []
  for (const axis of AXIS_REGISTRY) {
    let values = valuesFromParams(params, axis)
    if (!values?.length) values = valuesFromRows(rows, axis)
    if (!values || values.length <= 1) continue
    axes.push({ key: axis.key, label: axis.label, values })
  }
  return axes
}

function riskScore(row) {
  const score = Number(row?.risk_adjusted_score)
  return Number.isFinite(score) ? score : -1e18
}

export function computeFacetBest(rows = [], sweepAxes = []) {
  const ordered = [...rows].sort((a, b) => riskScore(b) - riskScore(a))
  const facetBest = {}
  for (const axis of sweepAxes) {
    const bucket = []
    for (const value of axis.values || []) {
      const match = ordered.find((row) => axisValuesEqual(axis.key, row?.[axis.key], value))
      if (match) {
        bucket.push({
          value,
          label: formatAxisValue(axis.key, value),
          row: match,
        })
      }
    }
    if (bucket.length) facetBest[axis.key] = bucket
  }
  return facetBest
}

export function buildSweepResultView(resultDetail, jobParams = {}) {
  if (resultDetail?.sweep_view) {
    return resultDetail.sweep_view
  }
  const rows = resultDetail?.rows || []
  const params = jobParams || resultDetail?.params || {}
  const sweepAxes = inferSweepAxes(params, rows)
  return {
    sweep_axes: sweepAxes,
    fixed_params: params,
    metric_keys: [
      'cumulative_return',
      'index_excess_cumulative_return',
      'sharpe',
      'max_drawdown',
      'average_turnover',
      'risk_adjusted_score',
    ],
    row_count: Number(resultDetail?.row_count_total || rows.length),
    facet_best: computeFacetBest(rows, sweepAxes),
    global_best_row: rows[0] || null,
  }
}

export function rowMatchesAxis(row, axisKey, axisValue) {
  return axisValuesEqual(axisKey, row?.[axisKey], axisValue)
}

export function filterRowsByFacet(rows, axisKey, axisValue) {
  if (axisKey == null || axisValue === undefined) return rows
  return rows.filter((row) => rowMatchesAxis(row, axisKey, axisValue))
}

export function filterRowsBySelections(rows, selections = {}) {
  return rows.filter((row) =>
    Object.entries(selections).every(([axisKey, values]) => {
      if (!values?.length) return true
      return values.some((value) => rowMatchesAxis(row, axisKey, value))
    }))
}

export function paginateRows(rows, page = 1, pageSize = 50) {
  const safePage = Math.max(1, Number(page) || 1)
  const safeSize = Math.max(1, Number(pageSize) || 50)
  const start = (safePage - 1) * safeSize
  return {
    page: safePage,
    pageSize: safeSize,
    total: rows.length,
    items: rows.slice(start, start + safeSize),
    totalPages: Math.max(1, Math.ceil(rows.length / safeSize)),
  }
}

export function experimentSummary(sweepView) {
  const axes = sweepView?.sweep_axes || []
  if (!axes.length) return ''
  const parts = axes.map((axis) => `${axis.values?.length || 0} ${axis.label}`)
  const comboCount = sweepView?.row_count || 0
  return `${parts.join(' × ')} = ${comboCount} 组合`
}

export function buildCandidateConfigFromRow(row, job = {}, params = {}) {
  const universe = String(params.universe_index || job.universe_index || 'csi1000')
  const topN = Number(row?.top_n || params.top_n_values?.[0] || 10)
  const rebalanceDays = Number(row?.rebalance_interval_days || params.horizon || 20)
  const scoreVariant = String(row?.score_variant || params.score_column || 'score')
  const variant = String(row?.variant || 'top_n')
  const slug = (value) => String(value || '').replace(/[^0-9A-Za-z]+/g, '_').slice(0, 40)
  const presetId = `research_${slug(universe)}_${slug(scoreVariant)}_${slug(variant)}_top${topN}_${rebalanceDays}d_${String(job.job_id || '').slice(0, 8)}`
  return {
    preset_id: presetId,
    strategy_template_id: 'growth_cycle_index_enhanced',
    name: `${universe.toUpperCase()} ${scoreVariant} ${variant} Top${topN} ${rebalanceDays}d`,
    universe_index: universe,
    index_benchmark_symbol: params.index_benchmark_symbol || row?.index_benchmark_symbol || '000852.SH',
    score_type: row?.growth_weight != null && row?.cycle_weight != null ? 'growth_cycle_weighted' : 'score_column',
    score_column: row?.score_column || params.score_column || 'composite_growth_cycle_score',
    growth_weight: row?.growth_weight,
    cycle_weight: row?.cycle_weight,
    top_n: topN,
    rebalance_days: rebalanceDays,
    construction_mode: row?.construction_mode || 'top_n',
    max_industry_weight: row?.max_industry_weight,
    lot_size: Number(params.lot_size || 100),
    transaction_cost: Number(params.transaction_cost ?? 0.001),
    buy_commission_rate: params.buy_commission_rate,
    sell_commission_rate: params.sell_commission_rate,
    min_commission: params.min_commission,
    stamp_tax_rate: params.stamp_tax_rate,
    transfer_fee_rate: params.transfer_fee_rate,
    execution_price: params.execution_price || 'next_open',
    cash_buffer: Number(params.cash_buffer ?? 0.03),
    initial_capital: Number(params.initial_capital ?? 1_000_000),
    trailing_stop_pct: row?.trailing_stop_pct ?? params.trailing_stop_pct ?? null,
    candidate_pool_enabled: params.candidate_pool_enabled !== false,
    status: 'draft',
    version: 1,
  }
}
