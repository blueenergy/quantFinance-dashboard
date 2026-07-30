/** Display helpers for Factor Backtest (no network, no Vue refs). */

import { compactDate, formatJobDateTime, jobElapsedLabel, num, pct, signClass } from './portfolioResearchView'

export { compactDate, formatJobDateTime, jobElapsedLabel, num, pct, signClass }

// Only the indices the worker's memory estimator knows; the API rejects others.
export const INDEX_OPTIONS = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'csi2000', label: 'csi2000 - 中证2000' },
]

export const FACTOR_SET_OPTIONS = [
  { value: 'alpha8', label: 'alpha8 - 8 个 K线/量价基础因子' },
  { value: 'alpha158', label: 'alpha158 - Qlib Alpha158 全集' },
]

export const PROGRESS_STAGE_LABELS = {
  loading_prices: '加载行情',
  computing_factors: '计算因子',
  building_dataset: '构建数据集',
  screening_ic: 'IC 初筛',
  running_diagnostics: '分位/TopK 诊断',
  cost_adjustment: '成本调整',
}

export const PROGRESS_STAGE_ORDER = Object.keys(PROGRESS_STAGE_LABELS)

export function indexName(value) {
  return INDEX_OPTIONS.find((item) => item.value === value)?.label || value || '-'
}

export function factorSetLabel(value) {
  return FACTOR_SET_OPTIONS.find((item) => item.value === value)?.label || value || '-'
}

export function jobProgressStageLabel(job) {
  if (!job || job.status !== 'running' || !job.progress_stage) return ''
  return PROGRESS_STAGE_LABELS[job.progress_stage] || job.progress_stage
}

/**
 * Stage position, not elapsed time: the diagnostics stage dominates the wall
 * clock, so this only says how far down the pipeline the job is.
 */
export function jobStageProgress(job) {
  if (!job || job.status !== 'running') return null
  const index = PROGRESS_STAGE_ORDER.indexOf(job.progress_stage)
  if (index < 0) return null
  const step = index + 1
  const total = PROGRESS_STAGE_ORDER.length
  return {
    step,
    total,
    percent: Math.round((step / total) * 100),
    label: `阶段 ${step}/${total} · ${PROGRESS_STAGE_LABELS[job.progress_stage]}`,
  }
}

export function jobFactorScopeLabel(job) {
  const params = job?.params || {}
  const factors = params.factors
  if (Array.isArray(factors) && factors.length) return `${factors.length} 个指定因子`
  return `${params.factor_set || job?.factor_set || '-'} 全集`
}

/** Groups catalog entries into [{ family, factors: [...] }], families sorted by size. */
export function groupFactorsByFamily(factors = []) {
  const groups = new Map()
  for (const factor of Array.isArray(factors) ? factors : []) {
    const family = factor?.family || '其他'
    if (!groups.has(family)) groups.set(family, [])
    groups.get(family).push(factor)
  }
  return Array.from(groups.entries())
    .map(([family, items]) => ({ family, factors: items }))
    .sort((left, right) => right.factors.length - left.factors.length || left.family.localeCompare(right.family))
}

export function filterCatalogFactors(factors = [], keyword = '') {
  const needle = String(keyword || '').trim().toLowerCase()
  if (!needle) return Array.isArray(factors) ? factors : []
  return (Array.isArray(factors) ? factors : []).filter((factor) => (
    String(factor?.name || '').toLowerCase().includes(needle)
    || String(factor?.description || '').toLowerCase().includes(needle)
    || String(factor?.expression || '').toLowerCase().includes(needle)
    || String(factor?.family || '').toLowerCase().includes(needle)
  ))
}

export function formatList(value, formatter = (item) => item) {
  if (Array.isArray(value)) return value.length ? value.map(formatter).join(', ') : '-'
  if (value === undefined || value === null || value === '') return '-'
  return formatter(value)
}

export function buildFactorParamRows(job) {
  if (!job) return []
  const params = job.params || {}
  const rows = [
    { key: 'index_code', label: 'universe', value: indexName(params.index_code) },
    { key: 'window', label: '区间', value: `${compactDate(params.start_date)} → ${compactDate(params.end_date)}` },
    { key: 'factor_set', label: '因子集', value: factorSetLabel(params.factor_set) },
    { key: 'factors', label: '因子范围', value: jobFactorScopeLabel(job) },
    { key: 'horizons', label: 'horizons', value: formatList(params.horizons, (item) => `${item}d`) },
    { key: 'quantiles', label: '分位数', value: params.quantiles ?? '-' },
    { key: 'top_k', label: 'Top K', value: formatList(params.top_k) },
    { key: 'min_names', label: '最少标的数', value: params.min_names ?? '-' },
    { key: 'screen', label: 'IC 初筛', value: `保留 ${params.screen_top ?? '-'} 个 @ ${params.screen_horizon ? `${params.screen_horizon}d` : '最长 horizon'}` },
    { key: 'warmup_days', label: '预热天数', value: params.warmup_days ?? '-' },
    { key: 'slippage_bps', label: '单边滑点', value: params.slippage_bps == null ? '-' : `${num(params.slippage_bps, 1)} bps` },
    { key: 'turnover', label: '每次调仓换手', value: pct(params.turnover) },
  ]
  return rows.map((row) => ({ ...row, value: row.value || '-' }))
}

export function screenHorizon(report) {
  return report?.screen?.horizon ?? null
}

export function buildScreenRows(report) {
  const ranked = report?.screen?.ranked
  return Array.isArray(ranked) ? ranked : []
}

