import { describe, expect, it } from 'vitest'
import {
  coverageLabel,
  filterAcceptedModels,
  formatRankDelta,
  groupModelsByUniverse,
  pickDefaultModels,
  rankDeltaClass,
  sharedTradeDates,
} from '../modelScoresView'

const CATALOG = [
  {
    model_id: 'research-csi1000-clean-raw5',
    index_code: 'csi1000',
    accepted: true,
    accepted_reasons: ['live', 'shadow'],
    shadow: true,
    recent: true,
    last_trade_date: '20261113',
    recent_trade_dates: ['20261113', '20261112', '20261111'],
    date_count: 133,
    first_trade_date: '20160413',
  },
  {
    model_id: 'promo-csi1000-e243b409',
    index_code: 'csi1000',
    accepted: true,
    accepted_reasons: ['shadow'],
    shadow: true,
    recent: true,
    last_trade_date: '20261113',
    recent_trade_dates: ['20261113', '20261112'],
    date_count: 5,
    first_trade_date: '20261106',
  },
  {
    model_id: 'promo-hs300-b7618410',
    index_code: 'hs300',
    accepted: true,
    accepted_reasons: ['shadow'],
    shadow: true,
    recent: true,
    last_trade_date: '20261113',
    recent_trade_dates: ['20261113'],
    date_count: 20,
  },
  {
    model_id: 'research-rolling60-hs300',
    index_code: 'hs300',
    accepted: false,
    accepted_reasons: [],
    shadow: false,
    recent: false,
    last_trade_date: '20241119',
    recent_trade_dates: ['20241119'],
    date_count: 93,
  },
]

describe('filterAcceptedModels', () => {
  const VALIDATED = {
    model_id: 'research-csi1000-clean-raw5-oos2025',
    index_code: 'csi1000',
    accepted: false,
    validated: true,
    state: 'validated',
    shadow: false,
    recent: true,
    last_trade_date: '20261113',
    recent_trade_dates: ['20261113'],
    date_count: 451,
  }

  it('drops raw research and only admits validated on request', () => {
    expect(filterAcceptedModels(CATALOG).map((model) => model.model_id)).toEqual([
      'research-csi1000-clean-raw5',
      'promo-csi1000-e243b409',
      'promo-hs300-b7618410',
    ])
    const withValidated = filterAcceptedModels([...CATALOG, VALIDATED], true)
      .map((model) => model.model_id)
    expect(withValidated).toEqual([
      'research-csi1000-clean-raw5',
      'promo-csi1000-e243b409',
      'promo-hs300-b7618410',
      'research-csi1000-clean-raw5-oos2025',
    ])
    expect(withValidated).not.toContain('research-rolling60-hs300')
  })
})

describe('groupModelsByUniverse', () => {
  it('groups by universe and keeps recent models first', () => {
    const groups = groupModelsByUniverse(CATALOG)
    expect(groups.map((group) => group.indexCode)).toEqual(['csi1000', 'hs300'])
    const hs300 = groups.find((group) => group.indexCode === 'hs300')
    expect(hs300.models[0].model_id).toBe('promo-hs300-b7618410')
    expect(hs300.label).toBe('沪深300')
  })
})

describe('pickDefaultModels', () => {
  it('picks the live model plus its newest sibling in the same universe', () => {
    expect(pickDefaultModels(CATALOG)).toEqual([
      'research-csi1000-clean-raw5',
      'promo-csi1000-e243b409',
    ])
  })

  it('falls back to a single model when the universe has one', () => {
    const only = CATALOG.filter((model) => model.model_id === 'promo-hs300-b7618410')
    expect(pickDefaultModels(only)).toEqual(['promo-hs300-b7618410'])
  })

  it('returns nothing when no model is recent', () => {
    expect(pickDefaultModels([CATALOG[3]])).toEqual([])
  })
})

describe('sharedTradeDates', () => {
  it('returns dates covered by every selected model, newest first', () => {
    expect(sharedTradeDates(CATALOG, ['research-csi1000-clean-raw5', 'promo-csi1000-e243b409'])).toEqual([
      '20261113',
      '20261112',
    ])
  })
})

describe('rank formatting', () => {
  it('formats deltas with direction', () => {
    expect(formatRankDelta(3)).toBe('+3')
    expect(formatRankDelta(-2)).toBe('-2')
    expect(formatRankDelta(0)).toBe('0')
    expect(formatRankDelta(null)).toBe('-')
    expect(rankDeltaClass(3)).toBe('rank-up')
    expect(rankDeltaClass(-2)).toBe('rank-down')
  })

  it('formats coverage', () => {
    expect(coverageLabel({ date_count: 0 })).toBe('无数据')
    expect(coverageLabel(CATALOG[1])).toBe('5 日 · 20261106~20261113')
  })
})
