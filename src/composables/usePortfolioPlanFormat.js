export function num(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

export function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

export function pctSigned(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`
}

export function priceSourceLabel(source) {
  const labels = { realtime: '实时', daily_close: '昨收', none: '无价' }
  return labels[source] || source || '-'
}

export function priceSourceClass(source) {
  if (source === 'realtime') return 'price-source-realtime'
  if (source === 'daily_close') return 'price-source-daily'
  if (source === 'none') return 'price-source-none'
  return ''
}

export function formatPriceAsOf(asOf) {
  if (!asOf) return ''
  return String(asOf).slice(0, 19)
}

export function formatSignalReviewAt(value) {
  if (!value) return ''
  return String(value).slice(0, 19).replace('T', ' ')
}

export function signalReviewStatusText(status) {
  const labels = {
    analyzed: '已分析',
    skipped_unchanged: '无新证据，已跳过 LLM',
    parse_error: '上次解析失败，将重试',
    failed: '上次失败',
  }
  return labels[status] || status || '未分析'
}

export function signalReviewTitle(review) {
  if (!review) return '尚无 AI 风险/机会分析记录'
  const parts = []
  const analyzedAt = formatSignalReviewAt(review.analyzed_at)
  const checkedAt = formatSignalReviewAt(review.checked_at)
  if (analyzedAt) parts.push(`上次分析：${analyzedAt}`)
  if (checkedAt && checkedAt !== analyzedAt) parts.push(`上次检查：${checkedAt}`)
  parts.push(signalReviewStatusText(review.last_run_status))
  if (Number.isFinite(Number(review.evidence_count))) parts.push(`证据快照累计 ${Number(review.evidence_count)} 项`)
  if (review.latest_evidence_at) parts.push(`最新证据：${formatSignalReviewAt(review.latest_evidence_at)}`)
  return parts.filter(Boolean).join(' · ')
}

export function selectionExclusionShort(reason) {
  const labels = {
    missing_price: '无价',
    over_slot_budget: '超预算',
    dropped_from_target_pool: '掉出目标池',
  }
  return labels[reason] || ''
}

export function selectionExclusionLabel(reason) {
  const labels = {
    missing_price: '未入选：生成计划时缺少有效价格',
    over_slot_budget: '未入选：1 手金额超过单槽预算',
    dropped_from_target_pool: '未入选：掉出本次目标组合',
  }
  return labels[reason] || ''
}

export function latestRankHeaderTitle(overlay) {
  const snapDate = overlay?.score_snapshot_date || '-'
  const latestDate = overlay?.latest_score_date || '-'
  const slot = Number(overlay?.target_slot_amount)
  const slotText = Number.isFinite(slot) && slot > 0 ? `${Math.round(slot)} 元/槽` : '-'
  return [
    '全市场 universe 排名（非组合序号）',
    `计划快照日：${snapDate}`,
    `最新记分日：${latestDate}`,
    `单槽预算约：${slotText}`,
    '悬停单元格可查看快照排名 vs 最新排名',
  ].join('\n')
}

export function latestRankCellTitle(item, overlay) {
  const snapDate = overlay?.score_snapshot_date || '-'
  const latestDate = overlay?.latest_score_date || '-'
  const parts = [
    `计划快照日（${snapDate}）全市场排名：${item?.snapshot_rank ?? '未入榜/无分'}`,
    `最新记分日（${latestDate}）全市场排名：${item?.latest_rank ?? '未入榜/无分'}`,
  ]
  if (item?.rank_delta != null && item.rank_delta !== 0) {
    const dir = item.rank_delta > 0 ? `上升 ${item.rank_delta} 名` : `下降 ${Math.abs(item.rank_delta)} 名`
    parts.push(`较计划快照：${dir}`)
  } else if (item?.snapshot_rank != null && item?.latest_rank != null) {
    parts.push('较计划快照：排名未变')
  }
  if (item?.rank != null) {
    parts.push(`本计划目标组合序号：#${item.rank}`)
  }
  const exclusion = selectionExclusionLabel(item?.selection_exclusion_reason)
  if (exclusion) parts.push(exclusion)
  if (item?.dropped_out_of_top_n) parts.push('最新记分日已掉出 TopN')
  return parts.join('\n')
}

