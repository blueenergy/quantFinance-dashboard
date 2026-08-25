import request from '../utils/request'
import { normalizeBacktestSymbol } from '../utils/backtestSymbolUtils'

export const STRATEGY_POOL_BACKTEST_DAYS_BACK = 2200
export const STRATEGY_POOL_CHART_LOOKBACK_DAYS = 1200
export const STRATEGY_POOL_CHART_MAX_ROUNDS = 20
export const STRATEGY_POOL_TRADE_PREVIEW_LIMIT = 80

export async function fetchStrategyPoolBacktestResult({
  symbol,
  strategy,
  preset,
  signalDate,
  daysBack = STRATEGY_POOL_BACKTEST_DAYS_BACK,
} = {}) {
  const normSymbol = normalizeBacktestSymbol(symbol, 'stock')
  if (!normSymbol) throw new Error('股票代码为空')
  if (!strategy) throw new Error('策略为空')

  const params = { symbol: normSymbol, strategy, days_back: daysBack }
  if (preset) params.preset = preset
  if (signalDate) params.end_date = signalDate

  return request({
    method: 'get',
    url: '/strategy-pool/backtest-result',
    params,
  })
}

export async function fetchStrategyPoolChartContext({
  symbol,
  strategy,
  preset,
  signalDate,
} = {}) {
  const normSymbol = normalizeBacktestSymbol(symbol, 'stock')
  if (!normSymbol) throw new Error('股票代码为空')
  if (!strategy) throw new Error('策略为空')
  if (!signalDate) throw new Error('信号日期为空')

  const params = {
    symbol: normSymbol,
    strategy,
    signal_date: signalDate,
    lookback_days: STRATEGY_POOL_CHART_LOOKBACK_DAYS,
    max_rounds: STRATEGY_POOL_CHART_MAX_ROUNDS,
  }
  if (preset) params.preset = preset

  return request({
    method: 'get',
    url: '/strategy-pool/chart-context',
    params,
  })
}

export async function fetchStrategyPoolParams({ strategy, preset } = {}) {
  if (!strategy) return {}
  const params = { strategy }
  if (preset) params.preset = preset
  const body = await request({
    method: 'get',
    url: '/strategy-pool/params',
    params,
  })
  return body?.params || {}
}

/**
 * Load pool backtest result and build modal meta suitable for deploy.
 */
export async function loadStrategyPoolBacktestDetail({
  symbol,
  strategy,
  preset,
  signalDate,
} = {}) {
  const body = await fetchStrategyPoolBacktestResult({
    symbol,
    strategy,
    preset,
    signalDate,
  })

  let strategyParams = body?.strategy_params
  if (!strategyParams || Object.keys(strategyParams).length === 0) {
    try {
      strategyParams = await fetchStrategyPoolParams({ strategy, preset })
    } catch {
      strategyParams = {}
    }
  }

  const normSymbol = normalizeBacktestSymbol(symbol, 'stock')
  const meta = {
    symbol: normSymbol,
    asset_type: 'stock',
    strategy_key: strategy,
    strategy_params: strategyParams || {},
    preset: preset || body?.preset || '',
    initial_cash: body?.initial_cash ?? 1000000,
    start_date: '',
    end_date: '',
  }

  if (Array.isArray(body?.equity_curve) && body.equity_curve.length > 0) {
    meta.start_date = body.equity_curve[0]?.date || ''
    meta.end_date = body.equity_curve[body.equity_curve.length - 1]?.date || ''
  } else if (signalDate) {
    meta.end_date = signalDate
  }

  return { result: body, meta }
}
