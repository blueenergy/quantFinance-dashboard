import { describe, it, expect } from 'vitest'
import { isSubmittingForKey } from '../src/utils/scopedSubmitting'

describe('scopedSubmitting', () => {
  it('only shows submitting for the lineage that initiated the action', () => {
    const submittingKey = 'growth_cycle_index_enhanced:7130a0795f90'

    expect(isSubmittingForKey(submittingKey, 'growth_cycle_index_enhanced:7130a0795f90')).toBe(true)
    expect(isSubmittingForKey(submittingKey, 'growth_cycle_index_enhanced:aaaaaaaaaaaa')).toBe(false)
    expect(isSubmittingForKey('', 'growth_cycle_index_enhanced:7130a0795f90')).toBe(false)
  })
})