export function blockerText(blocker) {
  const labels = {
    account_binding_missing: '账户绑定不完整',
    account_position_capped: '按账户可卖数量封顶',
    insufficient_available_position: '可卖持仓不足',
    insufficient_cash: '可用资金不足',
    below_lot_size: '低于一手交易单位',
    below_star_min_order: '低于科创板单笔 200 股下单门槛',
    below_start_min_order: '低于启动下单门槛',
    limit_up: '已涨停',
    live_trading_disabled: '账户未开启实盘',
    max_daily_amount_exceeded: '超过单日交易金额上限',
    max_order_amount_exceeded: '超过单笔金额上限',
    max_position_pct_exceeded: '超过单票仓位上限',
    missing_plan_equity: '缺少计划权益基准',
    missing_plan_cash: '缺少计划现金基准',
    missing_frozen_price: '活跃买单缺少冻结价格',
    missing_price: '缺少有效价格',
    missing_price_market_sell: '缺价按市价卖出',
    priced_from_stale_close: '按昨收定价',
    st_stock: 'ST 股票',
    suspended: '停牌',
  }
  return labels[blocker] || blocker || '-'
}

export function remainderReasonText(reason) {
  const labels = {
    item_not_a_planned_trade: '非计划交易项',
    already_at_target: '已达目标',
    live_signal_active: '有在飞信号',
    reference_price_unavailable: '无可用价格',
    account_not_synced: '账户未同步',
    budget_capped: '预算封顶',
    cash_capped: '现金封顶',
    available_position_below_gap: '可卖持仓不足',
    estimated_price_missing: '缺计划价',
  }
  return labels[reason] || reason || '-'
}

export function planItemActionLabel(action) {
  if (action === 'buy') return '买'
  if (action === 'sell') return '卖'
  if (action === 'hold') return '持'
  return '跳过'
}

export function planItemActionClass(action) {
  if (action === 'buy') return 'tag-buy'
  if (action === 'sell') return 'tag-sell'
  if (action === 'hold') return 'tag-hold'
  return 'tag-skip'
}

export function formatShareDelta(value) {
  const n = Number(value || 0)
  if (!Number.isFinite(n) || n === 0) return '0'
  return n > 0 ? `+${n}` : String(n)
}

export function signClass(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return ''
  return n > 0 ? 'pos' : 'neg'
}

export function riskSeverityLabel(severity) {
  if (severity === 'high') return '高'
  if (severity === 'medium') return '中'
  if (severity === 'low') return '低'
  return '正常'
}

const severityRank = { none: 0, low: 1, medium: 2, high: 3 }

export function opportunityStrengthLabel(strength) {
  if (strength === 'high') return '强'
  if (strength === 'medium') return '中'
  if (strength === 'low') return '弱'
  return '无'
}

export function riskDisplaySeverity(risk) {
  if (!risk) return 'none'
  const ruleSeverity = risk.severity || 'none'
  const llmSeverity = risk.llm?.severity || 'none'
  return (severityRank[llmSeverity] || 0) > (severityRank[ruleSeverity] || 0) ? llmSeverity : ruleSeverity
}

function primaryEvidence(finding) {
  const rows = Array.isArray(finding?.evidence) ? finding.evidence : []
  const nested = rows.find((row) => row?.source_title || row?.source_url || row?.source_date || row?.evidence_type) || rows[0]
  if (nested?.source_title || nested?.source_url || nested?.source_date || nested?.evidence_type) {
    return nested
  }
  if (finding?.source_title || finding?.source_url || finding?.source_date || finding?.evidence_type) {
    return {
      source_title: finding?.source_title || '',
      source_url: finding?.source_url || '',
      source_date: finding?.source_date || '',
      evidence_type: finding?.evidence_type || '',
    }
  }
  return nested || null
}

export function formatLedgerAsOf(asOf) {
  if (!asOf) return ''
  const text = String(asOf).trim()
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  }
  return text.slice(0, 10)
}

export function formatLedgerAt(at) {
  if (!at) return ''
  const text = String(at).trim()
  if (text.includes('T')) return text.slice(0, 19).replace('T', ' ')
  return formatLedgerAsOf(text) || text.slice(0, 19)
}

export function evidenceTypeLabel(type) {
  const labels = {
    announcement: '公告',
    news: '新闻',
    guba: '股吧',
    policy: '政策',
    rules_prior: '规则先验',
    unverified: '未核验',
  }
  return labels[type] || type || ''
}

