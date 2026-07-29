import { describe, expect, it } from 'vitest'
import {
  buildFactorBacktestPayload,
  dateInputValue,
  formStateFromJob,
} from '../factorBacktestPayload'

function validState(overrides = {}) {
  return {
    name: ' 测试回测 ',
    index_code: 'csi1000',
    start_date: '2023-01-01',
    end_date: '2023-12-31',
    factor_set: 'alpha8',
    factors: [],
    warmup_days: '60',
    horizons: '20, 5,1,5',
    quantiles: '5',
    min_names: '30',
    top_k: '50,20',
    screen_top: '20',
    screen_horizon: '',
    slippage_bps: '10',
    turnover: '1',
    ...overrides,
  }
}

describe('buildFactorBacktestPayload', () => {
  it('compacts dates, dedupes and sorts the list params, and coerces numbers', () => {
    expect(buildFactorBacktestPayload(validState())).toEqual({
      name: '测试回测',
      index_code: 'csi1000',
      start_date: '20230101',
      end_date: '20231231',
      factor_set: 'alpha8',
      factors: null,
      warmup_days: 60,
      horizons: [1, 5, 20],
      quantiles: 5,
      min_names: 30,
      top_k: [20, 50],
      screen_top: 20,
      screen_horizon: null,
      slippage_bps: 10,
      turnover: 1,
    })
  })

  it('sends no factors instead of an empty list, which the API rejects', () => {
    expect(buildFactorBacktestPayload(validState({ factors: [] })).factors).toBeNull()
    expect(buildFactorBacktestPayload(validState({ factors: ['alpha1', ''] })).factors).toEqual(['alpha1'])
  })

  it('defaults the name when it is blank', () => {
    expect(buildFactorBacktestPayload(validState({ name: '   ' })).name).toBe('因子回测')
  })

  it('keeps a screen horizon that is among the horizons', () => {
    expect(buildFactorBacktestPayload(validState({ screen_horizon: '5' })).screen_horizon).toBe(5)
  })

  it('rejects a screen horizon that is not among the horizons', () => {
    expect(() => buildFactorBacktestPayload(validState({ screen_horizon: '3' })))
      .toThrow(/初筛 horizon 3 需要在 horizons 1,5,20 之中/)
  })

  it('rejects an incomplete or reversed date window', () => {
    expect(() => buildFactorBacktestPayload(validState({ end_date: '' }))).toThrow(/完整的开始与结束日期/)
    expect(() => buildFactorBacktestPayload(validState({ start_date: '2024-01-01' })))
      .toThrow(/开始日期不能晚于结束日期/)
  })

  it('rejects empty or non-positive list params', () => {
    expect(() => buildFactorBacktestPayload(validState({ horizons: '' }))).toThrow(/horizons/)
    expect(() => buildFactorBacktestPayload(validState({ horizons: '0,5' }))).toThrow(/horizons/)
    expect(() => buildFactorBacktestPayload(validState({ top_k: 'abc' }))).toThrow(/Top K/)
  })

  it('rejects a universe too thin to fill the quantile buckets', () => {
    expect(() => buildFactorBacktestPayload(validState({ min_names: '4', quantiles: '5' })))
      .toThrow(/无法填满 5 个分位桶/)
  })
})

describe('formStateFromJob', () => {
  const fallback = { name: '因子回测', index_code: 'csi1000', horizons: '1,5', factor_set: 'alpha8' }

  it('turns stored compact dates back into date-input values', () => {
    const state = formStateFromJob({ params: { start_date: '20230104', end_date: '20231229' } }, fallback)
    expect(state.start_date).toBe('2023-01-04')
    expect(state.end_date).toBe('2023-12-29')
  })

  it('carries the factor picks and list params over as editable text', () => {
    const state = formStateFromJob({
      name: '沪深300 alpha8',
      params: { factors: ['alpha1', 'alpha2'], horizons: [1, 5, 10], top_k: [20], index_code: 'hs300' },
    }, fallback)
    expect(state.name).toBe('沪深300 alpha8 重跑')
    expect(state.factors).toEqual(['alpha1', 'alpha2'])
    expect(state.horizons).toBe('1,5,10')
    expect(state.top_k).toBe('20')
    expect(state.index_code).toBe('hs300')
  })

  it('falls back for params the job does not carry', () => {
    const state = formStateFromJob({}, fallback)
    expect(state.horizons).toBe('1,5')
    expect(state.factors).toEqual([])
    expect(state.screen_horizon).toBe('')
  })
})

describe('dateInputValue', () => {
  it('only formats a full eight-digit date', () => {
    expect(dateInputValue('20230101')).toBe('2023-01-01')
    expect(dateInputValue('2023-01-01')).toBe('2023-01-01')
    expect(dateInputValue('202301')).toBe('')
    expect(dateInputValue(null)).toBe('')
  })
})
