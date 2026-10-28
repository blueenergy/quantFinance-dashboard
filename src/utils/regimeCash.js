export const REGIME_CASH_REMINDER =
  '指数 MA 标成牛市则满仓，否则空仓。回测里中证1000上有效，同一规则在中证500上伤害收益；是否启用由你决定。'

export const REGIME_MODE_OFF = 'off'
export const REGIME_MODE_CASH = 'bull_g60_else_cash'

export const DEFAULT_REGIME_RULE = 'k_slow_anchor'
export const VOLUME_PRICE_REGIME_RULE = 'k_slow_anchor_with_vol_and_atr'

export const REGIME_RULE_OPTIONS = [
  { value: DEFAULT_REGIME_RULE, label: '价格K交叉（默认）' },
  { value: VOLUME_PRICE_REGIME_RULE, label: '量价择时（放量+低波动）' },
  { value: 'k_slow_anchor_with_volume', label: '仅放量过滤' },
  { value: 'k_slow_anchor_with_volatility', label: '仅低波动过滤' },
]

// Reference indices with rows in quant_data.index_prices. Keep the codes in
// sync with services/backtest_batch_schemas.py::REGIME_INDEX_CHOICES.
export const REGIME_INDEX_OPTIONS = [
  { value: '', label: '跟随股票池（推荐）' },
  { value: '000300.SH', label: '沪深300' },
  { value: '000905.SH', label: '中证500' },
  { value: '000852.SH', label: '中证1000' },
  { value: '932000.CSI', label: '中证2000' },
  { value: '000016.SH', label: '上证50' },
  { value: '000001.SH', label: '上证指数' },
  { value: '399006.SZ', label: '创业板指' },
  { value: '000688.SH', label: '科创50' },
]

const REGIME_INDEX_LABELS = Object.fromEntries(
  REGIME_INDEX_OPTIONS.filter((item) => item.value).map((item) => [item.value, item.label]),
)

export function formatRegimeIndex(code) {
  const key = String(code || '').trim().toUpperCase()
  if (!key || key === 'AUTO') return '跟随股票池'
  const label = REGIME_INDEX_LABELS[key]
  return label ? `${label}（${key}）` : key
}

export const REGIME_RULE_HINT =
  '仅对非牛空仓生效；可多选对照，默认只跑价格K交叉。量价择时：牛市买入需放量且波动收缩；熊市退出不加过滤。指数日线缺成交量时会退化为价格交叉。'

const REGIME_MODE_LABELS = {
  [REGIME_MODE_OFF]: '始终满仓',
  [REGIME_MODE_CASH]: '非牛空仓',
}

const INDEX_REGIME_LABELS = {
  bull: '牛市',
  bear: '熊市',
  uncertain: '震荡',
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

export function formatIndexRegimeLabel(label) {
  const key = String(label || '').trim().toLowerCase()
  if (!key) return '-'
  return INDEX_REGIME_LABELS[key] || key
}

export function indexRegimeTone(label) {
  const key = String(label || '').trim().toLowerCase()
  if (key === 'bull' || key === 'bear' || key === 'uncertain') return key
  return ''
}

export function regimeCashFromParams(params = {}) {
  return regimeFlagsFromParams(params).regime_cash
}

export function regimeRuleFromParams(params = {}) {
  const text = String(params?.regime_rule || '').trim()
  return text || DEFAULT_REGIME_RULE
}

export function regimeRulesFromParams(params = {}) {
  if (Array.isArray(params.regime_rules) && params.regime_rules.length) {
    const seen = new Set()
    const values = []
    for (const raw of params.regime_rules) {
      const id = String(raw || '').trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      values.push(id)
    }
    if (values.length) return values
  }
  return [regimeRuleFromParams(params)]
}

export function buildRegimeRulesFromForm(form = {}) {
  const selected = Array.isArray(form.regime_rules) ? form.regime_rules : []
  const normalized = [...new Set(selected.map((item) => String(item || '').trim()).filter(Boolean))]
  if (normalized.length) return normalized
  const legacy = String(form.regime_rule || '').trim()
  return [legacy || DEFAULT_REGIME_RULE]
}

export function toggleRegimeRuleSelection(currentRules, ruleId, checked) {
  const id = String(ruleId || '').trim()
  if (!id) return [...(currentRules || [])]
  const rules = Array.isArray(currentRules) ? [...currentRules] : []
  if (checked) {
    if (!rules.includes(id)) rules.push(id)
    return rules
  }
  const next = rules.filter((item) => item !== id)
  return next.length ? next : [DEFAULT_REGIME_RULE]
}

export function formatRegimeRules(rules) {
  const list = Array.isArray(rules) ? rules : regimeRulesFromParams({ regime_rule: rules })
  return list.map((id) => formatRegimeRule(id)).join('、')
}

/** True when job asked for multiple timing rules but result rows lack per-row regime_rule. */
export function regimeRulesMissingOnRows(params = {}, rows = []) {
  const expected = regimeRulesFromParams(params)
  if (expected.length <= 1) return false
  const cashRows = (rows || []).filter(
    (row) => String(row?.regime_mode || '').trim() === 'bull_g60_else_cash',
  )
  if (!cashRows.length) return false
  const onRows = new Set(
    cashRows.map((row) => String(row?.regime_rule || '').trim()).filter(Boolean),
  )
  return onRows.size < expected.length
}

export function formatRegimeRule(ruleId) {
  const id = String(ruleId || '').trim() || DEFAULT_REGIME_RULE
  const option = REGIME_RULE_OPTIONS.find((item) => item.value === id)
  return option?.label || id
}

export function regimeRuleSelectOptions(currentRule) {
  const selected = String(currentRule || '').trim()
  if (!selected || REGIME_RULE_OPTIONS.some((item) => item.value === selected)) {
    return REGIME_RULE_OPTIONS
  }
  return [...REGIME_RULE_OPTIONS, { value: selected, label: selected }]
}
