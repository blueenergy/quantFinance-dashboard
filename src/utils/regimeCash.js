export const REGIME_CASH_REMINDER =
  '指数 MA 标成牛市则满仓，否则空仓。回测里中证1000上有效，同一规则在中证500上伤害收益；是否启用由你决定。'

export function isRegimeCashEnabled(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export function regimeCashFromParams(params = {}) {
  if (isRegimeCashEnabled(params.regime_cash)) return true
  const modes = Array.isArray(params.regime_modes) ? params.regime_modes : []
  return modes.some((mode) => {
    const text = String(mode || '').trim()
    return text && text !== 'off'
  })
}
