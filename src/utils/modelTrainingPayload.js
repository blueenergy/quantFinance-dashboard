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
