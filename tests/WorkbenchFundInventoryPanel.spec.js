import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkbenchFundInventoryPanel from '../src/components/stock/WorkbenchFundInventoryPanel.vue'

describe('WorkbenchFundInventoryPanel', () => {
  it('renders four-state snapshot and four questions', () => {
    const wrapper = mount(WorkbenchFundInventoryPanel, {
      props: {
        snapshot: {
          state: 'inventory_turnover',
          state_label: '库存换手',
          state_hint: '新基金在买，老机构卖得更多。',
          period_curr: '20260630',
          period_prev: '20251231',
          compare_mode: 'full_vs_full',
          lag_note: '数据截止报告期 20260630，不是今日买卖。',
          net_ex_price_yi: -50,
          surface_mv_chg_yi: 701,
          mv_price_effect_yi: 751,
          new_inflow_yi: 311,
          incumbent_delta_yi: -361,
          n_funds_prev: 40,
          n_funds_curr: 55,
          n_new: 20,
          n_exited: 8,
          four_questions: [
            { id: 'price_effect', question: '股价上涨贡献了多少持仓市值？', value_yi: 751, detail: '' },
          ],
        },
      },
    })

    expect(wrapper.text()).toContain('库存换手')
    expect(wrapper.text()).toContain('不是今日买卖')
    expect(wrapper.text()).toContain('-50.00 亿')
    expect(wrapper.text()).toContain('股价上涨贡献了多少持仓市值？')
    expect(wrapper.text()).not.toContain('尚未生成公募库存快照')
  })

  it('shows empty copy when no snapshot', () => {
    const wrapper = mount(WorkbenchFundInventoryPanel, {
      props: { snapshot: null, loading: false },
    })
    expect(wrapper.text()).toContain('尚未生成公募库存快照')
  })

  it('shows service errors instead of the missing-data copy', () => {
    const wrapper = mount(WorkbenchFundInventoryPanel, {
      props: {
        snapshot: null,
        loading: false,
        error: '公募库存服务暂时不可用',
      },
    })
    expect(wrapper.get('[role="alert"]').text()).toContain('暂时不可用')
    expect(wrapper.text()).not.toContain('尚未生成公募库存快照')
  })
})
