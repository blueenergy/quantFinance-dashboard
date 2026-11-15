import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LineageTimeline from '../LineageTimeline.vue'

function monitorNode(date, buy, sell, turnover) {
  return {
    plan_id: `plan-${date}`,
    date,
    node_type: 'monitor',
    record_kind: 'observation',
    today_state: '观察日：不交易',
    drift_brief: {
      mode: 'drift',
      buy_count: buy,
      sell_count: sell,
      estimated_turnover: turnover,
      items: [{
        symbol: '000001.SZ',
        name: '平安银行',
        action: 'buy',
        delta_shares: 100,
        current_shares: 0,
        target_shares: 100,
        estimated_amount: 1000,
      }],
    },
  }
}

const foldEntry = {
  type: 'monitor_fold',
  start: '2026-11-13',
  end: '2026-11-11',
  count: 2,
  maxDrift: 0.27,
  nodes: [
    monitorNode('2026-11-13', 18, 12, 0.27),
    monitorNode('2026-11-12', 19, 11, 0.25),
  ],
}

describe('LineageTimeline observation fold', () => {
  it('keeps the observation fold collapsed by default', () => {
    const wrapper = mount(LineageTimeline, { props: { entries: [foldEntry] } })
    expect(wrapper.find('.timeline-fold-body').exists()).toBe(false)
    expect(wrapper.text()).toContain('观察 2 次')
    expect(wrapper.text()).toContain('最大漂移换手 27.00%')
  })

  it('expands to one row per observation day with buy/sell/turnover', async () => {
    const wrapper = mount(LineageTimeline, { props: { entries: [foldEntry] } })
    await wrapper.find('.timeline-fold-head .timeline-expand').trigger('click')

    const rows = wrapper.findAll('.timeline-fold-body .timeline-node')
    expect(rows).toHaveLength(2)
    expect(rows[0].text()).toContain('2026-11-13')
    expect(rows[0].text()).toContain('买 18')
    expect(rows[0].text()).toContain('卖 12')
    expect(rows[0].text()).toContain('换手 27.00%')
    expect(rows[1].text()).toContain('2026-11-12')
    expect(rows[1].text()).toContain('买 19')
  })

  it('expands a single observation day to its trade list', async () => {
    const wrapper = mount(LineageTimeline, { props: { entries: [foldEntry] } })
    await wrapper.find('.timeline-fold-head .timeline-expand').trigger('click')
    await wrapper.findAll('.timeline-fold-body .timeline-expand')[0].trigger('click')

    const detail = wrapper.find('.timeline-fold-body .timeline-trade-detail')
    expect(detail.exists()).toBe(true)
    expect(detail.text()).toContain('000001.SZ')
    expect(detail.text()).toContain('买')
  })
})
