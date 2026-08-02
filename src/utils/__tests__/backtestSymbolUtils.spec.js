import { describe, expect, it } from 'vitest'
import {
  inferAssetTypeFromSymbol,
  normalizeBacktestSymbol,
  formatBacktestDateYmd,
} from '../backtestSymbolUtils.js'

describe('inferAssetTypeFromSymbol', () => {
  it('treats ChiNext stock codes as stock', () => {
    expect(inferAssetTypeFromSymbol('300196.SZ', 'etf')).toBe('stock')
    expect(inferAssetTypeFromSymbol('000858.SZ', 'etf')).toBe('stock')
  })

  it('treats ETF codes as etf', () => {
    expect(inferAssetTypeFromSymbol('510300.SH', 'stock')).toBe('etf')
    expect(inferAssetTypeFromSymbol('159949.SZ', 'stock')).toBe('etf')
  })
})

describe('normalizeBacktestSymbol', () => {
  it('adds exchange suffix for bare stock codes', () => {
    expect(normalizeBacktestSymbol('300196', 'stock')).toBe('300196.SZ')
    expect(normalizeBacktestSymbol('600000', 'stock')).toBe('600000.SH')
  })
})

describe('formatBacktestDateYmd', () => {
  it('uses local calendar date', () => {
    const d = new Date(2026, 7, 2, 15, 0, 0)
    expect(formatBacktestDateYmd(d)).toBe('20260802')
  })
})
