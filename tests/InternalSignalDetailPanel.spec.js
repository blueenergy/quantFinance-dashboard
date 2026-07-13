import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import InternalSignalDetailPanel from '../src/components/stock/InternalSignalDetailPanel.vue'

describe('InternalSignalDetailPanel peer percentile copy', () => {
  it('explains SW2021 L1 peer percentile with sample size', async () => {
    const wrapper = mount(InternalSignalDetailPanel, {
      props: {
        detail: {
          symbol: '300196.SZ',
          name: '四方达',
          dimension: 'strength',
          finding: {
            summary: 'ROE 水平较高且处于行业前列',
            rule_condition: {
              metric: 'roe_level',
              operator: 'gte',
              threshold: 15,
              peer_operator: 'gte',
              peer_threshold: 70,
              min_peer_count: 10,
            },
            evidence: [
              {
                metric: 'roe_level',
                source_field: 'roe_yearly',
                value: 18,
                unit: 'percent',
                end_date: '20260331',
                peer_percentile: 73.47,
                peer_count: 147,
                sw1_code: '801710.SI',
                sw1_name: '建筑材料',
                industry_membership_mode: 'current_sw1',
              },
            ],
          },
        },
      },
    })

    await wrapper.vm.$nextTick()

    const panel = document.body.querySelector('.internal-detail-panel')
    expect(panel).not.toBeNull()
    const text = panel.textContent || ''
    expect(text).toContain('73.47')
    expect(text).toContain('样本 147')
    expect(text).toContain('申万2021一级行业「建筑材料」')
    expect(text).toContain('current_sw1')
    expect(text).toContain('申万一级行业百分位 ≥ 70')
    wrapper.unmount()
    document.body.querySelector('.internal-popover-backdrop')?.remove()
  })

  it('formats operating cash flow amounts in wan or yi', async () => {
    const wrapper = mount(InternalSignalDetailPanel, {
      props: {
        detail: {
          symbol: '300196.SZ',
          dimension: 'strength',
          finding: {
            evidence: [
              { metric: 'ttm_cash_conversion', value: 1.6, unit: 'ratio' },
              {
                component: 'ttm_operating_cash_flow',
                metric: 'ttm_operating_cash_flow',
                value: 1077553855.08,
                unit: 'currency',
                points: [
                  { end_date: '20260331', value: 269388463.77 },
                  { end_date: '20251231', value: 250000000 },
                ],
              },
            ],
          },
        },
      },
    })

    await wrapper.vm.$nextTick()
    const panel = document.body.querySelector('.internal-detail-panel')
    const text = panel?.textContent || ''
    expect(text).toContain('10.78亿元')
    expect(text).toContain('20260331：2.69亿元')
    expect(text).toContain('20251231：2.50亿元')
    wrapper.unmount()
    document.body.querySelector('.internal-popover-backdrop')?.remove()
  })
})
