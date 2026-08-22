import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResultGridTable from '../src/components/portfolio/ResultGridTable.vue'

const sampleRow = {
  variant: 'growth_cycle_topn',
  top_n: 10,
  cumulative_return: 0.2,
  annualized_return: 0.08,
  index_excess_cumulative_return: 0.1,
  sharpe: 1.0,
  max_drawdown: -0.1,
  average_exposure: 1,
  risk_adjusted_score: 0.5,
}

function mountTable(overrides = {}) {
  return mount(ResultGridTable, {
    props: {
      rows: [sampleRow],
      sweepAxes: [],
      formatAxisValue: (_key, value) => String(value ?? '-'),
      pct: (value) => `${(Number(value) * 100).toFixed(0)}%`,
      num: (value, digits = 2) => Number(value).toFixed(digits),
      ...overrides,
    },
  })
}

describe('ResultGridTable', () => {
  it('shows TopN when top_n is not a swept axis', () => {
    const wrapper = mountTable()

    expect(wrapper.text()).toContain('TopN')
    expect(wrapper.text()).toContain('10')
  })

  it('hides TopN when top_n is already in sweep axes', () => {
    const wrapper = mountTable({
      sweepAxes: [{ key: 'top_n', label: 'Top N', values: [10, 20] }],
    })

    expect(wrapper.text()).toContain('Top N')
    expect(wrapper.text()).not.toContain('TopN')
  })
})
