import { describe, expect, it } from 'vitest'
import {
  cycleProgressPct,
  foldedTimeline,
  formatSyncedAt,
  portfolioKey,
} from '../portfolioOverviewFormat'

describe('portfolio overview formatting', () => {
  it('folds consecutive passive monitor nodes', () => {
    const nodes = [
      {
        node_type: 'monitor',
        action_required: false,
        date: '2026-07-18',
        drift_brief: { estimated_turnover: 0.04 },
      },
      {
        node_type: 'monitor',
        action_required: false,
        date: '2026-07-19',
        drift_brief: { estimated_turnover: 0.08 },
      },
    ]

    expect(foldedTimeline(nodes)).toEqual([
      {
        type: 'monitor_fold',
        start: '2026-07-18',
        end: '2026-07-19',
        count: 2,
        maxDrift: 0.08,
      },
    ])
  })

  it('ends a passive monitor fold at an action-required node', () => {
    const actionNode = {
      node_type: 'monitor',
      action_required: true,
      date: '2026-07-19',
    }
    const nodes = [
      { node_type: 'monitor', action_required: false, date: '2026-07-18' },
      actionNode,
      { node_type: 'monitor', action_required: false, date: '2026-07-20' },
    ]

    expect(foldedTimeline(nodes)).toEqual([
      {
        type: 'monitor_fold',
        start: '2026-07-18',
        end: '2026-07-18',
        count: 1,
        maxDrift: 0,
      },
      { type: 'node', node: actionNode },
      {
        type: 'monitor_fold',
        start: '2026-07-20',
        end: '2026-07-20',
        count: 1,
        maxDrift: 0,
      },
    ])
  })

  it('builds distinct portfolio keys from strategy and parameter lineage', () => {
    const keys = [
      portfolioKey({ strategy_template_id: 'alpha', params_hash: 'hash-a' }),
      portfolioKey({ strategy_template_id: 'alpha', params_hash: 'hash-b' }),
      portfolioKey({ strategy_template_id: 'beta', params_hash: 'hash-a' }),
    ]

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('preserves cycle progress calculation and caps it at one hundred', () => {
    expect(cycleProgressPct(null)).toBe(0)
    expect(cycleProgressPct({
      current_cycle: { elapsed_trading_days: -2, rebalance_days: 10 },
    })).toBe(-20)
    expect(cycleProgressPct({
      current_cycle: { elapsed_trading_days: 4, rebalance_days: 10 },
    })).toBe(40)
    expect(cycleProgressPct({
      current_cycle: { elapsed_trading_days: 12, rebalance_days: 10 },
    })).toBe(100)
  })

  it('formats valid epoch seconds and rejects invalid sync times', () => {
    expect(formatSyncedAt(undefined)).toBe('')
    expect(formatSyncedAt('invalid')).toBe('')
    expect(formatSyncedAt(0)).toBe('')
    expect(formatSyncedAt(-1)).toBe('')
    expect(formatSyncedAt(1_700_000_000)).toBe(
      new Date(1_700_000_000 * 1000).toLocaleString(),
    )
  })
})
