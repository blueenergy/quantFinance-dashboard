const SCORE_KEY_RE = /(评分|得分)$/
const WEIGHT_KEY_RE = /\(权重:\s*([\d.]+)%\)/

const DIMENSION_NAME_MAP = {
  cycle: '动量评分',
  growth: '成长评分',
  fundamental: '基本面评分',
  value: '价值评分',
  technical: '技术面评分',
  money_flow: '资金流评分',
  industry_rs: '行业相对强度',
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

function buildRawFields(entries) {
  const rawFields = []
  for (const [key, value] of entries) {
    if (SCORE_KEY_RE.test(key)) continue
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
  const rawFields = buildRawFields(entries)

  for (const [key, value] of entries) {
    if (SCORE_KEY_RE.test(key)) continue
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
    rawFields,
  }
}

/**
 * Normalize nested category details into chart-friendly structure.
 * @param {Record<string, unknown>} details
 * @param {Record<string, number>} [weights]
 */
export function normalizeCategoryDetails(details, weights = {}) {
  if (!details || typeof details !== 'object') {
    return { total: null, subModules: [], topLevelFields: [], error: null }
  }

  if ('错误' in details) {
    return { total: null, subModules: [], topLevelFields: [], error: String(details['错误']) }
  }

  let total = null
  const subModules = []
  const topLevelFields = []

  for (const [key, value] of Object.entries(details)) {
    if (SCORE_KEY_RE.test(key) && typeof value === 'number') {
      total = value
      continue
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const mod = parseSubmodule(key, value, weights)
      if (mod) subModules.push(mod)
      continue
    }
    topLevelFields.push({ key, ...classifyRawValue(value) })
  }

  return { total, subModules, topLevelFields, error: null }
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
