export function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

export function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

export function pctSigned(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}

export function priceSourceLabel(source) {
  const labels = { realtime: '实时', daily_close: '昨收', none: '无价' }
  return labels[source] || source || '-'
}

export function priceSourceClass(source) {
  if (source === 'realtime') return 'price-source-realtime'
  if (source === 'daily_close') return 'price-source-daily'
  if (source === 'none') return 'price-source-none'
  return ''
}

export function formatPriceAsOf(asOf) {
  if (!asOf) return ''
  return String(asOf).slice(0, 19)
}

export function blockerText(blocker) {
  const labels = {
    account_binding_missing: '账户绑定不完整',
    account_position_capped: '按账户可卖数量封顶',
    insufficient_available_position: '可卖持仓不足',
    insufficient_cash: '可用资金不足',
    limit_up: '已涨停',
    live_trading_disabled: '账户未开启实盘',
    max_daily_amount_exceeded: '超过单日交易金额上限',
    max_order_amount_exceeded: '超过单笔金额上限',
    max_position_pct_exceeded: '超过单票仓位上限',
    missing_price: '缺少有效价格',
    missing_price_market_sell: '缺价按市价卖出',
    priced_from_stale_close: '按昨收定价',
    st_stock: 'ST 股票',
    suspended: '停牌',
  }
  return labels[blocker] || blocker || '-'
}

export function remainderReasonText(reason) {
  const labels = {
    item_not_a_planned_trade: '非计划交易项',
    already_at_target: '已达目标',
    live_signal_active: '有在飞信号',
    reference_price_unavailable: '无可用价格',
    account_not_synced: '账户未同步',
    budget_capped: '预算封顶',
    cash_capped: '现金封顶',
    available_position_below_gap: '可卖持仓不足',
    estimated_price_missing: '缺计划价',
  }
  return labels[reason] || reason || '-'
}

export function planItemActionLabel(action) {
  if (action === 'buy') return '买'
  if (action === 'sell') return '卖'
  if (action === 'hold') return '持'
  return '跳过'
}

export function planItemActionClass(action) {
  if (action === 'buy') return 'tag-buy'
  if (action === 'sell') return 'tag-sell'
  if (action === 'hold') return 'tag-hold'
  return 'tag-skip'
}

export function formatShareDelta(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n === 0) return '0'
  return n > 0 ? `+${n}` : String(n)
}

export function signClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return n > 0 ? 'pos' : 'neg'
}

export function riskSeverityLabel(severity) {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  if (severity === 'low') return '低'
  return '正常'
}

export function isKeepItem(item) {
  const currentShares = Number(item?.current_shares ?? 0)
  const targetShares = Number(item?.target_shares ?? 0)
  const deltaShares = Number(item?.delta_shares ?? 0)
  return currentShares > 0 && targetShares > 0 && deltaShares === 0
}

export function actionBadge(itemOrAction) {
  const item = typeof itemOrAction === 'object' ? itemOrAction : null
  const action = item?.action ?? itemOrAction
  if (item && isKeepItem(item)) {
    return { text: 'K', label: '保留不动', cls: 'tag-keep' }
  }
  switch (action) {
    case 'buy':
      return { text: 'B', label: '买入', cls: 'tag-buy' }
    case 'sell':
      return { text: 'S', label: '卖出', cls: 'tag-sell' }
    case 'hold':
      return { text: 'H', label: '持有', cls: 'tag-hold' }
    default:
      return { text: '·', label: '跳过', cls: 'tag-skip' }
  }
}

export function driftBadge(item) {
  const drift = Number(item?.drift_delta_shares ?? 0)
  if (!Number.isFinite(drift) || drift === 0) return { text: '持平', cls: 'drift-flat' }
  if (drift > 0) return { text: `+${drift} 待买`, cls: 'drift-buy' }
  return { text: `${drift} 待卖`, cls: 'drift-sell' }
}

export function aiRiskBadge(item) {
  const risk = item?.ai_risk
  if (!risk || !risk.severity || risk.severity === 'none') {
    return { show: ['buy', 'hold'].includes(item?.action), text: '正常', cls: 'risk-none', title: '未发现规则风控信号' }
  }
  const labelMap = { high: '高', medium: '中', low: '低' }
  const reasons = (risk.findings || []).map((f) => `${f.title}：${f.detail}`).join('\n') || (risk.reasons || []).join('、')
  return {
    show: true,
    text: labelMap[risk.severity] || risk.severity,
    cls: `risk-${risk.severity}`,
    title: reasons || '风险信号',
  }
}

export function usePortfolioPlanFormat() {
  return {
    num,
    money,
    pctSigned,
    priceSourceLabel,
    priceSourceClass,
    formatPriceAsOf,
    blockerText,
    remainderReasonText,
    planItemActionLabel,
    planItemActionClass,
    formatShareDelta,
    signClass,
    riskSeverityLabel,
    actionBadge,
    driftBadge,
    aiRiskBadge,
  }
}
