export function portfolioKey(portfolio) {
  return `${portfolio.strategy_template_id}:${portfolio.params_hash}`
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
