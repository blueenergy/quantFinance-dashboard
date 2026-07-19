import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import request from '../../utils/request'
import { useChartWorkspace } from '../useChartWorkspace.js'

vi.mock('../../utils/request', () => ({
  default: vi.fn(),
}))

describe('useChartWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      getItem: (key) => (key === 'access_token' ? 'token' : null),
    })
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      json: () => Promise.resolve({ data: [] }),
    })))
  })

  it('keeps chart symbols independent from loaded watchlist data', async () => {
    request.mockImplementation((config) => {
      const url = config.url
      if (url === '/user/watchlist-stocks') {
        return Promise.resolve({
          success: true,
          data: [{ symbol: '000001.SZ' }],
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
})
