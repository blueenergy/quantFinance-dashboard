/**
 * Heatmap color scale: direction from sign, intensity from |inflow_rate| vs cohort.
 * Values are dimensionless ratios (window net inflow / size at window start).
 */

export const HEATMAP_SCALE_LEVELS = 5

const HEATMAP_PALETTES = {
  pos: ['#fff1f2', '#ffe4e6', '#fecdd3', '#fb7185', '#b91c1c'],
  neg: ['#f0fdf4', '#dcfce7', '#bbf7d0', '#4ade80', '#15803d'],
}

/**
 * @param {number[]} rates - inflow_rate values for one kind cohort (theme or broad)
 * @param {number} [percentile=0.95]
 * @returns {number} positive cap for |rate| mapping (never zero)
 */
export function heatmapIntensityCap(rates, percentile = 0.95) {
  const abs = (rates || [])
    .map((x) => Math.abs(Number(x)))
    .filter((x) => Number.isFinite(x) && x > 0)
  if (!abs.length) return 1
  abs.sort((a, b) => a - b)
  const idx = Math.min(
    abs.length - 1,
    Math.max(0, Math.floor((abs.length - 1) * percentile)),
  )
  const cap = abs[idx]
  return cap > 0 ? cap : 1
}

/**
 * Map one inflow_rate to { level: 0..LEVELS, sign: 'pos'|'neg'|'zero', t: 0..1 }.
 * @param {number|null|undefined} rate
 * @param {number} cap
 */
export function heatmapRateLevel(rate, cap) {
  const r = Number(rate)
  if (!Number.isFinite(r) || cap <= 0) {
    return { level: 0, sign: 'zero', t: 0 }
  }
  if (Math.abs(r) < 1e-9) {
    return { level: 0, sign: 'zero', t: 0 }
  }
  const sign = r > 0 ? 'pos' : 'neg'
  const t = Math.min(1, Math.abs(r) / cap)
  const level = Math.max(1, Math.ceil(t * HEATMAP_SCALE_LEVELS))
  return { level, sign, t }
}

/**
 * CSS background for a heatmap cell.
 * @param {number|null|undefined} rate
 * @param {number} cap
 */
export function heatmapCellBackground(rate, cap) {
  const { level, sign } = heatmapRateLevel(rate, cap)
  if (sign === 'zero' || level === 0) {
    return '#f1f5f9'
  }
  return HEATMAP_PALETTES[sign][level - 1]
}

/**
 * Keep text readable on the two darkest color steps.
 * @param {number|null|undefined} rate
 * @param {number} cap
 */
export function heatmapCellForeground(rate, cap) {
  const { level, sign } = heatmapRateLevel(rate, cap)
  if (sign === 'zero' || level < 4) return '#172033'
  if (sign === 'neg' && level === 4) return '#052e16'
  return '#ffffff'
}

/**
 * @param {number|null|undefined} wan - net inflow in 万元
 */
export function formatInflowYi(wan) {
  if (wan == null || wan === '') return '—'
  const n = Number(wan)
  if (!Number.isFinite(n)) return '—'
  const yi = n / 10000
  if (Math.abs(yi) >= 100) return `${yi.toFixed(0)}亿`
  if (Math.abs(yi) >= 10) return `${yi.toFixed(1)}亿`
  return `${yi.toFixed(2)}亿`
}

/**
 * @param {number|null|undefined} rate
 */
export function formatInflowRatePct(rate) {
  if (rate == null || rate === '') return '—'
  const n = Number(rate)
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}