export function discoveredByLabel(by) {
  const labels = {
    llm: 'AI 分析',
    manual: '人工录入',
    opportunity_invalidation: '机会落空转入',
  }
  return labels[by] || by || ''
}

export function findingSourceMeta(finding) {
  const evidence = primaryEvidence(finding)
  const typeLabel = evidenceTypeLabel(evidence?.evidence_type)
  const title = String(evidence?.source_title || '').trim()
  const url = String(evidence?.source_url || '').trim()

  let sourceText = ''
  if (typeLabel && title) sourceText = `${typeLabel}：${title}`
  else if (typeLabel) sourceText = typeLabel
  else if (title) sourceText = title
  else if (finding?.discovered_by) sourceText = discoveredByLabel(finding.discovered_by)

  const eventTime = formatLedgerAsOf(evidence?.source_date) || ''
  const ledgerFirstAt = formatLedgerAsOf(finding?.first_detected_as_of) || formatLedgerAt(finding?.first_detected_at) || ''
  const ledgerConfirmedAt = formatLedgerAsOf(finding?.last_confirmed_as_of) || formatLedgerAt(finding?.last_confirmed_at) || ''
  const discoveredBy = discoveredByLabel(finding?.discovered_by)
  const hasMeta = Boolean(sourceText || eventTime || ledgerFirstAt || ledgerConfirmedAt || discoveredBy)

  return {
    sourceText,
    url,
    eventTime,
    ledgerFirstAt,
    ledgerConfirmedAt,
    discoveredBy,
    hasMeta,
  }
}

function findingLine(finding) {
  const title = finding?.title || finding?.summary || finding?.subject || finding?.code || finding?.finding_key || '风险信号'
  const detail = finding?.detail || ''
  const meta = findingSourceMeta(finding)
  const sourceBits = [meta.eventTime, meta.sourceText].filter(Boolean)
  const source = sourceBits.length ? `（${sourceBits.join(' · ')}）` : ''
  const suggested = finding?.suggested_resolution?.reason
    ? ` [LLM建议解除: ${finding.suggested_resolution.reason}]`
    : ''
  return `${detail ? `${title}：${detail}` : title}${source}${suggested}`
}

function opportunityFindingLine(finding) {
  const title = finding?.title || finding?.summary || finding?.subject || finding?.code || finding?.finding_key || '机会信号'
  const detail = finding?.detail || ''
  const meta = findingSourceMeta(finding)
  const sourceBits = [meta.eventTime, meta.sourceText].filter(Boolean)
  const source = sourceBits.length ? `（${sourceBits.join(' · ')}）` : ''
  const suggested = finding?.suggested_closure?.reason
    ? ` [LLM建议关闭: ${finding.suggested_closure.reason}]`
    : ''
  return `${detail ? `${title}：${detail}` : title}${source}${suggested}`
}

export function aiRiskTitle(risk) {
  if (!risk) return '未发现规则风控信号'
  const sections = []
  const ruleLines = (risk.findings || []).map(findingLine).filter(Boolean)
  if (!ruleLines.length && (risk.reasons || []).length) {
    ruleLines.push((risk.reasons || []).join('、'))
  }
  if (ruleLines.length) sections.push(`规则风控\n${ruleLines.join('\n')}`)

  const llm = risk.llm
  if (llm) {
    const llmLines = []
    if (llm.summary) llmLines.push(llm.summary)
    llmLines.push(...(llm.findings || []).map(findingLine).filter(Boolean))
    if (llmLines.length) sections.push(`LLM 事件风控\n${llmLines.join('\n')}`)
  }

  if (sections.length) return sections.join('\n\n')
  return '未发现明确风控信号'
}

export function llmRiskTitle(risk) {
  const llm = risk?.llm || risk
  if (!llm) return '暂无 LLM 事件风控结果'
  const lines = []
  if (llm.summary) lines.push(llm.summary)
  lines.push(...(llm.findings || []).map(findingLine).filter(Boolean))
  if (llm.model) lines.push(`模型：${llm.model}`)
  if (llm.analyzed_at) lines.push(`分析时间：${String(llm.analyzed_at).slice(0, 19).replace('T', ' ')}`)
  return lines.length ? `LLM 事件风控\n${lines.join('\n')}` : 'LLM 事件风控：未发现明确风险信号'
}

