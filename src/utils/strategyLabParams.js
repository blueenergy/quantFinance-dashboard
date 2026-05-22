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

export function normalizeSuggestionParams(item) {
  if (!item || typeof item !== 'object') return {}
  if (item.strategy_params && typeof item.strategy_params === 'object') return item.strategy_params
  if (item.params && typeof item.params === 'object') return item.params
  if (item.suggested_params && typeof item.suggested_params === 'object') return item.suggested_params
  if (item.name && Array.isArray(item.suggested_values) && item.suggested_values.length) {
    return { [item.name]: item.suggested_values[0] }
  }
  if (item.name && item.value !== undefined) return { [item.name]: item.value }
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
