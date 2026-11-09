/** Shared human-readable outcome for a strategy stop/clear response. */
export function describeDisableResult(result) {
  if (!result || result.cancelled || !result.disabled) return ''

  const managed = Number(result.position?.managed_qty || 0)
  if (result.flatten_order_id) {
    const scheduled = result.session && result.session.is_open === false
      ? '下一交易时段'
      : '盘中'
    let message = `策略已停止，清仓委托已提交：卖出 ${Number(result.flatten_qty || 0).toLocaleString('zh-CN')} 股，将在${scheduled}执行。\n清仓成交前请勿重新启用该策略。`
    if (result.state_reset === false) {
      message += '\n注意：策略状态重置失败，重新启用前请先核对持仓与 state。'
    }
    return message
  }

  if (managed > 0) {
    return `策略已停止，${managed.toLocaleString('zh-CN')} 股持仓保留，但不再受该策略管理。`
  }
  return ''
}

export function notifyDisableResult(result) {
  const message = describeDisableResult(result)
  if (message) alert(message)
}
