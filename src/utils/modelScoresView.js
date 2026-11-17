/**
 * Pure helpers for the 模型评分 tab.
 *
 * Kept out of the SFC so the selection rules and formatting are unit-testable:
 * models are grouped by index universe (comparison across universes is not
 * defined), and the default selection is the live model plus its most recent
 * sibling from the same universe when one exists.
 */

export const MAX_COMPARE_MODELS = 6

const UNIVERSE_LABELS = {
  hs300: '沪深300',
  a500: '中证A500',
  csi500: '中证500',
  csi1000: '中证1000',
  csi2000: '中证2000',
  star50: '科创50',
}

export function universeLabel(indexCode) {
  if (!indexCode) return '未知池'
  return UNIVERSE_LABELS[indexCode] || String(indexCode)
}

export function modelLabel(model) {
  const id = String(model?.model_id || '')
  const tags = []
  if (model?.shadow) tags.push('shadow')
  if (model?.research) tags.push('research')
  const tag = tags.length ? ` · ${tags.join('/')}` : ''
  return `${id}${tag}`
}

/**
 * Models worth showing by default: those the system actually runs (active
 * strategy activation or enabled shadow profile). The optional toggle also
 * admits ``validated`` research models; raw research models stay out.
 */
export function filterAcceptedModels(models = [], showValidated = false) {
  return models.filter((model) => model?.accepted || (showValidated && model?.validated))
}

/** Group catalog rows by index_code; recent models first inside each group. */
export function groupModelsByUniverse(models = []) {
  const groups = new Map()
  for (const model of models) {
    const key = model?.index_code || 'unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(model)
  }
  return [...groups.entries()]
    .map(([indexCode, rows]) => ({
      indexCode,
      label: universeLabel(indexCode),
      models: [...rows].sort((a, b) => {
        if (Boolean(a.recent) !== Boolean(b.recent)) return a.recent ? -1 : 1
        return String(b.last_trade_date || '').localeCompare(String(a.last_trade_date || ''))
      }),
    }))
    .sort((a, b) => a.indexCode.localeCompare(b.indexCode))
}

/**
 * Default selection: prefer a universe whose models are all recent, choose the
 * shadow (live) model first, then its newest same-universe sibling.
 */
export function pickDefaultModels(models = []) {
  const recent = models.filter((model) => model?.recent)
  if (!recent.length) return []
  const byUniverse = new Map()
  for (const model of recent) {
    const key = model?.index_code || 'unknown'
    if (!byUniverse.has(key)) byUniverse.set(key, [])
    byUniverse.get(key).push(model)
  }
  // Prefer the universe with the most recent models (usually csi1000 today).
  const ranked = [...byUniverse.entries()].sort((a, b) => b[1].length - a[1].length)
  for (const [, rows] of ranked) {
    const sorted = [...rows].sort((a, b) =>
      String(b.last_trade_date || '').localeCompare(String(a.last_trade_date || '')),
    )
    const live = sorted.find((model) => model.shadow) || sorted[0]
    const sibling = sorted.find((model) => model.model_id !== live.model_id)
    return sibling ? [live.model_id, sibling.model_id] : [live.model_id]
  }
  return []
}

/** Dates available in every selected model, newest first (capped). */
export function sharedTradeDates(models = [], selectedIds = [], cap = 30) {
  const selected = models.filter((model) => selectedIds.includes(model?.model_id))
  if (!selected.length) return []
  let common = null
  for (const model of selected) {
    const dates = new Set(model.recent_trade_dates || [])
    common = common === null ? dates : new Set([...common].filter((date) => dates.has(date)))
  }
  return [...(common || [])].sort().reverse().slice(0, cap)
}

/** ``+3`` improved, ``-2`` fell, ``null`` when there is no previous date. */
export function formatRankDelta(delta) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return '-'
  const value = Number(delta)
  if (value === 0) return '0'
  return value > 0 ? `+${value}` : `${value}`
}

export function rankDeltaClass(delta) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return ''
  const value = Number(delta)
  if (value > 0) return 'rank-up'
  if (value < 0) return 'rank-down'
  return ''
}

export function formatScore(score, digits = 4) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return '-'
  return Number(score).toFixed(digits)
}

/** Compact one-line coverage label for the model picker. */
export function coverageLabel(model) {
  if (!model) return ''
  const dates = Number(model.date_count || 0)
  if (!dates) return '无数据'
  return `${dates} 日 · ${model.first_trade_date || '?'}~${model.last_trade_date || '?'}`
}
