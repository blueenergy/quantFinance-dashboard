import request from './request'

/**
 * UI-gated deploy: maps a completed backtest config onto watchlist strategy.
 * Permission / ETF limits stay client-side for now.
 */
export function getDeployBacktestBlockReason(payload = {}) {
  if (!payload.symbol) return '缺少标的代码'
  if (!payload.strategy_key) return '缺少策略'
  if ((payload.asset_type || 'stock') !== 'stock') {
    return 'ETF 回测暂不支持一键部署到实盘。'
  }
  return ''
}

export async function deployBacktestToLive(payload = {}, { requestFn = request } = {}) {
  const blocked = getDeployBacktestBlockReason(payload)
  if (blocked) {
    const err = new Error(blocked)
    err.code = 'DEPLOY_BLOCKED'
    throw err
  }

  await requestFn({
    method: 'post',
    url: '/user/watchlist/strategy',
    data: {
      symbol: payload.symbol,
      strategy: payload.strategy_key,
      enabled: true,
      params: payload.strategy_params || {},
    },
  })
}

export async function confirmAndDeployBacktestToLive(
  payload = {},
  {
    requestFn = request,
    confirmFn = (message) => window.confirm(message),
    alertFn = (message) => window.alert(message),
  } = {},
) {
  const blocked = getDeployBacktestBlockReason(payload)
  if (blocked) {
    alertFn(blocked)
    return { ok: false, reason: blocked }
  }

  const confirmed = confirmFn(
    `确定要将此回测配置部署到实盘吗？\n\n` +
      `股票：${payload.symbol}\n` +
      `策略：${payload.strategy_key}\n` +
      `参数：${JSON.stringify(payload.strategy_params || {}, null, 2)}`,
  )
  if (!confirmed) return { ok: false, reason: 'cancelled' }

  try {
    await deployBacktestToLive(payload, { requestFn })
    alertFn('✅ 部署成功！策略已配置到实盘')
    return { ok: true }
  } catch (error) {
    const message = error?.response?.data?.detail || error?.message || '部署失败'
    alertFn(`❌ 部署失败：${message}`)
    return { ok: false, reason: message, error }
  }
}
