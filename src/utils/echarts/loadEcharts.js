let pending = null

export const KLINE_PREFETCH_TABS = new Set([
  'watchlist',
  'chart',
  'stock-workbench',
  'kline-comparison',
  'futures-kline',
  'shenwan-index',
  'etf',
  'strategy-pool',
])

export function loadEcharts() {
  if (!pending) {
    pending = import('echarts').then((mod) => mod.default || mod)
  }
  return pending
}

export function prefetchEcharts() {
  void loadEcharts()
}

export function prefetchEchartsForTab(tabId) {
  if (KLINE_PREFETCH_TABS.has(tabId)) prefetchEcharts()
}

export function resetEchartsLoader() {
  pending = null
}
