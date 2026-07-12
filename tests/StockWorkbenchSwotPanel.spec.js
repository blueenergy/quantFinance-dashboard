import { beforeEach, describe, expect, it } from 'vitest'
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

beforeEach(() => {
  document.body
    .querySelectorAll('.llm-detail-panel, .llm-popover-backdrop')
    .forEach((el) => el.remove())
})


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

  it('renders industry signals as read-only references', () => {
    const wrapper = mountPanel({
      industryReference: {
        industry: '玻璃',
        opportunity: {
          strength: 'low',
          findings: [
            {
              finding_key: 'industry-opp-1',
              strength: 'low',
              summary: '玻璃玻纤行业景气修复',
            },
          ],
        },
        threat: { severity: 'none', findings: [] },
        data_status: { found: true },
      },
    })

    expect(wrapper.get('.industry-reference-head').text()).toContain('玻璃')
    expect(wrapper.get('.industry-finding-list').text()).toContain('玻璃玻纤行业景气修复')
    expect(wrapper.text()).toContain('不等同于该股票自身结论')
  })
})


describe('StockWorkbenchSwotPanel empty threat action', () => {
  it('opens the existing detail panel for manually adding the first risk', async () => {
    const wrapper = mountPanel()
    const button = wrapper.get('.swot-quadrant--threat .swot-detail-btn')

    expect(button.text()).toBe('手动添加风险')

    await button.trigger('click')

    const panel = document.body.querySelector('.llm-detail-panel')
    expect(panel).not.toBeNull()
    expect(panel.querySelector('.llm-detail-title').textContent).toContain('平安银行')
    expect(panel.querySelector('.llm-manual-add button').textContent).toContain('手动添加风险')
    wrapper.unmount()
  })
})


describe('StockWorkbenchSwotPanel news url action', () => {
  it('emits analyze-url for a valid http link', async () => {
    const wrapper = mountPanel()
    await wrapper.get('.swot-url-input').setValue('https://finance.example.com/news/123')
    await wrapper.get('.swot-url-form').trigger('submit.prevent')

    expect(wrapper.emitted('analyze-url')).toEqual([['https://finance.example.com/news/123']])
    wrapper.unmount()
  })

  it('disables analyze controls while collecting', () => {
    const wrapper = mountPanel({ collecting: true })

    expect(wrapper.get('.swot-url-input').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.swot-url-btn').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.swot-url-btn').text()).toContain('分析中')
    wrapper.unmount()
  })
})
