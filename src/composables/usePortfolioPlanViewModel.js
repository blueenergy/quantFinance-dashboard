import { computed, toValue } from 'vue'
import {
  canExecutePaperNowFromState,
  paperExecuteReadyTextFromState,
} from '../utils/paperExecutionEligibility'

const ACTION_ORDER = { buy: 0, sell: 1, hold: 2, skip: 3 }

export function normalizePlanItemRow(item) {
  // Live enrichment overwrites current_shares with strategy/account fills.
  // Infer buy/sell from plan baseline + stored delta, never from live current.
  const displayCurrent = Number(item?.current_shares ?? 0)
  const hasPlanCurrent = item?.plan_current_shares != null && item?.plan_current_shares !== ''
  const planCurrent = Number(hasPlanCurrent ? item.plan_current_shares : displayCurrent)
  const target = Number(item?.target_shares ?? 0)
  const parsedDelta = Number(item?.delta_shares)
  const delta = Number.isFinite(parsedDelta) ? parsedDelta : (target - planCurrent)
  let action = String(item?.action || '').trim().toLowerCase()
  if (!action) {
    if (delta > 0) action = 'buy'
    else if (delta < 0) action = 'sell'
    else if (target > 0) action = 'hold'
    else action = 'skip'
  }
  if (action === 'hold' && delta !== 0) {
    action = delta > 0 ? 'buy' : 'sell'
  }
  return {
    ...item,
    action,
    current_shares: displayCurrent,
    plan_current_shares: hasPlanCurrent ? planCurrent : item?.plan_current_shares,
    target_shares: target,
    delta_shares: delta,
  }
}

export function summarizePlanRows(rows) {
  return (rows || []).reduce(
    (summary, row) => {
      if (row.action === 'buy') summary.buy += 1
      else if (row.action === 'sell') summary.sell += 1
      else if (row.action === 'hold') summary.hold += 1
      return summary
    },
    { buy: 0, sell: 0, hold: 0 },
  )
}

export function buildPlanTargetRows(items) {
  return (items || [])
    .map((item) => normalizePlanItemRow(item))
    .filter((item) => item.action !== 'skip')
    .sort((a, b) => {
      const aScore = Number(a.score_value)
      const bScore = Number(b.score_value)
      const aHasScore = Number.isFinite(aScore)
      const bHasScore = Number.isFinite(bScore)
      if (aHasScore && bHasScore && bScore !== aScore) return bScore - aScore
      if (aHasScore !== bHasScore) return aHasScore ? -1 : 1
      return (ACTION_ORDER[a.action] ?? 9) - (ACTION_ORDER[b.action] ?? 9)
        || String(a.symbol).localeCompare(String(b.symbol))
    })
}

/**
 * Resolve original plan trade intent. Prefer stored action/delta and
 * plan_current_shares — never re-infer buy/sell from live-enriched current.
 */
export function resolvePlanTradeIntent(item) {
  const target = Number(item?.target_shares || 0)
  const hasPlanCurrent = item?.plan_current_shares != null && item?.plan_current_shares !== ''
  const planCurrent = Number(
    hasPlanCurrent ? item.plan_current_shares : (item?.current_shares ?? 0),
  )
  let action = String(item?.action || '').trim().toLowerCase()
  const phase = String(item?.execution_phase || '').trim().toLowerCase()
  if ((!action || action === 'hold' || action === 'skip')
    && (phase === 'buy' || phase === 'sell')) {
    action = phase
  }
  let delta = Number(item?.delta_shares)
  if (!Number.isFinite(delta)) {
    delta = target - planCurrent
  }
  // Only infer when the plan did not record a directional action.
  // Explicit buy/sell must not flip after live fills push current past target.
  if (!action || action === 'hold' || action === 'skip') {
    if (delta > 0) action = 'buy'
    else if (delta < 0) action = 'sell'
    else if (target > 0) action = 'hold'
    else action = 'skip'
  }
  return {
    action,
    delta_shares: delta,
    plan_current_shares: Number.isFinite(planCurrent) ? planCurrent : 0,
    target_shares: Number.isFinite(target) ? target : 0,
  }
}

/**
 * Per-symbol plan completion for overview: target / filled / gap.
 * Uses live enrichment fields from getPortfolioPlan when present.
 */
