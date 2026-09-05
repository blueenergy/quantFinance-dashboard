import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const requestMock = vi.fn()
const requestGetMock = vi.fn()

vi.mock('../src/utils/request', () => {
  const fn = (...args) => requestMock(...args)
  fn.get = (...args) => requestGetMock(...args)
  return { default: fn }
})

vi.mock('../src/services/auth.js', async () => {
  const { ref } = await import('vue')
  return {
    useAuth: () => ({
      isAuthenticated: ref(true),
      user: ref({ username: 'alice', id: 'u1' }),
    }),
  }
})

import WatchListData from '../src/components/WatchListData.vue'
import { watchlistService } from '../src/services/watchlist.js'

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function mountWatchlist() {
  return mount(WatchListData, {
    global: {
      stubs: {
        StockSearchInput: true,
        HistoryAnalysis: true,
        'v-snackbar': true,
      },
    },
  })
}

describe('WatchListData first paint', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestGetMock.mockReset()
    sessionStorage.clear()
    localStorage.removeItem('watchList')
    watchlistService.clearSessionSnapshot()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading instead of empty copy while realtime fetch is in flight', async () => {
    const pending = deferred()
    requestMock.mockImplementation((config) => {
      if (config?.url === '/user/watchlist-stocks/realtime') return pending.promise
      return Promise.resolve({ success: true, data: [] })
    })

    const wrapper = mountWatchlist()
    await nextTick()

    expect(wrapper.text()).toContain('自选股加载中')
    expect(wrapper.text()).not.toContain('暂无自选股')
    expect(requestMock.mock.calls.some((call) => call[0]?.url === '/user/watchlist')).toBe(false)

    pending.resolve({
      success: true,
      data: [{
        symbol: '000001.SZ',
        name: '平安银行',
        asset_type: 'stock',
        price: 10.5,
        change: 0.5,
        change_pct: 5,
        volume: 1000,
      }],
    })
    await flushPromises()

    expect(wrapper.text()).toContain('平安银行')
    expect(wrapper.text()).not.toContain('暂无自选股')
    expect(wrapper.text()).not.toContain('自选股加载中')
    wrapper.unmount()
  })

  it('hydrates the last snapshot so the table appears before realtime returns', async () => {
    watchlistService.setSessionSnapshot('alice', {
      symbols: ['000001.SZ'],
      stocks: [{
        symbol: '000001.SZ',
        name: '平安银行',
        asset_type: 'stock',
        price: 10.1,
        change: 0.1,
        change_pct: 1,
        volume: 1,
      }],
    })
    const pending = deferred()
    requestMock.mockImplementation((config) => {
      if (config?.url === '/user/watchlist-stocks/realtime') return pending.promise
      return Promise.resolve({ success: true, data: [] })
    })

    const wrapper = mountWatchlist()
    await nextTick()

    expect(wrapper.text()).toContain('平安银行')
    expect(wrapper.text()).not.toContain('暂无自选股')
    expect(wrapper.text()).not.toContain('自选股加载中')

    pending.resolve({
      success: true,
      data: [{
        symbol: '000001.SZ',
        name: '平安银行',
        asset_type: 'stock',
        price: 10.8,
        change: 0.8,
        change_pct: 8,
        volume: 2000,
      }],
    })
    await flushPromises()
    expect(wrapper.text()).toContain('10.80')
    wrapper.unmount()
  })

  it('shows empty copy only after a completed load with no symbols', async () => {
    requestMock.mockImplementation((config) => {
      if (config?.url === '/user/watchlist-stocks/realtime') {
        return Promise.resolve({ success: true, data: [] })
      }
      return Promise.resolve({ success: true, data: [] })
    })

    const wrapper = mountWatchlist()
    await flushPromises()

    expect(wrapper.text()).toContain('暂无自选股，请添加股票代码')
    expect(wrapper.text()).not.toContain('自选股加载中')
    wrapper.unmount()
  })

  it('keeps a long ETF name in the name cell with a full-name title', async () => {
    requestMock.mockImplementation((config) => {
      if (config?.url === '/user/watchlist-stocks/realtime') {
        return Promise.resolve({
          success: true,
          data: [{
            symbol: '159967.SZ',
            name: '创金合信中证红利低波动ETF',
            asset_type: 'etf',
            price: 1.234,
            change: 0.005,
            change_pct: 0.41,
            volume: 1000,
          }],
        })
      }
      return Promise.resolve({ success: true, data: [] })
    })

    const wrapper = mountWatchlist()
    await flushPromises()

    const name = wrapper.get('.stock-name-text')
    expect(name.text()).toBe('创金合信中证红利低波动ETF')
    expect(name.attributes('title')).toBe('创金合信中证红利低波动ETF')
    expect(wrapper.get('.price').text()).toBe('1.234')
    wrapper.unmount()
  })

  it('uses tone on-light for the add-stock input on the light surface card', async () => {
    requestMock.mockResolvedValue({ success: true, data: [] })
    const wrapper = mount(WatchListData, {
      global: {
        stubs: {
          StockSearchInput: {
            name: 'StockSearchInput',
            props: ['tone', 'theme', 'bgColor', 'color', 'baseColor', 'inputClass', 'density'],
            template: '<div class="stock-search-stub" />',
          },
          HistoryAnalysis: true,
          'v-snackbar': true,
        },
      },
    })
    await nextTick()

    const input = wrapper.findComponent({ name: 'StockSearchInput' })
    expect(input.props('tone')).toBe('on-light')
    expect(input.props('theme')).toBeUndefined()
    expect(input.props('color')).toBeUndefined()
    expect(input.props('baseColor')).toBeUndefined()
    expect(input.props('bgColor')).toBeUndefined()
    expect(input.props('density')).toBe('comfortable')
    expect(input.props('inputClass')).toBeFalsy()
    wrapper.unmount()
  })
})
