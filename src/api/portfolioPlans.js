import request from '../utils/request'

export function listPortfolioStrategies(params = {}) {
  return request({ url: '/portfolio-plans/strategies', method: 'get', params })
}

export function listPortfolioParameterPresets(params = {}) {
  return request({ url: '/portfolio-plans/parameter-presets', method: 'get', params })
}

export function listPortfolioPlans(params = {}) {
  return request({ url: '/portfolio-plans/plans', method: 'get', params })
}

export function generatePortfolioPlan(data) {
  return request({ url: '/portfolio-plans/plans/generate', method: 'post', data })
}

export function getPortfolioPlanGenerationTask(taskId) {
  return request({ url: `/portfolio-plans/plans/generation-tasks/${taskId}`, method: 'get' })
}

export function listPortfolioPlanGenerationTasks(params = {}) {
  return request({ url: '/portfolio-plans/plans/generation-tasks', method: 'get', params })
}

export function listPortfolioWorkerStatus(params = {}) {
  return request({ url: '/portfolio-plans/workers/status', method: 'get', params })
}

export function getPortfolioPlanGenerationWatermark(params = {}) {
  return request({ url: '/portfolio-plans/data-watermarks/plan-generation', method: 'get', params })
}

export function publishPortfolioPlanLiveSignals(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/publish-live-signals`, method: 'post', data })
}

export function replanPortfolioPlanRemainder(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/replan-remainder`, method: 'post', data })
}

export function listLiveTradeSignals(params = {}) {
  return request({ url: '/trader/live-signals', method: 'get', params })
}

export function listLiveTradeExecutions(params = {}) {
  return request({ url: '/trader/executions', method: 'get', params })
}

export function listTraderHeartbeats(params = {}) {
  return request({ url: '/trader/heartbeat', method: 'get', params })
}

export function getPortfolioPlan(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}`, method: 'get' })
}

export function getPortfolioPlanOperationLogs(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/operation-logs`, method: 'get', params })
}

export function executePortfolioPlanPaper(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/execute-paper`, method: 'post', data })
}

export function approvePortfolioPlan(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/approve`, method: 'post', data })
}

export function rejectPortfolioPlan(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/reject`, method: 'post', data })
}

export function cancelPortfolioPlan(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/cancel`, method: 'post', data })
}

export function rejectPortfolioPlanItem(planId, symbol) {
  return request({ url: `/portfolio-plans/plans/${planId}/items/${encodeURIComponent(symbol)}/reject`, method: 'post' })
}

export function bulkRejectPortfolioPlanItems(planId, symbols = []) {
  return request({ url: `/portfolio-plans/plans/${planId}/items/bulk-reject`, method: 'post', data: { symbols } })
}

export function restorePortfolioPlanItem(planId, symbol) {
  return request({ url: `/portfolio-plans/plans/${planId}/items/${encodeURIComponent(symbol)}/restore`, method: 'post' })
}

export function rerunPortfolioPlanAiRisk(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/ai-risk-review`, method: 'post' })
}

export function getPortfolioPlanExecutions(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/executions`, method: 'get' })
}

export function getPortfolioPlanEquity(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/equity`, method: 'get', params })
}

export function getPortfolioPlanLineageEquity(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/lineage-equity`, method: 'get', params })
}

export function getLineagePaperPositions(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/lineage-paper-positions`, method: 'get' })
}

export function getLineagePaperExecutions(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/lineage-paper-executions`, method: 'get' })
}

export function getPortfolioPlanLiveExecutions(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/live-executions`, method: 'get' })
}

export function getPortfolioPlanLiveEquity(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/live-equity`, method: 'get', params })
}

export function getPortfolioPlanLiveRealtimeEquity(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/live-realtime-equity`, method: 'get' })
}

export function listPortfolios() {
  return request({ url: '/portfolio-plans/portfolios', method: 'get' })
}

export function listLivePortfolios() {
  return request({ url: '/portfolio-plans/live-portfolios', method: 'get' })
}

export function getPortfolioPlanLineageTimeline(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/lineage-timeline`, method: 'get', params })
}

// Enqueues a manual-rebalance generation task; poll the returned task_id via
// getPortfolioPlanGenerationTask until status === 'completed'.
export function createManualRebalancePlan(data) {
  return request({ url: '/portfolio-plans/plans/manual-rebalance', method: 'post', data })
}

// Enqueues a holdings-level AI risk review task; poll the returned task_id via
// getPortfolioPlanGenerationTask, whose result holds the review payload.
export function enqueuePortfolioHoldingsRisk(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/holdings-risk`, method: 'post' })
}

// Enqueues an AI risk review for the lineage's bench candidates; poll the
// returned task_id via getPortfolioPlanGenerationTask, whose result holds
// { symbols: [{ symbol, ai_risk }], high, medium, low, none }.
export function enqueuePortfolioBenchRisk(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/bench-risk`, method: 'post', params })
}

export function resumePortfolioLineage(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/resume-lineage`, method: 'post' })
}

// Intraday LIVE discretionary rebalance (reduce / clear / add). Synchronously
// creates a manual plan and publishes buy/sell signals; the trader executes
// within the session. Liquidation is just every held symbol mapped to 0.
// Pass { securities_account_id, targets, exclude_after?, dry_run? }.
export function liveRebalancePortfolio(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/live-rebalance`, method: 'post', data })
}

// Record broker-side manual fills (e.g. miniQMT direct operation) into the live
// lineage ledger. Supports partial reduce / add and full liquidation. Pass
// { securities_account_id, fills, pause_lineage?, exclude_after?, reason?,
// external_batch_id? }, where each fill is { symbol, action, filled_size,
// filled_price, ... }.
export function recordExternalManualRecord(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/external-manual-record`, method: 'post', data })
}

// Intraday PAPER discretionary rebalance (reduce / clear / add). Synchronously
// fills against the paper book at the realtime price and writes the new paper
// snapshot/equity plus a manual plan. Pass { targets, exclude_after?, dry_run? }.
export function paperRebalancePortfolio(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/paper-rebalance`, method: 'post', data })
}

export function getLineageLiveExecutions(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/lineage-live-executions`, method: 'get' })
}

export function getLineageLivePositions(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/lineage-live-positions`, method: 'get' })
}

export function getLineageLiveEquity(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/lineage-live-equity`, method: 'get', params })
}

export function getPortfolioPlanBench(planId, params = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/bench`, method: 'get', params })
}

export function forceRebalanceLineage(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/force-rebalance`, method: 'post', data })
}

// Diff the system ledger holdings against the broker's synced positions
// (trader_positions). Live-only; returns { applicable, in_sync, diffs, ... }.
export function reconcilePortfolioHoldings(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/holdings-reconcile`, method: 'get' })
}

export function getPortfolioStrategyEquity(strategyId, params = {}) {
  return request({ url: `/portfolio-plans/strategies/${strategyId}/equity`, method: 'get', params })
}

export function getPortfolioStrategyRealtimeEquity(strategyId) {
  return request({ url: `/portfolio-plans/strategies/${strategyId}/realtime-equity`, method: 'get' })
}
