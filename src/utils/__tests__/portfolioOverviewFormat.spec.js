import { describe, expect, it } from 'vitest'
import {
  cycleProgressPct,
  foldedTimeline,
  formatSyncedAt,
  planCompletionIncompleteCount,
  overviewDeepLinkParams,
  overviewPanelFromPending,
  overviewPortfolioKeyFromParams,
  normalizeOverviewPanel,
  portfolioKey,
  shouldShowCatchUpPanel,
  shouldShowOverviewCatchUpGrid,
  shouldShowPlanCompletionPanel,
  shouldShowPlanOpsPanel,
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

  it('maps overview deep-link params to the existing portfolio key', () => {
    const row = { strategy_template_id: 'alpha', params_hash: 'hash-a', plan_id: 'plan-1' }
    expect(overviewDeepLinkParams(row, { plan_id: row.plan_id, panel: 'cycle' })).toEqual({
      strategy: 'alpha',
      params_hash: 'hash-a',
      plan_id: 'plan-1',
      panel: 'cycle',
    })
    expect(overviewPortfolioKeyFromParams({ strategy: 'alpha', params_hash: 'hash-a' })).toBe(
      portfolioKey(row),
    )
    expect(overviewPortfolioKeyFromParams({ strategy: 'alpha' })).toBe('')
    expect(overviewPortfolioKeyFromParams({ params_hash: 'hash-a' })).toBe('')
    expect(overviewDeepLinkParams({}, { plan_id: '  ', panel: null })).toEqual({})
  })

  it('normalizes overview panel ids and ignores tab-only deep links', () => {
    expect(normalizeOverviewPanel('cycle')).toBe('cycle')
    expect(normalizeOverviewPanel('fills')).toBe('fills')
    expect(normalizeOverviewPanel('holdings')).toBe('holdings')
    expect(normalizeOverviewPanel('unknown')).toBe('holdings')
    expect(normalizeOverviewPanel('')).toBe('holdings')
    expect(normalizeOverviewPanel(null)).toBe('holdings')
    expect(overviewPanelFromPending({ strategy: 'alpha', params_hash: 'hash-a' })).toBe('holdings')
    expect(overviewPanelFromPending({
      strategy: 'alpha',
      params_hash: 'hash-a',
      panel: 'cycle',
    })).toBe('cycle')
    expect(overviewPanelFromPending({ requestId: 1, panel: 'fills' })).toBeNull()
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

describe('portfolio overview panel visibility', () => {
  it('counts incomplete plan-completion rows', () => {
    expect(planCompletionIncompleteCount(null)).toBe(0)
    expect(planCompletionIncompleteCount([])).toBe(0)
    expect(planCompletionIncompleteCount([
      { complete: true },
      { complete: false },
      { complete: false },
    ])).toBe(2)
  })

  it('shows catch-up only for live plans that have cancelled buys', () => {
    expect(shouldShowCatchUpPanel({
      isLivePortfolio: true,
      operationPlanId: 'plan-1',
      catchUpRowCount: 0,
    })).toBe(false)
    expect(shouldShowCatchUpPanel({
      isLivePortfolio: true,
      operationPlanId: 'plan-1',
      catchUpRowCount: 2,
    })).toBe(true)
    expect(shouldShowCatchUpPanel({
      isLivePortfolio: false,
      operationPlanId: 'plan-1',
      catchUpRowCount: 2,
    })).toBe(false)
    expect(shouldShowCatchUpPanel({
      isLivePortfolio: true,
      operationPlanId: '',
      catchUpRowCount: 2,
    })).toBe(false)
  })

  it('shows completion only for live plans with fill gaps', () => {
    expect(shouldShowPlanCompletionPanel({
      isLivePortfolio: true,
      operationPlanId: 'plan-1',
      incompleteCount: 0,
    })).toBe(false)
    expect(shouldShowPlanCompletionPanel({
      isLivePortfolio: true,
      operationPlanId: 'plan-1',
      incompleteCount: 1,
    })).toBe(true)
    expect(shouldShowPlanCompletionPanel({
      isLivePortfolio: false,
      operationPlanId: 'plan-1',
      incompleteCount: 3,
    })).toBe(false)
  })

  it('shows the catch-up grid when either child panel is visible', () => {
    expect(shouldShowOverviewCatchUpGrid({
      showCatchUp: false,
      showCompletion: false,
    })).toBe(false)
    expect(shouldShowOverviewCatchUpGrid({ showCatchUp: true })).toBe(true)
    expect(shouldShowOverviewCatchUpGrid({ showCompletion: true })).toBe(true)
  })

  it('shows plan ops only while a next execution step remains', () => {
    const base = {
      operationPlanId: 'plan-1',
      planStatus: 'approved',
      isPaperPortfolio: false,
      isLivePortfolio: true,
    }
    expect(shouldShowPlanOpsPanel({
      ...base,
      awaitingPublishOrExecute: true,
    })).toBe(true)
    expect(shouldShowPlanOpsPanel({
      ...base,
      isLivePortfolio: false,
      isPaperPortfolio: true,
      canExecutePaperNow: true,
    })).toBe(true)
    expect(shouldShowPlanOpsPanel({
      ...base,
      remainderActionableCount: 2,
    })).toBe(true)
    expect(shouldShowPlanOpsPanel({
      ...base,
      completionIncompleteCount: 1,
    })).toBe(true)
    expect(shouldShowPlanOpsPanel(base)).toBe(false)
    expect(shouldShowPlanOpsPanel({
      ...base,
      isLivePortfolio: false,
      isPaperPortfolio: true,
    })).toBe(false)
    expect(shouldShowPlanOpsPanel({
      ...base,
      planStatus: 'needs_review',
      awaitingPublishOrExecute: true,
    })).toBe(false)
    expect(shouldShowPlanOpsPanel({
      ...base,
      operationPlanId: '',
      awaitingPublishOrExecute: true,
    })).toBe(false)
  })
})
