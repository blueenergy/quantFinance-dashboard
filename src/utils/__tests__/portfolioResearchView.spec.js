import { describe, expect, it } from 'vitest'
import {
  buildComboSummaryCards,
  buildEquityChart,
  buildResearchParamRows,
  buildYearlyReturnRows,
  filterAndSortTrades,
  formatDurationMs,
  formatJobDateTime,
  actualDataStartNotice,
  indexInceptionDate,
  researchStartBeforeInception,
  jobElapsedLabel,
  jobProgressStageLabel,
  jobWeightLabel,
  pct,
  pctTrailingStop,
  signClass,
  universeName,
} from '../portfolioResearchView.js'

describe('universeName', () => {
  it('resolves known universe labels', () => {
    expect(universeName('csi1000')).toContain('中证1000')
    expect(universeName('unknown')).toBe('unknown')
  })
})

describe('formatDurationMs', () => {
  it('formats seconds, minutes, and hours', () => {
    expect(formatDurationMs(5_000)).toBe('5 秒')
    expect(formatDurationMs(65_000)).toBe('1 分 5 秒')
    expect(formatDurationMs(3_600_000)).toBe('1 小时')
    expect(formatDurationMs(-1)).toBe('-')
  })
})

describe('formatJobDateTime', () => {
  it('formats valid task timestamps and handles missing values', () => {
    expect(formatJobDateTime('2024-01-01T00:00:00Z')).not.toBe('-')
    expect(formatJobDateTime(null)).toBe('-')
    expect(formatJobDateTime('invalid')).toBe('-')
  })
})

describe('jobWeightLabel', () => {
  it('joins array weights and trims string weights', () => {
    expect(jobWeightLabel({ params: { growth_cycle_weights: ['30:70', '40:60'] } })).toBe('30:70, 40:60')
    expect(jobWeightLabel({ params: { growth_cycle_weights: '  50:50  ' } })).toBe('50:50')
    expect(jobWeightLabel({
      params: {
        score_specs: [{ mode: 'column', column: 'composite_conservative_score' }],
      },
    })).toContain('基本面 30%')
    expect(jobWeightLabel({ params: {} })).toBe('')
  })
})

describe('jobElapsedLabel', () => {
  it('labels completed jobs with fixed duration', () => {
    const label = jobElapsedLabel({
      status: 'completed',
      started_at: '2024-01-01T00:00:00Z',
      completed_at: '2024-01-01T00:01:30Z',
    })
    expect(label).toBe('用时 1 分 30 秒')
  })

  it('labels running jobs relative to nowMs', () => {
    const started = Date.parse('2024-01-01T00:00:00Z')
    const label = jobElapsedLabel(
      { status: 'running', started_at: '2024-01-01T00:00:00Z' },
      started + 45_000,
    )
    expect(label).toBe('已运行 45 秒')
  })
})

describe('jobProgressStageLabel', () => {
  it('maps known stages only while running', () => {
    expect(jobProgressStageLabel({ status: 'running', progress_stage: 'running_sweep' })).toBe('参数扫描')
    expect(jobProgressStageLabel({ status: 'completed', progress_stage: 'running_sweep' })).toBe('')
    expect(jobProgressStageLabel({ status: 'running', progress_stage: 'custom_stage' })).toBe('custom_stage')
  })
})

describe('buildResearchParamRows', () => {
  it('builds labeled rows with trailing-stop formatting', () => {
    const rows = buildResearchParamRows({
      start_date: '20230101',
      end_date: '2024-06-01',
      universe_index: 'csi1000',
      params: {
        score_column: 'composite_growth_cycle_score',
        growth_cycle_weights: ['30:70'],
        selection_mode: 'dynamic_score_threshold',
        threshold_lookback_days: 15,
        max_positions: 25,
        top_n_values: [10, 20],
        horizon: 20,
        active_caps: [0.2],
        trailing_stop_pcts: [0, 0.15],
        force: false,
      },
    })
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    expect(byKey.start_date).toBe('2023-01-01')
    expect(byKey.universe_index).toContain('中证1000')
    expect(byKey.selection_mode).toBe('动态评分阈值')
    expect(byKey.threshold_lookback_days).toBe(15)
    expect(byKey.max_positions).toBe(25)
    expect(byKey.top_n_values).toBe('10, 20')
    expect(byKey.trailing_stop_pcts).toBe('关闭, 15.00%')
    expect(byKey.regime_modes).toBe('始终满仓')
    expect(byKey.force).toBe('false')
  })

  it('shows legacy jobs as fixed Top N selection', () => {
    const rows = buildResearchParamRows({ params: {} })
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    expect(byKey.selection_mode).toBe('固定 Top N')
  })
})

