import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HoldingsPanel from '../src/components/portfolio/HoldingsPanel.vue'

function mountHoldingsPanel(overrides = {}) {
  return mount(HoldingsPanel, {
    attachTo: document.body,
    props: {
      latestHoldingRows: [
        { symbol: '600000.SH', name: '浦发银行', shares: 100, market_value: 1000 },
      ],
      holdingPlanOpportunityBySymbol: {
        '600000.SH': {
          llm: { strength: 'high', summary: '政策催化', findings: [] },
        },
      },
      riskRowClass: () => '',
      formatRiskTime: (value) => value || '',
      halfTargetShares: () => 0,
      signedMoney: (value) => String(value),
      effectiveTarget: () => 0,
      manualDelta: () => 0,
      ...overrides,
    },
  })
}

beforeEach(() => {
  document.body
    .querySelectorAll('.llm-detail-panel, .llm-popover-backdrop')
    .forEach((el) => el.remove())
})

describe('HoldingsPanel plan opportunity merge', () => {
  it('shows opportunity tag from holdingPlanOpportunityBySymbol when row lacks ai_opportunity', () => {
    const wrapper = mountHoldingsPanel()
    const tag = wrapper.find('.llm-opportunity-tag')
    expect(tag.exists()).toBe(true)
    expect(tag.text()).toBe('机会')
    wrapper.unmount()
  })

  it('hides opportunity tag when plan map has no llm payload for the symbol', () => {
    const wrapper = mountHoldingsPanel({ holdingPlanOpportunityBySymbol: {} })
    expect(wrapper.find('.llm-opportunity-tag').exists()).toBe(false)
    wrapper.unmount()
  })
})