export function llmOpportunityTitle(opportunity) {
  const llm = opportunity?.llm || opportunity
  if (!llm) return '暂无 LLM 机会结果'
  const lines = []
  if (llm.summary) lines.push(llm.summary)
  lines.push(...(llm.findings || []).map(opportunityFindingLine).filter(Boolean))
  if (llm.model) lines.push(`模型：${llm.model}`)
  if (llm.analyzed_at) lines.push(`分析时间：${String(llm.analyzed_at).slice(0, 19).replace('T', ' ')}`)
  return lines.length ? `LLM 机会\n${lines.join('\n')}` : 'LLM 机会：未发现明确机会信号'
}

export function isKeepItem(item) {
  const currentShares = Number(item?.current_shares ?? 0)
  const targetShares = Number(item?.target_shares ?? 0)
  const deltaShares = Number(item?.delta_shares ?? 0)
  return currentShares > 0 && targetShares > 0 && deltaShares === 0
}

export function actionBadge(itemOrAction) {
  const item = typeof itemOrAction === 'object' ? itemOrAction : null
  const action = item?.action ?? itemOrAction
  if (item && isKeepItem(item)) {
    return { text: 'K', label: '保留不动', cls: 'tag-keep' }
  }
  switch (action) {
    case 'buy':
      return { text: 'B', label: '买入', cls: 'tag-buy' }
    case 'sell':
      return { text: 'S', label: '卖出', cls: 'tag-sell' }
    case 'hold':
      return { text: 'H', label: '持有', cls: 'tag-hold' }
    default:
      return { text: '·', label: '跳过', cls: 'tag-skip' }
  }
}

export function driftBadge(item) {
  const drift = Number(item?.drift_delta_shares ?? 0)
  if (!Number.isFinite(drift) || drift === 0) return { text: '持平', cls: 'drift-flat' }
  if (drift > 0) return { text: `+${drift} 待买`, cls: 'drift-buy' }
  return { text: `${drift} 待卖`, cls: 'drift-sell' }
}

export function aiRiskBadge(item) {
  const risk = item?.ai_risk
  const severity = riskDisplaySeverity(risk)
  if (!risk || severity === 'none') {
    return { show: ['buy', 'hold'].includes(item?.action), text: '正常', cls: 'risk-none', title: '未发现规则风控信号' }
  }
  const labelMap = { high: '高', medium: '中', low: '低' }
  return {
    show: true,
    text: labelMap[severity] || severity,
    cls: `risk-${severity}`,
    title: aiRiskTitle(risk),
  }
}

