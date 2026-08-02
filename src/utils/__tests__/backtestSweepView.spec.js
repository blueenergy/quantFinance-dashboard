import { describe, expect, it } from 'vitest'
import {
  buildBacktestSweepView,
  buildBacktestRecommendations,
  buildFacetEntries,
  filterRowsByAxis,
  formatStrategyParamsCell,
  listStrategyParamEntries,
  formatLowSampleHint,
  isLowSample,
  LOW_SAMPLE_TRADE_THRESHOLD,
  sortRows,
} from '../backtestSweepView.js'

const sampleRows = [
  {
    strategy_key: 'turtle',
    preset: 'default',
    strategy_params: { entry_period: 10 },
    total_return: 0.12,
    total_trades: 20,
  },
  {
    strategy_key: 'turtle',
    preset: 'default',
    strategy_params: { entry_period: 20 },
    total_return: 0.08,
    total_trades: 5,
  },
  {
    strategy_key: 'ma',
    preset: 'default',
    strategy_params: { fast: 5 },
    total_return: 0.15,
    total_trades: 30,
  },
]

describe('buildBacktestSweepView', () => {
  it('creates strategy namespace param axes', () => {
    const view = buildBacktestSweepView(sampleRows)
    expect(view.sweep_axes.some((a) => a.key === 'strategy_key')).toBe(true)
    expect(view.sweep_axes.some((a) => a.key === 'param:turtle:entry_period')).toBe(true)
    expect(view.sweep_axes.some((a) => a.key === 'param:ma:fast')).toBe(false)
  })
})

describe('buildFacetEntries', () => {
  it('picks best row per facet value by total_return', () => {
    const view = buildBacktestSweepView(sampleRows)
    const strategyAxis = view.sweep_axes.find((a) => a.key === 'strategy_key')
    const entries = buildFacetEntries(sampleRows, strategyAxis, 'total_return')
    const maEntry = entries.find((e) => e.value === 'ma')
    expect(maEntry.row.total_return).toBe(0.15)
  })
})

describe('filterRowsByAxis', () => {
  it('filters turtle entry_period facet', () => {
    const view = buildBacktestSweepView(sampleRows)
    const axis = view.sweep_axes.find((a) => a.key === 'param:turtle:entry_period')
    const filtered = filterRowsByAxis(sampleRows, axis, 10)
    expect(filtered.length).toBe(1)
    expect(filtered[0].strategy_params.entry_period).toBe(10)
  })
})

describe('formatStrategyParamsCell', () => {
  it('joins strategy params into one compact cell', () => {
    const text = formatStrategyParamsCell({
      strategy_key: 'atr_breakout',
      strategy_params: { period: 14, atr_mult: 1.5 },
    })
    expect(text).toBe('atr_mult=1.5, period=14')
  })
})

describe('listStrategyParamEntries', () => {
  it('lists sorted param entries for popover', () => {
    const entries = listStrategyParamEntries({
      strategy_params: { period: 14, use_filter: true },
    })
    expect(entries).toEqual([
      { key: 'period', value: '14' },
      { key: 'use_filter', value: 'true' },
    ])
  })
})

describe('sortRows and low sample', () => {
  it('sorts by metric and flags low trade count on completed rows only', () => {
    const sorted = sortRows(sampleRows, 'total_return', 'desc')
    expect(sorted[0].strategy_key).toBe('ma')
    expect(isLowSample(sorted.find((r) => r.total_trades === 5))).toBe(true)
    expect(isLowSample(sorted.find((r) => r.total_trades === 20))).toBe(false)
    expect(isLowSample({ status: 'pending', total_trades: 0 })).toBe(false)
    expect(isLowSample({ status: 'completed', total_trades: 0 })).toBe(true)
  })

  it('explains closed-round count and threshold in the low-sample hint', () => {
    expect(formatLowSampleHint({ total_trades: 5 })).toContain('本次完成 5 个平仓回合')
    expect(formatLowSampleHint({ total_trades: 5 })).toContain(`参考阈值 ${LOW_SAMPLE_TRADE_THRESHOLD} 次`)
  })
})

describe('buildBacktestRecommendations', () => {
  it('recommends a balanced, sufficiently sampled combo instead of the highest raw return', () => {
    const rows = [
      {
        task_id: 'risky',
        status: 'completed',
        strategy_key: 'momentum',
        total_return: 0.3,
        max_drawdown: 0.4,
        sharpe_ratio: 0.5,
        total_trades: 30,
      },
      {
        task_id: 'balanced',
        status: 'completed',
        strategy_key: 'turtle',
        total_return: 0.2,
        max_drawdown: 0.1,
        sharpe_ratio: 1.8,
        total_trades: 30,
      },
      {
        task_id: 'lucky-small-sample',
        status: 'completed',
        strategy_key: 'single_yang',
        total_return: 0.8,
        max_drawdown: 0.01,
        sharpe_ratio: 4,
        total_trades: 3,
      },
    ]

    const result = buildBacktestRecommendations(rows)

    expect(result.recommendedCombo.row.task_id).toBe('balanced')
    expect(result.bestStrategy.strategy_key).toBe('turtle')
    expect(result.eligibleCount).toBe(2)
    expect(result.excludedLowSampleCount).toBe(1)
  })

  it('does not claim a winner when every complete result has too few closed rounds', () => {
    const result = buildBacktestRecommendations([
      {
        status: 'completed',
        strategy_key: 'turtle',
        total_return: 0.2,
        max_drawdown: 0.1,
        sharpe_ratio: 1.5,
        total_trades: 4,
      },
    ])

    expect(result.recommendedCombo).toBeNull()
    expect(result.bestStrategy).toBeNull()
    expect(result.excludedLowSampleCount).toBe(1)
  })
})
