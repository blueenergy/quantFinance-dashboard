import { describe, expect, it } from 'vitest'
import {
  ETF_PRICE_DIGITS,
  STOCK_PRICE_DIGITS,
  assetTypeForPosition,
  assetTypeForSymbol,
  formatAssetChange,
  formatAssetPrice,
  priceDigitsForAsset,
} from '../assetPriceFormat.js'

describe('assetPriceFormat', () => {
  it('uses 3 decimals for ETF prices and 2 for stocks', () => {
    expect(priceDigitsForAsset('etf')).toBe(ETF_PRICE_DIGITS)
    expect(priceDigitsForAsset('stock')).toBe(STOCK_PRICE_DIGITS)
    expect(formatAssetPrice(1.234, 'etf')).toBe('1.234')
    expect(formatAssetPrice(10.5, 'stock')).toBe('10.50')
    expect(formatAssetPrice(null, 'etf')).toBe('-')
  })

  it('keeps the signed change amount on the same tick size', () => {
    expect(formatAssetChange(0.005, 'etf')).toBe('+0.005')
    expect(formatAssetChange(-0.012, 'etf')).toBe('-0.012')
    expect(formatAssetChange(0.12, 'stock')).toBe('+0.12')
  })

  it('identifies ETFs from symbols, with or without an exchange suffix', () => {
    expect(assetTypeForSymbol('510300.SH')).toBe('etf')
    expect(assetTypeForSymbol('513260.SH')).toBe('etf')
    expect(assetTypeForSymbol('159766.SZ')).toBe('etf')
    expect(assetTypeForSymbol('510300')).toBe('etf')
    expect(assetTypeForSymbol('159766')).toBe('etf')
    expect(assetTypeForSymbol('600114.SH')).toBe('stock')
    expect(assetTypeForSymbol('000951.SZ')).toBe('stock')
    expect(assetTypeForSymbol('02016.HK')).toBe('stock')
  })

  it('prefers instrument_type on position rows but falls back to the symbol', () => {
    expect(assetTypeForPosition({ instrument_type: 'etf', symbol: '600114.SH' })).toBe('etf')
    expect(assetTypeForPosition({ instrument_type: 'stock', symbol: '510300.SH' })).toBe('stock')
    expect(assetTypeForPosition({ symbol: '510300.SH' })).toBe('etf')
    expect(assetTypeForPosition({ symbol: '159847.SZ' })).toBe('etf')
    expect(assetTypeForPosition({ symbol: '600114.SH' })).toBe('stock')
  })
})
