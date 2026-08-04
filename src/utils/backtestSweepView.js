import { formatParamDisplay } from './strategyLabParams'

function collectParamValues(rows, strategyKey, paramName) {
  const values = new Set()
  for (const row of rows) {
    if (row.strategy_key !== strategyKey) continue
    const params = row.strategy_params || {}
    if (paramName in params) values.add(JSON.stringify(params[paramName]))
  }
  return values
}

export function buildBacktestSweepView(rows = []) {
  const strategyKeys = [...new Set(rows.map((r) => r.strategy_key).filter(Boolean))]
  const presetValues = new Set(rows.map((r) => r.preset || ''))
  const symbols = [...new Set(rows.map((r) => r.symbol).filter(Boolean))]
  const axes = []

  if (symbols.length > 1) {
    axes.push({ key: 'symbol', label: '标的', values: symbols })
  }
  if (strategyKeys.length > 1) {
    axes.push({ key: 'strategy_key', label: '策略', values: strategyKeys })
  }
  if (presetValues.size > 1) {
    axes.push({ key: 'preset', label: '预设', values: [...presetValues] })
  }

  for (const strategyKey of strategyKeys) {
    const sample = rows.find((r) => r.strategy_key === strategyKey)
    const params = sample?.strategy_params || {}
    for (const paramName of Object.keys(params).sort()) {
      const distinct = collectParamValues(rows, strategyKey, paramName)
      if (distinct.size <= 1) continue
      axes.push({
        key: `param:${strategyKey}:${paramName}`,
        label: `${strategyKey} · ${paramName}`,
        strategy_key: strategyKey,
        param_name: paramName,
        values: [...distinct].map((v) => JSON.parse(v)),
      })
    }
  }

  return {
    sweep_axes: axes,
    rows,
  }
}

export function formatStrategyParamsCell(row) {
  const params = row?.strategy_params
  if (!params || typeof params !== 'object') {
    return row?.combo_label || '—'
  }
  const keys = Object.keys(params).sort()
  if (!keys.length) {
    return row?.combo_label || '—'
  }
  return keys.map((key) => `${key}=${formatParamDisplay(params[key])}`).join(', ')
}

export function listStrategyParamEntries(row) {
  const params = row?.strategy_params
  if (!params || typeof params !== 'object') return []
  return Object.keys(params)
    .sort()
    .map((key) => ({ key, value: formatParamDisplay(params[key]) }))
}

export function hasStrategyParams(row) {
  const params = row?.strategy_params
  return params && typeof params === 'object' && Object.keys(params).length > 0
}

export function filterRowsByAxis(rows, axis, value) {
  if (!axis) return rows
  if (axis.key === 'symbol') return rows.filter((r) => r.symbol === value)
  if (axis.key === 'strategy_key') return rows.filter((r) => r.strategy_key === value)
  if (axis.key === 'preset') return rows.filter((r) => (r.preset || '') === value)
  if (axis.param_name && axis.strategy_key) {
    return rows.filter(
      (r) =>
        r.strategy_key === axis.strategy_key &&
        JSON.stringify(r.strategy_params?.[axis.param_name]) === JSON.stringify(value),
    )
  }
  return rows
}

export function sortRows(rows, sortKey, order = 'desc') {
  const reverse = order !== 'asc'
  const present = rows.filter((r) => r[sortKey] != null)
  const missing = rows.filter((r) => r[sortKey] == null)
  present.sort((a, b) => {
    const av = a[sortKey]
    const bv = b[sortKey]
    if (av === bv) return 0
    return reverse ? (bv > av ? 1 : -1) : (av > bv ? 1 : -1)
  })
  return [...present, ...missing]
}

export const LOW_SAMPLE_TRADE_THRESHOLD = 10
export const RECOMMENDATION_SAMPLE_SATURATION = 30
export const RECOMMENDATION_WEIGHTS = Object.freeze({
  total_return: 0.35,
  max_drawdown: 0.25,
  sharpe_ratio: 0.25,
  sample_confidence: 0.15,
})

export function isLowSample(row, threshold = LOW_SAMPLE_TRADE_THRESHOLD) {
  const status = String(row?.status || '').toLowerCase()
  if (status && !['completed', 'failed'].includes(status)) {
    return false
  }
  const trades = row?.total_trades
  if (trades == null) return false
  const n = Number(trades)
  return Number.isFinite(n) && n < threshold
}

export function formatLowSampleHint(row, threshold = LOW_SAMPLE_TRADE_THRESHOLD) {
  const trades = Number(row?.total_trades)
  const count = Number.isFinite(trades) ? trades : 0
  return (
    `本次完成 ${count} 个平仓回合（买入→卖出算 1 次，不含加仓分笔），` +
    `少于参考阈值 ${threshold} 次；胜率/收益样本偏少，不宜单独作为优劣依据。` +
    `详情里的买卖明细按委托笔数列出，条数通常大于平仓回合。`
  )
}

