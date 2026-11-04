/**
 * 趋势分色阶：发散型 blue <-> neutral <-> red。
 * 分数是「相对自身历史」的趋势强度分位，50 附近为中性，不是涨跌幅。
 *
 * 亮度沿两端向外递减，文字颜色按 WCAG 对比度选白/深色。
 */

export const TREND_BINS = [
  { min: 0, bg: '#082a56', fg: '#ffffff' },
  { min: 10, bg: '#0d366b', fg: '#ffffff' },
  { min: 20, bg: '#184f95', fg: '#ffffff' },
  { min: 30, bg: '#256abf', fg: '#ffffff' },
  { min: 40, bg: '#86b6ef', fg: '#172033' },
  { min: 50, bg: '#f0efec', fg: '#172033' },
  { min: 60, bg: '#f4b9b9', fg: '#172033' },
  { min: 70, bg: '#e98282', fg: '#172033' },
  { min: 80, bg: '#c22f2f', fg: '#ffffff' },
  { min: 90, bg: '#8f1d1d', fg: '#ffffff' },
]

const EMPTY_STYLE = { background: '#f1f5f9', color: '#94a3b8' }

/**
 * @param {number|null|undefined} score
 * @returns {{background: string, color: string}}
 */
export function trendCellStyle(score) {
  if (score === null || score === undefined || score === '') return EMPTY_STYLE
  const n = Number(score)
  if (!Number.isFinite(n)) return EMPTY_STYLE
  const clamped = Math.min(100, Math.max(0, n))
  const idx = Math.min(TREND_BINS.length - 1, Math.floor(clamped / 10))
  const bin = TREND_BINS[idx]
  return { background: bin.bg, color: bin.fg }
}

/**
 * @param {number|null|undefined} score
 * @returns {string}
 */
export function formatTrendScore(score) {
  if (score === null || score === undefined || score === '') return '—'
  const n = Number(score)
  if (!Number.isFinite(n)) return '—'
  return String(Math.round(n))
}

/**
 * 图例渐变：从 0 到 100 依次拼接色阶。
 */
export function trendLegendGradient() {
  const stops = TREND_BINS.map((bin, i) => `${bin.bg} ${i * 10}%`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}
