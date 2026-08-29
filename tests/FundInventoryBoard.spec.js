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
          state_label: '存量强化',
          net_ex_price_yi: 789,
          new_inflow_yi: 286,
          incumbent_delta_yi: 503,
          mv_price_effect_yi: 100,
          surface_mv_chg_yi: 889,
          lag_note: '数据截止报告期 20260630，不是今日买卖。',
        },
      ],
      counts: {
        incumbent_strengthen: 1,
        new_inventory: 0,
        inventory_turnover: 0,
        inventory_exit: 0,
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
    expect(wrapper.text()).toContain('存量强化')
    expect(wrapper.text()).toContain('+789.00 亿')
    expect(wrapper.text()).toContain('存量强化 1')
    expect(wrapper.find('.symbol-link').exists()).toBe(true)
  })
})
