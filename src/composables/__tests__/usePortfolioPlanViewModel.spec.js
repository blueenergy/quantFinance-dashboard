import { describe, expect, it } from 'vitest'
import {
  buildPlanExecutionState,
  buildPlanReviewRiskSummary,
  buildPlanSignalMaps,
  buildPlanTargetRows,
  executionVenueFromPlan,
  executionVenueFromPortfolio,
  normalizePlanItemRow,
  summarizePlanRows,
} from '../usePortfolioPlanViewModel'

describe('portfolio plan row view model', () => {
  it('corrects hold actions with nonzero share deltas', () => {
    expect(normalizePlanItemRow({
      action: 'hold',
      current_shares: 100,
      target_shares: 200,
    })).toMatchObject({
      action: 'buy',
      delta_shares: 100,
    })
    expect(normalizePlanItemRow({
      action: 'hold',
      current_shares: 200,
      target_shares: 100,
    })).toMatchObject({
      action: 'sell',
      delta_shares: -100,
    })
    expect(normalizePlanItemRow({
      action: 'hold',
      current_shares: 0,
      target_shares: 100,
    })).toMatchObject({
      action: 'buy',
      delta_shares: 100,
    })
    expect(normalizePlanItemRow({
      action: 'hold',
      current_shares: 100,
      target_shares: 0,
    })).toMatchObject({
      action: 'sell',
      delta_shares: -100,
    })
  })

  it('summarizes actionable row counts', () => {
    expect(summarizePlanRows([
      { action: 'buy' },
      { action: 'buy' },
      { action: 'sell' },
      { action: 'hold' },
      { action: 'skip' },
    ])).toEqual({ buy: 2, sell: 1, hold: 1 })
  })

  it('filters skip rows and sorts by score, action, then symbol', () => {
    const rows = buildPlanTargetRows([
      { symbol: '000004.SZ', action: 'skip', score_value: 99 },
      { symbol: '000003.SZ', action: 'sell', score_value: 8 },
      { symbol: '000002.SZ', action: 'buy', score_value: 8 },
      { symbol: '000001.SZ', action: 'buy', score_value: 8 },
      { symbol: '000005.SZ', action: 'hold' },
      { symbol: '000006.SZ', action: 'buy', score_value: 9 },
    ])

    expect(rows.map((row) => row.symbol)).toEqual([
      '000006.SZ',
      '000001.SZ',
      '000002.SZ',
      '000003.SZ',
      '000005.SZ',
    ])
  })

  it('builds risk counts and full/bare-symbol signal maps', () => {
    const risk = { severity: 'high' }
    const opportunity = { summary: 'upside' }
    const internalSwot = { strengths: ['quality'] }
    const rows = [
      {
        symbol: '000001.SZ',
        ai_risk: risk,
        ai_opportunity: opportunity,
        internal_swot: internalSwot,
      },
      { symbol: '000002.SZ', ai_risk: { severity: 'low' } },
    ]

    expect(buildPlanReviewRiskSummary(rows)).toEqual({ high: 1, medium: 0, low: 1 })
    const maps = buildPlanSignalMaps(rows)
    expect(maps.holdingPlanRiskBySymbol['000001.SZ']).toBe(risk)
    expect(maps.holdingPlanRiskBySymbol['000001']).toBe(risk)
    expect(maps.holdingPlanOpportunityBySymbol['000001']).toBe(opportunity)
    expect(maps.holdingPlanInternalSwotBySymbol['000001']).toBe(internalSwot)
  })
})

describe('portfolio plan execution view model', () => {
  it('adapts portfolio and plan execution venues', () => {
    expect(executionVenueFromPortfolio({ execution_venue: 'live' })).toBe('live')
    expect(executionVenueFromPortfolio({ execution_venue: 'paper' })).toBe('paper')
    expect(executionVenueFromPortfolio()).toBe('')
    expect(executionVenueFromPortfolio({ execution_venue: 'unknown' })).toBe('')
    expect(executionVenueFromPlan({ capital_basis: 'rolling_paper' })).toBe('paper')
    expect(executionVenueFromPlan({ capital_basis: 'account_equity' })).toBe('live')
  })

  it('allows an approved paper plan to execute', () => {
    const state = buildPlanExecutionState({
      plan: { status: 'approved' },
      executionStatus: { execution_count: 0, open_price_ready: true },
      executionMode: 'not_executed',
      venue: 'paper',
    })

    expect(state).toMatchObject({
      paperExecutionCount: 0,
      hasPaperExecution: false,
      selectedPlanHasLiveSignals: false,
      canExecutePaperNow: true,
      canPublishLiveSignals: false,
      canCancelCurrentPlan: true,
      selectedPlanExecutionModeLabel: '未执行',
    })
    expect(state.paperExecuteReadyText).toContain('execute_date')
  })

  it('allows an unpublished approved live plan to publish', () => {
    const state = buildPlanExecutionState({
      plan: { status: 'approved' },
      executionMode: 'not_executed',
      liveExecutionContext: { signal_count: 0 },
      venue: 'live',
    })

    expect(state.selectedPlanHasPublishedLiveSignals).toBe(false)
    expect(state.canPublishLiveSignals).toBe(true)
    expect(state.canExecutePaperNow).toBe(false)
  })

  it('blocks duplicate actions after live signals exist', () => {
    const state = buildPlanExecutionState({
      plan: { status: 'approved' },
      executionMode: 'live',
      liveExecutionContext: { signal_count: 2, active_signal_count: 1 },
      venue: 'live',
    })

    expect(state.selectedPlanHasPublishedLiveSignals).toBe(true)
    expect(state.canPublishLiveSignals).toBe(false)
    expect(state.selectedPlanExecutionModeLabel).toBe('实盘信号在途 1/2')
  })

  it('supports the Plans live-mode publication fallback', () => {
    const state = buildPlanExecutionState({
      plan: { status: 'approved' },
      executionMode: 'live',
      liveExecutionModeImpliesPublished: true,
      venue: 'live',
    })

    expect(state.selectedPlanHasPublishedLiveSignals).toBe(true)
    expect(state.canPublishLiveSignals).toBe(false)
  })
})
