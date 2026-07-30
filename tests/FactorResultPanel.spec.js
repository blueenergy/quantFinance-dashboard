import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import FactorResultPanel from '../src/components/factor/FactorResultPanel.vue'
import {
  buildCoverageCards,
  buildIcRows,
  buildNetReturnRows,
  buildQuantileBars,
  buildScreenRows,
  buildSkippedFactorRows,
  factorDiagnostics,
  reportHorizons,
} from '../src/utils/factorBacktestView'

const report = {
  rows: 72000,
  distinct_dates: 240,
  symbols: 300,
  evaluated_columns: ['alpha1', 'alpha2'],
  skipped_factors: [{ name: 'VWAP0', reason: 'needs $vwap' }],
  score_date_range: ['20230103', '20231229'],
  estimated_memory_gb: 3.5,
  factors: {
    alpha1: {
      5: {
        ic: { ic_mean: -0.11, ic_ir: -0.42, t_stat: -3.2, positive_ratio: 0.31, observations: 200, avg_names: 290 },
        per_year: [{ year: '2023', ic_mean: -0.1, ic_ir: -0.4, observations: 200 }],
        quantiles: {
          mean_return_by_quantile: { 1: 0.02, 2: 0.01, 3: -0.005 },
          top_minus_bottom_spread: -0.025,
          monotonic_increasing: false,
          quantile_rank_corr: -0.9,
        },
      },
    },
    alpha2: { 5: { ic: { ic_mean: 0.3 }, quantiles: {} } },
  },
  screen: { horizon: 5, ranked: [{ factor: 'alpha2', ic_mean: 0.3 }, { factor: 'alpha1', ic_mean: -0.11 }] },
  source: { point_in_time_universe: true },
  cost_assumptions: { slippage_bps_one_way: 10, round_trip_rate: 0.0027 },
  factor_meta: [{ name: 'alpha1', family: 'K线形态', description: '实体涨跌幅', expression: '($close-$open)/($high-$low)' }],
  net_returns: [
    { score_column: 'alpha1', horizon: 5, top_k: 20, long_excess_net: 0.012, long_short_net: 0.02, observations: 40 },
  ],
}

function mountPanel(overrides = {}) {
  const selectedFactor = overrides.selectedFactor ?? 'alpha1'
  const selectedHorizon = overrides.selectedHorizon ?? '5'
  const diagnostics = factorDiagnostics(report, selectedFactor, selectedHorizon)
  return mount(FactorResultPanel, {
    props: {
      report,
      coverageCards: buildCoverageCards(report),
      skippedFactorRows: buildSkippedFactorRows(report),
      pitLabel: 'Point-in-time（当时成分股）',
      horizons: reportHorizons(report),
      selectedHorizon,
      selectedFactor,
      icRows: buildIcRows(report, selectedHorizon),
      diagnostics,
      quantileBars: buildQuantileBars(diagnostics),
      yearlyIcRows: diagnostics?.per_year || [],
      netReturnRows: buildNetReturnRows(report, selectedFactor),
      screenRows: buildScreenRows(report),
      ...overrides,
    },
  })
}

describe('FactorResultPanel', () => {
  it('renders coverage, universe quality and the IC ranking', () => {
    const text = mountPanel().text()
    expect(text).toContain('72,000')
    expect(text).toContain('Point-in-time（当时成分股）')
    expect(text).toContain('3.50 GB')
    expect(text).toContain('-0.1100')
  })

  it('says which factors were skipped and why, and stays quiet when none were', () => {
    const text = mountPanel().text()
    expect(text).toContain('未评估 1 个因子')
    expect(text).toContain('VWAP0')
    expect(text).toContain('价格面板缺少 $vwap 字段')

    expect(mountPanel({ skippedFactorRows: [] }).find('.skipped-note').exists()).toBe(false)
  })

  it('drills into the selected factor with its expression and quantile spread', () => {
    const text = mountPanel().text()
    expect(text).toContain('alpha1 · 5d 诊断')
    expect(text).toContain('($close-$open)/($high-$low)')
    expect(text).toContain('K线形态 · 实体涨跌幅')
    expect(text).toContain('首尾分位差 -2.50%')
    expect(text).toContain('分位秩相关 -0.900')
  })

  it('draws one quantile bar per bucket, widest for the largest move', () => {
    const bars = mountPanel().findAll('.quantile-fill')
    expect(bars).toHaveLength(3)
    expect(bars[0].attributes('style')).toContain('width: 100%')
    expect(bars[0].classes()).toContain('pos')
    expect(bars[2].classes()).toContain('neg')
  })

  it('shows the cost assumptions next to the net returns', () => {
    const text = mountPanel().text()
    expect(text).toContain('单边滑点 10.0 bps')
    expect(text).toContain('每次调仓成本 0.27%')
  })

  it('marks the open horizon and emits a change', async () => {
    const wrapper = mountPanel()
    const tabs = wrapper.findAll('.horizon-tab')
    expect(tabs).toHaveLength(1)
    expect(tabs[0].classes()).toContain('active')

    await tabs[0].trigger('click')
    expect(wrapper.emitted('select-horizon')).toEqual([['5']])
  })

  it('emits the factor when an IC row is clicked', async () => {
    const wrapper = mountPanel()
    await wrapper.findAll('tbody tr')[0].trigger('click')
    expect(wrapper.emitted('select-factor')).toEqual([['alpha2']])
  })

  it('says so when the horizon has no diagnostics rather than rendering an empty table', () => {
    const wrapper = mountPanel({ icRows: [], selectedFactor: '' })
    expect(wrapper.text()).toContain('该 horizon 没有可用的因子诊断')
  })
})
