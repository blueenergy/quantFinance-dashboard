import { describe, expect, it } from 'vitest'
import {
  buildModelTrainingPayload,
  formFromJobParams,
  withModelTrainingRerunNameSuffix,
} from '../modelTrainingPayload'

describe('modelTrainingPayload', () => {
  it('formFromJobParams restores walk-forward and parquet fields', () => {
    const form = formFromJobParams(
      {
        index_code: 'csi1000',
        model_kind: 'lightgbm',
        train_days: 60,
        test_days: 20,
        purge_days: 60,
        parquet_path: 's3://aipoc/quant_ml/snapshots/csi1000/uuid.parquet',
        snapshot_id: 'uuid',
      },
      'ML训练',
    )
    expect(form.model_kind).toBe('lightgbm')
    expect(form.parquet_path).toContain('s3://')
    expect(form.snapshot_id).toBe('uuid')
    expect(form.showAdvanced).toBe(true)
    const payload = buildModelTrainingPayload(form)
    expect(payload.parquet_path).toBe(form.parquet_path)
    expect(payload.snapshot_id).toBe('uuid')
  })

  it('withModelTrainingRerunNameSuffix avoids double suffix', () => {
    expect(withModelTrainingRerunNameSuffix('foo')).toBe('foo (rerun)')
    expect(withModelTrainingRerunNameSuffix('foo (rerun)')).toBe('foo (rerun)')
  })
})
