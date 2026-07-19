import { describe, expect, it } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'

import WorkbenchFinancialPanel from '../src/components/stock/WorkbenchFinancialPanel.vue'

const VBtnToggleStub = defineComponent({
  name: 'VBtnToggle',
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  template: `
    <div class="financial-mode-toggle-stub">
      <button type="button" @click="$emit('update:modelValue', 'annual')">年度对比</button>
    </div>
  `,
})

const GrowthChartStub = defineComponent({
  name: 'GrowthChart',
  props: {
    series: { type: Array, default: () => [] },
  },
  template: '<div class="growth-chart-stub">chart:{{ series.length }}</div>',
})

function mountPanel(props = {}) {
  return mount(WorkbenchFinancialPanel, {
    props,
    global: {
      stubs: {
        GrowthChart: GrowthChartStub,
        VBtnToggle: VBtnToggleStub,
        VBtn: true,
      },
    },
  })
}

describe('WorkbenchFinancialPanel', () => {
  it('emits a model update when toggling financial mode', async () => {
    const wrapper = mountPanel({ financialMode: 'quarterly' })

    await wrapper.get('.financial-mode-toggle-stub button').trigger('click')

    expect(wrapper.emitted('update:financialMode')?.[0]).toEqual(['annual'])
  })

  it('wires parent v-model:financial-mode like StockWorkbench', async () => {
    const Host = defineComponent({
      components: { WorkbenchFinancialPanel },
      setup() {
        const financialMode = ref('quarterly')
        return { financialMode }
      },
      template: `
        <WorkbenchFinancialPanel
          v-model:financial-mode="financialMode"
          financial-mode-label="单季对比"
        />
      `,
    })
    const wrapper = mount(Host, {
      global: {
        stubs: {
          GrowthChart: true,
          VBtnToggle: VBtnToggleStub,
          VBtn: true,
        },
      },
    })

    await wrapper.get('.financial-mode-toggle-stub button').trigger('click')
    expect(wrapper.vm.financialMode).toBe('annual')
  })

  it('renders GrowthChart when series exist and empty chart state otherwise', async () => {
    const wrapper = mountPanel({
      financialChartData: [{ period: '2024Q1', revenue: 1 }],
      loading: true,
      financialModeLabel: '单季对比',
    })
    expect(wrapper.get('.growth-chart-stub').text()).toContain('chart:1')
    expect(wrapper.text()).toContain('刷新中')

    await wrapper.setProps({ financialChartData: [] })
    expect(wrapper.find('.growth-chart-stub').exists()).toBe(false)
    expect(wrapper.text()).toContain('暂无足够财务数据')
  })

  it('renders quality cards and their empty state', async () => {
    const wrapper = mountPanel({
      financialQualityCards: [{
        key: 'cashflow',
        level: 'good',
        label: '现金质量',
        title: '现金流健康',
        detail: '经营现金流覆盖归母净利润。',
      }],
    })

    expect(wrapper.get('.quality-card').text()).toContain('现金流健康')
    expect(wrapper.text()).not.toContain('暂无足够财务数据生成质量摘要')

    await wrapper.setProps({ financialQualityCards: [] })

    expect(wrapper.find('.quality-card').exists()).toBe(false)
    expect(wrapper.text()).toContain('暂无足够财务数据生成质量摘要')
  })

  it('renders earnings events and report_rc rows when provided', () => {
    const wrapper = mountPanel({
      earningsEvents: [{
        type: '业绩预告',
        title: '预计净利润同比增长',
        date: '20260731',
      }],
      reportRcRows: [{
        report_date: '20260701',
        org_name: '某券商',
        report_title: '买入评级',
        rating: '买入',
        min_price: 10,
        max_price: 12,
      }],
      incomeReportSections: [{
        key: '1',
        label: '合并报表（report_type=1）',
        rows: [{ end_date: '20240630', total_revenue: 1e8, revenue: 9e7, n_income_attr_p: 1e7, n_income: 1e7 }],
      }],
    })

    const event = wrapper.get('.event-item')
    expect(event.text()).toContain('业绩预告')
    expect(event.text()).toContain('预计净利润同比增长')
    expect(event.text()).toContain('20260731')
    expect(wrapper.text()).toContain('某券商')
    expect(wrapper.text()).toContain('买入评级')
    expect(wrapper.text()).toContain('合并报表')
    expect(wrapper.text()).toContain('20240630')
  })
})
