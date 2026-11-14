import { describe, expect, it } from 'vitest'
import { daysBetween, describeHotStockFreshness } from '../hotStockFreshness'

const RAW = {
  has_data: true,
  trade_date: '20261113',
  rank_time: '2026-11-13 22:30:03',
  stock_count: 193,
}

function shownAnalysis() {
  return { market_sentiment: '偏强', opportunities: [] }
}

describe('daysBetween', () => {
  it('counts calendar days between two trade dates', () => {
    expect(daysBetween('20261113', '20261114')).toBe(1)
    expect(daysBetween('20261030', '20261113')).toBe(14)
    expect(daysBetween('20261113', '20261113')).toBe(0)
  })

  it('returns 0 for missing or malformed dates', () => {
    expect(daysBetween('', '20261113')).toBe(0)
    expect(daysBetween('20261113', '')).toBe(0)
    expect(daysBetween('2026-11-13', '20261113')).toBe(0)
  })
})

describe('describeHotStockFreshness', () => {
  it('returns null when there is no raw data at all', () => {
    expect(describeHotStockFreshness(null, shownAnalysis(), {})).toBeNull()
    expect(describeHotStockFreshness({ has_data: false }, shownAnalysis(), {})).toBeNull()
  })

  it('flags a pending analysis when raw data exists but no analysis does', () => {
    const result = describeHotStockFreshness(RAW, null, {})

    expect(result.type).toBe('info')
    expect(result.badge).toBe('待分析')
    expect(result.text).toContain('20261113')
  })

  it('reports the newest snapshot when the analysis matches it', () => {
    const result = describeHotStockFreshness(RAW, shownAnalysis(), {
      shownRankTime: '2026-11-13 22:30:03',
      shownTradeDate: '20261113',
    })

    expect(result.type).toBe('success')
    expect(result.badge).toBe('数据最新')
  })

  it('warns when the shown analysis predates the newest hot list', () => {
    const result = describeHotStockFreshness(RAW, shownAnalysis(), {
      shownRankTime: '2026-11-12 22:30:33',
      shownTradeDate: '20261112',
    })

    expect(result.type).toBe('warning')
    expect(result.badge).toBe('结论已过时')
    expect(result.text).toContain('2026-11-12 22:30:33')
    expect(result.text).toContain('2026-11-13 22:30:03')
  })

  it('does not warn when the user deliberately opened an older history record', () => {
    const result = describeHotStockFreshness(RAW, shownAnalysis(), {
      shownRankTime: '2026-11-12 22:30:33',
      shownTradeDate: '20261112',
      viewingOldRecord: true,
    })

    expect(result.type).toBe('info')
    expect(result.badge).toBe('历史记录')
  })

  it('warns when the analysis trails the raw trade date', () => {
    const result = describeHotStockFreshness(
      { ...RAW, rank_time: '' },
      shownAnalysis(),
      { shownRankTime: '2026-11-11 22:30:39', shownTradeDate: '20261111' }
    )

    expect(result.type).toBe('warning')
    expect(result.badge).toBe('数据滞后')
    expect(result.text).toContain('2 天')
  })
})
