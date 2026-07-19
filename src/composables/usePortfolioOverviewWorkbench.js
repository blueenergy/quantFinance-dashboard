import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  enqueuePortfolioLlmRisk,
  forceRebalanceLineage,
  getLineagePaperExecutions,
  getLineagePaperPositions,
  getPortfolioLlmRiskRun,
  getPortfolioPlan,
  getPortfolioPlanGenerationTask,
  getPortfolioPlanLineageEquity,
  getPortfolioPlanLineageTimeline,
  getPortfolioPlanLiveSummary,
  getPortfolioPlanSummary,
  listPortfolios,
  rerunPortfolioPlanAiRisk,
  resumePortfolioLineage,
} from '../api/portfolioPlans'
import { getSecuritiesAccounts } from '../api/trader'
import { executionVenueFromPortfolio } from './usePortfolioPlanViewModel'
import { portfolioKey } from '../utils/portfolioOverviewFormat'
import { isSubmittingForKey } from '../utils/scopedSubmitting'

export const CANCELLED_POLL_RESULT = Object.freeze({ cancelled: true })

export function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

export function usePortfolioOverviewWorkbench({
  onBeforeSelect = () => {},
  onPlanDetailLoaded = () => {},
  onDetailLoaded = () => {},
  onLoadBench = () => Promise.resolve(),
  onLoadReconcile = () => Promise.resolve(),
  onReconcileData = () => {},
  onResumeSubmitting = () => {},
  getForceRebalanceBlockReason = () => '',
} = {}) {
  const portfolios = ref([])
  const selectedPortfolioKey = ref('')
  const portfolioSummary = ref(null)
  const loadingList = ref(false)
  const loadingDetail = ref(false)
  const message = ref('')
  const messageIsError = ref(false)

  const equityRows = ref([])
  const equityCaveat = ref('')
  const bookEquity = ref(null)
  const positionRows = ref([])
  const positionSummary = ref(null)
  const tradeRows = ref([])

  const timelineData = ref(null)
  const latestPlanDetail = ref(null)
  const expandedTimelinePlanId = ref(null)
  const reviewAiRiskLoading = ref(false)
  const reviewLlmRiskLoading = ref(false)
  const opsLlmRiskLoading = ref(false)
  const forceRebalanceSubmittingKey = ref('')

  const securitiesAccounts = ref([])
  const selectedLiveAccountId = ref('')

  let active = true
  let requestEpoch = 0
  let listRequestEpoch = 0
  let accountsRequestEpoch = 0
  const pollingContexts = new Set()

  const selectedPortfolio = computed(() => (
    portfolios.value.find((row) => portfolioKey(row) === selectedPortfolioKey.value) || null
  ))
  const selectedPortfolioDisplay = computed(() => {
    if (!selectedPortfolio.value) return null
    return { ...selectedPortfolio.value, ...(portfolioSummary.value || {}) }
  })
  const selectedLatestPlanId = computed(() => selectedPortfolio.value?.latest_plan_id || '')
  const selectedOperationPlanId = computed(() => (
    timelineData.value?.operation_plan?.plan_id || selectedLatestPlanId.value
  ))
  const benchPlanId = computed(() => (
    timelineData.value?.latest_drift_summary?.plan_id || selectedOperationPlanId.value
  ))
  const pendingActionPlan = computed(() => {
    const nodes = timelineData.value?.timeline || []
    return nodes.find((node) => node.action_required && node.status === 'needs_review') || null
  })
  const openLineageTradePlan = computed(() => {
    const nodes = timelineData.value?.timeline || []
    return nodes.find((node) => {
      const isTradePlan = node.record_kind === 'trade_plan' || node.node_type === 'rebalance'
      return isTradePlan && ['needs_review', 'approved'].includes(node.status)
    }) || null
  })
  const executionVenue = computed(() => executionVenueFromPortfolio(selectedPortfolio.value))
  const isLivePortfolio = computed(() => (
    Boolean(selectedPortfolio.value) && executionVenue.value === 'live'
  ))
  const isPaperPortfolio = computed(() => (
    Boolean(selectedPortfolio.value) && executionVenue.value === 'paper'
  ))
  const forceRebalanceSubmitting = computed(() => (
    isSubmittingForKey(forceRebalanceSubmittingKey.value, selectedPortfolioKey.value)
  ))

  function isCurrentSelection(key, epoch = null) {
    return (
      active
      && selectedPortfolioKey.value === key
      && (epoch === null || requestEpoch === epoch)
    )
  }

  function isCurrentPlan(key, planId) {
    if (!isCurrentSelection(key)) return false
    return [
      selectedLatestPlanId.value,
      selectedOperationPlanId.value,
      pendingActionPlan.value?.plan_id,
    ].includes(planId)
  }

  function createPollingContext(key) {
    const context = {
      key,
      cancelled: false,
      timers: new Map(),
    }
    pollingContexts.add(context)
    return context
  }

  function releasePollingContext(context) {
    for (const timerId of context.timers.keys()) window.clearTimeout(timerId)
    context.timers.clear()
    pollingContexts.delete(context)
  }

  function cancelPolling() {
    for (const context of pollingContexts) {
      context.cancelled = true
      for (const [timerId, resolve] of context.timers) {
        window.clearTimeout(timerId)
        resolve(false)
      }
      context.timers.clear()
    }
  }

  function pollingDelay(ms, context) {
    if (context.cancelled) return Promise.resolve(false)
    return new Promise((resolve) => {
      const timerId = window.setTimeout(() => {
        context.timers.delete(timerId)
        resolve(!context.cancelled)
      }, ms)
      context.timers.set(timerId, resolve)
    })
  }

  async function pollGenerationTask(
    taskId,
    { attempts = 90, intervalMs = 2000, portfolioKey: capturedKey = selectedPortfolioKey.value } = {},
  ) {
    const context = createPollingContext(capturedKey)
    try {
      for (let i = 0; i < attempts; i += 1) {
        if (context.cancelled || (capturedKey && !isCurrentSelection(capturedKey))) {
          return CANCELLED_POLL_RESULT
        }
        const res = await getPortfolioPlanGenerationTask(taskId)
        if (context.cancelled || (capturedKey && !isCurrentSelection(capturedKey))) {
          return CANCELLED_POLL_RESULT
        }
        const task = res.data || {}
        if (task.status === 'completed') return task
        if (task.status === 'failed') {
          throw new Error(task.error_message || '任务执行失败')
        }
        if (!(await pollingDelay(intervalMs, context))) return CANCELLED_POLL_RESULT
      }
      throw new Error('任务处理超时，请稍后到「组合交易计划」查看结果')
    } finally {
      releasePollingContext(context)
    }
  }

  async function pollLlmRiskRun(
    planId,
    runId,
    {
      attempts = 90,
      intervalMs = 2000,
      portfolioKey: capturedKey = selectedPortfolioKey.value,
    } = {},
  ) {
    const context = createPollingContext(capturedKey)
    try {
      for (let i = 0; i < attempts; i += 1) {
        if (context.cancelled || !isCurrentPlan(capturedKey, planId)) {
          return CANCELLED_POLL_RESULT
        }
        const res = await getPortfolioLlmRiskRun(planId, runId)
        if (context.cancelled || !isCurrentPlan(capturedKey, planId)) {
          return CANCELLED_POLL_RESULT
        }
        const run = res.data || {}
        if (['completed', 'completed_with_failures', 'failed'].includes(run.status)) return run
        if (!(await pollingDelay(intervalMs, context))) return CANCELLED_POLL_RESULT
      }
      throw new Error('AI 风险/机会分析任务处理超时，请稍后刷新查看结果')
    } finally {
      releasePollingContext(context)
    }
  }

  async function loadPortfolios() {
    const epoch = ++listRequestEpoch
    loadingList.value = true
    message.value = ''
    messageIsError.value = false
    const previousKey = selectedPortfolioKey.value
    try {
      const res = await listPortfolios()
      if (!active || listRequestEpoch !== epoch) return
      const nextPortfolios = res.data?.portfolios || []
      portfolios.value = nextPortfolios
      if (!nextPortfolios.length) {
        selectedPortfolioKey.value = ''
        message.value = '当前没有已执行的实盘或纸面组合血缘。'
        return
      }
      if (
        previousKey
        && selectedPortfolioKey.value === previousKey
        && nextPortfolios.some((row) => portfolioKey(row) === previousKey)
      ) {
        selectedPortfolioKey.value = previousKey
      }
    } catch (error) {
      if (!active || listRequestEpoch !== epoch) return
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载组合列表失败'
      messageIsError.value = true
    } finally {
      if (active && listRequestEpoch === epoch) loadingList.value = false
    }
  }

  async function loadSecuritiesAccounts() {
    const epoch = ++accountsRequestEpoch
    try {
      const accounts = await getSecuritiesAccounts()
      if (!active || accountsRequestEpoch !== epoch) return
      securitiesAccounts.value = Array.isArray(accounts)
        ? accounts
        : (Array.isArray(accounts?.data) ? accounts.data : [])
      syncSelectedLiveAccount()
    } catch {
      if (active && accountsRequestEpoch === epoch) securitiesAccounts.value = []
    }
  }

  function syncSelectedLiveAccount() {
    const portfolioAccount = selectedPortfolio.value?.securities_account_id
    if (portfolioAccount) {
      selectedLiveAccountId.value = portfolioAccount
      return
    }
    if (!selectedLiveAccountId.value && securitiesAccounts.value.length) {
      selectedLiveAccountId.value = (
        securitiesAccounts.value[0].id || securitiesAccounts.value[0]._id || ''
      )
    }
  }

  function clearDetailState() {
    portfolioSummary.value = null
    timelineData.value = null
    latestPlanDetail.value = null
    equityRows.value = []
    equityCaveat.value = ''
    bookEquity.value = null
    positionRows.value = []
    positionSummary.value = null
    tradeRows.value = []
  }

  function buildPaperDetail(lineageData, detail, portfolio) {
    const [eqRes, posRes, exRes] = lineageData
    const rows = eqRes.data?.rows || []
    const normalizedEquityRows = rows.map((row) => ({
      ...row,
      equity: Number(row.equity),
    }))
    const snapshotDate = posRes.data?.as_of_date
    const summary = posRes.data?.summary || {}
    const positions = posRes.data?.positions || []
    const latestRow = rows[rows.length - 1]
    const currentBookEquity = (latestRow || summary.equity)
      ? {
          equity: Number(summary.equity || latestRow?.equity || 0),
          initial_capital: Number(
            eqRes.data?.initial_capital
            || detail?.plan?.params_snapshot?.initial_capital
            || portfolio?.initial_capital
            || rows[0]?.equity
            || 0
          ),
          cash: Number(summary.cash || latestRow?.cash || 0),
          realized_pnl: 0,
          unrealized_pnl: Number(summary.total_unrealized_pnl || 0),
        }
      : null
    return {
      equityRows: normalizedEquityRows,
      equityCaveat: snapshotDate
        ? `纸面净值由各 plan 日更 portfolio_paper_equity 拼接；最新持仓快照 ${snapshotDate}（plan ${posRes.data?.source_plan_id || '-'}）。`
        : '纸面净值由各 plan 日更 portfolio_paper_equity 拼接；当前血缘暂无 paper 持仓快照。',
      bookEquity: currentBookEquity,
      positionRows: positions,
      positionSummary: summary.holding_count != null
        ? summary
        : {
            total_market_value: positions.reduce(
              (sum, row) => sum + Number(row.market_value || 0),
              0,
            ),
            total_realized_pnl: 0,
            total_unrealized_pnl: 0,
            holding_count: positions.length,
          },
      tradeRows: exRes.data?.trades || [],
      reconcile: null,
    }
  }

  function buildLiveDetail(lineageResponse) {
    const summaryData = lineageResponse?.data || {}
    const equity = summaryData.equity || {}
    return {
      equityRows: (equity.rows || []).map((row) => ({
        ...row,
        equity: Number(row.equity),
      })),
      equityCaveat: equity.caveat || '',
      bookEquity: equity.current_book_equity || null,
      positionRows: summaryData.positions?.positions || [],
      positionSummary: summaryData.positions?.summary || null,
      tradeRows: summaryData.trades || [],
      reconcile: summaryData.reconcile || null,
    }
  }

  async function refreshDetail() {
    const epoch = ++requestEpoch
    const capturedKey = selectedPortfolioKey.value
    const planId = selectedLatestPlanId.value
    const portfolio = selectedPortfolio.value
    if (!planId || !capturedKey) return
    loadingDetail.value = true
    message.value = ''
    messageIsError.value = false
    try {
      const isLive = executionVenueFromPortfolio(portfolio) === 'live'
      const timelinePromise = getPortfolioPlanLineageTimeline(planId, { limit: 40 })
      const selectedPlanDetailPromise = getPortfolioPlan(planId)
      const summaryPromise = getPortfolioPlanSummary(planId)
      const lineagePromise = isLive
        ? getPortfolioPlanLiveSummary(planId)
        : Promise.all([
            getPortfolioPlanLineageEquity(planId),
            getLineagePaperPositions(planId),
            getLineagePaperExecutions(planId),
          ])

      const [timelineRes, selectedPlanRes, summaryRes, lineageData] = await Promise.all([
        timelinePromise,
        selectedPlanDetailPromise,
        summaryPromise,
        lineagePromise,
      ])
      if (!isCurrentSelection(capturedKey, epoch)) return
      const nextTimeline = timelineRes.data || null
      const operationPlanId = nextTimeline?.operation_plan?.plan_id || planId
      const latestPlanRes = operationPlanId === planId
        ? selectedPlanRes
        : await getPortfolioPlan(operationPlanId)
      if (!isCurrentSelection(capturedKey, epoch)) return

      const nextDetail = latestPlanRes.data || null
      const detailData = isLive
        ? buildLiveDetail(lineageData)
        : buildPaperDetail(lineageData, nextDetail, portfolio)

      if (!isCurrentSelection(capturedKey, epoch)) return
      timelineData.value = nextTimeline
      latestPlanDetail.value = nextDetail
      portfolioSummary.value = summaryRes.data || null
      equityRows.value = detailData.equityRows
      equityCaveat.value = detailData.equityCaveat
      bookEquity.value = detailData.bookEquity
      positionRows.value = detailData.positionRows
      positionSummary.value = detailData.positionSummary
      tradeRows.value = detailData.tradeRows
      onReconcileData(detailData.reconcile)
      onPlanDetailLoaded()
      syncSelectedLiveAccount()
      onDetailLoaded()

      if (isLive) {
        await onLoadBench({
          planId: benchPlanId.value,
          isCurrent: () => isCurrentSelection(capturedKey, epoch),
        })
      } else {
        await Promise.all([
          onLoadBench({
            planId: benchPlanId.value,
            isCurrent: () => isCurrentSelection(capturedKey, epoch),
          }),
          onLoadReconcile(),
        ])
      }
    } catch (error) {
      if (!isCurrentSelection(capturedKey, epoch)) return
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载详情失败'
      messageIsError.value = true
    } finally {
      if (isCurrentSelection(capturedKey, epoch)) loadingDetail.value = false
    }
  }

  async function rerunReviewAiRisk() {
    const planId = selectedOperationPlanId.value
    const capturedKey = selectedPortfolioKey.value
    if (!planId || !capturedKey) return
    reviewAiRiskLoading.value = true
    message.value = ''
    messageIsError.value = false
    try {
      const res = await rerunPortfolioPlanAiRisk(planId)
      if (!isCurrentPlan(capturedKey, planId)) return
      const taskId = res.data?.task_id
      if (taskId) {
        const task = await pollGenerationTask(taskId, { portfolioKey: capturedKey })
        if (!task || task.cancelled || !isCurrentPlan(capturedKey, planId)) return
      }
      await refreshDetail()
      if (!isCurrentSelection(capturedKey)) return
      message.value = '规则风控已复检，标的风险等级已刷新。'
    } catch (error) {
      if (!isCurrentSelection(capturedKey)) return
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '规则风控复检失败'
      messageIsError.value = true
    } finally {
      if (isCurrentSelection(capturedKey)) reviewAiRiskLoading.value = false
    }
  }

  async function rerunPlanLlmRisk(planIdRef, source = 'ops') {
    const planId = typeof planIdRef === 'object' ? planIdRef.value : planIdRef
    const capturedKey = selectedPortfolioKey.value
    if (!planId || !capturedKey) return
    const isReviewPlan = source === 'review'
    if (isReviewPlan) reviewLlmRiskLoading.value = true
    else opsLlmRiskLoading.value = true
    message.value = ''
    messageIsError.value = false
    try {
      const res = await enqueuePortfolioLlmRisk(planId)
      if (!isCurrentPlan(capturedKey, planId)) return
      const runId = res.data?.run_id
      if (runId) {
        const run = await pollLlmRiskRun(planId, runId, { portfolioKey: capturedKey })
        if (!run || run.cancelled || !isCurrentPlan(capturedKey, planId)) return
        const summaryText = run.partial_summary || ''
        if (run.status === 'completed_with_failures') {
          message.value = `AI 风险/机会分析部分完成：${summaryText || '部分行业任务失败，已刷新可用结果'}`
        } else if (run.status === 'failed') {
          message.value = `AI 风险/机会分析失败：${summaryText || '所有行业任务均未完成，请稍后重试或检查 worker 日志'}`
          messageIsError.value = true
        } else {
          message.value = 'AI 风险/机会分析已完成，标的事件风险已刷新。'
        }
      } else {
        message.value = 'AI 风险/机会分析已提交，但未返回 run_id；请稍后刷新查看任务状态。'
      }
      await refreshDetail()
    } catch (error) {
      if (!isCurrentSelection(capturedKey)) return
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || 'AI 风险/机会分析失败'
      messageIsError.value = true
    } finally {
      if (isCurrentSelection(capturedKey)) {
        if (isReviewPlan) reviewLlmRiskLoading.value = false
        else opsLlmRiskLoading.value = false
      }
    }
  }

  async function submitForceRebalance() {
    const planId = selectedOperationPlanId.value
    const capturedKey = selectedPortfolioKey.value
    if (!planId) {
      message.value = '当前组合没有可操作的计划，无法发起立即调仓。'
      messageIsError.value = true
      return
    }
    const blockReason = getForceRebalanceBlockReason()
    if (blockReason) {
      message.value = blockReason
      messageIsError.value = true
      return
    }
    forceRebalanceSubmittingKey.value = capturedKey
    message.value = ''
    messageIsError.value = false
    let taskId = ''
    try {
      const res = await forceRebalanceLineage(planId, {})
      if (!isCurrentSelection(capturedKey)) return
      taskId = res.data?.task_id || ''
      message.value = '已提交立即调仓任务，正在等待 worker 生成计划…'
      const task = await pollGenerationTask(taskId, { portfolioKey: capturedKey })
      if (!task || task.cancelled || !isCurrentSelection(capturedKey)) return
      const newPlanId = task.plan_id || task.result?.plan_id
      message.value = newPlanId
        ? `已提交立即调仓，新计划 ${newPlanId} 待审批。`
        : '已提交立即调仓任务，请稍后刷新查看新计划。'
      if (isCurrentSelection(capturedKey)) {
        await loadPortfolios()
        if (isCurrentSelection(capturedKey)) await refreshDetail()
      }
    } catch (error) {
      if (!isCurrentSelection(capturedKey)) return
      const detail = formatApiDetail(error.response?.data?.detail) || error.message || '立即调仓提交失败'
      if (detail.includes('任务处理超时')) {
        message.value = taskId
          ? `任务 ${taskId} 已提交，但 3 分钟内未生成计划。请到「组合交易计划」查看任务状态；若长时间停留在 pending，请确认计划生成服务(quant-portfolio worker)是否在运行。`
          : '立即调仓任务已提交，但 3 分钟内未生成计划。请稍后刷新查看，若无结果请确认计划生成服务是否在运行。'
        messageIsError.value = false
        await loadPortfolios()
        if (isCurrentSelection(capturedKey)) await refreshDetail()
      } else {
        message.value = detail
        messageIsError.value = true
      }
    } finally {
      if (forceRebalanceSubmittingKey.value === capturedKey) {
        forceRebalanceSubmittingKey.value = ''
      }
    }
  }

  async function resumeLineageAction() {
    const planId = selectedLatestPlanId.value
    const capturedKey = selectedPortfolioKey.value
    if (!planId || !capturedKey) return
    onResumeSubmitting(true)
    try {
      await resumePortfolioLineage(planId)
      if (!isCurrentSelection(capturedKey)) return
      message.value = '已恢复该组合的自动调仓。'
      messageIsError.value = false
      await loadPortfolios()
    } catch (error) {
      if (!isCurrentSelection(capturedKey)) return
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '恢复失败'
      messageIsError.value = true
    } finally {
      if (isCurrentSelection(capturedKey)) onResumeSubmitting(false)
    }
  }

  function toggleTimelineDetail(planId) {
    expandedTimelinePlanId.value = expandedTimelinePlanId.value === planId ? null : planId
  }

  watch(selectedPortfolioKey, (key) => {
    requestEpoch += 1
    cancelPolling()
    expandedTimelinePlanId.value = null
    reviewAiRiskLoading.value = false
    reviewLlmRiskLoading.value = false
    opsLlmRiskLoading.value = false
    onResumeSubmitting(false)
    onBeforeSelect()
    loadingDetail.value = false
    clearDetailState()
    if (key) refreshDetail()
  })

  onMounted(() => {
    loadSecuritiesAccounts()
    loadPortfolios()
  })

  onBeforeUnmount(() => {
    active = false
    requestEpoch += 1
    listRequestEpoch += 1
    accountsRequestEpoch += 1
    cancelPolling()
  })

  return {
    portfolios,
    selectedPortfolioKey,
    portfolioSummary,
    loadingList,
    loadingDetail,
    message,
    messageIsError,
    equityRows,
    equityCaveat,
    bookEquity,
    positionRows,
    positionSummary,
    tradeRows,
    timelineData,
    latestPlanDetail,
    expandedTimelinePlanId,
    reviewAiRiskLoading,
    reviewLlmRiskLoading,
    opsLlmRiskLoading,
    forceRebalanceSubmittingKey,
    forceRebalanceSubmitting,
    securitiesAccounts,
    selectedLiveAccountId,
    selectedPortfolio,
    selectedPortfolioDisplay,
    selectedLatestPlanId,
    selectedOperationPlanId,
    benchPlanId,
    pendingActionPlan,
    openLineageTradePlan,
    executionVenue,
    isLivePortfolio,
    isPaperPortfolio,
    loadPortfolios,
    loadSecuritiesAccounts,
    syncSelectedLiveAccount,
    refreshDetail,
    rerunReviewAiRisk,
    rerunPlanLlmRisk,
    pollLlmRiskRun,
    submitForceRebalance,
    resumeLineageAction,
    pollGenerationTask,
    toggleTimelineDetail,
  }
}
