export function portfolioKey(portfolio) {
  return `${portfolio.strategy_template_id}:${portfolio.params_hash}`
}

/**
 * Query params for /?tab=portfolio-overview. `strategy` is strategy_template_id.
 * @param {{ strategy_template_id?: string, params_hash?: string } | null | undefined} row
 * @param {Record<string, string | number | boolean | undefined | null>} [extra]
 */
export function overviewDeepLinkParams(row, extra = {}) {
  const params = {}
  const strategy = String(row?.strategy_template_id || '').trim()
  const paramsHash = String(row?.params_hash || '').trim()
  if (strategy) params.strategy = strategy
  if (paramsHash) params.params_hash = paramsHash
  for (const [key, value] of Object.entries(extra || {})) {
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (!text) continue
    params[key] = text
  }
  return params
}

/**
 * @param {{ strategy?: string, params_hash?: string } | null | undefined} params
 * @returns {string} portfolioKey, or '' when strategy or params_hash is missing
 */
export function overviewPortfolioKeyFromParams(params) {
  const strategy = String(params?.strategy || '').trim()
  const paramsHash = String(params?.params_hash || '').trim()
  if (!strategy || !paramsHash) return ''
  return portfolioKey({ strategy_template_id: strategy, params_hash: paramsHash })
}

export const OVERVIEW_PANEL_IDS = ['holdings', 'cycle', 'fills']

export function normalizeOverviewPanel(panel) {
  const value = String(panel || '').trim()
  return OVERVIEW_PANEL_IDS.includes(value) ? value : 'holdings'
}

/** Panel to select from a deep link, or null when the link does not name a lineage. */
export function overviewPanelFromPending(detail) {
  if (!overviewPortfolioKeyFromParams(detail)) return null
  return normalizeOverviewPanel(detail?.panel)
}

export function portfolioOptionLabel(portfolio) {
  const name = portfolio.strategy_name || portfolio.strategy_template_id || '组合'
  const params = portfolio.param_summary || '参数未记录'
  const range = portfolio.first_base_date && portfolio.last_base_date
    ? `${portfolio.first_base_date}→${portfolio.last_base_date}`
    : (portfolio.last_base_date || '-')
  const hash = portfolio.params_hash_short || (portfolio.params_hash ? portfolio.params_hash.slice(0, 8) : '--------')
  const account = portfolio.securities_account_id
    ? ` · 账户${portfolio.securities_account_id.slice(-6)}`
    : ''
  return `${name} · ${params} · ${range}（${portfolio.plan_count}期${account} · #${hash}）`
}

export function executionVenueLabel(venue) {
  if (venue === 'live') return '实盘'
  if (venue === 'paper') return '纸面'
  return venue || '-'
}

export function formatSyncedAt(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  return new Date(seconds * 1000).toLocaleString()
}

export function foldedTimeline(nodes) {
  const folded = []
  let monitorRun = null
  for (const node of nodes || []) {
    const isPassiveMonitor = node.node_type === 'monitor' && !node.action_required
    if (isPassiveMonitor) {
      const drift = Number(node.drift_brief?.estimated_turnover || 0)
      if (!monitorRun) {
        monitorRun = {
          type: 'monitor_fold',
          start: node.date,
          end: node.date,
          count: 1,
          maxDrift: drift,
        }
      } else {
        monitorRun.end = node.date
        monitorRun.count += 1
        monitorRun.maxDrift = Math.max(monitorRun.maxDrift, drift)
      }
      continue
    }
    if (monitorRun) {
      folded.push(monitorRun)
      monitorRun = null
    }
    folded.push({ type: 'node', node })
  }
  if (monitorRun) folded.push(monitorRun)
  return folded
}

export function cycleProgressPct(timeline) {
  const cycle = timeline?.current_cycle
  if (!cycle?.rebalance_days) return 0
  const elapsed = Number(cycle.elapsed_trading_days || 0)
  return Math.min(100, Math.round((elapsed / cycle.rebalance_days) * 100))
}

export function trailingStopTriggersOnly(run) {
  return run?.verbosity === 'triggers_only'
}

export function trailingStopDefaultExpanded(run) {
  if (!run) return false
  const triggered = Number(run.triggered_count ?? run.summary?.triggered_count ?? 0)
  return triggered > 0
}

export function planCompletionIncompleteCount(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0
  return rows.reduce((count, row) => count + (row?.complete ? 0 : 1), 0)
}

export function shouldShowCatchUpPanel({
  isLivePortfolio = false,
  operationPlanId = '',
  catchUpRowCount = 0,
} = {}) {
  return Boolean(isLivePortfolio && operationPlanId && Number(catchUpRowCount) > 0)
}

export function shouldShowPlanCompletionPanel({
  isLivePortfolio = false,
  operationPlanId = '',
  incompleteCount = 0,
} = {}) {
  return Boolean(isLivePortfolio && operationPlanId && Number(incompleteCount) > 0)
}

export function shouldShowOverviewCatchUpGrid({
  showCatchUp = false,
  showCompletion = false,
} = {}) {
  return Boolean(showCatchUp || showCompletion)
}

/**
 * Overview PlanOpsPanel: only when the user still has a next execution step.
 * Cancel stays inside the panel when it is shown; do not show the panel solely
 * to expose cancel on an already-finished plan.
 */
export function shouldShowPlanOpsPanel({
  operationPlanId = '',
  planStatus = '',
  isPaperPortfolio = false,
  isLivePortfolio = false,
  awaitingPublishOrExecute = false,
  canExecutePaperNow = false,
  remainderActionableCount = 0,
  completionIncompleteCount = 0,
} = {}) {
  if (!operationPlanId || planStatus !== 'approved') return false
  if (!isPaperPortfolio && !isLivePortfolio) return false
  if (awaitingPublishOrExecute || canExecutePaperNow) return true
  if (Number(remainderActionableCount) > 0) return true
  // Keep 缺口预检 available while live fills are still incomplete.
  if (isLivePortfolio && Number(completionIncompleteCount) > 0) return true
  return false
}
