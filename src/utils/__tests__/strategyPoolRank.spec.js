import { describe, expect, it } from 'vitest'
import {
  comparePoolStocks,
  isPoolTopRow,
  poolTableRange,
  rankPoolStocks,
  rankingCaption,
  shiftYyyymmdd,
} from '../strategyPoolRank'

describe('strategyPoolRank', () => {
  it('ranks k_regime by sharpe then path return then newer date', () => {
    const ranked = rankPoolStocks(
      [
        { symbol: 'A', date: '20260820', hist_sharpe_ratio: 0.4, hist_return: 2 },
        { symbol: 'B', date: '20260821', hist_sharpe_ratio: 0.8, hist_return: 0.1 },
        { symbol: 'C', date: '20260822', hist_sharpe_ratio: 0.8, hist_return: 0.5 },
        { symbol: 'D', date: '20260810', hist_sharpe_ratio: 0.8, hist_return: 0.5 },
      ],
      'k_regime',
    )
    expect(ranked.map((row) => row.symbol)).toEqual(['C', 'D', 'B', 'A'])
    expect(ranked[0].rank).toBe(1)
    expect(isPoolTopRow(ranked[2])).toBe(true)
    expect(isPoolTopRow(ranked[3])).toBe(false)
  })

  it('ranks morphological strategies by path return without using sharpe', () => {
    const ranked = rankPoolStocks(
      [
        { symbol: 'LOW', date: '20260824', hist_sharpe_ratio: 9, hist_return: 0.03 },
        { symbol: 'HIGH', date: '20260801', hist_sharpe_ratio: 0, hist_return: 0.12 },
      ],
      'hidden_dragon',
    )
    expect(ranked[0].symbol).toBe('HIGH')
    expect(comparePoolStocks(ranked[0], ranked[1], 'hidden_dragon')).toBeLessThan(0)
  })

  it('explains the default ranking in captions', () => {
    expect(rankingCaption('k_regime')).toContain('夏普')
    expect(rankingCaption('turtle')).toContain('路径收益')
  })

  it('builds a 30-day table window from a fixed today', () => {
    expect(shiftYyyymmdd('20260825', -30)).toBe('20260726')
    expect(poolTableRange(30, '20260825')).toEqual({
      startDate: '20260726',
      endDate: '20260825',
    })
  })
})
