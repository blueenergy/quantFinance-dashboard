import { describe, expect, it } from 'vitest'
import {
  buildScoreAuditPayload,
  defaultScoreAuditRange,
  localYmd,
  toDateInput,
} from '../scoreAuditPayload'

describe('buildScoreAuditPayload', () => {
  it('compacts dates and keeps sampling knobs', () => {
    expect(
      buildScoreAuditPayload({
        start_date: '2021-01-04',
        end_date: '2021-05-15',
        universe_index: 'csi1000',
        step: '20',
        sample: '12',
      }),
    ).toEqual({
      start_date: '20210104',
      end_date: '20210515',
      universe_index: 'csi1000',
      step: 20,
      sample: 12,
      max_dates: 40,
    })
  })

  it('rejects an inverted window', () => {
    expect(() =>
      buildScoreAuditPayload({
        start_date: '2021-05-15',
        end_date: '2021-01-04',
        step: 2,
        sample: 12,
      }),
    ).toThrow(/开始日期/)
  })
})

describe('defaultScoreAuditRange', () => {
  it('looks back 40 local calendar days', () => {
    const range = defaultScoreAuditRange(new Date(2026, 8, 10))
    expect(range.end_date).toBe('2026-09-10')
    expect(range.start_date).toBe('2026-08-01')
    expect(toDateInput('20210104')).toBe('2021-01-04')
    expect(localYmd(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
