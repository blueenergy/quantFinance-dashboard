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

  it('emits refresh-internal from the S/W analysis button', async () => {
    const wrapper = mountPanel()

    await wrapper.get('.swot-internal-btn').trigger('click')

    expect(wrapper.emitted('refresh-internal')).toHaveLength(1)
  })

  it('keeps collection and S/W refresh buttons independent', async () => {
    const collecting = mountPanel({ collecting: true })
    expect(collecting.get('.swot-collect-btn').attributes('disabled')).toBeDefined()
    // 搜集机会与风险进行中，不应禁用刷新优势与劣势
    expect(collecting.get('.swot-internal-btn').attributes('disabled')).toBeUndefined()
    await collecting.get('.swot-internal-btn').trigger('click')
    expect(collecting.emitted('refresh-internal')).toHaveLength(1)

    const refreshing = mountPanel({ internalRefreshing: true })
    expect(refreshing.get('.swot-internal-btn').attributes('disabled')).toBeDefined()
    // 刷新优势与劣势进行中，不应禁用搜集机会与风险
    expect(refreshing.get('.swot-collect-btn').attributes('disabled')).toBeUndefined()
    await refreshing.get('.swot-collect-btn').trigger('click')
    expect(refreshing.emitted('collect')).toHaveLength(1)
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


describe('StockWorkbenchSwotPanel internal S/W findings', () => {
  it('renders active rule findings and internal review metadata', () => {
    const wrapper = mountPanel({
      swot: {
        strength: {
          status: 'completed',
          strength: 'high',
          summary: 'ROE 水平较高且处于行业前列',
          findings: [
            {
              finding_key: 'profitability.roe_high',
              strength: 'high',
              summary: 'ROE 水平较高且处于行业前列',
              detail: 'roe_level=18 percent；行业百分位=90（样本 20）',
              evidence_version: '20260331:abc',
            },
          ],
        },
        weakness: {
          status: 'completed',
          severity: 'medium',
          findings: [
            {
              finding_key: 'leverage.debt_elevated',
              severity: 'medium',
              summary: '资产负债率较高且处于行业高位',
            },
          ],
        },
        opportunity: { strength: 'none', findings: [] },
        threat: { severity: 'none', findings: [] },
      },
      internalSignalReview: {
        last_run_status: 'analyzed',
        engine_version: 'sw-mvp-v1',
        input_completeness: 'complete',
      },
    })

    expect(wrapper.get('.swot-quadrant--strength').text()).toContain('ROE 水平较高')
    expect(wrapper.get('.swot-quadrant--strength').text()).toContain('证据版本')
    expect(wrapper.get('.swot-quadrant--weakness').text()).toContain('资产负债率较高')
    expect(wrapper.get('.internal-review-banner').text()).toContain('sw-mvp-v1')
    expect(wrapper.get('.internal-review-banner').text()).toContain('输入 完整')
    expect(
      wrapper.get('.swot-quadrant--strength .swot-finding-item').attributes('role'),
    ).toBe('button')
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

  it('emits analyze-url with finding_key when submitting a follow-up news link', async () => {
    const wrapper = mountPanel({
      swot: {
        strength: { status: 'planned', findings: [] },
        weakness: { status: 'planned', findings: [] },
        opportunity: { strength: 'none', findings: [] },
        threat: {
          severity: 'medium',
          summary: '存在诉讼风险',
          findings: [
            {
              finding_key: 'legal_compliance:诉讼案件尚未开庭',
              severity: 'medium',
              summary: '诉讼案件尚未开庭，结果存在不确定性',
              detail: '涉案金额超3.3亿元。',
            },
          ],
        },
      },
    })

    await wrapper.get('.swot-quadrant--threat .swot-detail-btn').trigger('click')
    const panel = document.body.querySelector('.llm-detail-panel')
    expect(panel).not.toBeNull()

    const followUpBtn = Array.from(panel.querySelectorAll('.llm-action-btn'))
      .find((btn) => btn.textContent.includes('补充后续新闻'))
    expect(followUpBtn).toBeTruthy()
    followUpBtn.click()
    await wrapper.vm.$nextTick()

    const input = panel.querySelector('.llm-followup-input')
    expect(input).not.toBeNull()
    input.value = 'https://finance.example.com/news/verdict'
    input.dispatchEvent(new Event('input'))
    await wrapper.vm.$nextTick()

    panel.querySelector('.llm-followup-form').dispatchEvent(new Event('submit'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('analyze-url')).toEqual([
      [{ url: 'https://finance.example.com/news/verdict', findingKey: 'legal_compliance:诉讼案件尚未开庭' }],
    ])
    wrapper.unmount()
  })
})

describe('StockWorkbenchSwotPanel internal findings', () => {
  it('opens internal detail panel for strength findings', async () => {
    const wrapper = mountPanel({
      swot: {
        strength: {
          status: 'completed',
          strength: 'high',
          findings: [
            {
              finding_key: 'profitability.roe_high',
              summary: 'ROE 较高',
              rule_condition: { metric: 'roe_level', operator: 'gte', threshold: 15 },
              evidence: [{ metric: 'roe_level', value: 18, unit: 'percent' }],
            },
          ],
        },
        weakness: { status: 'not_analyzed', findings: [] },
        opportunity: { strength: 'none', findings: [] },
        threat: { severity: 'none', findings: [] },
      },
    })

    await wrapper.get('.swot-quadrant--strength .swot-finding-item').trigger('click')
    expect(document.body.querySelector('.internal-detail-panel')).not.toBeNull()
    wrapper.unmount()
  })

  it('shows missing message when pending finding is absent', async () => {
    const wrapper = mountPanel({
      pendingFinding: {
        findingKey: 'missing.rule',
        dimension: 'strength',
      },
      swot: {
        strength: { status: 'completed', findings: [] },
        weakness: { status: 'not_analyzed', findings: [] },
        opportunity: { strength: 'none', findings: [] },
        threat: { severity: 'none', findings: [] },
      },
    })

    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('已关闭或不存在')
    wrapper.unmount()
  })
})
