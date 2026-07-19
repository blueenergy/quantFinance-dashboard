import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const requestMock = vi.fn()

vi.mock('../src/utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import BacktestManager from '../src/components/BacktestManager.vue'

function urlOf(call) {
  const config = call[0]
  return typeof config === 'string' ? config : (config?.url || '')
}

describe('BacktestManager - open from strategy pool', () => {
  beforeEach(() => {
    requestMock.mockReset()
    localStorage.setItem('access_token', 'test-token')
  })

  afterEach(() => {
    localStorage.removeItem('access_token')
  })

  it('opens existing strategy-pool result and prefers returned strategy_params (no fallback params call)', async () => {
    requestMock.mockImplementation(async (config) => {
      const u = urlOf([config])
      if (u.includes('/strategy/strategies')) return { strategies: [] }
      if (u.includes('/strategy/templates')) return { templates: {} }
      if (u.includes('/backtest/tasks')) return []

      if (u.includes('/strategy-pool/backtest-result')) {
        return {
          task_id: 'pool_hidden_dragon_dragon_default_000001.SZ_20260109',
          symbol: '000001.SZ',
          strategy_key: 'hidden_dragon',
          strategy_params: { p: 123 },
          metrics: {},
          trades: [],
          equity_curve: [
            { date: '20250101', value: 1000000 },
            { date: '20260109', value: 1100000 }
          ],
          created_at: '2026-01-11T00:00:00Z'
        }
      }

      if (u.includes('/strategy-pool/params')) {
        return { success: true, found: true, params: { p: 999 } }
      }

      return {}
    })

    const wrapper = mount(BacktestManager, {
      global: {
        stubs: {
          StrategyParamsEditor: { template: '<div />' },
          MetricsRadarChart: { template: '<div />' },
          EquityCurveChart: { template: '<div />' }
        }
      }
    })

    await flushPromises()

    window.dispatchEvent(
      new CustomEvent('open-backtest-from-strategy-pool', {
        detail: {
          symbol: '000001',
          strategy: 'hidden_dragon',
          preset: 'dragon_default',
          signalDate: '20260109'
        }
      })
    )

    await flushPromises()

    expect(wrapper.vm.showResultModal).toBe(true)
    expect(wrapper.vm.result?.task_id).toContain('pool_hidden_dragon')
    expect(wrapper.vm.selectedTask?.symbol).toBe('000001.SZ')
    expect(wrapper.vm.selectedTask?.strategy_params).toEqual({ p: 123 })

    // UI should show strategy + params used
    expect(wrapper.text()).toContain('策略与参数')
    expect(wrapper.text()).toContain('hidden_dragon')
    expect(wrapper.text()).toContain('"p": 123')

    // UI should show backtest range
    expect(wrapper.text()).toContain('回测区间')
    expect(wrapper.text()).toContain('2025-01-01')
    expect(wrapper.text()).toContain('2026-01-09')

    const calledUrls = requestMock.mock.calls.map(c => urlOf(c))
    expect(calledUrls.some(u => u.includes('/strategy-pool/backtest-result'))).toBe(true)
    // Because strategy_params exists, it should not need the template params endpoint.
    expect(calledUrls.some(u => u.includes('/strategy-pool/params'))).toBe(false)

    wrapper.unmount()
  })

  it('falls back to /strategy-pool/params when result has no strategy_params', async () => {
    requestMock.mockImplementation(async (config) => {
      const u = urlOf([config])
      if (u.includes('/strategy/strategies')) return { strategies: [] }
      if (u.includes('/strategy/templates')) return { templates: {} }
      if (u.includes('/backtest/tasks')) return []

      if (u.includes('/strategy-pool/backtest-result')) {
        return {
          task_id: 'pool_hidden_dragon_dragon_default_000001.SZ_20260109',
          symbol: '000001.SZ',
          strategy_key: 'hidden_dragon',
          strategy_params: null,
          metrics: {},
          trades: [],
          equity_curve: [
            { date: '20250101', value: 1000000 },
            { date: '20260109', value: 1100000 }
          ],
          created_at: '2026-01-11T00:00:00Z'
        }
      }

      if (u.includes('/strategy-pool/params')) {
        return { success: true, found: true, params: { p: 999 } }
      }

      return {}
    })

    const wrapper = mount(BacktestManager, {
      global: {
        stubs: {
          StrategyParamsEditor: { template: '<div />' },
          MetricsRadarChart: { template: '<div />' },
          EquityCurveChart: { template: '<div />' }
        }
      }
    })

    await flushPromises()

    window.dispatchEvent(
      new CustomEvent('open-backtest-from-strategy-pool', {
        detail: {
          symbol: '000001',
          strategy: 'hidden_dragon',
          preset: 'dragon_default',
          signalDate: '20260109'
        }
      })
    )

    await flushPromises()

    expect(wrapper.vm.selectedTask?.strategy_params).toEqual({ p: 999 })

    // UI should show fallback params too
    expect(wrapper.text()).toContain('策略与参数')
    expect(wrapper.text()).toContain('hidden_dragon')
    expect(wrapper.text()).toContain('"p": 999')

    // UI should show backtest range
    expect(wrapper.text()).toContain('回测区间')
    expect(wrapper.text()).toContain('2025-01-01')
    expect(wrapper.text()).toContain('2026-01-09')

    const calledUrls = requestMock.mock.calls.map(c => urlOf(c))
    expect(calledUrls.some(u => u.includes('/strategy-pool/params'))).toBe(true)

    wrapper.unmount()
  })

  it('create new backtest from result defaults end_date to today (not copied)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-11T12:00:00Z'))

    requestMock.mockImplementation(async (config) => {
      const u = urlOf([config])
      if (u.includes('/strategy/strategies')) return { strategies: [] }
      if (u.includes('/strategy/templates')) return { templates: {} }
      if (u.includes('/backtest/tasks')) return []
      return {}
    })

    const wrapper = mount(BacktestManager, {
      global: {
        stubs: {
          StrategyParamsEditor: { template: '<div />' },
          MetricsRadarChart: { template: '<div />' },
          EquityCurveChart: { template: '<div />' }
        }
      }
    })

    await flushPromises()

    // Simulate viewing a completed historical task/result
    wrapper.vm.selectedTask = {
      symbol: '000001.SZ',
      strategy_key: 'hidden_dragon',
      start_date: '20250101',
      end_date: '20250131',
      initial_cash: 1000000,
      strategy_params: { p: 1 },
      preset: 'dragon_default'
    }
    wrapper.vm.result = {
      symbol: '000001.SZ',
      strategy_key: 'hidden_dragon',
      strategy_params: { p: 1 },
      metrics: {},
      trades: [],
      equity_curve: [{ date: '20250131', value: 1000000 }]
    }
    wrapper.vm.showResultModal = true

    wrapper.vm.openCreateNewBacktestFromResult()
    await flushPromises()

    const expectedToday = '20260111'

    expect(wrapper.vm.showCreateModal).toBe(true)
    expect(wrapper.vm.showResultModal).toBe(false)
    expect(wrapper.vm.newTask.end_date).toBe(expectedToday)

    wrapper.unmount()

    vi.useRealTimers()
  })
})
