/** Compare-form bulk universe shortcuts (frontend expands to symbols). */
export const COMPARE_INDEX_UNIVERSES = [
  { key: 'hs300', label: '沪深300', path: '/index/hs300/constituents', assetType: 'stock' },
  { key: 'csi500', label: '中证500', path: '/index/csi500/constituents', assetType: 'stock' },
  { key: 'csi1000', label: '中证1000', path: '/index/csi1000/constituents', assetType: 'stock' },
  { key: 'a500', label: '中证A500', path: '/index/a500/constituents', assetType: 'stock' },
  { key: 'star50', label: '科创50', path: '/index/star50/constituents', assetType: 'stock' },
]

export function extractSymbolsFromIndexResponse(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows.map((row) => row?.symbol || row?.ts_code || row?.code).filter(Boolean)
}

export function extractSymbolsFromWatchlistResponse(payload) {
  const symbols = payload?.data?.symbols
  if (Array.isArray(symbols)) return symbols.filter(Boolean)
  if (Array.isArray(payload?.symbols)) return payload.symbols.filter(Boolean)
  return []
}

export function extractSymbolsFromEtfListResponse(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  return rows.map((row) => row?.ts_code || row?.symbol || row?.code).filter(Boolean)
}