export function pct(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

export function signedMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

export function signedPct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

export function todayInputDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function scoringRunText(run) {
  if (!run) return '暂无记录'
  const scoreDate = run.score_date || '-'
  const status = run.status || 'unknown'
  return `${scoreDate} / ${status}`
}

export function summarizeByStatus(rows) {
  return rows.reduce((acc, row) => {
    const status = row.status || 'unknown'
    acc[status] = (acc[status] || 0) + 1
    return acc
  }, {})
}

export function formatSummary(summary) {
  const entries = Object.entries(summary)
  if (!entries.length) return '暂无'
  return entries.map(([status, count]) => `${status}: ${count}`).join(' / ')
}

export function signalDisplayName(signal) {
  return signal?.name || signal?.stock_name || signal?.symbol || '-'
}

export function effectiveTopN(plan) {
  return plan?.summary?.target_top_n
    ?? plan?.params_snapshot?.top_n
    ?? '-'
}

export function effectiveRebalanceDays(plan) {
  return plan?.params_snapshot?.rebalance_days
    ?? null
}

export function effectiveConstructionMode(plan) {
  return plan?.params_snapshot?.construction_mode
    ?? null
}

export function effectiveInitialCapital(plan) {
  return plan?.params_snapshot?.initial_capital
    ?? null
}

export function planParamSummary(plan) {
  const parts = [`Top${effectiveTopN(plan)}`]
  const rebalanceDays = effectiveRebalanceDays(plan)
  if (rebalanceDays) parts.push(`${rebalanceDays}d`)
  const mode = effectiveConstructionMode(plan)
  if (mode) parts.push(mode)
  return parts.join(' · ')
}

export function shortPlanId(planId) {
  const text = String(planId || '')
  if (!text) return '-'
  if (text.length <= 28) return text
  return `${text.slice(0, 18)}…${text.slice(-8)}`
}

export const CAPITAL_BASIS_LABELS = {
  account_equity: '实盘账户滚动权益',
  rolling_paper: '纸面滚动权益',
  fixed_notional: '固定名义本金',
}

export const BASELINE_SOURCE_LABELS = {
  live_lineage_reconstruction: '实盘成交重建',
  paper_snapshot: '纸面快照继承',
  initial_capital: '初始本金',
  fixed_notional: '固定名义本金',
}

export function capitalBasisLabel(plan) {
  const basis = plan?.capital_basis || plan?.summary?.capital_basis
  return CAPITAL_BASIS_LABELS[basis] || basis || '—'
}

export function baselineSourceLabel(plan) {
  const source = plan?.summary?.baseline_source
  return BASELINE_SOURCE_LABELS[source] || source || '—'
}

export function planBaselineEquity(plan) {
  const value = plan?.summary?.baseline_equity ?? plan?.summary?.equity
  return Number.isFinite(Number(value)) ? Number(value) : null
}

export function baselineSyncedLabel(plan) {
  const value = plan?.summary?.baseline_synced_at
  if (value === null || value === undefined || value === '') return '—'
  const date = typeof value === 'number'
    ? new Date(value < 1e12 ? value * 1000 : value)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatSnapshotAt(value) {
  if (!value) return '-'
  return String(value).slice(0, 19).replace('T', ' ')
}

export function planCadenceBadge(plan) {
  if (!plan) return { text: '-', cls: 'cadence-unknown' }
  // record_kind is the authoritative type stamped by the backend. origin is the
  // orthogonal provenance dimension (manual vs scheduled) used only to refine the
  // label within a trade_plan; we no longer infer the kind from plan_type / origin.
  const pending = ['needs_review', 'generated', 'draft'].includes(plan.status)
  if (plan.record_kind === 'ledger_event') {
    return plan.is_liquidation
      ? { text: '手工补录·清仓', cls: 'cadence-manual' }
      : { text: '手工补录', cls: 'cadence-manual' }
  }
  if (plan.record_kind === 'observation') {
    return plan.executable === false
      ? { text: '观察·不交易', cls: 'cadence-monitor-readonly' }
      : { text: '观察·可交易', cls: 'cadence-monitor-trade' }
  }
  if (plan.record_kind === 'trade_plan') {
    if (plan.origin === 'manual') {
      return pending
        ? { text: '手动调仓·待审', cls: 'cadence-manual-pending' }
        : { text: '手动调仓', cls: 'cadence-manual' }
    }
    if (plan.is_rebalance_day === false) {
      return { text: '未到周期', cls: 'cadence-not-due' }
    }
    if (!plan.previous_rebalance_date) {
      return pending
        ? { text: '待审核建仓', cls: 'cadence-rebalance-pending' }
        : { text: '首次建仓', cls: 'cadence-rebalance' }
    }
    if (pending) {
      return { text: '待审核调仓', cls: 'cadence-rebalance-pending' }
    }
    return { text: '调仓日', cls: 'cadence-rebalance' }
  }
  return { text: plan.plan_type || plan.record_kind || '-', cls: 'cadence-unknown' }
}

export function buildEquityRows(equity) {
  return [...equity]
    .filter((point) => Number.isFinite(Number(point.equity)))
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
    .map((point, index, rows) => {
      const value = Number(point.equity)
      const previous = index > 0 ? Number(rows[index - 1].equity) : NaN
      const change = Number.isFinite(previous) ? value - previous : null
      const changePct = Number.isFinite(previous) && previous !== 0 ? change / previous : null
      return { ...point, equity: value, change, changePct }
    })
}

export function buildEquityChart(equityRows) {
  if (!equityRows.length) return { points: '', labels: [], min: 0, max: 0, latestReturn: null }
  const values = equityRows.map((row) => row.equity)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const width = 640
  const height = 220
  const pad = 28
  const points = equityRows
    .map((row, index) => {
      const x = equityRows.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (equityRows.length - 1)
      const y = height - pad - ((row.equity - min) * (height - pad * 2)) / span
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const first = equityRows[0].equity
  const latest = equityRows[equityRows.length - 1].equity
  return {
    points,
    min,
    max,
    latestReturn: first ? latest / first - 1 : null,
    labels: [
      { text: equityRows[0].date, x: pad, y: height - 6, anchor: 'start' },
      { text: equityRows[equityRows.length - 1].date, x: width - pad, y: height - 6, anchor: 'end' },
    ],
  }
}

export function previousPlanIdFor(plan, plans) {
  if (!plan) return ''
  if (plan.previous_rebalance_plan_id) return plan.previous_rebalance_plan_id
  const previousDate = plan.previous_rebalance_date
  if (!previousDate || !plan.params_hash) return ''
  const previous = plans.find((row) => (
    row.base_date === previousDate
    && row.params_hash === plan.params_hash
    && row.strategy_template_id === plan.strategy_template_id
    && (!plan.user_id || row.user_id === plan.user_id)
    && row.record_kind === 'trade_plan'
  ))
  return previous?.plan_id || ''
}

export function planLineage(plan, plans) {
  if (!plan) return { show: false, previousDate: '', previousPlanId: '' }
  const previousDate = plan.previous_rebalance_date || ''
  const previousPlanId = previousPlanIdFor(plan, plans)
  return {
    show: Boolean(plan.params_hash || previousDate || previousPlanId),
    previousDate,
    previousPlanId,
  }
}

export function isPreviousPlanOfSelected(plan, selectedPlanId, selectedDetail, plans) {
  if (!plan || !selectedPlanId) return false
  return plan.plan_id === previousPlanIdFor(selectedDetail?.plan, plans)
}

export function isNextPlanOfSelected(plan, selectedPlanId, plans) {
  if (!plan || !selectedPlanId) return false
  return previousPlanIdFor(plan, plans) === selectedPlanId
}

export function planRelationBadge(plan, selectedPlanId, selectedDetail, plans) {
  if (!selectedPlanId || !plan || plan.plan_id === selectedPlanId) return null
  if (isPreviousPlanOfSelected(plan, selectedPlanId, selectedDetail, plans)) {
    return { text: '上游', cls: 'relation-upstream' }
  }
  if (isNextPlanOfSelected(plan, selectedPlanId, plans)) {
    return { text: '下游', cls: 'relation-downstream' }
  }
  return null
}

export function planRowClass(plan, selectedPlanId, selectedDetail, plans) {
  return {
    active: selectedPlanId === plan.plan_id,
    upstream: isPreviousPlanOfSelected(plan, selectedPlanId, selectedDetail, plans),
    downstream: isNextPlanOfSelected(plan, selectedPlanId, plans),
  }
}

export function usePortfolioPlanFormat() {
  return {
    num,
    money,
    pctSigned,
    priceSourceLabel,
    priceSourceClass,
    formatPriceAsOf,
    formatSignalReviewAt,
    signalReviewStatusText,
    signalReviewTitle,
    selectionExclusionShort,
    selectionExclusionLabel,
    latestRankHeaderTitle,
    latestRankCellTitle,
    blockerText,
    remainderReasonText,
    planItemActionLabel,
    planItemActionClass,
    formatShareDelta,
    signClass,
    riskSeverityLabel,
    opportunityStrengthLabel,
    riskDisplaySeverity,
    aiRiskTitle,
    llmRiskTitle,
    llmOpportunityTitle,
    formatLedgerAsOf,
    formatLedgerAt,
    evidenceTypeLabel,
    discoveredByLabel,
    findingSourceMeta,
    actionBadge,
    driftBadge,
    aiRiskBadge,
    pct,
    signedMoney,
    signedPct,
    todayInputDate,
    scoringRunText,
    summarizeByStatus,
    formatSummary,
    signalDisplayName,
    effectiveTopN,
    effectiveRebalanceDays,
    effectiveConstructionMode,
    effectiveInitialCapital,
    planParamSummary,
    shortPlanId,
    capitalBasisLabel,
    baselineSourceLabel,
    planBaselineEquity,
    baselineSyncedLabel,
    formatSnapshotAt,
    planCadenceBadge,
    buildEquityRows,
    buildEquityChart,
    previousPlanIdFor,
    planLineage,
    isPreviousPlanOfSelected,
    isNextPlanOfSelected,
    planRelationBadge,
    planRowClass,
  }
}
