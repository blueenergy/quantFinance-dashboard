/**
 * Test: Strategy Stock Pool Component
 *
 * Switching strategies must reload the 30-day table even when the
 * previous strategy's signal dates overlap.
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

function stocksStrategy(config) {
  return config?.params?.strategy || ''
}

describe('StrategyStockPool', () => {
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    requestMock.mockReset()
  })

  it('should reload stocks when strategy changes even if date unchanged', async () => {
    const hiddenDragonStocks = [
      { symbol: '000001.SZ', name: '平安银行', strategy: 'hidden_dragon', date: '20260109', hist_return: 0.04 },
      { symbol: '000002.SZ', name: '万科A', strategy: 'hidden_dragon', date: '20260109', hist_return: 0.02 },
    ]

    const singleYangStocks = [
      { symbol: '000003.SZ', name: '京东方A', strategy: 'single_yang', date: '20260109', hist_return: 0.08 },
      { symbol: '000004.SZ', name: '国华网安', strategy: 'single_yang', date: '20260109', hist_return: 0.03 },
    ]

    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('stocks')) {
        if (stocksStrategy(config) === 'single_yang') {
          return Promise.resolve({ success: true, stocks: singleYangStocks })
        }
        return Promise.resolve({ success: true, stocks: hiddenDragonStocks })
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      if (url.includes('chart-context')) {
        return Promise.resolve({
          success: true,
          kline: { records: [] },
          markers: [],
          rounds: [],
          forward_returns: { horizons: [] },
          disclaimer: '含信号日之后走势，仅供事后验证。',
        })
      }
      return Promise.reject(new Error('Unexpected API call: ' + url))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    expect(wrapper.vm.selectedStrategy).toBe('hidden_dragon')
    expect(wrapper.vm.rankedStocks).toHaveLength(2)
    expect(wrapper.vm.rankedStocks[0].symbol).toBe('000001.SZ')
    expect(wrapper.vm.stocks[0].strategy).toBe('hidden_dragon')
    expect(wrapper.text()).toContain('近 30 日新开仓')

    wrapper.vm.selectedStrategy = 'single_yang'
    await flushPromises()

    expect(wrapper.vm.rankedStocks).toHaveLength(2)
    expect(wrapper.vm.rankedStocks[0].strategy).toBe('single_yang')
    expect(wrapper.vm.rankedStocks[0].symbol).toBe('000003.SZ')

    const stocksCalls = requestMock.mock.calls.filter((call) => urlOf(call).includes('stocks'))
    expect(stocksCalls.length).toBeGreaterThanOrEqual(2)
    const lastStocksCall = stocksCalls[stocksCalls.length - 1][0]
    expect(lastStocksCall.params.strategy).toBe('single_yang')
    expect(lastStocksCall.params.start_date).toMatch(/^\d{8}$/)
    expect(lastStocksCall.params.end_date).toMatch(/^\d{8}$/)
    expect(lastStocksCall.params.date).toBeUndefined()
    expect(requestMock.mock.calls.some((call) => urlOf(call).includes('/dates'))).toBe(false)
  })

  it('should handle strategy with no available dates', async () => {
    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('stocks')) {
        return Promise.resolve({ success: true, stocks: [] })
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      if (url.includes('chart-context')) {
        return Promise.resolve({ success: true, kline: { records: [] }, markers: [] })
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    expect(wrapper.vm.stocks).toHaveLength(0)
    expect(wrapper.text()).toContain('近 30 日暂无买入信号')
  })

  it('should display loading state during fetch', async () => {
    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('stocks')) {
        return Promise.resolve({ success: true, stocks: [] })
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      if (url.includes('chart-context')) {
        return Promise.resolve({ success: true, kline: { records: [] }, markers: [] })
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
      if (url.includes('stocks')) {
        return Promise.reject(new Error('Network error'))
      }
      if (url.includes('presets')) {
        return Promise.resolve({ success: true, presets: [] })
      }
      if (url.includes('params')) {
        return Promise.resolve({ success: true, found: false, params: null })
      }
      if (url.includes('chart-context')) {
        return Promise.resolve({ success: true, kline: { records: [] }, markers: [] })
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

      if (url.includes('stocks')) {
        return Promise.resolve({ success: true, stocks: [] })
      }
      if (url.includes('chart-context')) {
        return Promise.resolve({ success: true, kline: { records: [] }, markers: [] })
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

  it('lists k_regime as an independent strategy type', async () => {
    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('stocks')) return Promise.resolve({ success: true, stocks: [] })
      if (url.includes('presets')) return Promise.resolve({ success: true, presets: ['k_regime_default'] })
      if (url.includes('params')) return Promise.resolve({ success: true, found: false, params: null })
      if (url.includes('chart-context')) {
        return Promise.resolve({ success: true, kline: { records: [] }, markers: [] })
      }
      return Promise.reject(new Error('Unexpected API call: ' + url))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    const keys = wrapper.vm.strategies.map((item) => item.key)
    expect(keys).toContain('k_regime')
    expect(wrapper.vm.strategies.find((item) => item.key === 'k_regime').name).toBe('量价择时')
    expect(keys).toContain('hidden_dragon')
  })

  it('ranks k_regime rows by sharpe and marks the top three', async () => {
    requestMock.mockImplementation((config) => {
      const url = urlOf([config])
      if (url.includes('stocks')) {
        return Promise.resolve({
          success: true,
          stocks: [
            { symbol: 'RF.SZ', name: '瑞丰高材', strategy: 'k_regime', date: '20260824', hist_sharpe_ratio: -0.3, hist_return: -0.5 },
            { symbol: 'ZG.SZ', name: '藏格矿业', strategy: 'k_regime', date: '20260812', hist_sharpe_ratio: 0.82, hist_return: 3.66 },
            { symbol: 'TZ.SZ', name: '柘中股份', strategy: 'k_regime', date: '20260821', hist_sharpe_ratio: 0.6, hist_return: 1.65 },
            { symbol: 'LL.SZ', name: '利尔化学', strategy: 'k_regime', date: '20260824', hist_sharpe_ratio: 0.41, hist_return: 0.7 },
          ],
        })
      }
      if (url.includes('presets')) return Promise.resolve({ success: true, presets: ['k_regime_default'] })
      if (url.includes('params')) return Promise.resolve({ success: true, found: false, params: null })
      if (url.includes('chart-context')) {
        return Promise.resolve({ success: true, kline: { records: [] }, markers: [], forward_returns: { horizons: [] } })
      }
      return Promise.reject(new Error('Unexpected API call: ' + url))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()
    wrapper.vm.selectedStrategy = 'k_regime'
    await flushPromises()

    expect(wrapper.vm.rankedStocks.map((row) => row.name)).toEqual([
      '藏格矿业',
      '柘中股份',
      '利尔化学',
      '瑞丰高材',
    ])
    expect(wrapper.find('.pool-table').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('选择日期')
    expect(wrapper.findAll('.top-chip')).toHaveLength(3)
    expect(wrapper.vm.selectedStock.name).toBe('藏格矿业')
    expect(wrapper.text()).toContain('夏普')
  })
})
