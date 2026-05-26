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

  it('passes through price base/latest for return-since column', () => {
    const rankings = [
      {
        symbol: '000001.SZ',
        composite_score: { balanced: 70 },
        score_date: '20250920',
        return_since_score_pct: 1.5,
        price_base_trade_date: '20250918',
        price_latest_trade_date: '20251001',
        prior_3m_return_pct: 12.5,
        prior_3m_base_trade_date: '20250620',
        prior_3m_end_trade_date: '20250920',
      },
    ]
    const rows = computeDisplayRows({
      rankings,
      viewMode: 'ranking',
      selectedDates: [],
      rankingStrategy: 'balanced',
      perStockStrategies: {},
      getCompositeScore,
    })
    expect(rows[0].display_price_base_trade_date).toBe('20250918')
    expect(rows[0].display_price_latest_trade_date).toBe('20251001')
    expect(rows[0].display_prior_3m_return_pct).toBe(12.5)
    expect(rows[0].display_prior_3m_base_trade_date).toBe('20250620')
    expect(rows[0].display_prior_3m_end_trade_date).toBe('20250920')
  })

  it('flattens per_date_return_since price dates in selected mode', () => {
    const rankings = [
      {
        symbol: 'AAA',
        composite_score: { balanced: 80 },
        per_date_scores: { '20250918': { balanced: 82 } },
        per_date_return_since: {
          '20250918': {
            return_since_score_pct: 2,
            price_base_trade_date: '20250910',
            price_latest_trade_date: '20250925',
          },
        },
        per_date_prior_3m_return: {
          '20250918': {
            prior_3m_return_pct: 8,
            prior_3m_base_trade_date: '20250618',
            prior_3m_end_trade_date: '20250918',
          },
        },
      },
    ]
    const rows = computeDisplayRows({
      rankings,
      viewMode: 'selected',
      selectedDates: ['20250918'],
      rankingStrategy: 'balanced',
      perStockStrategies: {},
      getCompositeScore,
    })
    expect(rows[0].display_price_base_trade_date).toBe('20250910')
    expect(rows[0].display_price_latest_trade_date).toBe('20250925')
    expect(rows[0].display_prior_3m_return_pct).toBe(8)
    expect(rows[0].display_prior_3m_base_trade_date).toBe('20250618')
    expect(rows[0].display_prior_3m_end_trade_date).toBe('20250918')
  })
})
