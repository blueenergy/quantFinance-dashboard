import { describe, expect, it } from 'vitest'
import {
  buildFoldComparisonRows,
  buildModelTrainingParamRows,
  maxAbsIcForChart,
  formatDatasetSnapshotLabel,
  groupPromotionLabel,
  promotionReasonLabel,
  promotionPassed,
} from '../modelTrainingView'

describe('modelTrainingView', () => {
  it('formats dataset snapshot labels for select', () => {
    const label = formatDatasetSnapshotLabel({
      index_code: 'hs300',
      start_date: '20230101',
      end_date: '20251231',
      snapshot_id: 'c80bd05b-a4f8-4566-84b4-fbfe4fb87764',
      row_count: 211804,
    })
    expect(label).toContain('hs300')
    expect(label).toContain('c80bd05b')
    expect(label).toContain('211804')
  })

  it('formats group promotion label', () => {
    const label = groupPromotionLabel({
      passed: true,
      passed_pool_count: 2,
      required_pools: 2,
      passed_index_codes: ['a500', 'hs300'],
    })
    expect(label).toContain('已通过')
    expect(label).toContain('hs300')
  })

  it('maps promotion reasons to Chinese labels', () => {
    expect(promotionReasonLabel('permutation_failed')).toContain('置换')
    expect(promotionPassed({ passed: true })).toBe(true)
    expect(promotionPassed({ passed: false })).toBe(false)
  })

  it('builds param rows from job params', () => {
    const rows = buildModelTrainingParamRows({
      params: { index_code: 'csi1000', model_kind: 'ridge', train_days: 60 },
    })
    expect(rows.find((r) => r.key === 'index_code')?.value).toBe('csi1000')
  })

  it('builds fold comparison and chart scale', () => {
    const folds = [
      { fold_id: 0, model: { mean_ic: 0.02 }, baseline: { mean_ic: 0.01 } },
      { fold_id: 1, model: { mean_ic: -0.03 }, baseline: { mean_ic: 0.005 } },
    ]
    expect(buildFoldComparisonRows(folds)).toHaveLength(2)
    expect(maxAbsIcForChart(folds)).toBeGreaterThanOrEqual(0.03)
  })
})
