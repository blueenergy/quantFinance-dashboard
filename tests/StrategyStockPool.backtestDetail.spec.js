import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const requestMock = vi.fn()

vi.mock('../src/utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

vi.mock('../src/components/MetricsRadarChart.vue', () => ({
  default: { name: 'MetricsRadarChart', props: ['metrics'], template: '<div class="radar-stub" />' },
}))
vi.mock('../src/components/EquityCurveChart.vue', () => ({
  default: {
    name: 'EquityCurveChart',
    props: ['equityCurve', 'initialCash'],
    template: '<div class="equity-stub" />',
  },
}))

import StrategyStockPool from '../src/components/StrategyStockPool.vue'

function urlOf(call) {
  const config = call[0]
  return typeof config === 'string' ? config : config?.url || ''
}

function pageText() {
  return document.body.textContent || ''
}

describe('StrategyStockPool - local backtest detail', () => {
  beforeEach(() => {
    requestMock.mockReset()
    localStorage.setItem('access_token', 'test-token')
  })

  afterEach(() => {
    localStorage.removeItem('access_token')
    document.body.innerHTML = ''
  })

  function mockPoolApis({ strategyParams = { p: 123 }, resultParams = { p: 123 } } = {}) {
    requestMock.mockImplementation(async (config) => {
      const u = urlOf([config])
      if (u.includes('/strategy-pool/presets')) {
        return { success: true, presets: ['dragon_default'] }
      }
      if (u.includes('/strategy-pool/params')) {
        return { success: true, found: true, params: strategyParams }
      }
      if (u.includes('/strategy-pool/dates')) {
        return { success: true, dates: ['20260109'] }
      }
      if (u.includes('/strategy-pool/stocks')) {
        return {
          success: true,
          stocks: [
            {
              symbol: '000001.SZ',
              name: '平安银行',
              strategy: 'hidden_dragon',
              preset: 'dragon_default',
              date: '20260109',
            },
          ],
        }
      }
      if (u.includes('/strategy-pool/backtest-result')) {
        return {
          task_id: 'pool_hidden_dragon_dragon_default_000001.SZ_20260109',
          symbol: '000001.SZ',
          strategy_key: 'hidden_dragon',
          strategy_params: resultParams,
          metrics: { total_return: 0.1, total_trades: 12 },
          trades: [],
          equity_curve: [
            { date: '20250101', value: 1000000 },
            { date: '20260109', value: 1100000 },
          ],
        }
      }
      return {}
    })
  }

  it('opens shared detail locally with pool result params (no tab switch)', async () => {
    mockPoolApis({ resultParams: { p: 123 } })

    const wrapper = mount(StrategyStockPool, { attachTo: document.body })
    await flushPromises()

    await wrapper.vm.openBacktestDetail(wrapper.vm.stocks[0])
    await flushPromises()

    expect(wrapper.vm.detailOpen).toBe(true)
    expect(wrapper.vm.detailMeta.strategy_params).toEqual({ p: 123 })
    expect(pageText()).toContain('策略与参数')
    expect(pageText()).toContain('hidden_dragon')
    expect(pageText()).toContain('"p": 123')
    expect(pageText()).toContain('回测区间')
    expect(pageText()).toContain('2025-01-01')
    expect(pageText()).toContain('部署到实盘')

    const urls = requestMock.mock.calls.map((c) => urlOf(c))
    expect(urls.some((u) => u.includes('/strategy-pool/backtest-result'))).toBe(true)
    expect(urls.some((u) => u.includes('/backtest/tasks'))).toBe(false)

    document.body.querySelector('.deploy-btn').click()
    await flushPromises()
    expect(pageText()).toContain('确认将 000001.SZ · hidden_dragon 部署到实盘？')

    document.body.querySelector('.confirm-deploy-btn').click()
    await flushPromises()

    expect(requestMock).toHaveBeenCalledWith({
      method: 'post',
      url: '/user/watchlist/strategy',
      data: {
        symbol: '000001.SZ',
        strategy: 'hidden_dragon',
        enabled: true,
        params: { p: 123 },
      },
    })
    expect(pageText()).toContain('部署成功，策略已配置到实盘。')

    wrapper.unmount()
  })

  it('falls back to /strategy-pool/params when result has no strategy_params', async () => {
    mockPoolApis({ resultParams: null, strategyParams: { p: 999 } })

    const wrapper = mount(StrategyStockPool, { attachTo: document.body })
    await flushPromises()

    await wrapper.vm.openBacktestDetail({
      symbol: '000001.SZ',
      strategy: 'hidden_dragon',
      preset: 'dragon_default',
      date: '20260109',
    })
    await flushPromises()

    expect(wrapper.vm.detailMeta.strategy_params).toEqual({ p: 999 })
    expect(pageText()).toContain('"p": 999')
    expect(requestMock.mock.calls.map((c) => urlOf(c)).some((u) => u.includes('/strategy-pool/params'))).toBe(
      true,
    )

    wrapper.unmount()
  })
})
