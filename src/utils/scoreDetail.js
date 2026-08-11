const SCORE_KEY_RE = /(评分|得分)$/
const WEIGHT_KEY_RE = /\(权重:\s*([\d.]+)%\)/
const RESERVED_SUBMODULE_KEYS = new Set(['_series', '_formula'])
const SERIES_HIDDEN_RAW_KEYS = new Set(['历年营收', '历年净利润', '历年ROE'])

const DIMENSION_NAME_MAP = {
  cycle: '动量评分',
  growth: '成长评分',
  fundamental: '基本面评分',
  value: '价值评分',
  technical: '技术面评分',
  money_flow: '资金流评分',
  industry_rs: '行业相对强度',
}

const DIMENSION_SCORE_FIELDS = {
  cycle: 'cycle_score',
  growth: 'growth_score',
  fundamental: 'fundamental_score',
  value: 'value_score',
  technical: 'technical_score',
  money_flow: 'money_flow_score',
}

function isSignalValue(value) {
  return typeof value === 'string' && /[✅❌⚠️]/.test(value)
}

function signalPositive(text) {
  if (typeof text !== 'string') return null
  if (text.includes('✅')) return true
  if (text.includes('❌')) return false
  if (text.includes('⚠️')) return false
  return null
}

/**
 * @param {unknown} value
 * @returns {{ type: 'null'|'scalar'|'array'|'object', display: string, items: string[] }}
 */
export function classifyRawValue(value) {
  if (value === null || value === undefined) {
    return { type: 'null', display: '—', items: [] }
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => (item == null ? '—' : String(item)))
    return { type: 'array', display: items.join(' · '), items }
  }
  if (typeof value === 'object') {
    return { type: 'object', display: JSON.stringify(value, null, 2), items: [] }
  }
  if (typeof value === 'number') {
    const display = Number.isInteger(value) ? String(value) : value.toFixed(2)
    return { type: 'scalar', display, items: [] }
  }
  return { type: 'scalar', display: String(value), items: [] }
}

export function formatRawValue(value) {
  return classifyRawValue(value).display
}

function extractSubmoduleScore(entries) {
  for (const [key, value] of entries) {
    if (SCORE_KEY_RE.test(key) && typeof value === 'number') {
      return value
    }
  }
  return null
}

function normalizeSeriesBlock(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return []
  const seriesList = []
  for (const [name, spec] of Object.entries(raw)) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue
    const points = Array.isArray(spec.points) ? spec.points : []
    seriesList.push({
      name,
      unit: spec.unit || '',
      source: spec.source || '',
      points: points.map((pt) => ({
        period: pt?.period ?? '—',
        end_date: pt?.end_date ?? '',
        value: pt?.value,
        yoy: pt?.yoy,
      })),
    })
  }
  return seriesList
}

function normalizeFormulaBlock(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const steps = Array.isArray(raw.steps) ? raw.steps : []
  if (!steps.length && raw.base == null && raw.raw_score == null) return null
  return {
    base: typeof raw.base === 'number' ? raw.base : 50,
    steps: steps.map((step) => ({
      rule: step?.rule || step?.label || '—',
      delta: typeof step?.delta === 'number' ? step.delta : 0,
      reason: step?.reason || '',
      weight: typeof step?.weight === 'number' ? step.weight : null,
    })),
    rawScore: typeof raw.raw_score === 'number' ? raw.raw_score : null,
    clippedScore: typeof raw.clipped_score === 'number' ? raw.clipped_score : null,
    clipped: Boolean(raw.clipped),
  }
}

function buildRawFields(entries, seriesKeys = new Set()) {
  const rawFields = []
  for (const [key, value] of entries) {
    if (SCORE_KEY_RE.test(key)) continue
    if (RESERVED_SUBMODULE_KEYS.has(key)) continue
    if (seriesKeys.has(key)) continue
    rawFields.push({ key, ...classifyRawValue(value) })
  }
  return rawFields
}