describe('pct / signClass', () => {
  it('formats percentages and sign classes', () => {
    expect(pct(0.1234)).toBe('12.34%')
    expect(pct(undefined)).toBe('-')
    expect(signClass(1)).toBe('pos')
    expect(signClass(-0.5)).toBe('neg')
    expect(signClass(0)).toBe('mut')
  })

  it('formats trailing stop ratios from decimals or legacy percent points', () => {
    expect(pctTrailingStop(0.15)).toBe('15.00%')
    expect(pctTrailingStop(15)).toBe('15.00%')
    expect(pctTrailingStop(0)).toBe('关闭')
  })
})

describe('filterAndSortTrades', () => {
  it('filters by score date and sorts the matching rows', () => {
    const trades = [
      { score_date: '2024-01-02', symbol: '600001.SH', score_value: 70 },
      { score_date: '2024-01-01', symbol: '600002.SH', score_value: 80 },
      { score_date: '2024-01-02', symbol: '600003.SH', score_value: 90 },
    ]

    expect(filterAndSortTrades(trades, {
      dateFilter: '2024-01-02',
      sortKey: 'score_value',
      sortDir: -1,
    })).toEqual([
      trades[2],
      trades[0],
    ])
  })
})

describe('buildComboSummaryCards', () => {
  it('includes annualized return when present', () => {
    const cards = buildComboSummaryCards({
      cumulative_return: 0.5,
      annualized_return: 0.2,
      sharpe: 1.1,
      max_drawdown: -0.1,
      index_excess_cumulative_return: 0.08,
      average_turnover: 0.3,
      average_exposure: 0.54,
      periods: 24,
    })
    expect(cards.map((card) => card.k)).toContain('年化收益')
    expect(cards.find((card) => card.k === '年化收益')?.v).toBe('20.00%')
    expect(cards.find((card) => card.k === '平均暴露')?.v).toBe('54.00%')
  })
})

describe('buildYearlyReturnRows', () => {
  it('sorts yearly returns and pairs index excess', () => {
    expect(buildYearlyReturnRows({
      yearly_returns: { 2024: 0.1, 2022: -0.05 },
      yearly_index_excess: { 2022: 0.01, 2024: 0.02 },
    })).toEqual([
      { year: '2022', portfolioReturn: -0.05, indexExcess: 0.01 },
      { year: '2024', portfolioReturn: 0.1, indexExcess: 0.02 },
    ])
  })
})

describe('researchStartBeforeInception', () => {
  it('flags a research window that starts before the index launched', () => {
    expect(researchStartBeforeInception('a500', '20230101')).toEqual({
      universeIndex: 'a500',
      startDate: '2023-01-01',
      inceptionDate: '2024-09-23',
    })
  })

  it('returns null when the start date is on or after inception', () => {
    expect(researchStartBeforeInception('a500', '20241001')).toBeNull()
    expect(researchStartBeforeInception('a500', '20240923')).toBeNull()
  })

  it('returns null for unknown universes or malformed dates', () => {
    expect(researchStartBeforeInception('unknown', '20230101')).toBeNull()
    expect(researchStartBeforeInception('a500', '')).toBeNull()
    expect(indexInceptionDate('hs300')).toBe('20050408')
  })
})

