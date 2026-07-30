import { describe, expect, it } from 'vitest'
import {
  buildCoverageCards,
  buildIcRows,
  buildNetReturnRows,
  buildQuantileBars,
  buildFactorParamRows,
  buildSkippedFactorRows,
  buildYearlyIcRows,
  filterCatalogFactors,
  findFactorMeta,
  groupFactorsByFamily,
  jobArtifactSummary,
  jobFactorScopeLabel,
  jobProgressStageLabel,
  jobStageProgress,
  reportHorizons,
  universePitLabel,
} from '../factorBacktestView'

// Mirrors the report the worker writes: factors keyed by name then by horizon
// as a string, and score_date_range as a [min, max] pair.
function sampleReport() {
  return {
    rows: 12345,
    distinct_dates: 240,
    symbols: 300,
    evaluated_columns: ['alpha1', 'alpha2'],
    skipped_factors: [{ name: 'VWAP0', reason: 'needs $vwap' }],
    score_date_range: ['20230103', '20231229'],
    estimated_memory_gb: 3.5,
    factors: {
      alpha1: {
        1: {
          ic: { ic_mean: -0.11, ic_ir: -0.4, t_stat: -3.2, positive_ratio: 0.3, observations: 200, avg_names: 290 },
          per_year: [{ year: '2023', ic_mean: -0.1 }, { year: '2022', ic_mean: -0.2 }],
          quantiles: {
            mean_return_by_quantile: { 1: 0.02, 2: 0.01, 3: -0.005 },
            top_minus_bottom_spread: -0.025,
            monotonic_increasing: false,
            quantile_rank_corr: -0.9,
          },
        },
        5: { ic: { ic_mean: -0.2 }, quantiles: {} },
      },
      alpha2: {
        1: {
          ic: { ic_mean: 0.3, ic_ir: 0.8, t_stat: 6.1, positive_ratio: 0.6, observations: 198 },
          quantiles: { top_minus_bottom_spread: 0.03, monotonic_increasing: true },
        },
      },
    },
    screen: { horizon: 5, ranked: [{ factor: 'alpha2', ic_mean: 0.3 }, { factor: 'alpha1', ic_mean: -0.11 }] },
    source: { point_in_time_universe: true },
    factor_meta: [{ name: 'alpha1', family: 'K线形态', description: '实体涨跌幅' }],
    net_returns: [
      { score_column: 'alpha1', horizon: 5, top_k: 20, long_excess_net: 0.01 },
      { score_column: 'alpha1', horizon: 1, top_k: 50, long_excess_net: 0.02 },
      { score_column: 'alpha1', horizon: 1, top_k: 20, long_excess_net: 0.03 },
      { score_column: 'alpha2', horizon: 1, top_k: 20, long_excess_net: 0.04 },
    ],
  }
}

describe('progress labels', () => {
  it('labels the stage only while the job runs', () => {
    expect(jobProgressStageLabel({ status: 'running', progress_stage: 'screening_ic' })).toBe('IC 初筛')
    expect(jobProgressStageLabel({ status: 'completed', progress_stage: 'cost_adjustment' })).toBe('')
  })

  it('reports stage position out of the whole pipeline', () => {
    const progress = jobStageProgress({ status: 'running', progress_stage: 'running_diagnostics' })
    expect(progress).toMatchObject({ step: 5, total: 6, percent: 83 })
    expect(progress.label).toBe('阶段 5/6 · 分位/TopK 诊断')
  })

  it('has no stage progress for a stage it does not know', () => {
    expect(jobStageProgress({ status: 'running', progress_stage: 'nonsense' })).toBeNull()
    expect(jobStageProgress({ status: 'pending' })).toBeNull()
  })
})

describe('job list blurbs', () => {
  it('distinguishes a picked factor list from the whole set', () => {
    expect(jobFactorScopeLabel({ params: { factors: ['alpha1', 'alpha2'] } })).toBe('2 个指定因子')
    expect(jobFactorScopeLabel({ params: { factor_set: 'alpha158' } })).toBe('alpha158 全集')
  })

  it('summarises the artifact and stays empty without one', () => {
    expect(jobArtifactSummary({ artifact: { top_factor: 'alpha3', reported_factors: 20 } }))
      .toBe('最优 alpha3 · 诊断 20 个因子')
    expect(jobArtifactSummary({})).toBe('')
  })
})

describe('factor catalog helpers', () => {
  const catalog = [
    { name: 'alpha1', family: 'K线形态', description: '实体涨跌幅', expression: '($close-$open)' },
    { name: 'alpha4', family: 'K线形态', description: '上下影线', expression: '($close-$low)' },
    { name: 'MA5', family: '趋势', description: '5日均线', expression: 'Mean($close,5)' },
  ]

  it('groups by family, largest family first', () => {
    expect(groupFactorsByFamily(catalog).map((group) => [group.family, group.factors.length]))
      .toEqual([['K线形态', 2], ['趋势', 1]])
  })

  it('falls back to a bucket for entries without a family', () => {
    expect(groupFactorsByFamily([{ name: 'x' }])[0].family).toBe('其他')
  })

  it('searches name, description, expression and family', () => {
    expect(filterCatalogFactors(catalog, '均线').map((item) => item.name)).toEqual(['MA5'])
    expect(filterCatalogFactors(catalog, 'close-$low').map((item) => item.name)).toEqual(['alpha4'])
    expect(filterCatalogFactors(catalog, 'K线').map((item) => item.name)).toEqual(['alpha1', 'alpha4'])
    expect(filterCatalogFactors(catalog, '  ')).toHaveLength(3)
  })
})

