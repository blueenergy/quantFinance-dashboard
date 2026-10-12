import { describe, expect, it } from 'vitest'
import {
  buildFoldComparisonRows,
  buildModelTrainingParamRows,
  maxAbsIcForChart,
  promotionReasonLabel,
  promotionPassed,
} from '../modelTrainingView'

describe('modelTrainingView', () => {
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
