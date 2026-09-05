/**
 * A-share listed prices: stocks tick 0.01 (2 dp), ETFs tick 0.001 (3 dp).
 */

export const STOCK_PRICE_DIGITS = 2
export const ETF_PRICE_DIGITS = 3

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
