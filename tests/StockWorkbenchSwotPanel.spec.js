import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StockWorkbenchSwotPanel from '../src/components/stock/StockWorkbenchSwotPanel.vue'


function mountPanel(overrides = {}) {
  return mount(StockWorkbenchSwotPanel, {
    props: {
      symbol: '000001.SZ',
      name: '平安银行',
      swot: {
        strength: { status: 'planned', findings: [] },
        weakness: { status: 'planned', findings: [] },
        opportunity: { strength: 'none', findings: [] },
        threat: { severity: 'none', findings: [] },
      },
      ...overrides,
    },
  })
}


describe('StockWorkbenchSwotPanel collection action', () => {
  it('emits collect from the evidence analysis button', async () => {
    const wrapper = mountPanel()

    await wrapper.get('.swot-collect-btn').trigger('click')

    expect(wrapper.emitted('collect')).toHaveLength(1)
  })

  it('disables the collection button while analysis is running', () => {
    const wrapper = mountPanel({
      collecting: true,
      collectionMessage: '正在搜集分析…',
    })

    expect(wrapper.get('.swot-collect-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.swot-collection-status').text()).toContain('正在搜集分析')
  })
})
