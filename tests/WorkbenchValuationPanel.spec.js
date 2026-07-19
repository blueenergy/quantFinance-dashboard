import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

import WorkbenchValuationPanel from '../src/components/stock/WorkbenchValuationPanel.vue'

const VDialogStub = defineComponent({
  name: 'VDialog',
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  template: '<div v-if="modelValue" class="dialog-stub"><slot /></div>',
})

const PassThroughStub = defineComponent({
  template: '<div><slot /></div>',
})

const VBtnStub = defineComponent({
  name: 'VBtn',
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\', $event)"><slot /></button>',
})

function mountPanel(props = {}) {
  return mount(WorkbenchValuationPanel, {
    props,
    global: {
      stubs: {
        VDialog: VDialogStub,
        VCard: PassThroughStub,
        VCardTitle: PassThroughStub,
        VCardText: PassThroughStub,
        VCardActions: PassThroughStub,
        VSpacer: PassThroughStub,
        VBtn: VBtnStub,
      },
    },
  })
}

describe('WorkbenchValuationPanel', () => {
  it('emits refresh from the refresh button', async () => {
    const wrapper = mountPanel()
    const refreshButton = wrapper.findAll('button').find((button) => button.text() === '刷新估值')

    await refreshButton.trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('disables refresh while loading', () => {
    const wrapper = mountPanel({ loading: true })
    const refreshButton = wrapper.findAll('button').find((button) => button.text() === '刷新估值')

    expect(refreshButton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('刷新中…')
  })

  it('shows the matching DDM and DCF help dialog titles and can close', async () => {
    const wrapper = mountPanel()

    await wrapper.get('[data-help-topic="ddm"]').trigger('click')
    expect(wrapper.get('.dialog-stub').text()).toContain('DDM / 分红折现模型说明')

    await wrapper.findAll('button').find((button) => button.text() === '关闭').trigger('click')
    expect(wrapper.find('.dialog-stub').exists()).toBe(false)

    await wrapper.get('[data-help-topic="dcf"]').trigger('click')
    expect(wrapper.get('.dialog-stub').text()).toContain('DCF / 自由现金流折现说明')
  })

  it('renders the empty valuation state when data is unavailable', () => {
    const wrapper = mountPanel({ valuationDataStatusFound: false })

    expect(wrapper.text()).toContain('暂无足够估值数据')
    expect(wrapper.text()).toContain('等待 financial_daily_basic 与财务指标补齐')
  })

  it('renders representative DDM and DCF scenario rows', () => {
    const wrapper = mountPanel({
      valuationDataStatusFound: true,
      valuationConclusionMetrics: [{ label: '综合结论', value: '略低估' }],
      valuationDdmScenarios: [
        {
          name: 'base',
          cash_dividend_wan: 1000,
          ke: 0.1,
          growth: 0.03,
          growth_source: 'historical',
          equity_value_wan: 12000,
          upside_pct: 8.5,
        },
      ],
      valuationDcfScenarios: [
        {
          name: 'base',
          wacc: 0.09,
          terminal_growth: 0.03,
          initial_growth: 0.05,
          enterprise_value_wan: 20000,
          equity_value_wan: 18000,
          fair_value_per_share: 12.3,
          safety_margin_pct: 5.2,
        },
      ],
    })

    expect(wrapper.text()).toContain('综合结论')
    expect(wrapper.text()).toContain('略低估')
    expect(wrapper.text()).toContain('DDM / 分红验证')
    expect(wrapper.text()).toContain('DCF 三情景')
    expect(wrapper.text()).toContain('12.3')
    expect(wrapper.text()).toMatch(/8\.50%|8\.5%/)
  })
})