function finiteNumber(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function percentileScores(entries, valueForEntry, { lowerIsBetter = false } = {}) {
  const sorted = [...entries].sort((a, b) => {
    const av = valueForEntry(a)
    const bv = valueForEntry(b)
    return lowerIsBetter ? bv - av : av - bv
  })
  const denominator = Math.max(sorted.length - 1, 1)
  const scores = new Map()

  let index = 0
  while (index < sorted.length) {
    const value = valueForEntry(sorted[index])
    let end = index
    while (end + 1 < sorted.length && valueForEntry(sorted[end + 1]) === value) end += 1
    const averageRank = (index + end) / 2
    const score = sorted.length === 1 ? 1 : averageRank / denominator
    for (let i = index; i <= end; i += 1) scores.set(sorted[i], score)
    index = end + 1
  }
  return scores
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * Rank completed, sufficiently sampled combinations inside one experiment.
 * Scores are relative to the current result set and deliberately transparent:
 * return 35%, drawdown 25%, Sharpe 25%, closed-round confidence 15%.
 */
export function buildBacktestRecommendations(
  rows = [],
  {
    minTrades = LOW_SAMPLE_TRADE_THRESHOLD,
    sampleSaturation = RECOMMENDATION_SAMPLE_SATURATION,
  } = {},
) {
  const completed = rows.filter((row) => {
    const status = String(row?.status || '').toLowerCase()
    return !status || status === 'completed'
  })
  const metricComplete = completed.filter(
    (row) =>
      finiteNumber(row?.total_return) != null &&
      finiteNumber(row?.max_drawdown) != null &&
      finiteNumber(row?.sharpe_ratio) != null &&
      finiteNumber(row?.total_trades) != null,
  )
  const eligible = metricComplete.filter((row) => finiteNumber(row.total_trades) >= minTrades)

  if (!eligible.length) {
    return {
      recommendedCombo: null,
      bestStrategy: null,
      eligibleCount: 0,
      excludedLowSampleCount: metricComplete.filter(
        (row) => finiteNumber(row.total_trades) < minTrades,
      ).length,
    }
  }

  const returnScores = percentileScores(eligible, (row) => finiteNumber(row.total_return))
  const drawdownScores = percentileScores(
    eligible,
    (row) => Math.abs(finiteNumber(row.max_drawdown)),
    { lowerIsBetter: true },
  )
  const sharpeScores = percentileScores(eligible, (row) => finiteNumber(row.sharpe_ratio))

  const scoredRows = eligible
    .map((row) => {
      const sampleConfidence = Math.min(
        finiteNumber(row.total_trades) / Math.max(sampleSaturation, minTrades),
        1,
      )
      const components = {
        total_return: returnScores.get(row),
        max_drawdown: drawdownScores.get(row),
        sharpe_ratio: sharpeScores.get(row),
        sample_confidence: sampleConfidence,
      }
      const score = Object.entries(RECOMMENDATION_WEIGHTS).reduce(
        (sum, [key, weight]) => sum + components[key] * weight,
        0,
      )
      return { row, score: score * 100, components }
    })
    .sort((a, b) => b.score - a.score)

  const strategies = new Map()
  for (const entry of scoredRows) {
    const strategyKey = entry.row?.strategy_key || '未知策略'
    if (!strategies.has(strategyKey)) strategies.set(strategyKey, [])
    strategies.get(strategyKey).push(entry)
  }

  const strategyRankings = [...strategies.entries()]
    .map(([strategyKey, entries]) => ({
      strategy_key: strategyKey,
      score: median(entries.map((entry) => entry.score)),
      combo_count: entries.length,
      representative: [...entries].sort((a, b) => b.score - a.score)[0],
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.representative.score - a.representative.score ||
        b.combo_count - a.combo_count,
    )

  return {
    recommendedCombo: scoredRows[0],
    bestStrategy: strategyRankings[0],
    eligibleCount: eligible.length,
    excludedLowSampleCount: metricComplete.length - eligible.length,
  }
}

export function formatAxisValue(axis, value) {
  if (value == null || value === '') return '-'
  if (axis?.key === 'strategy_key') return String(value)
  if (axis?.key === 'preset') return String(value || 'default')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return String(value)
}

function axisValueForRow(row, axis) {
  if (!axis || !row) return undefined
  if (axis.key === 'strategy_key') return row.strategy_key
  if (axis.key === 'preset') return row.preset || ''
  if (axis.param_name && axis.strategy_key) {
    if (row.strategy_key !== axis.strategy_key) return undefined
    return row.strategy_params?.[axis.param_name]
  }
  return undefined
}

export function pickBestRow(rows, sortKey = 'total_return') {
  const ranked = rows.filter((r) => r[sortKey] != null)
  if (!ranked.length) return rows[0]
  return ranked.sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0))[0]
}

export function buildFacetEntries(rows, axis, sortKey = 'total_return') {
  if (!axis) return []
  const groups = new Map()
  for (const row of rows) {
    const value = axisValueForRow(row, axis)
    if (value === undefined) continue
    const key = JSON.stringify(value)
    if (!groups.has(key)) groups.set(key, { value, rows: [] })
    groups.get(key).rows.push(row)
  }
  return [...groups.values()].map((group) => ({
    value: group.value,
    label: formatAxisValue(axis, group.value),
    row: pickBestRow(group.rows, sortKey),
  }))
}

export function filterRowsBySelections(rows, axes, selections = {}) {
  return rows.filter((row) => {
    for (const axis of axes) {
      const selected = selections[axis.key]
      if (!selected?.length) continue
      const value = axisValueForRow(row, axis)
      const hit = selected.some((item) => JSON.stringify(item) === JSON.stringify(value))
      if (!hit) return false
    }
    return true
  })
}
