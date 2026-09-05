import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import request from '../../utils/request'
import { buildRecordsUrl, normalizeChartNavSymbols, useChartWorkspace } from '../useChartWorkspace.js'

vi.mock('../../utils/request', () => ({
  default: vi.fn(),
}))

describe('useChartWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key === 'access_token' ? 'token' : null),
      setItem: vi.fn(),
    })
    vi.stubGlobal('window', { currentSourceInfo: null })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ data: [] }),
    })))
    request.mockImplementation((config) => {
      const url = String(config?.url || '')
      if (url.startsWith('/records/')) return Promise.resolve([])
      if (url.startsWith('/strategy-pool/trade-history')) {
        return Promise.resolve({ success: true, data: { trades: [] } })
      }
      if (url === '/money-flow-records') return Promise.resolve({ data: [] })
      return Promise.resolve({})
    })
  })

  it('keeps chart symbols independent from loaded watchlist data', async () => {
    request.mockImplementation((config) => {
      const url = config.url
      if (url === '/user/watchlist') {
        return Promise.resolve({
          success: true,
          data: { symbols: ['000001.SZ'] },
        })
      }
      if (String(url).startsWith('/records/')) {
        return Promise.resolve([])
      }
      if (String(url).startsWith('/strategy-pool/trade-history')) {
        return Promise.resolve({ success: true, data: { trades: [] } })
      }
      return Promise.resolve({})
    })

    const activeTab = ref('chart')
    const workspace = useChartWorkspace({
      activeTab,
      isAuthenticated: ref(true),
      switchTab: (tab) => {
        activeTab.value = tab
      },
    })

    workspace.chartSymbols.value = ['688766.SH']
    workspace.currentIndex.value = 0
    await nextTick()

    await workspace.loadAppChartWatchlist()

    expect(workspace.chartSymbol.value).toBe('688766.SH')
    expect(workspace.chartSymbols.value).toEqual(['688766.SH'])
    expect(workspace.watchlist.value).toEqual(['000001.SZ'])
    expect(workspace.currentIndex.value).toBe(0)
  })

  it('does not load watchlist data when entering the chart tab', async () => {
    request.mockResolvedValue({ success: true, data: [] })

    const activeTab = ref('')
    useChartWorkspace({
      activeTab,
      isAuthenticated: ref(true),
      switchTab: (tab) => {
        activeTab.value = tab
      },
    })

    activeTab.value = 'chart'
    await nextTick()

    expect(request).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: '/user/watchlist-stocks' }),
    )
  })

  it('seeds chart navigation from provided watchlist symbols so prev/next work', async () => {
    const activeTab = ref('watchlist')
    const workspace = useChartWorkspace({
      activeTab,
      isAuthenticated: ref(true),
      switchTab: (tab) => {
        activeTab.value = tab
      },
    })

    await workspace.selectStockForChart({
      symbol: '600519.SH',
      symbols: ['000001.SZ', '600519.SH', '300750.SZ'],
    })

    expect(workspace.chartSymbols.value).toEqual(['000001.SZ', '600519.SH', '300750.SZ'])
    expect(workspace.currentIndex.value).toBe(1)
    expect(workspace.hasPrev.value).toBe(true)
    expect(workspace.hasNext.value).toBe(true)
    expect(activeTab.value).toBe('chart')

    workspace.nextStock()
    expect(workspace.chartSymbol.value).toBe('300750.SZ')
    expect(workspace.hasNext.value).toBe(false)

    workspace.prevStock()
    workspace.prevStock()
    expect(workspace.chartSymbol.value).toBe('000001.SZ')
    expect(workspace.hasPrev.value).toBe(false)
  })

  it('falls back to the loaded watchlist when opening a chart from the watchlist tab', async () => {
    const activeTab = ref('watchlist')
    const workspace = useChartWorkspace({
      activeTab,
      isAuthenticated: ref(true),
      switchTab: (tab) => {
        activeTab.value = tab
      },
    })
    workspace.watchlist.value = ['000001.SZ', '600519.SH']

    await workspace.selectStockForChart('000001.SZ')

    expect(workspace.chartSymbols.value).toEqual(['000001.SZ', '600519.SH'])
    expect(workspace.currentIndex.value).toBe(0)
    expect(workspace.hasNext.value).toBe(true)
  })

  it('does not replace chart symbols when opening a ranking/deep-link symbol', async () => {
    const activeTab = ref('ranking')
    const workspace = useChartWorkspace({
      activeTab,
      isAuthenticated: ref(true),
      switchTab: (tab) => {
        activeTab.value = tab
      },
    })
    workspace.watchlist.value = ['000001.SZ', '600519.SH']

    await workspace.selectStockForChart('688766.SH')

    expect(workspace.chartSymbols.value).toEqual(['688766.SH'])
    expect(workspace.hasPrev.value).toBe(false)
    expect(workspace.hasNext.value).toBe(false)
  })

  it('dedupes chart navigation symbols', () => {
    expect(normalizeChartNavSymbols(['000001.SZ', ' 000001.SZ ', '', '600519.SH', 12]))
      .toEqual(['000001.SZ', '600519.SH'])
  })

  it('builds /records/ URLs with the selected adjust mode', () => {
    expect(buildRecordsUrl({
      symbol: '600519.SH',
      limit: 500,
      startDate: '20260101',
      endDate: '20260904',
      adjust: 'qfq',
    })).toContain('adjust=qfq')
    expect(buildRecordsUrl({
      symbol: '600519.SH',
      limit: 500,
      adjust: 'hfq',
    })).toContain('adjust=hfq')
    expect(buildRecordsUrl({
      symbol: '600519.SH',
      limit: 500,
      includeScores: false,
    })).toContain('include_scores=false')
    expect(buildRecordsUrl({
      symbol: '600519.SH',
      limit: 500,
    })).not.toContain('include_scores')
  })

  it('reloads kline with the chosen adjust mode', async () => {
    request.mockImplementation((config) => {
      if (String(config.url).startsWith('/records/')) return Promise.resolve([])
      if (String(config.url).startsWith('/strategy-pool/trade-history')) {
        return Promise.resolve({ success: true, data: { trades: [] } })
      }
      return Promise.resolve({ data: [] })
    })

    const workspace = useChartWorkspace({
      activeTab: ref('chart'),
      isAuthenticated: ref(true),
      switchTab: vi.fn(),
    })
    workspace.chartSymbols.value = ['600519.SH']
    workspace.currentIndex.value = 0
    await nextTick()
    await Promise.resolve()

    const qfqCalls = request.mock.calls.filter(([config]) => String(config.url).includes('adjust=qfq'))
    expect(qfqCalls.length).toBeGreaterThan(0)

    workspace.setPriceAdjust('none')
    await nextTick()
    await Promise.resolve()
    expect(request.mock.calls.some(([config]) => String(config.url).includes('adjust=none'))).toBe(true)
  })

  function recordSymbolsRequested() {
    return request.mock.calls
      .map(([config]) => String(config?.url || ''))
      .filter((url) => url.startsWith('/records/'))
      .map((url) => new URLSearchParams(url.split('?')[1] || '').get('symbol'))
      .filter(Boolean)
  }

  it('paints kline without waiting on money-flow or trade-history', async () => {
    request.mockImplementation((config) => {
      const url = String(config?.url || '')
      if (url.startsWith('/records/')) {
        return Promise.resolve([
          { symbol: '600519.SH', name: '贵州茅台', trade_date: '20260904', close: 1400 },
        ])
      }
      if (url.includes('money-flow') || url.includes('trade-history')) {
        return new Promise(() => {})
      }
      return Promise.resolve({})
    })

    const workspace = useChartWorkspace({
      activeTab: ref('chart'),
      isAuthenticated: ref(true),
      switchTab: vi.fn(),
    })
    workspace.chartSymbols.value = ['600519.SH']
    workspace.currentIndex.value = 0

    await vi.waitFor(() => {
      expect(workspace.chartRecords.value[0]?.symbol).toBe('600519.SH')
    })
    expect(workspace.stockName.value).toBe('贵州茅台')
    expect(workspace.chartLoading.value).toBe(false)
    expect(request.mock.calls.some(([config]) => String(config.url).includes('money-flow'))).toBe(false)
    expect(request.mock.calls.some(([config]) => String(config.url).includes('trade-history'))).toBe(false)
    expect(request.mock.calls.some(([config]) => String(config.url).includes('include_scores=false'))).toBe(true)
  })

  it('prefetches neighboring watchlist kline after opening a chart', async () => {
    request.mockImplementation((config) => {
      const url = String(config?.url || '')
      if (url.startsWith('/records/')) {
        const symbol = new URLSearchParams(url.split('?')[1] || '').get('symbol')
        return Promise.resolve([{ symbol, trade_date: '20260904', close: 1 }])
      }
      return Promise.resolve({})
    })

    const activeTab = ref('watchlist')
    const workspace = useChartWorkspace({
      activeTab,
      isAuthenticated: ref(true),
      switchTab: (tab) => {
        activeTab.value = tab
      },
    })

    await workspace.selectStockForChart({
      symbol: '600519.SH',
      symbols: ['000001.SZ', '600519.SH', '300750.SZ'],
    })

    await vi.waitFor(() => {
      expect(workspace.chartRecords.value[0]?.symbol).toBe('600519.SH')
      expect(new Set(recordSymbolsRequested())).toEqual(new Set(['000001.SZ', '600519.SH', '300750.SZ']))
    })
  })

  it('reuses cached kline when flipping back to a previous stock', async () => {
    request.mockImplementation((config) => {
      const url = String(config?.url || '')
      if (url.startsWith('/records/')) {
        const symbol = new URLSearchParams(url.split('?')[1] || '').get('symbol')
        return Promise.resolve([{ symbol, trade_date: '20260904', close: 1 }])
      }
      return Promise.resolve({})
    })

    const activeTab = ref('watchlist')
    const workspace = useChartWorkspace({
      activeTab,
      isAuthenticated: ref(true),
      switchTab: (tab) => {
        activeTab.value = tab
      },
    })

    await workspace.selectStockForChart({
      symbol: '000001.SZ',
      symbols: ['000001.SZ', '600519.SH'],
    })
    await vi.waitFor(() => {
      expect(workspace.chartRecords.value[0]?.symbol).toBe('000001.SZ')
      expect(new Set(recordSymbolsRequested())).toEqual(new Set(['000001.SZ', '600519.SH']))
    })
    await Promise.resolve()
    await Promise.resolve()

    const callsAfterPrefetch = request.mock.calls.length
    workspace.nextStock()
    expect(workspace.chartSymbol.value).toBe('600519.SH')
    expect(workspace.chartRecords.value[0]?.symbol).toBe('600519.SH')
    workspace.prevStock()
    expect(workspace.chartSymbol.value).toBe('000001.SZ')
    expect(workspace.chartRecords.value[0]?.symbol).toBe('000001.SZ')
    expect(request.mock.calls.length).toBe(callsAfterPrefetch)
  })

  it('ignores stale kline responses after switching stocks', async () => {
    let releaseFirst
    const first = new Promise((resolve) => {
      releaseFirst = resolve
    })
    request.mockImplementation((config) => {
      const url = String(config?.url || '')
      if (!url.startsWith('/records/')) return Promise.resolve({})
      const symbol = new URLSearchParams(url.split('?')[1] || '').get('symbol')
      if (symbol === 'AAA.SZ') {
        return first.then(() => [{ symbol: 'AAA.SZ', trade_date: '20260101', close: 1 }])
      }
      return Promise.resolve([{ symbol, trade_date: '20260102', close: 2 }])
    })

    const workspace = useChartWorkspace({
      activeTab: ref('chart'),
      isAuthenticated: ref(true),
      switchTab: vi.fn(),
    })
    workspace.chartSymbols.value = ['AAA.SZ', 'BBB.SZ']
    workspace.currentIndex.value = 0
    await nextTick()

    workspace.nextStock()
    await vi.waitFor(() => {
      expect(workspace.chartRecords.value[0]?.symbol).toBe('BBB.SZ')
    })

    releaseFirst()
    await Promise.resolve()
    await Promise.resolve()
    expect(workspace.chartRecords.value[0]?.symbol).toBe('BBB.SZ')
  })
})
