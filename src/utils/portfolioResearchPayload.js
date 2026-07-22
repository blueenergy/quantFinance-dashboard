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

/**
 * Build create/rerun API body from the research drawer form state.
 * Coerces CSV fields and drops empty/invalid optional numbers so FastAPI
 * does not return 422 on "" / NaN.
 */
export function buildPortfolioResearchPayload(formState, { defaultName } = {}) {
  const form = formState || {}
  const horizon = asOptionalNumber(form.horizon)
  const payload = {
    name: form.name || defaultName || '组合研究',
    universe_index: form.universe_index,
    start_date: form.start_date,
    end_date: form.end_date,
    score_column: form.score_column,
    growth_cycle_weights: parseCsvNumbers(form.growth_cycle_weights, String),
    top_n_values: parseCsvNumbers(form.top_n_values, Number).map((n) => Math.trunc(n)),
    active_caps: parseCsvNumbers(form.active_caps, Number),
    trailing_stop_pcts: normalizeTrailingStopList(parseCsvNumbers(form.trailing_stop_pcts, Number)),
    force: true,
  }

  if (horizon != null && horizon >= 1) {
    payload.horizon = Math.trunc(horizon)
    payload.rebalance_interval_days = [payload.horizon]
  }

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
