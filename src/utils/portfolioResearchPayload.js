/** Optional numeric fields on create/rerun research job bodies. */
const OPTIONAL_NUMBER_KEYS = [
  'transaction_cost',
  'buy_commission_rate',
  'sell_commission_rate',
  'min_commission',
  'stamp_tax_rate',
  'transfer_fee_rate',
  'cash_buffer',
  'initial_capital',
  'trailing_stop_pct',
  'horizon',
]

/**
 * Split a comma-separated input (also accepts Chinese commas) into mapped values.
 * Drops blanks and non-finite numbers when mapper is Number.
 */
export function parseCsvNumbers(value, mapper = Number) {
  const items = String(value ?? '')
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(mapper)

  if (mapper === Number) {
    return items.filter((item) => Number.isFinite(item))
  }
  return items
}

export function parseWeightedScoreSpecs(value) {
  const lines = String(value ?? '')
    .split(/[;\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => {
    const weights = {}
    for (const token of line.split(/[,，]/).map((item) => item.trim()).filter(Boolean)) {
      const separator = token.indexOf(':')
      if (separator <= 0) {
        throw new Error(`无效加权项「${token}」，格式应为 dimension:weight`)
      }
      const dimension = token.slice(0, separator).trim()
      const weight = Number(token.slice(separator + 1).trim())
      if (!dimension || !Number.isFinite(weight)) {
        throw new Error(`无效加权项「${token}」`)
      }
      weights[dimension] = weight
    }
    return { mode: 'weighted', weights }
  })
}

function legacyGrowthCycleWeights(scoreSpecs) {
  if (!scoreSpecs.length) return null
  const values = []
  for (const spec of scoreSpecs) {
    const dimensions = Object.keys(spec.weights || {}).sort()
    if (dimensions.join(',') !== 'cycle,growth') return null
    values.push(`${spec.weights.growth}:${spec.weights.cycle}`)
  }
  return values
}

function asOptionalNumber(value) {
  if (value == null || value === '') return undefined
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : undefined
}

function normalizeTrailingStopList(values) {
  if (!Array.isArray(values)) return values
  return values.map((value) => {
    if (value == null || value === '' || Number(value) === 0) return 0
    const number = Number(value)
    if (!Number.isFinite(number) || number <= 0) return value
    return number > 1 ? number / 100 : number
  })
}

function omitEmpty(payload) {
  const next = { ...payload }
  for (const key of Object.keys(next)) {
    if (next[key] === undefined) delete next[key]
  }
  return next
}

/** Unique non-empty score column names from multi-select or legacy single field. */
export function resolveScoreColumns(formState = {}) {
  const fromList = Array.isArray(formState.score_columns)
    ? formState.score_columns.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  if (fromList.length) return [...new Set(fromList)]
  const single = String(formState.score_column || '').trim()
  return single ? [single] : []
}

/**
 * Build create/rerun API body from the research drawer form state.
 * Coerces CSV fields and drops empty/invalid optional numbers so FastAPI
 * does not return 422 on "" / NaN.
 */
export function buildPortfolioResearchPayload(formState, { defaultName } = {}) {
  const form = formState || {}
  const scoreMode = form.score_mode || ''
  const scoreColumns = resolveScoreColumns(form)
  const rebalanceIntervals = [...new Set(
    parseCsvNumbers(form.horizon, Number)
      .map((n) => Math.trunc(n))
      .filter((n) => n >= 1),
  )].sort((a, b) => a - b)
  const payload = {
    name: form.name || defaultName || '组合研究',
    universe_index: form.universe_index,
    start_date: form.start_date,
    end_date: form.end_date,
    score_column: scoreColumns[0] || form.score_column,
    top_n_values: parseCsvNumbers(form.top_n_values, Number).map((n) => Math.trunc(n)),
    active_caps: parseCsvNumbers(form.active_caps, Number),
    trailing_stop_pcts: normalizeTrailingStopList(parseCsvNumbers(form.trailing_stop_pcts, Number)),
    force: true,
  }

  if (scoreMode === 'column' || scoreMode === 'preset') {
    if (!scoreColumns.length) {
      throw new Error(scoreMode === 'preset' ? '请至少选择一个预定义组合' : '请至少选择一个评分维度')
    }
    payload.score_specs = scoreColumns.map((column) => ({ mode: 'column', column }))
  } else if (scoreMode === 'weighted') {
    const scoreSpecs = parseWeightedScoreSpecs(form.score_specs || form.growth_cycle_weights)
    const legacyWeights = legacyGrowthCycleWeights(scoreSpecs)
    if (legacyWeights) {
      payload.growth_cycle_weights = legacyWeights
    } else {
      payload.score_specs = scoreSpecs
    }
  } else {
    // Backward-compatible form state used by old saved jobs and tests.
    payload.growth_cycle_weights = parseCsvNumbers(form.growth_cycle_weights, String)
  }

  if (!rebalanceIntervals.length) {
    throw new Error('请至少填写一个 rebalance_days')
  }
  payload.rebalance_interval_days = rebalanceIntervals
  payload.horizon = rebalanceIntervals[0]

  for (const key of OPTIONAL_NUMBER_KEYS) {
    if (key === 'horizon') continue
    let num = asOptionalNumber(form[key])
    if (num == null) continue
    if (key === 'trailing_stop_pct' && num > 1) num = num / 100
    if (key === 'initial_capital' && !(num > 0)) continue
    if (key === 'cash_buffer' && (num < 0 || num > 1)) continue
    payload[key] = num
  }

  const benchmark = form.index_benchmark_symbol
  if (benchmark != null && String(benchmark).trim() !== '') {
    payload.index_benchmark_symbol = String(benchmark).trim()
  }

  return omitEmpty(payload)
}

/** Human-readable FastAPI / axios error text (handles 422 detail arrays). */
export function formatResearchApiError(error, fallback = '请求失败') {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item
        const loc = Array.isArray(item?.loc)
          ? item.loc.filter((part) => part !== 'body').join('.')
          : ''
        const msg = item?.msg || item?.message || JSON.stringify(item)
        return loc ? `${loc}: ${msg}` : msg
      })
      .join('；')
  }
  if (detail && typeof detail === 'object') {
    return detail.message || detail.msg || JSON.stringify(detail)
  }
  if (error?.response?.status) {
    return `${fallback}（HTTP ${error.response.status}）`
  }
  return error?.message || fallback
}