describe('actualDataStartNotice', () => {
  it('notifies when real data starts after the requested start', () => {
    expect(actualDataStartNotice('20200101', '20200715')).toEqual({
      requestedStart: '2020-01-01',
      actualStart: '2020-07-15',
    })
  })

  it('returns null when data starts on or before the requested start', () => {
    expect(actualDataStartNotice('20200101', '20200101')).toBeNull()
    expect(actualDataStartNotice('20210101', '20200715')).toBeNull()
  })

  it('returns null for missing or malformed dates', () => {
    expect(actualDataStartNotice('20200101', '')).toBeNull()
    expect(actualDataStartNotice('', '20200715')).toBeNull()
    expect(actualDataStartNotice('20200101', null)).toBeNull()
  })
})

describe('buildEquityChart', () => {
  it('returns null for empty periods', () => {
    expect(buildEquityChart([])).toBeNull()
  })

  it('builds chart points for one period', () => {
    const chart = buildEquityChart([{
      score_date: '2024-01-02',
      portfolio_return_net: 0.1,
      index_benchmark_return: 0.05,
    }])

    expect(chart).toMatchObject({
      hasIdx: true,
      firstDate: '2024-01-01',
      lastDate: '2024-01-02',
    })
    expect(chart.stratPath).toContain(' C ')
    expect(chart.idxPath).toContain(' C ')
    expect(chart.curvePoints).toHaveLength(2)
    expect(chart.stratSmoothPoints.split(' ').length).toBeGreaterThan(10)
    expect(chart.stratSmoothPoints).not.toMatch(/NaN|Infinity/)
  })

  it('shows quarterly ticks for ranges up to one year', () => {
    const chart = buildEquityChart([
      { score_date: '2024-01-03', portfolio_return_net: 0.01 },
      { score_date: '2024-04-03', portfolio_return_net: 0.01 },
      { score_date: '2024-07-02', portfolio_return_net: 0.01 },
      { score_date: '2024-12-02', portfolio_return_net: 0.01 },
    ])

    expect(chart.xAxisGranularity).toBe('quarter')
    expect(chart.axisTicks.map((tick) => tick.label)).toEqual([
      '2024-01-01',
      '2024 Q2',
      '2024 Q3',
      '2024 Q4',
      '2024-12-02',
    ])
  })

  it('shows yearly ticks for ranges longer than one year', () => {
    const chart = buildEquityChart([
      { score_date: '2020-01-02', portfolio_return_net: 0.01 },
      { score_date: '2021-01-04', portfolio_return_net: 0.01 },
      { score_date: '2022-01-04', portfolio_return_net: 0.01 },
      { score_date: '2024-02-01', portfolio_return_net: 0.01 },
    ])

    expect(chart.xAxisGranularity).toBe('year')
    expect(chart.axisTicks.map((tick) => tick.label)).toEqual([
      '2020-01-01',
      '2021',
      '2022',
      '2023',
      '2024',
      '2024-02-01',
    ])
  })

  it('preserves every yearly label and rotates dense labels', () => {
    const periods = Array.from({ length: 21 }, (_, index) => ({
      score_date: `${2000 + index}-01-02`,
      portfolio_return_net: 0.01,
    }))
    const chart = buildEquityChart(periods)

    expect(chart.axisTicks[0].label).toBe('2000-01-01')
    expect(chart.axisTicks.at(-1).label).toBe('2020-01-02')
    expect(chart.axisTicks.map((tick) => tick.label)).toContain('2004')
    expect(chart.axisTicks).toHaveLength(22)
    expect(chart.axisTicks.every((tick) => tick.rotate === -35)).toBe(true)
  })

  it('uses equal-width calendar years on the time axis', () => {
    const chart = buildEquityChart([
      {
        score_date: '2023-01-03',
        period_end_date: '2023-12-31',
        portfolio_return_net: 0.1,
      },
      {
        score_date: '2024-01-03',
        period_end_date: '2024-12-31',
        portfolio_return_net: 0.1,
      },
    ])
    const ticks = Object.fromEntries(chart.axisTicks.map((tick) => [tick.label, tick.x]))

    expect(ticks['2024'] - ticks['2023-01-01'])
      .toBeCloseTo(ticks['2024-12-31'] - ticks['2024'], 8)
  })

  it('derives period completion dates and yearly boundary equities from trades', () => {
    const chart = buildEquityChart([
      { score_date: '2023-01-03', portfolio_return_net: 0.1 },
      { score_date: '2023-11-01', portfolio_return_net: 0.2 },
    ], [
      { score_date: '2023-01-03', sell_date: '2023-06-30' },
      { score_date: '2023-11-01', sell_date: '2024-01-10' },
    ])

    expect(chart.equityEvents.map((event) => event.endDate)).toEqual([
      '2023-06-30',
      '2024-01-10',
    ])
    expect(chart.yearBoundaries).toMatchObject([
      { year: 2023, startStratEquity: 1, endStratEquity: 1.1 },
      { year: 2024, startStratEquity: 1.1, endStratEquity: 1.32 },
    ])
    expect(new Set(
      chart.hoverPoints.map((point) => Math.round(point.accountValue)),
    ).size).toBeGreaterThan(2)
  })

  it('reports long flat stretches as data gaps', () => {
    const chart = buildEquityChart([
      { score_date: '2023-01-03', portfolio_return_net: 0.05 },
      { score_date: '2024-10-31', portfolio_return_net: 0.1 },
    ], [
      { score_date: '2023-01-03', sell_date: '2023-01-17' },
      { score_date: '2024-10-31', sell_date: '2024-11-14' },
    ])

    expect(chart.dataGaps).toHaveLength(1)
    expect(chart.dataGaps[0]).toMatchObject({
      fromDate: '2023-01-17',
      toDate: '2024-10-31',
    })
    expect(chart.dataGaps[0].days).toBeGreaterThan(600)
  })

  it('reports no gaps for a densely sampled curve', () => {
    const periods = Array.from({ length: 12 }, (_, index) => ({
      score_date: `2024-${String(index + 1).padStart(2, '0')}-05`,
      portfolio_return_net: 0.01,
    }))
    const chart = buildEquityChart(periods)
    expect(chart.dataGaps).toHaveLength(0)
  })

  it('stops at the latest real date and exposes hover account values', () => {
    const chart = buildEquityChart([{
      score_date: '2026-07-25',
      portfolio_return_net: 0.1,
    }], [], 2_000_000)

    expect(chart.lastDate).toBe('2026-07-25')
    expect(chart.axisTicks.at(-1).label).toBe('2026-07-25')
    expect(chart.hoverPoints.at(-1)).toMatchObject({
      date: '2026-07-25',
      accountValue: 2_200_000,
    })
  })

  it('paints merged bull/bear bands from period regime labels', () => {
    const chart = buildEquityChart([
      {
        score_date: '2024-01-03',
        period_end_date: '2024-01-17',
        portfolio_return_net: 0.02,
        regime_label: 'bull',
      },
      {
        score_date: '2024-01-18',
        period_end_date: '2024-01-31',
        portfolio_return_net: 0.0,
        regime_label: 'bull',
      },
      {
        score_date: '2024-02-01',
        period_end_date: '2024-02-15',
        portfolio_return_net: 0.0,
        regime_label: 'bear',
      },
    ])

    expect(chart.regimeBands).toHaveLength(2)
    expect(chart.regimeBands[0]).toMatchObject({ label: 'bull', displayLabel: '牛市' })
    expect(chart.regimeBands[1]).toMatchObject({ label: 'bear', displayLabel: '熊市' })
    expect(chart.hoverPoints.some((point) => point.regimeLabel === '牛市')).toBe(true)
    expect(chart.hoverPoints.some((point) => point.regimeLabel === '熊市')).toBe(true)
  })

  it('omits bands when combo JSON has no regime labels', () => {
    const chart = buildEquityChart([{
      score_date: '2024-01-02',
      portfolio_return_net: 0.02,
    }])
    expect(chart.regimeBands).toEqual([])
  })
})