function parseSubmodule(name, raw, weights = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const entries = Object.entries(raw)
  const metrics = []
  const signals = []
  const series = normalizeSeriesBlock(raw._series)
  const formula = normalizeFormulaBlock(raw._formula)
  const seriesKeys = new Set()
  if (series.length) {
    for (const key of SERIES_HIDDEN_RAW_KEYS) seriesKeys.add(key)
  }

  for (const [key, value] of entries) {
    if (SCORE_KEY_RE.test(key)) continue
    if (RESERVED_SUBMODULE_KEYS.has(key)) continue
    if (seriesKeys.has(key)) continue
    if (isSignalValue(value)) {
      signals.push({ key, text: value, positive: signalPositive(value) })
    } else if (value !== null && typeof value !== 'object') {
      metrics.push({ key, value: String(value) })
    }
  }

  return {
    name,
    score: extractSubmoduleScore(entries),
    weight: typeof weights[name] === 'number' ? weights[name] : null,
    metrics,
    signals,
    series,
    formula,
    rawFields: buildRawFields(entries, seriesKeys),
  }
}

/**
 * Normalize nested category details into chart-friendly structure.
 * @param {Record<string, unknown>} details
 * @param {Record<string, number>} [weights]
 */
export function normalizeCategoryDetails(details, weights = {}) {
  if (!details || typeof details !== 'object') {
    return { total: null, subModules: [], topLevelFields: [], topLevelFormula: null, error: null }
  }

  if ('错误' in details) {
    return { total: null, subModules: [], topLevelFields: [], topLevelFormula: null, error: String(details['错误']) }
  }

  let total = null
  const subModules = []
  const topLevelFields = []
  const topLevelFormula = normalizeFormulaBlock(details._formula)

  for (const [key, value] of Object.entries(details)) {
    if (SCORE_KEY_RE.test(key) && typeof value === 'number') {
      total = value
      continue
    }
    if (RESERVED_SUBMODULE_KEYS.has(key)) continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const mod = parseSubmodule(key, value, weights)
      if (mod) subModules.push(mod)
      continue
    }
    topLevelFields.push({ key, ...classifyRawValue(value) })
  }

  return { total, subModules, topLevelFields, topLevelFormula, error: null }
}

function parseLegacyCompositeDetails(details) {
  if (!details || typeof details !== 'object') return []

  const dimensions = []
  for (const [key, value] of Object.entries(details)) {
    if (key === '当前策略' || key.startsWith('综合得分')) continue
    const match = key.match(WEIGHT_KEY_RE)
    const weight = match ? Number(match[1]) / 100 : null
    const name = key.replace(WEIGHT_KEY_RE, '').trim()
    const score = typeof value === 'number' ? value : null
    const contribution = (typeof score === 'number' && typeof weight === 'number')
      ? Math.round(score * weight * 100) / 100
      : null
    dimensions.push({
      key: name,
      name,
      score,
      weight,
      contribution,
      rawKey: key,
    })
  }
  return dimensions
}

/**
 * Normalize composite score breakdown for charts.
 * @param {Array<{key?: string, name?: string, score?: number, weight?: number, contribution?: number}>} [dimensions]
 * @param {Record<string, unknown>} [details]
 */
export function normalizeComposite(dimensions, details) {
  if (Array.isArray(dimensions) && dimensions.length > 0) {
    return dimensions
      .filter((item) => item && item.score != null)
      .map((item) => ({
        key: item.key || item.name,
        name: item.name || item.key,
        score: Number(item.score),
        weight: typeof item.weight === 'number' ? item.weight : null,
        contribution: typeof item.contribution === 'number'
          ? item.contribution
          : (typeof item.score === 'number' && typeof item.weight === 'number'
            ? Math.round(item.score * item.weight * 100) / 100
            : null),
        rawKey: item.rawKey || null,
      }))
  }
  return parseLegacyCompositeDetails(details)
}

/**
 * All top-level composite detail fields for raw-data display.
 * @param {Record<string, unknown>} [details]
 */
export function extractCompositeRawFields(details) {
  if (!details || typeof details !== 'object') return []
  return Object.entries(details).map(([key, value]) => ({
    key,
    ...classifyRawValue(value),
  }))
}

