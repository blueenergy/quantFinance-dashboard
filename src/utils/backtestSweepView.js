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
  const axes = []

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

export function isLowSample(row, threshold = 10) {
  const status = String(row?.status || '').toLowerCase()
  if (status && !['completed', 'failed'].includes(status)) {
    return false
  }
  const trades = row?.total_trades
  if (trades == null) return false
  const n = Number(trades)
  return Number.isFinite(n) && n < threshold
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
