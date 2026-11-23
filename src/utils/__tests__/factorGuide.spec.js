import { describe, expect, it } from 'vitest'
import {
  FACTOR_A_SHARE_NOTES,
  FACTOR_COVERAGE_NOTE,
  FACTOR_METRIC_GUIDE,
  FACTOR_STATUSES,
  FACTOR_STATUS_GUIDE,
  FACTOR_TEST_TYPE_GUIDE,
} from '../../constants/factorGuide'

describe('factor guide', () => {
  it('explains every status the filter offers', () => {
    const explained = FACTOR_STATUS_GUIDE.map((item) => item.key)
    expect(explained.slice().sort()).toEqual(FACTOR_STATUSES.slice().sort())
  })

  it('gives every status and metric a non-empty explanation', () => {
    for (const item of [...FACTOR_STATUS_GUIDE, ...FACTOR_TEST_TYPE_GUIDE, ...FACTOR_METRIC_GUIDE]) {
      expect(item.desc.trim().length).toBeGreaterThan(0)
    }
    expect(FACTOR_COVERAGE_NOTE.trim().length).toBeGreaterThan(0)
    expect(FACTOR_A_SHARE_NOTES.length).toBeGreaterThan(0)
    for (const note of FACTOR_A_SHARE_NOTES) expect(note.trim().length).toBeGreaterThan(0)
  })

  it('keeps the guide keys unique', () => {
    for (const list of [FACTOR_STATUS_GUIDE, FACTOR_TEST_TYPE_GUIDE, FACTOR_METRIC_GUIDE]) {
      const keys = list.map((item) => item.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})