/** Horizons present in the per-factor diagnostics, ascending. */
export function reportHorizons(report) {
  const factors = report?.factors || {}
  const horizons = new Set()
  for (const perHorizon of Object.values(factors)) {
    for (const horizon of Object.keys(perHorizon || {})) horizons.add(horizon)
  }
  return Array.from(horizons).sort((left, right) => Number(left) - Number(right))
}

export function diagnosedFactorNames(report) {
  return Object.keys(report?.factors || {})
}

/** One row per diagnosed factor at `horizon`, sorted by |IC| descending. */
export function buildIcRows(report, horizon) {
  const factors = report?.factors || {}
  const key = String(horizon)
  return Object.entries(factors)
    .map(([name, perHorizon]) => {
      const bucket = perHorizon?.[key]
      if (!bucket) return null
      const quantiles = bucket.quantiles || {}
      return {
        factor: name,
        ic_mean: bucket.ic?.ic_mean,
        ic_ir: bucket.ic?.ic_ir,
        t_stat: bucket.ic?.t_stat,
        positive_ratio: bucket.ic?.positive_ratio,
        observations: bucket.ic?.observations,
        avg_names: bucket.ic?.avg_names,
        spread: quantiles.top_minus_bottom_spread,
        monotonic: quantiles.monotonic_increasing,
        rank_corr: quantiles.quantile_rank_corr,
      }
    })
    .filter(Boolean)
    .sort((left, right) => Math.abs(Number(right.ic_mean) || 0) - Math.abs(Number(left.ic_mean) || 0))
}

export function findFactorMeta(report, factor) {
  const meta = Array.isArray(report?.factor_meta) ? report.factor_meta : []
  return meta.find((entry) => entry?.name === factor) || null
}

export function factorDiagnostics(report, factor, horizon) {
  return report?.factors?.[factor]?.[String(horizon)] || null
}

/** Quantile buckets as chart-ready bars, widths relative to the largest |return|. */
export function buildQuantileBars(diagnostics) {
  const byQuantile = diagnostics?.quantiles?.mean_return_by_quantile || {}
  const entries = Object.entries(byQuantile)
    .map(([quantile, value]) => ({ quantile, value: Number(value) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((left, right) => Number(left.quantile) - Number(right.quantile))
  if (!entries.length) return []
  const peak = Math.max(...entries.map((entry) => Math.abs(entry.value))) || 1
  return entries.map((entry) => ({
    ...entry,
    percent: Math.round((Math.abs(entry.value) / peak) * 100),
    cls: signClass(entry.value),
  }))
}

export function buildYearlyIcRows(diagnostics) {
  const perYear = diagnostics?.per_year
  return Array.isArray(perYear) ? perYear.slice().sort((left, right) => String(left.year).localeCompare(String(right.year))) : []
}

/** Net-return rows for one factor, ordered by horizon then top_k. */
export function buildNetReturnRows(report, factor) {
  const rows = Array.isArray(report?.net_returns) ? report.net_returns : []
  return rows
    .filter((row) => !factor || row.score_column === factor)
    .slice()
    .sort((left, right) => (
      (Number(left.horizon) - Number(right.horizon)) || (Number(left.top_k) - Number(right.top_k))
    ))
}

export function buildCoverageCards(report) {
  const source = report?.source || {}
  // The pipeline writes score_date_range as [min, max].
  const range = Array.isArray(report?.score_date_range) ? report.score_date_range : []
  return [
    { k: '样本行数', v: Number(report?.rows || 0).toLocaleString('zh-CN') },
    { k: '交易日数', v: num(report?.distinct_dates, 0) },
    { k: '标的数', v: num(report?.symbols, 0) },
    { k: '评估因子数', v: num(report?.evaluated_columns?.length, 0) },
    { k: '数据区间', v: `${compactDate(range[0] || source.start_date)} → ${compactDate(range[1] || source.end_date)}` },
    { k: '峰值内存估算', v: report?.estimated_memory_gb == null ? '-' : `${num(report.estimated_memory_gb, 2)} GB` },
  ]
}

/**
 * Factors the run asked for but could not evaluate, with the engine's reason.
 *
 * A full alpha158 run only evaluates 157: the price panel carries no $vwap, so
 * VWAP0 is dropped. Without showing it, the missing factor reads as a bug.
 */
export function buildSkippedFactorRows(report) {
  const skipped = report?.skipped_factors
  if (!Array.isArray(skipped)) return []
  return skipped
    .filter((item) => item && item.name)
    .map((item) => ({ name: String(item.name), reason: skipReasonLabel(item.reason) }))
}

/** The engine writes reasons like `needs $vwap`; anything else passes through. */
function skipReasonLabel(reason) {
  const text = String(reason || '').trim()
  if (!text) return '未说明原因'
  const field = /^needs \$(\w+)$/.exec(text)
  return field ? `价格面板缺少 $${field[1]} 字段` : text
}

/** Job-list blurb from the small artifact summary the worker attaches. */
export function jobArtifactSummary(job) {
  const artifact = job?.artifact
  if (!artifact) return ''
  const parts = []
  if (artifact.top_factor) parts.push(`最优 ${artifact.top_factor}`)
  if (artifact.reported_factors) parts.push(`诊断 ${artifact.reported_factors} 个因子`)
  return parts.join(' · ')
}

export function universePitLabel(report) {
  if (report?.source?.point_in_time_universe) return 'Point-in-time（当时成分股）'
  if (report?.source) return 'Latest-only（成分股近似，需复核）'
  return '-'
}
