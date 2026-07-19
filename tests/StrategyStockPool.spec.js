/**
 * Test: Strategy Stock Pool Component
 *
 * Critical bug fixed: When switching strategies, if the selected date exists
 * in both strategies, the stock list was not reloading because the date
 * didn't change, so the watch(selectedDate) wasn't triggered.
 *
 * Fix: Added explicit fetchStocks() call in watch(selectedStrategy)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const requestMock = vi.fn()

vi.mock('../src/utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import StrategyStockPool from '../src/components/StrategyStockPool.vue'

function urlOf(call) {
  const config = call[0]
  return typeof config === 'string' ? config : (config?.url || '')
}

describe('StrategyStockPool', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    requestMock.mockReset()
  })

  it('should reload stocks when strategy changes even if date unchanged', async () => {
    const hiddenDragonDates = ['20260109', '20260108', '20260107']
    const singleYangDates = ['20260109', '20260108', '20260106']

    const hiddenDragonStocks = [
      { symbol: '000001.SZ', name: '平安银行', strategy: 'hidden_dragon', date: '20260109' },
      { symbol: '000002.SZ', name: '万科A', strategy: 'hidden_dragon', date: '20260109' },
    ]

    const singleYangStocks = [
      { symbol: '000003.SZ', name: '京东方A', strategy: 'single_yang', date: '20260109' },
      { symbol: '000004.SZ', name: '国华网安', strategy: 'single_yang', date: '20260109' },
    ]

    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('dates') && url.includes('hidden_dragon')) {
        return Promise.resolve({ success: true, dates: hiddenDragonDates })
      }
      if (url.includes('dates') && url.includes('single_yang')) {
        return Promise.resolve({ success: true, dates: singleYangDates })
      }
      if (url.includes('stocks') && url.includes('hidden_dragon')) {
        return Promise.resolve({ success: true, stocks: hiddenDragonStocks })
      }
      if (url.includes('stocks') && url.includes('single_yang')) {
        return Promise.resolve({ success: true, stocks: singleYangStocks })
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      return Promise.reject(new Error('Unexpected API call: ' + url))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    expect(wrapper.vm.selectedStrategy).toBe('hidden_dragon')
    expect(wrapper.vm.selectedDate).toBe('20260109')
    expect(wrapper.vm.stocks).toHaveLength(2)
    expect(wrapper.vm.stocks[0].strategy).toBe('hidden_dragon')

    wrapper.vm.selectedStrategy = 'single_yang'
    await flushPromises()

    expect(wrapper.vm.stocks).toHaveLength(2)
    expect(wrapper.vm.stocks[0].strategy).toBe('single_yang')
    expect(wrapper.vm.stocks[0].symbol).toBe('000003.SZ')

    const stocksCalls = requestMock.mock.calls.filter((call) => urlOf(call).includes('stocks'))
    expect(stocksCalls.length).toBeGreaterThanOrEqual(2)

    const lastStocksUrl = urlOf(stocksCalls[stocksCalls.length - 1])
    expect(lastStocksUrl).toContain('strategy=single_yang')
    expect(lastStocksUrl).toContain('date=20260109')
  })

  it('should handle strategy with no available dates', async () => {
    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('dates')) {
        return Promise.resolve({ success: true, dates: [] })
      }
      if (url.includes('stocks')) {
        return Promise.resolve({ success: true, stocks: [] })
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    expect(wrapper.vm.availableDates).toHaveLength(0)
    expect(wrapper.vm.selectedDate).toBe('')
    expect(wrapper.vm.stocks).toHaveLength(0)
  })

  it('should display loading state during fetch', async () => {
    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('dates')) {
        return Promise.resolve({ success: true, dates: ['20260109'] })
      }
      if (url.includes('stocks')) {
        return Promise.resolve({ success: true, stocks: [] })
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    wrapper = mount(StrategyStockPool)

    expect(wrapper.vm.loading).toBe(true)

    await flushPromises()

    expect(wrapper.vm.loading).toBe(false)
  })

  it('should handle API errors gracefully', async () => {
    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('dates')) {
        return Promise.reject(new Error('Network error'))
      }
      if (url.includes('stocks')) {
        return Promise.resolve({ success: true, stocks: [] })
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    expect(wrapper.vm.error).toBeTruthy()
    expect(wrapper.vm.stocks).toHaveLength(0)
  })

  it('should fetch params when preset changes and update currentParams', async () => {
    const presets = ['dragon_default', 'dragon_aggressive']

    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('presets') && url.includes('hidden_dragon')) {
        return Promise.resolve({ success: true, presets })
      }

      if (url.includes('params') && url.includes('hidden_dragon') && url.includes('preset=dragon_default')) {
        return Promise.resolve({ success: true, found: true, params: { a: 1 } })
      }
      if (url.includes('params') && url.includes('hidden_dragon') && url.includes('preset=dragon_aggressive')) {
        return Promise.resolve({ success: true, found: true, params: { a: 9 } })
      }

      if (url.includes('dates') && url.includes('hidden_dragon')) {
        return Promise.resolve({ success: true, dates: ['20260109'] })
      }
      if (url.includes('stocks') && url.includes('hidden_dragon')) {
        return Promise.resolve({ success: true, stocks: [] })
      }

      return Promise.reject(new Error('Unexpected API call: ' + url))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    expect(wrapper.vm.selectedPreset).toBe('dragon_default')
    expect(wrapper.vm.currentParams).toEqual({ a: 1 })

    wrapper.vm.selectedPreset = 'dragon_aggressive'
    await flushPromises()

    expect(wrapper.vm.currentParams).toEqual({ a: 9 })

    const paramsUrls = requestMock.mock.calls
      .map((call) => urlOf(call))
      .filter((u) => String(u).includes('/strategy-pool/params'))

    expect(paramsUrls.some((u) => String(u).includes('preset=dragon_aggressive'))).toBe(true)
  })
})
