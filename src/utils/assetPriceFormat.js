/**
 * A-share listed prices: stocks tick 0.01 (2 dp), ETFs tick 0.001 (3 dp).
 */

import { inferAssetTypeFromSymbol } from './backtestSymbolUtils.js'

export const STOCK_PRICE_DIGITS = 2
export const ETF_PRICE_DIGITS = 3

/**
 * Identify tick size from a symbol alone. Bare ETF codes (no exchange suffix)
 * need the prefix hint, otherwise ``inferAssetTypeFromSymbol`` defaults to stock.
 */
export function assetTypeForSymbol(symbol) {
  const bare = String(symbol || '').trim().toUpperCase().split('.')[0]
  const preferred = /^(5|15|16)/.test(bare) ? 'etf' : 'stock'
  return inferAssetTypeFromSymbol(symbol, preferred)
}

/**
 * Identify tick size for a trader position row. ``instrument_type`` is
 * authoritative when the API provides it; otherwise fall back to the symbol
 * prefix (SH 51/56/58, SZ 15/16).
 */
export function assetTypeForPosition(row = {}) {
  const declared = String(row.instrument_type || row.asset_type || '').trim().toLowerCase()
  if (declared === 'etf') return 'etf'
  if (declared === 'stock' || declared === 'hk_stock') return 'stock'
  return assetTypeForSymbol(row.symbol)
}

export function priceDigitsForAsset(assetType) {
  return String(assetType || '').toLowerCase() === 'etf'
    ? ETF_PRICE_DIGITS
    : STOCK_PRICE_DIGITS
}

export function formatAssetPrice(value, assetType) {
  if (value === undefined || value === null || value === '') return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n.toFixed(priceDigitsForAsset(assetType))
}

export function formatAssetChange(value, assetType) {
  if (value === undefined || value === null || value === '') return '-'
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const text = n.toFixed(priceDigitsForAsset(assetType))
  return n >= 0 ? `+${text}` : text
}
