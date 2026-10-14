/** Display helpers for model training (no network). */

import {
  formatJobDateTime,
  jobElapsedLabel,
  parseJobDate,
} from './portfolioResearchView'

export const ML_UNIVERSE_OPTIONS = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'csi2000', label: 'csi2000 - 中证2000' },
]

export const MODEL_KIND_OPTIONS = [
  { value: 'rule_baseline', label: '规则基线' },
  { value: 'ridge', label: 'Ridge' },
  { value: 'elasticnet', label: 'ElasticNet' },
  { value: 'lightgbm', label: 'LightGBM' },
]

/** One line for snapshot <select> (dataset_manifests). */
export function formatDatasetSnapshotLabel(snapshot) {
  if (!snapshot) return ''
  const index = snapshot.index_code || '?'
  const range = [snapshot.start_date, snapshot.end_date].filter(Boolean).join('–') || '—'
  const id = String(snapshot.snapshot_id || '')
  const shortId = id.length > 8 ? `${id.slice(0, 8)}…` : id
  const rows = snapshot.row_count != null ? ` · ${snapshot.row_count} 行` : ''
  return `${index} · ${range} · ${shortId}${rows}`
}

const ML_PROGRESS_STAGE_LABELS = {
  training: '训练中',
  shadow: 'Shadow 预测',
}

const PROMOTION_REASON_LABELS = {
  insufficient_walk_forward_folds: 'walk-forward 折数不足',
  no_ic: '无有效 IC',
  ic_below_baseline: 'IC 未超过规则基线',
  insufficient_universes: '单任务未登记多池（请查看下方双池晋升）',
  permutation_failed: '置换检验未通过',
}

export function mlJobProgressStageLabel(job) {
  if (!job || job.status !== 'running' || !job.progress_stage) return ''
  return ML_PROGRESS_STAGE_LABELS[job.progress_stage] || job.progress_message || job.progress_stage
}

export function promotionReasonLabel(reason) {
  if (!reason) return ''
  return PROMOTION_REASON_LABELS[reason] || reason
}

export function promotionPassed(promotion) {
  return Boolean(promotion?.passed)
}

export function groupPromotionLabel(group) {
  if (!group) return ''
  const n = group.passed_pool_count ?? 0
  const req = group.required_pools ?? 2
  const codes = (group.passed_index_codes || []).join('、') || '—'
  if (group.passed) {
    return `双池晋升：已通过（${n}/${req}，${codes}）`
  }
  return `双池晋升：未通过（${n}/${req} 个指数过线，已过：${codes}）`
}

export function formatGroupMemberLine(member) {
  if (!member) return ''
  const idx = member.index_code || '?'
  const ok = member.single_pool?.passed
  const ic = member.single_pool?.model_mean_ic
  const icText = Number.isFinite(Number(ic)) ? Number(ic).toFixed(4) : '—'
  return `${idx} · ${ok ? '本池通过' : '本池未过'} · IC ${icText}`
}

export function formatIc(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(4)
}

export function formatPValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (n < 0.001) return '<0.001'
  return n.toFixed(3)
}

export function buildModelTrainingParamRows(job) {
  if (!job) return []
  const p = job.params || {}
  const rows = [
    { key: 'index_code', label: '指数池', value: p.index_code || '-' },
    { key: 'model_kind', label: '模型', value: p.model_kind || '-' },
    { key: 'train_days', label: '训练窗口(交易日)', value: p.train_days ?? '-' },
    { key: 'test_days', label: '测试窗口(交易日)', value: p.test_days ?? '-' },
    { key: 'purge_days', label: 'purge(交易日)', value: p.purge_days ?? '-' },
  ]
  if (p.parquet_path) {
    rows.push({ key: 'parquet_path', label: 'Parquet', value: p.parquet_path })
  }
  if (p.snapshot_id) {
    rows.push({ key: 'snapshot_id', label: 'snapshot_id', value: p.snapshot_id })
  }
  return rows
}

export function buildFoldComparisonRows(foldReports = []) {
  return (foldReports || []).map((fold) => ({
    foldId: fold.fold_id,
    modelIc: fold.model?.mean_ic,
    baselineIc: fold.baseline?.mean_ic,
    modelIr: fold.model?.ic_ir,
    baselineIr: fold.baseline?.ic_ir,
    modelDays: fold.model?.n_days,
    slippageCost: fold.model?.slippage_cost,
  }))
}

export function maxAbsIcForChart(foldReports = []) {
  let max = 0.01
  for (const fold of foldReports || []) {
    for (const side of [fold.model, fold.baseline]) {
      const v = Math.abs(Number(side?.mean_ic))
      if (Number.isFinite(v)) max = Math.max(max, v)
    }
  }
  return max
}

export function barWidthPct(ic, maxAbs) {
  const v = Number(ic)
  if (!Number.isFinite(v) || !Number.isFinite(maxAbs) || maxAbs <= 0) return 0
  return Math.min(100, Math.round((Math.abs(v) / maxAbs) * 100))
}

export {
  formatJobDateTime,
  jobElapsedLabel,
  parseJobDate,
}
