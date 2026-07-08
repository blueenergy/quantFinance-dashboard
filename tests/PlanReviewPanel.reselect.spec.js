import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PlanReviewPanel from '../src/components/portfolio/PlanReviewPanel.vue'

const item = {
  symbol: '600000.SH',
  name: '测试股',
  rank: 1,
  action: 'buy',
  industry: '银行',
  current_shares: 0,
  target_shares: 200,
  delta_shares: 200,
  estimated_price: 10,
  ai_risk: {
    severity: 'high',
    llm: { severity: 'high', summary: '事件风险', findings: [] },
  },
}

const baseProps = {
  visible: true,
  planId: 'plan-test-001',
  items: [item],
  overlay: { enabled: true },
  summary: { buy: 1, sell: 0, hold: 0 },
  riskSummary: { high: 1, medium: 0, low: 0 },
  canReselectItems: true,
  selectedReselectSymbols: new Set(['600000.SH']),
  selectedPlanExcluded: [],
  selectedReselectCount: 1,
  actionLoading: false,
  reselectBusy: false,
  pendingReselectSymbol: '',
  reselectStatus: { state: 'success', text: '已排除 600000.SH，补位换为 600001.SH' },
  reselectTaskMeta: { taskId: 'task-1', status: 'completed' },
  lastReselectSummary: '已排除 600000.SH，补位换为 600001.SH',
}

describe('PlanReviewPanel reselect UI', () => {
  it('renders reselect toolbar and pending action columns when enabled', () => {
    const wrapper = mount(PlanReviewPanel, {
      attachTo: document.body,
      props: baseProps,
    })
    expect(wrapper.text()).toContain('勾选高风险')
    expect(wrapper.text()).toContain('批量换股 (1)')
    expect(wrapper.find('.col-select').exists()).toBe(true)
    expect(wrapper.find('.col-action').exists()).toBe(true)
    expect(wrapper.text()).toContain('换一只')
    expect(wrapper.text()).toContain('已排除 600000.SH，补位换为 600001.SH')
    wrapper.unmount()
  })

  it('disables bulk reselect when nothing is selected', () => {
    const wrapper = mount(PlanReviewPanel, {
      props: { ...baseProps, selectedReselectSymbols: new Set(), selectedReselectCount: 0 },
    })
    const bulkBtn = wrapper.findAll('button').find((btn) => btn.text().includes('批量换股'))
    expect(bulkBtn?.attributes('disabled')).toBeDefined()
  })

  it('emits reselect when clicking 换一只', async () => {
    const wrapper = mount(PlanReviewPanel, {
      attachTo: document.body,
      props: baseProps,
    })
    const swapBtn = wrapper.findAll('button').find((btn) => btn.text().includes('换一只'))
    expect(swapBtn).toBeTruthy()
    await swapBtn.trigger('click')
    expect(wrapper.emitted('reselect')).toEqual([['600000.SH', false]])
    wrapper.unmount()
  })

  it('emits bulk-reselect from toolbar button', async () => {
    const wrapper = mount(PlanReviewPanel, { props: baseProps })
    const bulkBtn = wrapper.findAll('button').find((btn) => btn.text().includes('批量换股'))
    await bulkBtn.trigger('click')
    expect(wrapper.emitted('bulk-reselect')).toHaveLength(1)
  })
})
