import { describe, expect, it } from 'vitest'
import { computeRangeStats } from '../rangeStats.js'

const rows = [
  { trade_date: '20240101', open: 10, high: 11, low: 9.5, close: 10, volume: 100, amount: 1000 },
  { trade_date: '20240102', open: 10, high: 12, low: 10, close: 11, volume: 200, amount: 2000 },
  { trade_date: '20240103', open: 11, high: 13, low: 10.5, close: 12, volume: 300, amount: 3000 },
  { trade_date: '20240104', open: 12, high: 12.5, low: 9, close: 9, volume: 400, amount: 4000 },
]

describe('rangeStats', () => {
  it('computes change, amplitude and totals for a range', () => {
    const stats = computeRangeStats(rows, 0, 2)
    expect(stats).not.toBeNull()
    expect(stats.startDate).toBe('20240101')
    expect(stats.endDate).toBe('20240103')
    expect(stats.startClose).toBe(10)
    expect(stats.endClose).toBe(12)
    expect(stats.change).toBe(2)
    expect(stats.pct).toBeCloseTo(0.2, 6)
    expect(stats.high).toBe(13)
    expect(stats.low).toBe(9.5)
    expect(stats.amplitude).toBeCloseTo((13 - 9.5) / 9.5, 6)
    expect(stats.bars).toBe(3)
    expect(stats.volume).toBe(600)
    expect(stats.amount).toBe(6000)
  })

  it('accepts reversed indices', () => {
    const a = computeRangeStats(rows, 2, 0)
    const b = computeRangeStats(rows, 0, 2)
    expect(a).toEqual(b)
  })

  it('returns null for a single bar or invalid input', () => {
    expect(computeRangeStats(rows, 1, 1)).toBeNull()
    expect(computeRangeStats(rows, 0, 0)).toBeNull()
    expect(computeRangeStats([], 0, 1)).toBeNull()
    expect(computeRangeStats(rows, 'x', 2)).toBeNull()
  })

  it('clamps out-of-range indices', () => {
    const stats = computeRangeStats(rows, -5, 99)
    expect(stats.startIndex).toBe(0)
    expect(stats.endIndex).toBe(3)
    expect(stats.bars).toBe(4)
  })

  it('ignores missing volume/amount values', () => {
    const sparse = [
      { trade_date: '20240101', high: 11, low: 9, close: 10 },
      { trade_date: '20240102', high: 12, low: 10, close: 11 },
    ]
    const stats = computeRangeStats(sparse, 0, 1)
    expect(stats.volume).toBeNull()
    expect(stats.amount).toBeNull()
  })
})
