import { describe, it, expect } from 'vitest'
import { getCompositeScore, formatDateDisplay, generateCSV, deduplicateStocksByLatestDate } from '../scoreUtils.js'

describe('scoreUtils', () => {
  describe('getCompositeScore', () => {
    it('returns 0 for null stock', () => {
      expect(getCompositeScore(null, 'balanced')).toBe(0)
    })

    it('returns number when composite_score is number', () => {
      const s = { composite_score: 85 }
      expect(getCompositeScore(s, 'balanced')).toBe(85)
    })

    it('returns correct strategy value when composite_score is object', () => {
      const s = { composite_score: { balanced: 80, aggressive: 82 } }
      expect(getCompositeScore(s, 'aggressive')).toBe(82)
      expect(getCompositeScore(s, 'nonexistent')).toBe(0)
    })
  })

  describe('formatDateDisplay', () => {
    it('formats yyyyMMdd correctly', () => {
      expect(formatDateDisplay('20250919')).toBe('2025-09-19')
    })
    it('formats ISO date correctly', () => {
      expect(formatDateDisplay('2025-09-19T12:00:00Z')).toBe('2025-09-19')
    })
  })

  describe('deduplicateStocksByLatestDate', () => {
    it('returns empty for empty input', () => {
      expect(deduplicateStocksByLatestDate([])).toEqual([])
    })

    it('keeps latest by score_date', () => {
      const stocks = [
        { symbol: 'AAA', score_date: '20250917' },
        { symbol: 'AAA', score_date: '20250918' },
        { symbol: 'BBB', score_date: '20250916' }
      ]
      const dedup = deduplicateStocksByLatestDate(stocks)
      expect(dedup.length).toBe(2)
      const a = dedup.find(s => s.symbol === 'AAA')
      expect(a.score_date).toBe('20250918')
    })
  })

  describe('generateCSV', () => {
    it('generates CSV with per-date columns', () => {
      const data = [
        { symbol: 'AAA', name: 'A Corp', per_date_scores: { '20250918': { balanced: 80 } } },
      ]
      const csv = generateCSV(data, ['20250918'], (sym) => 'balanced', getCompositeScore)
      expect(csv).toContain('总分(2025-09-18)')
      expect(csv).toContain('80')
    })
  })
})
