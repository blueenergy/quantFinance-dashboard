export function buildModelTrainingPayload(form) {
  const name = String(form.name || '').trim() || 'ML训练'
  const payload = {
    name,
    index_code: form.index_code || 'csi1000',
    model_kind: form.model_kind || 'ridge',
    train_days: Number(form.train_days) || 60,
    test_days: Number(form.test_days) || 20,
    purge_days: Number(form.purge_days) || 60,
  }
  const parquet = String(form.parquet_path || '').trim()
  if (parquet) payload.parquet_path = parquet
  const snapshot = String(form.snapshot_id || '').trim()
  if (snapshot) payload.snapshot_id = snapshot
  return payload
}

export function defaultModelTrainingForm() {
  return {
    name: 'ML训练',
    index_code: 'csi1000',
    model_kind: 'ridge',
    train_days: 60,
    test_days: 20,
    purge_days: 60,
    parquet_path: '',
    snapshot_id: '',
    showAdvanced: false,
  }
}

const MODEL_KINDS = new Set(['rule_baseline', 'ridge', 'elasticnet', 'lightgbm'])
const INDEX_CODES = new Set(['hs300', 'a500', 'csi1000', 'csi2000'])

export function withModelTrainingRerunNameSuffix(baseName) {
  const name = String(baseName || '').trim() || 'ML训练'
  if (name.endsWith('(rerun)')) return name
  return `${name} (rerun)`
}

/** Map stored job.params (+ optional job name) into create-drawer form state. */
export function formFromJobParams(params = {}, jobName = '') {
  const defaults = defaultModelTrainingForm()
  const p = params && typeof params === 'object' ? params : {}
  const indexCode = INDEX_CODES.has(p.index_code) ? p.index_code : defaults.index_code
  const modelKind = MODEL_KINDS.has(p.model_kind) ? p.model_kind : defaults.model_kind
  const parquet_path = String(p.parquet_path || '').trim()
  const snapshot_id = String(p.snapshot_id || '').trim()
  const train_days = Number(p.train_days)
  const test_days = Number(p.test_days)
  const purge_days = Number(p.purge_days)
  return {
    ...defaults,
    name: String(jobName || p.name || defaults.name).trim() || defaults.name,
    index_code: indexCode,
    model_kind: modelKind,
    train_days: Number.isFinite(train_days) && train_days >= 5 ? train_days : defaults.train_days,
    test_days: Number.isFinite(test_days) && test_days >= 1 ? test_days : defaults.test_days,
    purge_days: Number.isFinite(purge_days) && purge_days >= 0 ? purge_days : defaults.purge_days,
    parquet_path,
    snapshot_id,
    showAdvanced: Boolean(parquet_path || snapshot_id),
  }
}
