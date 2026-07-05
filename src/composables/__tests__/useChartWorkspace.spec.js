import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import axios from 'axios'
import { useChartWorkspace } from '../useChartWorkspace.js'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
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
    axios.get.mockImplementation((url) => {
      if (url === '/api/user/watchlist-stocks') {
        return Promise.resolve({
          data: {
            success: true,
            data: [{ symbol: '000001.SZ' }],
          },
        })
      }
      if (String(url).startsWith('/api/records/')) {
        return Promise.resolve({ data: [] })
      }
      if (String(url).startsWith('/api/strategy-pool/trade-history')) {
        return Promise.resolve({ data: { success: true, data: { trades: [] } } })
      }
      return Promise.resolve({ data: {} })
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
    axios.get.mockResolvedValue({ data: { success: true, data: [] } })

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

    expect(axios.get).not.toHaveBeenCalledWith(
      '/api/user/watchlist-stocks',
      expect.anything()
    )
  })
})
