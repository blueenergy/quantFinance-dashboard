import { describe, expect, it } from 'vitest'
import {
  buildEquityChart,
  buildResearchParamRows,
  filterAndSortTrades,
  formatDurationMs,
  jobElapsedLabel,
  jobProgressStageLabel,
  jobWeightLabel,
  pct,
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

describe('jobWeightLabel', () => {
  it('joins array weights and trims string weights', () => {
    expect(jobWeightLabel({ params: { growth_cycle_weights: ['30:70', '40:60'] } })).toBe('30:70, 40:60')
    expect(jobWeightLabel({ params: { growth_cycle_weights: '  50:50  ' } })).toBe('50:50')
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
    expect(byKey.top_n_values).toBe('10, 20')
    expect(byKey.trailing_stop_pcts).toBe('关闭, 15.00%')
    expect(byKey.force).toBe('false')
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
      firstDate: '2024-01-02',
      lastDate: '2024-01-02',
    })
    expect(chart.stratPoints.split(' ')).toHaveLength(2)
    expect(chart.idxPoints.split(' ')).toHaveLength(2)
  })
})
