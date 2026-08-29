import { describe, expect, it, vi } from 'vitest'
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
    const strategyCurve = wrapper.find('polyline[stroke="#0f6bdc"]')
    expect(strategyCurve.exists()).toBe(true)
    expect(strategyCurve.attributes('points')).not.toMatch(/NaN|Infinity/)
  })

  it('emits close from the close button', async () => {
    const wrapper = mountModal()

    await wrapper.find('.combo-close-btn').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('exports a self-contained HTML file from the toolbar', async () => {
    const click = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: vi.fn(),
    })
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return { href: '', download: '', click, remove: vi.fn() }
      return originalCreate(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})

    const wrapper = mountModal({
      identity: {
        job_id: 'job-a',
        result_id: 'result-1',
        data_watermark: { dataset_rows: 12 },
      },
    })
    await wrapper.find('.combo-export-btn').trigger('click')

    expect(click).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('shows the date and account value when hovering the equity curve', async () => {
    const wrapper = mountModal()
    const svg = wrapper.find('svg')
    svg.element.getBoundingClientRect = () => ({
      left: 0,
      width: 1100,
      top: 0,
      height: 300,
      right: 1100,
      bottom: 300,
    })

    await svg.trigger('mousemove', { clientX: 52 })
    expect(wrapper.text()).toContain('账户总值：1,000,000')

    await svg.trigger('mousemove', { clientX: 1080 })
    expect(wrapper.text()).toContain('2024-01-02')
    expect(wrapper.text()).toContain('账户总值：1,020,000')
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

  it('shows index regime on trades and the equity chart', async () => {
    const wrapper = mountModal({
      detail: {
        ...detail,
        meta: { ...detail.meta, regime_mode: 'bull_g60_else_cash' },
        periods: [{
          score_date: '2024-01-02',
          period_end_date: '2024-01-20',
          portfolio_return_net: 0.02,
          index_benchmark_return: 0.01,
          regime_label: 'bull',
        }],
        trades: [
          { score_date: '2024-01-02', symbol: '600000.SH', name: '浦发银行', regime_label: 'bull' },
        ],
      },
    })

    expect(wrapper.text()).toContain('非牛空仓')
    expect(wrapper.text()).toContain('指数')
    expect(wrapper.text()).toContain('牛市')
    expect(wrapper.text()).toContain('持有期内指数翻熊不会中途卖出')
    expect(wrapper.findAll('rect').length).toBeGreaterThan(0)

    const svg = wrapper.find('svg')
    svg.element.getBoundingClientRect = () => ({
      left: 0,
      width: 1100,
      top: 0,
      height: 300,
      right: 1100,
      bottom: 300,
    })
    await svg.trigger('mousemove', { clientX: 1080 })
    expect(wrapper.text()).toContain('指数：牛市')
  })
})