describe('report views', () => {
  it('lists horizons numerically rather than as strings', () => {
    const report = sampleReport()
    report.factors.alpha1[10] = { ic: {} }
    expect(reportHorizons(report)).toEqual(['1', '5', '10'])
  })

  it('ranks IC rows for one horizon by absolute IC', () => {
    const rows = buildIcRows(sampleReport(), 1)
    expect(rows.map((row) => row.factor)).toEqual(['alpha2', 'alpha1'])
    expect(rows[1]).toMatchObject({ ic_ir: -0.4, spread: -0.025, monotonic: false })
  })

  it('skips factors that were not diagnosed at that horizon', () => {
    expect(buildIcRows(sampleReport(), 5).map((row) => row.factor)).toEqual(['alpha1'])
  })

  it('scales quantile bars against the largest absolute return', () => {
    const bars = buildQuantileBars(sampleReport().factors.alpha1[1])
    expect(bars.map((bar) => [bar.quantile, bar.percent, bar.cls]))
      .toEqual([['1', 100, 'pos'], ['2', 50, 'pos'], ['3', 25, 'neg']])
  })

  it('has no bars when the diagnostics are missing', () => {
    expect(buildQuantileBars(null)).toEqual([])
    expect(buildQuantileBars({ quantiles: {} })).toEqual([])
  })

  it('sorts yearly IC chronologically', () => {
    expect(buildYearlyIcRows(sampleReport().factors.alpha1[1]).map((row) => row.year))
      .toEqual(['2022', '2023'])
  })

  it('keeps one factor net returns ordered by horizon then top_k', () => {
    const rows = buildNetReturnRows(sampleReport(), 'alpha1')
    expect(rows.map((row) => [row.horizon, row.top_k])).toEqual([[1, 20], [1, 50], [5, 20]])
  })

  it('reads the date range out of the [min, max] pair', () => {
    const cards = buildCoverageCards(sampleReport())
    expect(cards.find((card) => card.k === '数据区间').v).toBe('2023-01-03 → 2023-12-29')
    expect(cards.find((card) => card.k === '峰值内存估算').v).toBe('3.50 GB')
  })

  it('counts the evaluated factor columns rather than stringifying the list', () => {
    const cards = buildCoverageCards(sampleReport())
    expect(cards.find((card) => card.k === '评估因子数').v).toBe('2')
  })

  it('names the skipped factors and reads the missing base field out of the reason', () => {
    expect(buildSkippedFactorRows(sampleReport())).toEqual([
      { name: 'VWAP0', reason: '价格面板缺少 $vwap 字段' },
    ])
  })

  it('passes an unrecognised reason through and ignores a report without skips', () => {
    expect(buildSkippedFactorRows({ skipped_factors: [{ name: 'MA20', reason: 'too slow' }, null] }))
      .toEqual([{ name: 'MA20', reason: 'too slow' }])
    expect(buildSkippedFactorRows({ skipped_factors: [{ name: 'MA20' }] }))
      .toEqual([{ name: 'MA20', reason: '未说明原因' }])
    expect(buildSkippedFactorRows({})).toEqual([])
    expect(buildSkippedFactorRows(null)).toEqual([])
  })

  it('flags a latest-only universe as needing review', () => {
    expect(universePitLabel(sampleReport())).toBe('Point-in-time（当时成分股）')
    expect(universePitLabel({ source: { point_in_time_universe: false } }))
      .toBe('Latest-only（成分股近似，需复核）')
  })

  it('finds factor metadata by name', () => {
    expect(findFactorMeta(sampleReport(), 'alpha1').family).toBe('K线形态')
    expect(findFactorMeta(sampleReport(), 'alpha2')).toBeNull()
  })
})

describe('buildFactorParamRows', () => {
  it('renders the screen scope and falls back for an unset screen horizon', () => {
    const rows = buildFactorParamRows({
      params: {
        index_code: 'csi1000',
        start_date: '20230101',
        end_date: '20231231',
        factor_set: 'alpha158',
        horizons: [1, 5],
        top_k: [20],
        screen_top: 20,
        screen_horizon: null,
        turnover: 0.5,
        slippage_bps: 10,
      },
    })
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    expect(byKey.screen).toBe('保留 20 个 @ 最长 horizon')
    expect(byKey.window).toBe('2023-01-01 → 2023-12-31')
    expect(byKey.horizons).toBe('1d, 5d')
    expect(byKey.turnover).toBe('50.00%')
    expect(byKey.factors).toBe('alpha158 全集')
  })

  it('has no rows without a job', () => {
    expect(buildFactorParamRows(null)).toEqual([])
  })
})
