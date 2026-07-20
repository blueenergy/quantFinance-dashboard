import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ResearchComboModal from '../src/components/portfolio/ResearchComboModal.vue'

const detail = {
  meta: {
    combo_key: 'growth__top10__ts0.15',
    construction_mode: 'top_n',
    score_variant: 'growth',
    variant: 'top_n',
    top_n: 10,
    horizon: 20,
  },
  summary: {
    cumulative_return: 0.1234,
    sharpe: 1.5,
    max_drawdown: -0.08,
    index_excess_cumulative_return: 0.03,
    average_turnover: 0.25,
    periods: 2,
  },
  periods: [
    {
      score_date: '2024-01-02',
      portfolio_return_net: 0.02,
      index_benchmark_return: 0.01,
    },
  ],
  trades: [
    { score_date: '2024-01-02', symbol: '600000.SH', name: '浦发银行' },
    { score_date: '2024-01-03', symbol: '000001.SZ', name: '平安银行' },
  ],
}

function mountModal(overrides = {}) {
  return mount(ResearchComboModal, {
    props: {
      open: true,
      loading: false,
      error: '',
      detail,
      contextRow: { combo_key: detail.meta.combo_key },
      ...overrides,
    },
  })
}

describe('ResearchComboModal', () => {
  it('renders summary cards when detail is present', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('累计收益(净)')
    expect(wrapper.text()).toContain('12.34%')
    expect(wrapper.text()).toContain('Sharpe')
    expect(wrapper.text()).toContain('1.50')
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('emits close from the close button', async () => {
    const wrapper = mountModal()

    await wrapper.find('.link-btn').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('filters trades locally by symbol or name', async () => {
    const wrapper = mountModal()

    await wrapper.find('input[placeholder="如 600000"]').setValue('平安')

    expect(wrapper.text()).toContain('000001.SZ')
    expect(wrapper.text()).not.toContain('600000.SH')
    expect(wrapper.text()).toContain('1 笔 / 共 2')
  })

  it('resets local filters when another combo opens', async () => {
    const wrapper = mountModal()
    await wrapper.find('input[placeholder="如 600000"]').setValue('平安')

    await wrapper.setProps({ contextRow: { combo_key: 'another-combo' } })

    expect(wrapper.find('input[placeholder="如 600000"]').element.value).toBe('')
    expect(wrapper.text()).toContain('600000.SH')
    expect(wrapper.text()).toContain('2 笔 / 共 2')
  })
})