export function buildPlanCompletionRows(items) {
  return (items || [])
    .map((item) => {
      const intent = resolvePlanTradeIntent(item)
      if (intent.action !== 'buy' && intent.action !== 'sell') return null

      const target = intent.target_shares
      const strategyCurrent = Number(
        item.strategy_current_shares
        ?? (item.plan_current_shares != null ? item.current_shares : null)
        ?? intent.plan_current_shares
        ?? 0,
      )
      const planned = Math.abs(Number(intent.delta_shares || 0))
      const filled = Number(item.live_filled_qty || 0)
      let gap = Number(item.live_remaining_qty)
      if (!Number.isFinite(gap)) {
        gap = intent.action === 'buy'
          ? Math.max(0, target - strategyCurrent)
          : Math.max(0, strategyCurrent - target)
      }
      gap = Math.max(0, Math.floor(gap))
      const liveStatus = item.live_status ? String(item.live_status) : ''
      const complete = gap <= 0 && (
        liveStatus === 'filled'
        || (planned > 0 && filled >= planned)
        || (intent.action === 'buy' ? strategyCurrent >= target : strategyCurrent <= target)
      )
      return {
        symbol: item.symbol,
        name: item.name || '',
        action: intent.action,
        target_shares: target,
        current_shares: strategyCurrent,
        planned_shares: planned,
        filled_shares: Number.isFinite(filled) ? filled : 0,
        gap_shares: gap,
        live_status: liveStatus || (planned > 0 ? 'not_started' : ''),
        complete: Boolean(complete),
      }
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.complete) - Number(b.complete)
      || (ACTION_ORDER[a.action] ?? 9) - (ACTION_ORDER[b.action] ?? 9)
      || String(a.symbol).localeCompare(String(b.symbol)))
}

export function summarizePlanCompletion(rows) {
  const list = rows || []
  return list.reduce(
    (summary, row) => {
      summary.total += 1
      if (row.complete) summary.complete += 1
      else summary.incomplete += 1
      if (row.action === 'buy' && !row.complete) summary.incomplete_buys += 1
      if (row.action === 'sell' && !row.complete) summary.incomplete_sells += 1
      return summary
    },
    { total: 0, complete: 0, incomplete: 0, incomplete_buys: 0, incomplete_sells: 0 },
  )
}

export function buildPlanReviewRiskSummary(rows) {
  return (rows || []).reduce(
    (summary, row) => {
      const severity = row.ai_risk?.severity
      if (severity === 'high') summary.high += 1
      else if (severity === 'medium') summary.medium += 1
      else if (severity === 'low') summary.low += 1
      return summary
    },
    { high: 0, medium: 0, low: 0 },
  )
}

function indexSignal(map, row, key) {
  if (!row?.symbol || !row[key]) return
  map[row.symbol] = row[key]
  const bareSymbol = String(row.symbol).split('.')[0]
  if (bareSymbol) map[bareSymbol] = row[key]
}

export function buildPlanSignalMaps(rows) {
  const holdingPlanRiskBySymbol = {}
  const holdingPlanOpportunityBySymbol = {}
  const holdingPlanInternalSwotBySymbol = {}
  for (const row of rows || []) {
    indexSignal(holdingPlanRiskBySymbol, row, 'ai_risk')
    indexSignal(holdingPlanOpportunityBySymbol, row, 'ai_opportunity')
    indexSignal(holdingPlanInternalSwotBySymbol, row, 'internal_swot')
  }
  return {
    holdingPlanRiskBySymbol,
    holdingPlanOpportunityBySymbol,
    holdingPlanInternalSwotBySymbol,
  }
}

export function executionVenueFromPortfolio(portfolio) {
  const venue = portfolio?.execution_venue
  if (venue === 'live') return 'live'
  if (venue === 'paper') return 'paper'
  return ''
}

export function executionVenueFromPlan(plan) {
  const capitalBasis = plan?.capital_basis || plan?.summary?.capital_basis
  return capitalBasis === 'rolling_paper' ? 'paper' : 'live'
}

