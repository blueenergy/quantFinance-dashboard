export const REGIME_CASH_REMINDER =
  '指数 MA 标成牛市则满仓，否则空仓。回测里中证1000上有效，同一规则在中证500上伤害收益；是否启用由你决定。'

export const REGIME_MODE_OFF = 'off'
export const REGIME_MODE_CASH = 'bull_g60_else_cash'

const REGIME_MODE_LABELS = {
  [REGIME_MODE_OFF]: '始终满仓',
  [REGIME_MODE_CASH]: '非牛空仓',
}

export function isRegimeCashEnabled(value) {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function normalizeRegimeMode(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  if (text === 'cash' || text === 'regime_cash') return REGIME_MODE_CASH
  return text
}

export function regimeModesFromParams(params = {}) {
  if (Array.isArray(params.regime_modes) && params.regime_modes.length) {
    return [...new Set(params.regime_modes.map(normalizeRegimeMode).filter(Boolean))]
  }
  if (isRegimeCashEnabled(params.regime_cash)) return [REGIME_MODE_CASH]
  return [REGIME_MODE_OFF]
}

export function regimeFlagsFromParams(params = {}) {
  const modes = regimeModesFromParams(params)
  return {
    regime_always_invest: modes.includes(REGIME_MODE_OFF),
    regime_cash: modes.includes(REGIME_MODE_CASH),
  }
}

export function buildRegimeModesFromForm(form = {}) {
  const modes = []
  if (form.regime_always_invest !== false) modes.push(REGIME_MODE_OFF)
  if (isRegimeCashEnabled(form.regime_cash)) modes.push(REGIME_MODE_CASH)
  if (!modes.length) {
    throw new Error('请至少选择一种仓位模式：始终满仓或非牛空仓')
  }
  return modes
}

export function formatRegimeModes(params = {}) {
  return regimeModesFromParams(params)
    .map((mode) => REGIME_MODE_LABELS[mode] || mode)
    .join(', ')
}

export function regimeCashFromParams(params = {}) {
  return regimeFlagsFromParams(params).regime_cash
}
