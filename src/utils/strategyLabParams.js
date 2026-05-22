export function stringifyValue(value) {
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

export function stableStringify(value) {
  const sortObject = (input) => {
    if (Array.isArray(input)) return input.map(sortObject)
    if (!input || typeof input !== 'object') return input
    return Object.fromEntries(
      Object.keys(input).sort().map((key) => [key, sortObject(input[key])])
    )
  }
  return JSON.stringify(sortObject(value || {}), null, 2)
}

export function buildParamDiff(beforeParams, afterParams) {
  const keys = Array.from(new Set([
    ...Object.keys(beforeParams || {}),
    ...Object.keys(afterParams || {}),
  ])).sort()
  const changes = []
  for (const key of keys) {
    const hasBefore = Object.prototype.hasOwnProperty.call(beforeParams || {}, key)
    const hasAfter = Object.prototype.hasOwnProperty.call(afterParams || {}, key)
    const before = beforeParams?.[key]
    const after = afterParams?.[key]
    if (!hasBefore && hasAfter) {
      changes.push({ key, before, after, type: 'added', label: '新增' })
    } else if (hasBefore && !hasAfter) {
      changes.push({ key, before, after, type: 'removed', label: '删除' })
    } else if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ key, before, after, type: 'changed', label: '修改' })
    }
  }
  return {
    beforeText: stableStringify(beforeParams),
    afterText: stableStringify(afterParams),
    changes,
  }
}

const PARAM_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

/** Batch/task metadata — not Backtrader strategy params. */
export const RESERVED_STRATEGY_PARAM_KEYS = new Set([
  'universe_value',
  'universe_type',
  'symbols_count',
  'limit_symbols',
  'symbols_preview',
  'batch_id',
  'batch_name',
  'batch_index',
  'parent_batch_id',
  'loop_id',
  'asset_type',
  'strategy_key',
  'preset',
  'name',
  'symbols',
  'start_date',
  'end_date',
  'initial_cash',
  'symbol',
  'task_id',
  'user_id',
  'stock_name',
  'status',
  'worker_id',
  'created_at',
  'started_at',
  'completed_at',
  'error_message',
])

export function isValidStrategyParamName(name) {
  if (typeof name !== 'string') return false
  const key = name.trim()
  return key.length > 0 && PARAM_NAME_RE.test(key) && !RESERVED_STRATEGY_PARAM_KEYS.has(key)
}

export function filterValidParamDict(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return {}
  const out = {}
  for (const [key, value] of Object.entries(params)) {
    if (isValidStrategyParamName(key)) out[key.trim()] = value
  }
  return out
}

export function mergeStrategyParams(base, patch) {
  return { ...(base || {}), ...(patch || {}) }
}

export function formatParamDisplay(value) {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function coerceParamValue(raw, hint) {
  if (raw === '' || raw === null || raw === undefined) return raw
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw
  const text = String(raw).trim()
  if (hint !== undefined && typeof hint === 'boolean') {
    return ['1', 'true', 'yes', 'y', 't'].includes(text.toLowerCase())
  }
  if (hint !== undefined && typeof hint === 'number') {
    const n = Number(text)
    return Number.isNaN(n) ? hint : n
  }
  if (text === 'true') return true
  if (text === 'false') return false
  const n = Number(text)
  if (!Number.isNaN(n) && text !== '') return n
  if (
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']'))
  ) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

/** True only for plain strategy param dicts (not DOM events / class instances). */
export function isPlainParamsObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (typeof value.preventDefault === 'function' || typeof value.stopPropagation === 'function') {
    return false
  }
  if ('isTrusted' in value) return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

export function coerceParamsDict(nextParams, currentParams = {}) {
  const out = {}
  for (const [key, value] of Object.entries(filterValidParamDict(nextParams || {}))) {
    out[key] = coerceParamValue(value, currentParams?.[key])
  }
  return out
}

/** Build table rows: param key, current value, next-round value. */
export function buildParamTableRows(currentParams, nextParams) {
  const current = currentParams || {}
  const next = nextParams || {}
  const keys = Array.from(new Set([...Object.keys(current), ...Object.keys(next)])).sort()
  return keys.map((key) => {
    const hasCurrent = Object.prototype.hasOwnProperty.call(current, key)
    const hasNext = Object.prototype.hasOwnProperty.call(next, key)
    const currentValue = current[key]
    const nextValue = next[key]
    const changed = JSON.stringify(currentValue) !== JSON.stringify(nextValue)
    return {
      key,
      label: key,
      currentValue,
      nextValue,
      hasCurrent,
      hasNext,
      changed,
      isNew: !hasCurrent && hasNext,
      isRemoved: hasCurrent && !hasNext,
    }
  })
}

export function resolveParamLabel(key, paramsWithDesc = {}) {
  const meta = paramsWithDesc?.[key]
  if (meta && typeof meta === 'object' && meta.description) return meta.description
  if (typeof meta === 'string' && meta) return meta
  return key
}

/** True for next_experiments rows; false for parameter_suggestions rows. */
export function isExperimentReviewItem(item) {
  if (!item || typeof item !== 'object') return false
  return Boolean(
    item.hypothesis ||
    item.validation_window ||
    (item.strategy_params && typeof item.strategy_params === 'object')
  )
}

/** Merge one AI suggestion into the current editor params (cumulative across clicks). */
export function applySuggestionToParams(currentParams, suggestionItem) {
  const patch = normalizeSuggestionParams(suggestionItem)
  const mergedParams = mergeStrategyParams(currentParams, patch)
  return {
    patch,
    mergedParams,
    hasPatch: Object.keys(patch).length > 0,
  }
}

export function normalizeSuggestionParams(item) {
  if (!item || typeof item !== 'object') return {}
  if (item.strategy_params && typeof item.strategy_params === 'object') {
    return filterValidParamDict(item.strategy_params)
  }
  if (item.params && typeof item.params === 'object') return filterValidParamDict(item.params)
  if (item.suggested_params && typeof item.suggested_params === 'object') {
    return filterValidParamDict(item.suggested_params)
  }
  if (!isValidStrategyParamName(item.name)) return {}
  const paramName = item.name.trim()
  if (Array.isArray(item.suggested_values) && item.suggested_values.length) {
    return { [paramName]: item.suggested_values[0] }
  }
  if (item.value !== undefined) return { [paramName]: item.value }
  return {}
}

export function normalizeStrategies(strategies, fallbackStrategies = []) {
  const out = []
  const seen = new Set()
  const add = (item) => {
    if (!item || typeof item !== 'object') return
    const key = item.key || item.strategy_key || item.strategy || item.value || item.id
    if (!key || seen.has(key)) return
    seen.add(key)
    out.push({
      ...item,
      key,
      name: item.name || item.label || item.display_name || key,
      allow_backtest: item.allow_backtest !== false,
      can_use: item.can_use !== false,
    })
  }

  ;(Array.isArray(strategies) ? strategies : []).forEach(add)
  ;(Array.isArray(fallbackStrategies) ? fallbackStrategies : []).forEach(add)
  return out
}

export function normalizeTemplateGroups(templates, fallbackTemplates = {}) {
  const normalized = { ...(fallbackTemplates || {}) }
  if (!templates || typeof templates !== 'object') return normalized

  for (const [strategyKey, presets] of Object.entries(templates)) {
    if (Array.isArray(presets) && presets.length) {
      normalized[strategyKey] = presets
    }
  }
  return normalized
}