export function buildPlanExecutionState({
  plan,
  planStatus = plan?.status || '',
  executionStatus = {},
  executionMode = 'not_executed',
  liveExecutionContext = {},
  venue = 'paper',
  liveExecutionModeImpliesPublished = false,
} = {}) {
  const paperExecutionCount = Number(executionStatus?.execution_count || 0)
  const hasPaperExecution = Boolean(plan?.paper_executed_at) || paperExecutionCount > 0
  const selectedPlanHasLiveSignals = executionMode === 'live'
  const selectedPlanLiveSignalCount = Number(liveExecutionContext?.signal_count || 0)
  const selectedPlanActiveLiveSignalCount = Number(liveExecutionContext?.active_signal_count || 0)
  const selectedPlanHasPublishedLiveSignals = (
    Boolean(liveExecutionContext?.published_at)
    || Boolean(liveExecutionContext?.signals_published_at)
    || selectedPlanLiveSignalCount > 0
    || Boolean(plan?.live_signals_published_at)
    || Number(plan?.live_signal_count || 0) > 0
    || (liveExecutionModeImpliesPublished && selectedPlanHasLiveSignals)
  )
  const isPaperPortfolio = venue === 'paper'
  const isLivePortfolio = venue === 'live'
  const canExecutePaperNow = canExecutePaperNowFromState({
    planStatus,
    hasLiveSignals: selectedPlanHasLiveSignals,
    hasPaperExecution,
    missingExecuteDate: executionStatus?.missing_execute_date === true,
    isPaperPortfolio,
  })
  const canPublishLiveSignals = (
    isLivePortfolio
    && planStatus === 'approved'
    && !selectedPlanHasPublishedLiveSignals
    && !hasPaperExecution
  )
  const canCancelCurrentPlan = planStatus === 'approved' && !hasPaperExecution
  const paperExecuteReadyText = paperExecuteReadyTextFromState({
    hasPaperExecution,
    hasLiveSignals: selectedPlanHasLiveSignals,
    planStatus,
    executionStatus,
    isPaperPortfolio,
  })
  let cancelPlanReadyText = '误点确认发布/审批后可作废；作废后状态变为 cancelled'
  if (hasPaperExecution) cancelPlanReadyText = '该 plan 已执行 Paper，不能作废'
  else if (planStatus !== 'approved') cancelPlanReadyText = '只有 approved plan 可以作废'
  else if (selectedPlanHasLiveSignals) {
    cancelPlanReadyText = '该 plan 存在实盘信号历史；作废会取消未成交信号，若已有成交后端会拒绝'
  }
  let selectedPlanExecutionModeLabel = '未执行'
  if (executionMode === 'live') {
    if (selectedPlanActiveLiveSignalCount > 0) {
      selectedPlanExecutionModeLabel = `实盘信号在途 ${selectedPlanActiveLiveSignalCount}/${selectedPlanLiveSignalCount}`
    } else if (!selectedPlanHasPublishedLiveSignals) {
      selectedPlanExecutionModeLabel = `有历史实盘信号（未标记发布，${selectedPlanLiveSignalCount} 条）`
    } else {
      selectedPlanExecutionModeLabel = `有历史实盘信号（无在途，${selectedPlanLiveSignalCount} 条）`
    }
  } else if (executionMode === 'paper') {
    selectedPlanExecutionModeLabel = '已执行 Paper'
  }
  return {
    paperExecutionCount,
    hasPaperExecution,
    selectedPlanHasLiveSignals,
    selectedPlanHasPublishedLiveSignals,
    selectedPlanLiveSignalCount,
    selectedPlanActiveLiveSignalCount,
    canExecutePaperNow,
    canPublishLiveSignals,
    canCancelCurrentPlan,
    paperExecuteReadyText,
    cancelPlanReadyText,
    selectedPlanExecutionModeLabel,
  }
}

export function usePlanExecutionState(sources) {
  const state = computed(() => buildPlanExecutionState({
    plan: toValue(sources.plan),
    planStatus: toValue(sources.planStatus),
    executionStatus: toValue(sources.executionStatus),
    executionMode: toValue(sources.executionMode),
    liveExecutionContext: toValue(sources.liveExecutionContext),
    venue: toValue(sources.venue),
    liveExecutionModeImpliesPublished: toValue(sources.liveExecutionModeImpliesPublished),
  }))
  const field = (key) => computed(() => state.value[key])
  return {
    state,
    paperExecutionCount: field('paperExecutionCount'),
    hasPaperExecution: field('hasPaperExecution'),
    selectedPlanHasLiveSignals: field('selectedPlanHasLiveSignals'),
    selectedPlanHasPublishedLiveSignals: field('selectedPlanHasPublishedLiveSignals'),
    selectedPlanLiveSignalCount: field('selectedPlanLiveSignalCount'),
    selectedPlanActiveLiveSignalCount: field('selectedPlanActiveLiveSignalCount'),
    canExecutePaperNow: field('canExecutePaperNow'),
    canPublishLiveSignals: field('canPublishLiveSignals'),
    canCancelCurrentPlan: field('canCancelCurrentPlan'),
    paperExecuteReadyText: field('paperExecuteReadyText'),
    cancelPlanReadyText: field('cancelPlanReadyText'),
    selectedPlanExecutionModeLabel: field('selectedPlanExecutionModeLabel'),
  }
}
