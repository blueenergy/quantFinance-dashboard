import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../src/api/fundInventory', () => ({
  getFundInventoryPeriods: vi.fn(async () => ({
    success: true,
    data: { periods: ['20260630'] },
  })),
  getFundInventorySnapshots: vi.fn(async () => ({
    success: true,
    data: {
      period: '20260630',
      rows: [
        {
          symbol: '300502',
          ts_code: '300502.SZ',
          name: '新易盛',
          industry: '电子',
          state: 'incumbent_strengthen',
          state_label: '前十大强化',
          net_ex_price_yi: 789,
          new_inflow_yi: 286,
          incumbent_delta_yi: 503,
          mv_price_effect_yi: 100,
          surface_mv_chg_yi: 889,
          lag_note: '数据截止报告期 20260630，不是今日买卖。',
          market: 'A',
        },
        {
          symbol: '00700.HK',
          ts_code: '00700.HK',
          name: '腾讯控股',
          market: 'HK',
          state: 'inventory_exit',
          state_label: '退出前十大',
          net_ex_price_yi: -10,
        },
      ],
      counts: {
        incumbent_strengthen: 1,
        new_inventory: 0,
        inventory_turnover: 0,
        inventory_exit: 0,
      },
      quality: {
        status: 'provisional',
        strategy_coverage_pct: 100,
        holding_depth_pct: 20.1,
        full_readiness_pct: 20.1,
        current: { strategies: 3345 },
        previous: { strategies: 3123 },
        warning: '当前为前十大预览',
      },
    },
  })),
}))

vi.mock('../src/components/common/AppLink.vue', () => ({
  default: {
    name: 'AppLink',
    props: ['tab', 'params'],
    template: '<a><slot /></a>',
  },
}))

import FundInventoryBoard from '../src/views/FundInventoryBoard.vue'

describe('FundInventoryBoard', () => {
  it('loads periods and snapshot rows', async () => {
    const wrapper = mount(FundInventoryBoard)
    await flushPromises()
    expect(wrapper.text()).toContain('不是今日买卖')
    expect(wrapper.text()).toContain('新易盛')
    expect(wrapper.text()).toContain('腾讯控股')
    expect(wrapper.text()).toContain('暂未校正拆股')
    expect(wrapper.text()).toContain('前十大强化')
    expect(wrapper.text()).toContain('前十大预览')
    expect(wrapper.text()).toContain('持仓深度')
    expect(wrapper.text()).toContain('20.1%')
    expect(wrapper.text()).toContain('+789.00 亿')
    expect(wrapper.text()).toContain('前十大强化 1')
    expect(wrapper.find('.symbol-link').exists()).toBe(true)
  })
})
