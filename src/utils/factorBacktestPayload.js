/** Turns factor backtest form state into the POST /factor-backtest/jobs body. */

import { parseCsvNumbers } from './portfolioResearchPayload'

export function compactDateInput(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 8)
}

export function dateInputValue(value) {
  const compact = compactDateInput(value)
  if (compact.length !== 8) return ''
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
}

/**
 * @throws {Error} with a message meant for the drawer, so obvious mistakes do
 *   not need a round trip to the API to be reported.
 */
export function buildFactorBacktestPayload(state = {}) {
  const startDate = compactDateInput(state.start_date)
  const endDate = compactDateInput(state.end_date)
  if (startDate.length !== 8 || endDate.length !== 8) {
    throw new Error('请填写完整的开始与结束日期')
  }
  if (startDate > endDate) {
    throw new Error('开始日期不能晚于结束日期')
  }

  const horizons = parseCsvNumbers(state.horizons).map((item) => Math.trunc(item))
  if (!horizons.length || horizons.some((item) => item < 1)) {
    throw new Error('horizons 需要至少一个 >= 1 的整数，例如 1,5,10,20')
  }
  const topK = parseCsvNumbers(state.top_k).map((item) => Math.trunc(item))
  if (!topK.length || topK.some((item) => item < 1)) {
    throw new Error('Top K 需要至少一个 >= 1 的整数，例如 20,50')
  }

  const quantiles = Number(state.quantiles)
  const minNames = Number(state.min_names)
  if (Number.isFinite(quantiles) && Number.isFinite(minNames) && minNames < quantiles) {
    throw new Error(`最少标的数 ${minNames} 无法填满 ${quantiles} 个分位桶`)
  }

  const sortedHorizons = Array.from(new Set(horizons)).sort((left, right) => left - right)
  const screenHorizonRaw = String(state.screen_horizon ?? '').trim()
  let screenHorizon = null
  if (screenHorizonRaw) {
    screenHorizon = Math.trunc(Number(screenHorizonRaw))
    if (!Number.isFinite(screenHorizon) || !sortedHorizons.includes(screenHorizon)) {
      throw new Error(`初筛 horizon ${screenHorizonRaw} 需要在 horizons ${sortedHorizons.join(',')} 之中`)
    }
  }

  const factors = Array.isArray(state.factors) ? state.factors.filter(Boolean) : []

  return {
    name: String(state.name || '').trim() || '因子回测',
    index_code: state.index_code,
    start_date: startDate,
    end_date: endDate,
    factor_set: state.factor_set,
    // Omitting factors means "the whole set", which is what the worker does
    // with null; an empty list would be rejected.
    factors: factors.length ? factors : null,
    warmup_days: Number(state.warmup_days),
    horizons: sortedHorizons,
    quantiles,
    min_names: minNames,
    top_k: Array.from(new Set(topK)).sort((left, right) => left - right),
    screen_top: Number(state.screen_top),
    screen_horizon: screenHorizon,
    slippage_bps: Number(state.slippage_bps),
    turnover: Number(state.turnover),
  }
}

/** Fills the drawer from an existing job so it can be tweaked and re-run. */
export function formStateFromJob(job, fallback = {}) {
  const params = job?.params || {}
  return {
    ...fallback,
    name: job?.name ? `${job.name} 重跑` : fallback.name,
    index_code: params.index_code || fallback.index_code,
    start_date: dateInputValue(params.start_date) || fallback.start_date,
    end_date: dateInputValue(params.end_date) || fallback.end_date,
    factor_set: params.factor_set || fallback.factor_set,
    factors: Array.isArray(params.factors) ? [...params.factors] : [],
    warmup_days: params.warmup_days ?? fallback.warmup_days,
    horizons: Array.isArray(params.horizons) ? params.horizons.join(',') : fallback.horizons,
    quantiles: params.quantiles ?? fallback.quantiles,
    min_names: params.min_names ?? fallback.min_names,
    top_k: Array.isArray(params.top_k) ? params.top_k.join(',') : fallback.top_k,
    screen_top: params.screen_top ?? fallback.screen_top,
    screen_horizon: params.screen_horizon ?? '',
    slippage_bps: params.slippage_bps ?? fallback.slippage_bps,
    turnover: params.turnover ?? fallback.turnover,
  }
}
