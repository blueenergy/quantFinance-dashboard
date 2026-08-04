import { parseCsvNumbers } from './portfolioResearchPayload'
import { inferAssetTypeFromSymbol, normalizeBacktestSymbol } from './backtestSymbolUtils'
import { coerceParamValue, filterValidParamDict } from './strategyLabParams'

export const MAX_COMPARE_TASKS = 500
export const ESTIMATED_SECONDS_PER_TASK = 12

export function parseCsvBooleans(value) {
  return String(value ?? '')
    .split(/[,，]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => {
      if (['true', '1', 'yes', 'y', 't'].includes(item)) return true
      if (['false', '0', 'no', 'n', 'f'].includes(item)) return false
      return null
    })
    .filter((item) => item !== null)
}

export function inferParamType(baselineValue) {
  if (typeof baselineValue === 'boolean') return 'boolean'
  if (typeof baselineValue === 'number' && Number.isFinite(baselineValue)) return 'number'
  if (typeof baselineValue === 'string') return 'string'
  return 'unknown'
}

export function parseExperimentValues(raw, baselineValue) {
  const text = String(raw ?? '').trim()
  if (!text) return [baselineValue]
  const type = inferParamType(baselineValue)
  if (type === 'boolean') {
    const values = parseCsvBooleans(text)
    return values.length ? values : [baselineValue]
  }
  if (type === 'number') {
    const isInt = Number.isInteger(baselineValue)
    const values = parseCsvNumbers(text, (item) => {
      const n = Number(item)
      if (!Number.isFinite(n)) return NaN
      return isInt ? Math.trunc(n) : n
    })
    return values.length ? values : [baselineValue]
  }
  if (text.includes(',') || text.includes('，')) {
    throw new Error('字符串参数不支持逗号网格扫描')
  }
  return [coerceParamValue(text, baselineValue)]
}

export function extractPresetParams(paramsWithDesc = {}) {
  const out = {}
  if (!paramsWithDesc || typeof paramsWithDesc !== 'object') return out
  for (const [key, cfg] of Object.entries(paramsWithDesc)) {
    if (cfg && typeof cfg === 'object' && 'value' in cfg) out[key] = cfg.value
  }
  return out
}

function cartesianAssignments(paramAxes) {
  if (!paramAxes.length) return [{}]
  const [first, ...rest] = paramAxes
  const tail = cartesianAssignments(rest)
  const out = []
  for (const value of first.values) {
    for (const partial of tail) {
      out.push({ ...partial, [first.key]: value })
    }
  }
  return out
}

export function buildStrategyCombos({
  strategyKey,
  presets = [],
  selectedPresetKeys = [],
  experimentValuesByPreset = {},
}) {
  const selectedPresets = presets.filter((p) => selectedPresetKeys.includes(p.preset))
  if (!selectedPresets.length) return []

  const combos = []
  for (const preset of selectedPresets) {
    const baseline = filterValidParamDict(extractPresetParams(preset.params_with_desc))
    const experimentMap = experimentValuesByPreset[preset.preset] || {}
    const axes = []
    for (const [key, baselineValue] of Object.entries(baseline)) {
      const raw = experimentMap[key]
      if (!raw || !String(raw).trim()) continue
      const values = parseExperimentValues(raw, baselineValue)
      if (values.length > 1 || JSON.stringify(values[0]) !== JSON.stringify(baselineValue)) {
        axes.push({ key, values })
      }
    }
    const assignments = cartesianAssignments(axes)
    for (const assignment of assignments) {
      const merged = { ...baseline, ...assignment }
      combos.push({
        strategy_key: strategyKey,
        preset: preset.preset,
        label: `${strategyKey} · ${preset.preset || 'default'}`,
        strategy_params: filterValidParamDict(merged),
        preview_key: comboPreviewKey(strategyKey, preset.preset, merged),
      })
    }
  }
  return combos
}

export function comboPreviewKey(strategyKey, preset, params) {
  return `${strategyKey}|${preset || ''}|${JSON.stringify(params || {})}`
}

export function buildAllCombos(strategyStates) {
  const all = []
  for (const state of strategyStates) {
    all.push(...buildStrategyCombos(state))
  }
  return all
}

export function estimateDurationSeconds(taskCount) {
  return Math.max(1, Math.ceil(taskCount * ESTIMATED_SECONDS_PER_TASK))
}

/** Split compare-form symbol input into unique codes (space / comma separated). */
export function parseCompareSymbols(textOrList) {
  if (Array.isArray(textOrList)) {
    return [...new Set(textOrList.map((item) => String(item || '').trim()).filter(Boolean))]
  }
  return [
    ...new Set(
      String(textOrList ?? '')
        .split(/[\s,，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ]
}

export function normalizeCompareSymbols(textOrList, assetType = 'stock') {
  const seen = new Set()
  const out = []
  for (const raw of parseCompareSymbols(textOrList)) {
    const preferred = inferAssetTypeFromSymbol(raw, assetType)
    const normalized = normalizeBacktestSymbol(raw, preferred)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

export function buildCompareSubmitPayload({
  name,
  symbol,
  symbols: symbolsInput,
  assetType = 'stock',
  startDate,
  endDate,
  initialCash,
  combos,
  excludedPreviewKeys = [],
}) {
  const source = symbolsInput != null ? symbolsInput : symbol
  const symbols = normalizeCompareSymbols(source, assetType)
  if (!symbols.length) {
    throw new Error('至少填写一个标的代码')
  }
  const resolvedAssetType = inferAssetTypeFromSymbol(symbols[0], assetType)
  const filtered = combos.filter((c) => !excludedPreviewKeys.includes(c.preview_key))
  if (!filtered.length) {
    throw new Error('至少选择一个有效组合')
  }
  const totalTasks = symbols.length * filtered.length
  if (totalTasks > MAX_COMPARE_TASKS) {
    throw new Error(
      `任务数 ${symbols.length} 标的 × ${filtered.length} 组合 = ${totalTasks} 超过上限 ${MAX_COMPARE_TASKS}`,
    )
  }
  const primary = filtered[0]
  return {
    name,
    symbols,
    asset_type: resolvedAssetType,
    universe_type: 'manual',
    strategy_key: primary.strategy_key,
    preset: primary.preset,
    strategy_params: primary.strategy_params,
    start_date: startDate,
    end_date: endDate,
    initial_cash: Number(initialCash) || 1000000,
    limit_symbols: 0,
    experiment_type: 'compare',
    combos: filtered.map(({ strategy_key, preset, strategy_params, label }) => ({
      strategy_key,
      preset,
      strategy_params,
      label,
    })),
  }
}
