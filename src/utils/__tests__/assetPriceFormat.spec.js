import { describe, expect, it } from 'vitest'
import {
  ETF_PRICE_DIGITS,
  STOCK_PRICE_DIGITS,
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
})
