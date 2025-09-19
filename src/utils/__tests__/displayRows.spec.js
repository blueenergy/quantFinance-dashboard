import { describe, it, expect } from 'vitest'
import { computeDisplayRows } from '../displayRows.js'
import { getCompositeScore } from '../scoreUtils.js'

describe('computeDisplayRows', () => {
  it('returns one row per stock when not in selected mode', () => {
    const rankings = [ { symbol: 'AAA', composite_score: 80 }, { symbol: 'BBB', composite_score: 75 } ]
    const rows = computeDisplayRows({ rankings, viewMode: 'ranking', selectedDates: [], rankingStrategy: 'balanced', perStockStrategies: {}, getCompositeScore })
    expect(rows.length).toBe(2)
    expect(rows[0].display_composite_score).toBe(80)
  })

  it('flattens multiple dates in selected mode', () => {
    const rankings = [
      { symbol: 'AAA', composite_score: { balanced: 80 }, per_date_scores: { '20250918': { balanced: 82 }, '20250917': { balanced: 79 } } }
    ]
    const rows = computeDisplayRows({ rankings, viewMode: 'selected', selectedDates: ['20250917','20250918'], rankingStrategy: 'balanced', perStockStrategies: {}, getCompositeScore })
    // should produce two rows for AAA, newest first
    expect(rows.length).toBe(2)
    expect(rows[0].display_date).toBe('20250918')
    expect(rows[0].display_composite_score).toBe(82)
    expect(rows[1].display_date).toBe('20250917')
  })

  it('falls back to score_date when per_date_scores missing', () => {
    const rankings = [ { symbol: 'AAA', composite_score: 88, score_date: '20250917' } ]
    const rows = computeDisplayRows({ rankings, viewMode: 'selected', selectedDates: ['20250917'], rankingStrategy: 'balanced', perStockStrategies: {}, getCompositeScore })
    expect(rows.length).toBe(1)
    expect(rows[0].display_composite_score).toBe(88)
  })

  it('uses perStockStrategies override when present', () => {
    const rankings = [ { symbol: 'AAA', composite_score: { balanced: 80, aggressive: 90 }, per_date_scores: { '20250918': { balanced: 81, aggressive: 91 } } } ]
    const rows = computeDisplayRows({ rankings, viewMode: 'selected', selectedDates: ['20250918'], rankingStrategy: 'balanced', perStockStrategies: { AAA: 'aggressive' }, getCompositeScore })
    expect(rows[0].display_composite_score).toBe(91)
  })
})
