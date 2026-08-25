import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const requestMock = vi.fn()

vi.mock('../src/utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

vi.mock('../src/components/StockKLineChart.vue', () => ({
  default: {
    name: 'StockKLineChart',
    props: ['records', 'markers', 'tf', 'chartMeta'],
    template: '<div class="kline-stub">kline</div>',
  },
}))

vi.mock('../src/components/MetricsRadarChart.vue', () => ({
  default: { name: 'MetricsRadarChart', props: ['metrics'], template: '<div />' },
}))
vi.mock('../src/components/EquityCurveChart.vue', () => ({
  default: { name: 'EquityCurveChart', template: '<div />' },
}))

import StrategyStockPool from '../src/components/StrategyStockPool.vue'

function urlOf(call) {
  const config = call[0]
  return typeof config === 'string' ? config : config?.url || ''
}

describe('StrategyStockPool chart pane', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('selects a pool stock onto the in-page K-line instead of opening backtest', async () => {
    requestMock.mockImplementation(async (config) => {
      const u = urlOf([config])
      if (u.includes('/strategy-pool/presets')) return { success: true, presets: ['dragon_default'] }
      if (u.includes('/strategy-pool/params')) return { success: true, found: true, params: { a: 1 } }
      if (u.includes('/strategy-pool/stocks')) {
        return {
          success: true,
          stocks: [
            { symbol: '000001.SZ', name: '平安银行', strategy: 'hidden_dragon', date: '20260109', price: 10.5, industry: '银行' },
            { symbol: '000002.SZ', name: '万科A', strategy: 'hidden_dragon', date: '20260109' },
          ],
        }
      }
      if (u.includes('/strategy-pool/chart-context')) {
        const symbol = config.params?.symbol
        return {
          success: true,
          symbol,
          signal_date: '20260109',
          disclaimer: '含信号日之后走势，仅供事后验证。',
          kline: {
            records: [
              { trade_date: '20260108', open: 10, high: 11, low: 9, close: 10, volume: 1 },
              { trade_date: '20260109', open: 10, high: 11, low: 9, close: 10.5, volume: 1 },
            ],
          },
          markers: [{ kind: 'buy', trade_date: '20260109', price: 10.5, highlighted: true, label: '买' }],
          rounds: [],
          forward_returns: {
            horizons: [{ days: 1, available: true, return: 0.021 }],
          },
        }
      }
      if (u.includes('/strategy-pool/backtest-result')) {
        throw new Error('backtest should not load on row select')
      }
      return {}
    })

    const wrapper = mount(StrategyStockPool)
    await flushPromises()

    expect(wrapper.text()).toContain('平安银行')
    expect(wrapper.text()).toContain('申万L1 · 银行')
    expect(wrapper.find('.industry-chip-lg').text()).toContain('银行')
    expect(wrapper.text()).toContain('事后验证')
    expect(wrapper.text()).toContain('+1日')
    expect(wrapper.find('.kline-stub').exists()).toBe(true)
    expect(wrapper.vm.selectedStock.symbol).toBe('000001.SZ')

    const chartCalls = requestMock.mock.calls.filter(([cfg]) => urlOf([cfg]).includes('chart-context'))
    expect(chartCalls.length).toBeGreaterThanOrEqual(1)
    expect(chartCalls.some(([cfg]) => cfg.params?.symbol === '000001.SZ')).toBe(true)

    const rows = wrapper.findAll('.pool-row')
    await rows[1].trigger('click')
    await flushPromises()

    expect(wrapper.vm.selectedStock.symbol).toBe('000002.SZ')
    expect(wrapper.find('.industry-chip-lg').exists()).toBe(false)
    expect(requestMock.mock.calls.some(([cfg]) => urlOf([cfg]).includes('backtest-result'))).toBe(false)

    wrapper.unmount()
  })
})
