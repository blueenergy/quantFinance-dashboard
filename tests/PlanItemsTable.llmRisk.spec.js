import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PlanItemsTable from '../src/components/portfolio/PlanItemsTable.vue'

const baseItem = {
  symbol: '600000.SH',
  name: '测试股',
  rank: 1,
  action: 'buy',
  industry: '银行',
  current_shares: 100,
  target_shares: 200,
  delta_shares: 100,
  estimated_price: 10,
  ai_risk: {
    severity: 'medium',
    llm: { severity: 'high', summary: '事件风险摘要', findings: [] },
  },
}

function makeItem(overrides = {}) {
  return { ...baseItem, ...overrides }
}

function mountTable(props) {
  return mount(PlanItemsTable, {
    attachTo: document.body,
    props: { items: [makeItem()], overlay: { enabled: false }, ...props },
  })
}

beforeEach(() => {
  // Deterministic default font size (composable persists to localStorage).
  localStorage.clear()
  // Popover is teleported to <body>; drop leftovers from previous tests.
  document.body
    .querySelectorAll('.llm-detail-panel, .llm-popover-backdrop')
    .forEach((el) => el.remove())
})

describe('PlanItemsTable LLM risk tag', () => {
  it('renders a clickable LLM tag in plan mode and opens the popover', async () => {
    const wrapper = mountTable({ mode: 'plan' })
    const tag = wrapper.find('.llm-risk-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('风险')

    await tag.trigger('click')
    expect(document.body.querySelector('.llm-detail-panel')).not.toBeNull()
    wrapper.unmount()
  })

  it('renders a clickable LLM tag in pending mode and opens the popover', async () => {
    const wrapper = mountTable({ mode: 'pending' })
    const tag = wrapper.find('.llm-risk-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('风险')

    await tag.trigger('click')
    const panel = document.body.querySelector('.llm-detail-panel')
    expect(panel).not.toBeNull()
    // Title should reference the clicked symbol/name.
    expect(document.body.querySelector('.llm-detail-title').textContent).toContain('测试股')
    wrapper.unmount()
  })

  it('toggles the popover closed on a second click of the same tag', async () => {
    const wrapper = mountTable({ mode: 'pending' })
    const tag = wrapper.find('.llm-risk-tag')

    await tag.trigger('click')
    expect(document.body.querySelector('.llm-detail-panel')).not.toBeNull()

    await tag.trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.llm-detail-panel')).toBeNull()
    wrapper.unmount()
  })

  it('A+/A− controls change the LLM detail font size within bounds', async () => {
    const wrapper = mountTable({ mode: 'pending' })
    await wrapper.find('.llm-risk-tag').trigger('click')

    const body = () => document.body.querySelector('.llm-detail-body')
    const fontBtns = () => document.body.querySelectorAll('.llm-font-btn')

    // Default 15px, two buttons: [0] = A− (dec), [1] = A+ (inc).
    expect(body().style.fontSize).toBe('15px')
    expect(fontBtns()).toHaveLength(2)

    fontBtns()[1].click() // A+
    await flushPromises()
    expect(body().style.fontSize).toBe('17px')

    fontBtns()[0].click() // A−
    fontBtns()[0].click() // A−
    await flushPromises()
    expect(body().style.fontSize).toBe('13px')

    // Choice is persisted so it survives a reopen / remount.
    expect(localStorage.getItem('planLlmRiskFontPx')).toBe('13')
    wrapper.unmount()
  })
})