export function extractCompositeTotal(details) {
  if (!details || typeof details !== 'object') return null
  const raw = details['综合得分(当前策略)']
  return typeof raw === 'number' ? raw : null
}

export function translateScoreCategory(cat) {
  if (cat === 'composite') return '综合评分'
  return DIMENSION_NAME_MAP[cat] || cat
}

export function scoreColor(score) {
  if (score == null || Number.isNaN(Number(score))) return '#94a3b8'
  const n = Number(score)
  if (n >= 80) return '#22c55e'
  if (n >= 70) return '#84cc16'
  if (n >= 60) return '#eab308'
  if (n >= 50) return '#f97316'
  return '#ef4444'
}

/**
 * Merge API meta with client-side fallbacks from details.
 * @param {Record<string, unknown>|null|undefined} meta
 * @param {Record<string, unknown>|null|undefined} details
 * @param {string} [scoreDate]
 */
export function normalizeScoreMeta(meta, details, scoreDate) {
  const base = (meta && typeof meta === 'object') ? { ...meta } : {}
  if (!base.score_date && scoreDate) base.score_date = scoreDate
  if (base.details_schema_version == null) base.details_schema_version = 0
  if (!base.algorithm_version) base.algorithm_version = 'v0.1'
  if (!base.lookahead_rule) base.lookahead_rule = 'ann_date/f_ann_date <= score_date'

  const express = extractExpressFromDetails(details)
  if (express && Object.keys(express).length) {
    base.express = { ...(base.express || {}), ...express }
  }
  return base
}

/**
 * Scan details (top-level or nested) for express / provisional markers.
 * @param {Record<string, unknown>|null|undefined} details
 */
export function extractExpressFromDetails(details) {
  if (!details || typeof details !== 'object') return {}
  const flags = {}
  if (details.express_source) flags.express_source = details.express_source
  if (details['数据来源']) flags.data_source = details['数据来源']
  if (details.express_discount != null) flags.express_discount = details.express_discount
  return flags
}

/**
 * Build score history comparison rows for chart/table display.
 * @param {Array<Record<string, unknown>>} history
 * @param {string} [category]
 */
export function buildScoreHistoryComparison(history, category = 'composite') {
  if (!Array.isArray(history) || !history.length) return []
  const field = category === 'composite' ? null : DIMENSION_SCORE_FIELDS[category]
  return history
    .filter((row) => row && row.score_date)
    .map((row) => {
      let score = null
      if (field) {
        score = row[field]
      } else {
        const composite = row.composite_score
        if (typeof composite === 'number') score = composite
        else if (composite && typeof composite === 'object') {
          score = composite.balanced ?? Object.values(composite).find((v) => typeof v === 'number')
        }
      }
      return {
        score_date: String(row.score_date),
        score: typeof score === 'number' ? score : null,
      }
    })
    .filter((row) => row.score != null)
}

/**
 * Read submodule weights off a dimension's `_formula` steps.
 *
 * Scorers that keep a ledger report the weight they actually applied, which
 * beats any table we mirror here. Returns null when the details predate that,
 * so callers can fall back.
 * @param {Record<string, unknown>|null|undefined} details
 * @returns {Record<string, number>|null}
 */
export function submoduleWeightsFromDetails(details) {
  const steps = details?._formula?.steps
  if (!Array.isArray(steps)) return null
  const weights = {}
  for (const step of steps) {
    if (step && typeof step.weight === 'number' && step.rule) {
      weights[step.rule] = step.weight
    }
  }
  return Object.keys(weights).length ? weights : null
}

export function formatSeriesValue(value, unit) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = Number(value)
  if (unit === '%') return `${n.toFixed(2)}%`
  if (unit === '亿元') return `${n.toFixed(2)}亿`
  if (unit) return `${n.toFixed(2)} ${unit}`
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export function formatYoyValue(yoy) {
  if (yoy == null || Number.isNaN(Number(yoy))) return '—'
  const n = Number(yoy)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}
