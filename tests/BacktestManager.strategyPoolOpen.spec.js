import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BacktestManager from '../src/components/BacktestManager.vue'

const okJson = (body) => ({
  ok: true,
  json: async () => body
})

describe('BacktestManager - open from strategy pool', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.setItem('access_token', 'test-token')
  })

  afterEach(() => {
    localStorage.removeItem('access_token')
  })

  it('opens existing strategy-pool result and prefers returned strategy_params (no fallback params call)', async () => {
    const fetchMock = vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/strategy/strategies')) return okJson({ strategies: [] })
      if (u.includes('/strategy/templates')) return okJson({ templates: {} })
      if (u.includes('/backtest/tasks')) return okJson([])

      if (u.includes('/strategy-pool/backtest-result')) {
        return okJson({
          task_id: 'pool_hidden_dragon_dragon_default_000001.SZ_20260109',
          symbol: '000001.SZ',
          strategy_key: 'hidden_dragon',
          strategy_params: { p: 123 },
          metrics: {},
          trades: [],
          equity_curve: [],
          created_at: '2026-01-11T00:00:00Z'
        })
      }

      if (u.includes('/strategy-pool/params')) {
        return okJson({ success: true, found: true, params: { p: 999 } })
      }

      return okJson({})
    })

    vi.stubGlobal('fetch', fetchMock)

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

    const calledUrls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(calledUrls.some(u => u.includes('/strategy-pool/backtest-result'))).toBe(true)
    // Because strategy_params exists, it should not need the template params endpoint.
    expect(calledUrls.some(u => u.includes('/strategy-pool/params'))).toBe(false)

    wrapper.unmount()
  })

  it('falls back to /strategy-pool/params when result has no strategy_params', async () => {
    const fetchMock = vi.fn(async (url) => {
      const u = String(url)
      if (u.includes('/strategy/strategies')) return okJson({ strategies: [] })
      if (u.includes('/strategy/templates')) return okJson({ templates: {} })
      if (u.includes('/backtest/tasks')) return okJson([])

      if (u.includes('/strategy-pool/backtest-result')) {
        return okJson({
          task_id: 'pool_hidden_dragon_dragon_default_000001.SZ_20260109',
          symbol: '000001.SZ',
          strategy_key: 'hidden_dragon',
          strategy_params: null,
          metrics: {},
          trades: [],
          equity_curve: [],
          created_at: '2026-01-11T00:00:00Z'
        })
      }

      if (u.includes('/strategy-pool/params')) {
        return okJson({ success: true, found: true, params: { p: 999 } })
      }

      return okJson({})
    })

    vi.stubGlobal('fetch', fetchMock)

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

    const calledUrls = fetchMock.mock.calls.map(c => String(c[0]))
    expect(calledUrls.some(u => u.includes('/strategy-pool/params'))).toBe(true)

    wrapper.unmount()
  })
})
