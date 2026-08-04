import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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

import BacktestResultDetail from '../src/components/BacktestResultDetail.vue'

const SAMPLE_RESULT = {
  task_id: 'bt_1',
  symbol: '300196.SZ',
  strategy_key: 'atr_breakout',
  strategy_params: { period: 14, atr_mult: 2 },
  metrics: {
    total_return: 0.12,
    sharpe_ratio: 1.2,
    max_drawdown: -0.08,
    max_drawdown_len: 30,
    win_rate: 0.55,
    total_trades: 18,
    calmar_ratio: 1.5,
    sortino_ratio: 1.1,
    sqn: 1.8,
    ulcer_index: 0.04,
    benchmark_return: 0.03,
    excess_return: 0.09,
    invested_return: 0.14,
    capital_utilization: 0.72,
  },
  trades: [
    {
      datetime: '2025-01-10',
      action: 'buy',
      price: 10.5,
      quantity: 100,
      commission: 5,
      pnl: 0,
      cumulative_pnl: 0,
    },
  ],
  equity_curve: [
    { date: '20250102', value: 1000000 },
    { date: '20250630', value: 1120000 },
  ],
}

describe('BacktestResultDetail', () => {
  it('renders strategy meta, metrics, trades and equity from props', () => {
    const wrapper = mount(BacktestResultDetail, {
      props: {
        result: SAMPLE_RESULT,
        meta: {
          symbol: '300196.SZ',
          strategy_key: 'atr_breakout',
          preset: 'atr_breakout_default',
          strategy_params: SAMPLE_RESULT.strategy_params,
          start_date: '20250102',
          end_date: '20250630',
          initial_cash: 1000000,
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('300196.SZ')
    expect(text).toContain('atr_breakout')
    expect(text).toContain('atr_breakout_default')
    expect(text).toContain('12.00%')
    expect(text).toContain('Calmar')
    expect(text).toContain('超额收益')
    expect(text).toContain('基准收益')
    expect(text).toContain('投入资金收益')
    expect(text).toContain('买入')
    expect(wrapper.find('.radar-stub').exists()).toBe(true)
    expect(wrapper.find('.equity-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows loading and error states without fetching', () => {
    const loading = mount(BacktestResultDetail, {
      props: { loading: true, loadingMessage: '加载中测试' },
    })
    expect(loading.text()).toContain('加载中测试')
    loading.unmount()

    const errored = mount(BacktestResultDetail, {
      props: { error: '加载失败测试' },
    })
    expect(errored.text()).toContain('加载失败测试')
    errored.unmount()
  })
})
