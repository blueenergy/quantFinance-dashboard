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
import axios from 'axios'
import StrategyStockPool from '../src/components/StrategyStockPool.vue'

describe('StrategyStockPool', () => {
  let wrapper
  let mockAxiosGet

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    mockAxiosGet = vi.spyOn(axios, 'get')
  })

  it('should reload stocks when strategy changes even if date unchanged', async () => {
    // Mock API responses
    const hiddenDragonDates = ['20260109', '20260108', '20260107']
    const singleYangDates = ['20260109', '20260108', '20260106'] // Same first two dates
    
    const hiddenDragonStocks = [
      { symbol: '000001.SZ', name: '平安银行', strategy: 'hidden_dragon', date: '20260109' },
      { symbol: '000002.SZ', name: '万科A', strategy: 'hidden_dragon', date: '20260109' }
    ]
    
    const singleYangStocks = [
      { symbol: '000003.SZ', name: '京东方A', strategy: 'single_yang', date: '20260109' },
      { symbol: '000004.SZ', name: '国华网安', strategy: 'single_yang', date: '20260109' }
    ]

    mockAxiosGet.mockImplementation((url) => {
      if (url.includes('dates') && url.includes('hidden_dragon')) {
        return Promise.resolve({ data: { success: true, dates: hiddenDragonDates } })
      }
      if (url.includes('dates') && url.includes('single_yang')) {
        return Promise.resolve({ data: { success: true, dates: singleYangDates } })
      }
      if (url.includes('stocks') && url.includes('hidden_dragon')) {
        return Promise.resolve({ data: { success: true, stocks: hiddenDragonStocks } })
      }
      if (url.includes('stocks') && url.includes('single_yang')) {
        return Promise.resolve({ data: { success: true, stocks: singleYangStocks } })
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    // Mount component
    wrapper = mount(StrategyStockPool, {
      global: {
        stubs: {
          // Stub child components if needed
        }
      }
    })

    // Wait for initial load (hidden_dragon by default)
    await flushPromises()
    
    // Verify initial state
    expect(wrapper.vm.selectedStrategy).toBe('hidden_dragon')
    expect(wrapper.vm.selectedDate).toBe('20260109')
    expect(wrapper.vm.stocks).toHaveLength(2)
    expect(wrapper.vm.stocks[0].strategy).toBe('hidden_dragon')
    
    // Record number of API calls so far
    const callsBeforeSwitch = mockAxiosGet.mock.calls.length

    // Switch to single_yang
    wrapper.vm.selectedStrategy = 'single_yang'
    await flushPromises()

    // CRITICAL ASSERTION: Stock list should be different
    expect(wrapper.vm.stocks).toHaveLength(2)
    expect(wrapper.vm.stocks[0].strategy).toBe('single_yang')
    expect(wrapper.vm.stocks[0].symbol).toBe('000003.SZ')
    
    // Verify that fetchStocks was called with new strategy
    const stocksCalls = mockAxiosGet.mock.calls.filter(call => 
      call[0].includes('stocks')
    )
    
    // Should have at least 2 stocks calls: one for hidden_dragon, one for single_yang
    expect(stocksCalls.length).toBeGreaterThanOrEqual(2)
    
    // Last stocks call should be for single_yang
    const lastStocksCall = stocksCalls[stocksCalls.length - 1][0]
    expect(lastStocksCall).toContain('strategy=single_yang')
    expect(lastStocksCall).toContain('date=20260109')
  })

  it('should handle strategy with no available dates', async () => {
    mockAxiosGet.mockImplementation((url) => {
      if (url.includes('dates')) {
        return Promise.resolve({ data: { success: true, dates: [] } })
      }
      if (url.includes('stocks')) {
        return Promise.resolve({ data: { success: true, stocks: [] } })
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
    mockAxiosGet.mockImplementation((url) => {
      if (url.includes('dates')) {
        return Promise.resolve({ data: { success: true, dates: ['20260109'] } })
      }
      if (url.includes('stocks')) {
        return Promise.resolve({ data: { success: true, stocks: [] } })
      }
      return Promise.reject(new Error('Unexpected API call'))
    })

    wrapper = mount(StrategyStockPool)
    
    // Loading should be true initially
    expect(wrapper.vm.loading).toBe(true)
    
    await flushPromises()
    
    // Loading should be false after fetch
    expect(wrapper.vm.loading).toBe(false)
  })

  it('should handle API errors gracefully', async () => {
    mockAxiosGet.mockImplementation((url) => {
      if (url.includes('dates')) {
        return Promise.reject(new Error('Network error'))
      }
      if (url.includes('stocks')) {
        return Promise.resolve({ data: { success: true, stocks: [] } })
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

    mockAxiosGet.mockImplementation((url) => {
      if (url.includes('presets') && url.includes('hidden_dragon')) {
        return Promise.resolve({ data: { success: true, presets } })
      }

      if (url.includes('params') && url.includes('hidden_dragon') && url.includes('preset=dragon_default')) {
        return Promise.resolve({ data: { success: true, found: true, params: { a: 1 } } })
      }
      if (url.includes('params') && url.includes('hidden_dragon') && url.includes('preset=dragon_aggressive')) {
        return Promise.resolve({ data: { success: true, found: true, params: { a: 9 } } })
      }

      if (url.includes('dates') && url.includes('hidden_dragon')) {
        return Promise.resolve({ data: { success: true, dates: ['20260109'] } })
      }
      if (url.includes('stocks') && url.includes('hidden_dragon')) {
        return Promise.resolve({ data: { success: true, stocks: [] } })
      }

      return Promise.reject(new Error('Unexpected API call: ' + url))
    })

    wrapper = mount(StrategyStockPool)
    await flushPromises()

    // Initial preset should be first available and params should be loaded.
    expect(wrapper.vm.selectedPreset).toBe('dragon_default')
    expect(wrapper.vm.currentParams).toEqual({ a: 1 })

    // Change preset
    wrapper.vm.selectedPreset = 'dragon_aggressive'
    await flushPromises()

    expect(wrapper.vm.currentParams).toEqual({ a: 9 })

    const paramsCalls = mockAxiosGet.mock.calls
      .map(call => call[0])
      .filter(u => String(u).includes('/api/strategy-pool/params'))

    expect(paramsCalls.some(u => String(u).includes('preset=dragon_aggressive'))).toBe(true)
  })
})
