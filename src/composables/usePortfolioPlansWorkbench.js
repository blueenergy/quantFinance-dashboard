import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  enqueuePortfolioLlmRisk,
  generatePortfolioPlan,
  getPortfolioLlmRiskRun,
  getPortfolioPlan,
  getPortfolioPlanExecutions,
  getPortfolioPlanGenerationTask,
  getPortfolioPlanGenerationWatermark,
  getPortfolioPlanLineageEquity,
  getPortfolioPlanLiveEquity,
  getPortfolioPlanLiveExecutions,
  getPortfolioPlanLiveRealtimeEquity,
  getPortfolioPlanOperationLogs,
  listLiveTradeExecutions,
  listLiveTradeSignals,
  listPortfolioParameterPresets,
  listPortfolioPlanGenerationTasks,
  listPortfolioPlans,
  listPortfolioStrategies,
  listPortfolioWorkerStatus,
  listTraderHeartbeats,
  rerunPortfolioPlanAiRisk,
} from '../api/portfolioPlans'
import { getSecuritiesAccounts } from '../api/trader'

const ACTION_REQUIRED_STATUSES = new Set(['needs_review', 'approved', 'partially_executed'])

function todayInputDate() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

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

export function usePortfolioPlansWorkbench({
  normalizePlanParams = (params) => params,
  syncGenerateParamsFromStrategy = () => {},
  applyDefaultPreset = () => {},
  onBeforeSelect = () => {},
} = {}) {
  const selectedStrategyId = ref('')
  const statusFilter = ref('')
  const showOnlyActionRequired = ref(true)
  const hideMonitorPlans = ref(true)
  const selectedPlanId = ref('')
  const selectedDetail = ref(null)
  const monitorAccountId = ref('')
  const operationAccountId = ref('')

  const plans = ref([])
  const strategies = ref([])
  const parameterPresets = ref([])
  const generationTasks = ref([])
  const workerStatuses = ref([])
  const traderHeartbeats = ref([])
  const liveSignals = ref([])
  const liveExecutions = ref([])
  const securitiesAccounts = ref([])
  const planGenerationWatermark = ref(null)
  const equity = ref([])
  const realtimeEquity = ref(null)
  const executions = ref([])
  const operationLogs = ref([])

  const loading = ref(false)
  const generateLoading = ref(false)
  const tasksLoading = ref(false)
  const watermarkLoading = ref(false)
  const workerStatusLoading = ref(false)
  const liveOpsLoading = ref(false)
  const operationLogsLoading = ref(false)
  const aiRiskRunning = ref(false)
  const llmRiskRunning = ref(false)

  const message = ref('')
  const currentGenerationTask = ref(null)
  const llmRiskMeta = ref({ runId: '', status: '', summary: '' })
  const generateForm = ref({
    strategy_template_id: '',
    base_date: todayInputDate(),
    mode: 'auto',
    force: false,
    preset_id: '',
    params: {},
  })

  let realtimeTimer = null
  let generationTaskTimer = null
  let aiRiskTimer = null
  let llmRiskTimer = null
  let requestEpoch = 0

  const displayPlans = computed(() => (
    plans.value.filter((plan) => {
      if (
        hideMonitorPlans.value
        && plan.record_kind === 'observation'
        && plan.executable === false
        && plan.non_executable_reason === 'monitor_no_trade'
      ) {
        return false
      }
      if (showOnlyActionRequired.value) {
        const needsAction = ACTION_REQUIRED_STATUSES.has(plan.status)
          || (plan.executable && ['needs_review', 'approved'].includes(plan.status))
        if (!needsAction) return false
      }
      return true
    })
  ))

  function isCurrentSelection(planId, epoch = null) {
    return selectedPlanId.value === planId && (epoch === null || requestEpoch === epoch)
  }

  function detailHasLiveSignals(detail = selectedDetail.value) {
    return (detail?.execution_mode || 'not_executed') === 'live'
  }

  function detailShowsPaperSections(detail = selectedDetail.value) {
    if (!detail || detailHasLiveSignals(detail)) return false
    const status = detail?.plan?.status || ''
    if (['needs_review', 'generated', 'draft'].includes(status)) return false
    const executionCount = Number(detail?.execution_status?.execution_count || 0)
    const hasPaperExecution = Boolean(detail?.plan?.paper_executed_at) || executionCount > 0
    return status === 'approved' || hasPaperExecution
  }

  function filterBySelectedAccount(rows) {
    if (!monitorAccountId.value) return rows
    return rows.filter((row) => String(row.securities_account_id || '') === String(monitorAccountId.value))
  }

  function reportFirstRejected(results, fallback) {
    const failed = results.find((result) => result.status === 'rejected')
    if (!failed) return
    const error = failed.reason || {}
    const detailText = formatApiDetail(error.response?.data?.detail)
    message.value = detailText || error.message || fallback
  }

  async function loadSecuritiesAccounts() {
    try {
      const accounts = await getSecuritiesAccounts()
      securitiesAccounts.value = Array.isArray(accounts) ? accounts : []
      if (!operationAccountId.value && securitiesAccounts.value.length) {
        operationAccountId.value = securitiesAccounts.value[0].id || securitiesAccounts.value[0]._id
      }
    } catch {
      securitiesAccounts.value = []
    }
  }

  async function loadStrategies() {
    try {
      const res = await listPortfolioStrategies()
      strategies.value = res.data || []
    } catch (error) {
      strategies.value = []
      throw error
    }
  }

  async function loadParameterPresets() {
    if (!generateForm.value.strategy_template_id) {
      parameterPresets.value = []
      return
    }
    try {
      const res = await listPortfolioParameterPresets({
        strategy_template_id: generateForm.value.strategy_template_id,
      })
      parameterPresets.value = (res.data || []).filter((preset) => preset.status !== 'disabled')
    } catch {
      parameterPresets.value = []
    }
  }

  async function loadPlans() {
    loading.value = true
    message.value = ''
    try {
      const params = {}
      if (selectedStrategyId.value) params.strategy_template_id = selectedStrategyId.value
      if (statusFilter.value) params.status = statusFilter.value
      const res = await listPortfolioPlans(params)
      plans.value = res.data || []
      if (selectedPlanId.value && !plans.value.some((plan) => plan.plan_id === selectedPlanId.value)) {
        requestEpoch += 1
        selectedPlanId.value = ''
        selectedDetail.value = null
        equity.value = []
        realtimeEquity.value = null
        executions.value = []
      }
    } catch (error) {
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载计划失败'
    } finally {
      loading.value = false
    }
  }

  async function loadGenerationTasks() {
    tasksLoading.value = true
    try {
      const res = await listPortfolioPlanGenerationTasks({ limit: 20 })
      generationTasks.value = res.data || []
    } catch (error) {
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载生成任务失败'
    } finally {
      tasksLoading.value = false
    }
  }

  async function loadWorkerStatus() {
    workerStatusLoading.value = true
    try {
      const res = await listPortfolioWorkerStatus({ worker_type: 'portfolio_plan_generator', limit: 20 })
      workerStatuses.value = res.data || []
    } catch (error) {
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载 worker 状态失败'
    } finally {
      workerStatusLoading.value = false
    }
  }

  async function loadLiveOps(planId = selectedPlanId.value, epoch = null) {
    liveOpsLoading.value = true
    try {
      const params = { limit: 20 }
      if (monitorAccountId.value) params.securities_account_id = monitorAccountId.value
      const heartbeatsPromise = listTraderHeartbeats({ limit: 20 })
      if (planId) {
        const [planLiveRes, heartbeatsRes] = await Promise.all([
          getPortfolioPlanLiveExecutions(planId),
          heartbeatsPromise,
        ])
        if (!isCurrentSelection(planId, epoch)) return
        liveSignals.value = filterBySelectedAccount(planLiveRes.data?.signals || [])
        liveExecutions.value = filterBySelectedAccount(planLiveRes.data?.executions || [])
        traderHeartbeats.value = heartbeatsRes.data || []
        return
      }
      const [signalsRes, executionsRes, heartbeatsRes] = await Promise.all([
        listLiveTradeSignals(params),
        listLiveTradeExecutions(params),
        heartbeatsPromise,
      ])
      if (selectedPlanId.value) return
      liveSignals.value = signalsRes.data || []
      liveExecutions.value = executionsRes.data || []
      traderHeartbeats.value = heartbeatsRes.data || []
    } catch (error) {
      if (!planId || isCurrentSelection(planId, epoch)) {
        message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载实盘执行状态失败'
      }
    } finally {
      if (!planId || isCurrentSelection(planId, epoch)) liveOpsLoading.value = false
    }
  }

  async function loadPlanGenerationWatermark() {
    if (!generateForm.value.strategy_template_id) {
      planGenerationWatermark.value = null
      return
    }
    watermarkLoading.value = true
    try {
      const res = await getPortfolioPlanGenerationWatermark({
        strategy_template_id: generateForm.value.strategy_template_id,
        base_date: generateForm.value.base_date,
      })
      planGenerationWatermark.value = res.data || null
    } catch (error) {
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载数据水位失败'
    } finally {
      watermarkLoading.value = false
    }
  }

  async function loadEquity(planId = selectedPlanId.value, detail = selectedDetail.value, epoch = null) {
    if (!planId) {
      equity.value = []
      return
    }
    if (detailHasLiveSignals(detail)) {
      const res = await getPortfolioPlanLiveEquity(planId)
      if (isCurrentSelection(planId, epoch)) equity.value = res.data || []
      return
    }
    if (!detailShowsPaperSections(detail)) {
      if (isCurrentSelection(planId, epoch)) equity.value = []
      return
    }
    const res = await getPortfolioPlanLineageEquity(planId)
    if (isCurrentSelection(planId, epoch)) equity.value = res.data?.rows || []
  }

  async function loadRealtimeEquity(planId = selectedPlanId.value, detail = selectedDetail.value, epoch = null) {
    if (!planId) {
      realtimeEquity.value = null
      return
    }
    if (detailHasLiveSignals(detail)) {
      const res = await getPortfolioPlanLiveRealtimeEquity(planId)
      if (isCurrentSelection(planId, epoch)) realtimeEquity.value = res.data || null
      return
    }
    if (isCurrentSelection(planId, epoch)) realtimeEquity.value = null
  }

  async function loadExecutions(planId = selectedPlanId.value, detail = selectedDetail.value, epoch = null) {
    if (!planId || !detailShowsPaperSections(detail)) {
      if (!planId || isCurrentSelection(planId, epoch)) executions.value = []
      return
    }
    const res = await getPortfolioPlanExecutions(planId)
    if (isCurrentSelection(planId, epoch)) executions.value = res.data || []
  }

  async function loadOperationLogs(planId = selectedPlanId.value, epoch = null) {
    if (!planId) {
      operationLogs.value = []
      return
    }
    operationLogsLoading.value = true
    try {
      const res = await getPortfolioPlanOperationLogs(planId, { limit: 100 })
      if (isCurrentSelection(planId, epoch)) operationLogs.value = res.data || []
    } catch (error) {
      if (isCurrentSelection(planId, epoch)) {
        const detailText = formatApiDetail(error.response?.data?.detail)
        message.value = detailText || error.message || '加载操作日志失败'
      }
    } finally {
      if (isCurrentSelection(planId, epoch)) operationLogsLoading.value = false
    }
  }

  async function refreshAll() {
    const initialResults = await Promise.allSettled([
      loadSecuritiesAccounts(),
      loadStrategies(),
    ])
    reportFirstRejected(initialResults, '部分基础配置加载失败')
    const availableStrategies = strategies.value.filter((strategy) => strategy.status !== 'disabled')
    if (!generateForm.value.strategy_template_id && availableStrategies.length) {
      generateForm.value.strategy_template_id = availableStrategies[0].strategy_template_id
    }
    syncGenerateParamsFromStrategy()
    const restResults = await Promise.allSettled([
      loadParameterPresets(),
      loadWorkerStatus(),
      loadGenerationTasks(),
      loadPlans(),
      loadPlanGenerationWatermark(),
      loadLiveOps(),
    ])
    reportFirstRejected(restResults, '部分组合计划数据加载失败')
    applyDefaultPreset()
  }

  async function generatePlan() {
    if (!generateForm.value.strategy_template_id || !generateForm.value.base_date) return
    generateLoading.value = true
    message.value = ''
    try {
      const payload = {
        strategy_template_id: generateForm.value.strategy_template_id,
        base_date: generateForm.value.base_date,
        mode: generateForm.value.mode,
        force: generateForm.value.force,
        preset_id: generateForm.value.preset_id || null,
        params_override: normalizePlanParams(generateForm.value.params),
      }
      const res = await generatePortfolioPlan(payload)
      currentGenerationTask.value = res.data
      await loadPlanGenerationWatermark()
      await loadGenerationTasks()
      selectedStrategyId.value = generateForm.value.strategy_template_id
      statusFilter.value = ''
      message.value = `已提交生成任务 ${res.data?.task_id || ''}`
      startGenerationTaskPolling(res.data?.task_id)
    } catch (error) {
      message.value = formatApiDetail(error.response?.data?.detail) || error.message || '生成计划失败'
    } finally {
      generateLoading.value = false
    }
  }

  function startGenerationTaskPolling(taskId) {
    if (!taskId) return
    if (generationTaskTimer) window.clearInterval(generationTaskTimer)
    pollGenerationTask(taskId)
    generationTaskTimer = window.setInterval(() => pollGenerationTask(taskId), 3000)
  }

  async function pollGenerationTask(taskId) {
    try {
      const res = await getPortfolioPlanGenerationTask(taskId)
      currentGenerationTask.value = res.data
      if (['completed', 'failed'].includes(res.data?.status)) {
        if (generationTaskTimer) {
          window.clearInterval(generationTaskTimer)
          generationTaskTimer = null
        }
        await loadPlanGenerationWatermark()
        await loadWorkerStatus()
        await loadGenerationTasks()
        await loadPlans()
        if (res.data.status === 'completed' && res.data.plan_id) {
          await selectPlan(res.data.plan_id)
          message.value = `已生成计划 ${res.data.plan_id}`
        } else if (res.data.status === 'failed') {
          message.value = res.data.error_message || '生成计划失败'
        }
      }
    } catch (error) {
      const detailText = formatApiDetail(error.response?.data?.detail)
      message.value = detailText || error.message || '查询生成任务失败'
    }
  }

  async function reloadSelectedPlan() {
    const planId = selectedPlanId.value
    if (!planId) return
    const epoch = requestEpoch
    try {
      const res = await getPortfolioPlan(planId)
      if (isCurrentSelection(planId, epoch)) selectedDetail.value = res.data
    } catch (error) {
      if (!isCurrentSelection(planId, epoch)) return
      const detailText = formatApiDetail(error.response?.data?.detail)
      message.value = detailText || error.message || '刷新 plan 风险失败'
    }
  }

  async function selectPlan(planId) {
    const epoch = ++requestEpoch
    selectedPlanId.value = planId
    onBeforeSelect()
    let detail
    try {
      const res = await getPortfolioPlan(planId)
      if (!isCurrentSelection(planId, epoch)) return
      detail = res.data
      selectedDetail.value = detail
    } catch (error) {
      if (!isCurrentSelection(planId, epoch)) return
      selectedDetail.value = null
      const detailText = formatApiDetail(error.response?.data?.detail)
      message.value = detailText || error.message || '加载 plan 详情失败'
      return
    }
    const optionalLoads = detailHasLiveSignals(detail)
      ? [
          loadEquity(planId, detail, epoch),
          loadRealtimeEquity(planId, detail, epoch),
          loadOperationLogs(planId, epoch),
          loadLiveOps(planId, epoch),
        ]
      : [
          loadEquity(planId, detail, epoch),
          loadRealtimeEquity(planId, detail, epoch),
          loadExecutions(planId, detail, epoch),
          loadOperationLogs(planId, epoch),
          loadLiveOps(planId, epoch),
        ]
    if (detailHasLiveSignals(detail)) executions.value = []
    const results = await Promise.allSettled(optionalLoads)
    if (!isCurrentSelection(planId, epoch)) return
    const failed = results.find((result) => result.status === 'rejected')
    if (failed) {
      const error = failed.reason || {}
      const detailText = formatApiDetail(error.response?.data?.detail)
      message.value = detailText || error.message || '部分附加数据加载失败，plan 详情已显示'
    }
  }

  async function runAiRisk() {
    const planId = selectedPlanId.value
    if (!planId || aiRiskRunning.value) return
    aiRiskRunning.value = true
    message.value = '规则风控审查已提交，正在运行…'
    try {
      const res = await rerunPortfolioPlanAiRisk(planId)
      const taskId = res.data?.task?.task_id
      await loadOperationLogs(planId)
      if (!taskId) {
        aiRiskRunning.value = false
        return
      }
      if (aiRiskTimer) window.clearInterval(aiRiskTimer)
      aiRiskTimer = window.setInterval(() => pollAiRiskTask(taskId, planId), 2000)
    } catch (error) {
      aiRiskRunning.value = false
      const detailText = formatApiDetail(error.response?.data?.detail)
      message.value = detailText || error.message || '规则风控审查失败'
    }
  }

  async function pollAiRiskTask(taskId, planId) {
    try {
      const res = await getPortfolioPlanGenerationTask(taskId)
      const status = res.data?.status
      if (['completed', 'failed'].includes(status)) {
        if (aiRiskTimer) {
          window.clearInterval(aiRiskTimer)
          aiRiskTimer = null
        }
        aiRiskRunning.value = false
        await loadOperationLogs(planId)
        if (status === 'completed') {
          if (selectedPlanId.value === planId) await selectPlan(planId)
          message.value = '规则风控审查完成'
        } else {
          message.value = res.data?.error_message || '规则风控审查失败'
        }
      }
    } catch (error) {
      if (aiRiskTimer) {
        window.clearInterval(aiRiskTimer)
        aiRiskTimer = null
      }
      aiRiskRunning.value = false
      message.value = error.message || '规则风控任务查询失败'
    }
  }

  async function runLlmRisk() {
    const planId = selectedPlanId.value
    if (!planId || llmRiskRunning.value) return
    llmRiskRunning.value = true
    llmRiskMeta.value = { runId: '', status: 'pending', summary: '' }
    message.value = 'AI 风险/机会分析已提交，正在按行业分桶分析…'
    try {
      const res = await enqueuePortfolioLlmRisk(planId)
      const runId = res.data?.run_id
      const summary = res.data?.summary || {}
      llmRiskMeta.value = {
        runId: runId || '',
        status: summary.status || 'pending',
        summary: summary.partial_summary || '',
      }
      await loadOperationLogs(planId)
      if (!runId) {
        llmRiskRunning.value = false
        return
      }
      if (llmRiskTimer) window.clearInterval(llmRiskTimer)
      await pollLlmRiskRun(runId, planId)
      if (llmRiskRunning.value) {
        llmRiskTimer = window.setInterval(() => pollLlmRiskRun(runId, planId), 2000)
      }
    } catch (error) {
      llmRiskRunning.value = false
      const detailText = formatApiDetail(error.response?.data?.detail)
      message.value = detailText || error.message || 'AI 风险/机会分析失败'
    }
  }

  async function pollLlmRiskRun(runId, planId) {
    try {
      const res = await getPortfolioLlmRiskRun(planId, runId)
      const status = res.data?.status
      const summaryText = res.data?.partial_summary || ''
      llmRiskMeta.value = {
        runId,
        status: status || '',
        summary: summaryText,
      }
      if (['completed', 'completed_with_failures', 'failed'].includes(status)) {
        if (llmRiskTimer) {
          window.clearInterval(llmRiskTimer)
          llmRiskTimer = null
        }
        llmRiskRunning.value = false
        await loadOperationLogs(planId)
        if (status === 'completed') {
          if (selectedPlanId.value === planId) await selectPlan(planId)
          message.value = 'AI 风险/机会分析完成'
        } else if (status === 'completed_with_failures') {
          if (selectedPlanId.value === planId) await selectPlan(planId)
          message.value = `AI 风险/机会分析部分完成：${summaryText || '部分行业任务失败，已刷新可用结果'}`
        } else {
          message.value = `AI 风险/机会分析失败：${summaryText || '所有行业任务均未完成，请稍后重试或检查 worker 日志'}`
        }
      }
    } catch (error) {
      if (llmRiskTimer) {
        window.clearInterval(llmRiskTimer)
        llmRiskTimer = null
      }
      llmRiskRunning.value = false
      message.value = error.message || 'AI 风险/机会分析任务查询失败'
    }
  }

  onMounted(() => {
    refreshAll()
    realtimeTimer = window.setInterval(() => {
      if (selectedDetail.value?.plan?.strategy_template_id) loadRealtimeEquity()
    }, 60000)
  })

  onBeforeUnmount(() => {
    requestEpoch += 1
    if (realtimeTimer) window.clearInterval(realtimeTimer)
    if (generationTaskTimer) window.clearInterval(generationTaskTimer)
    if (aiRiskTimer) window.clearInterval(aiRiskTimer)
    if (llmRiskTimer) window.clearInterval(llmRiskTimer)
  })

  return {
    selectedStrategyId,
    statusFilter,
    showOnlyActionRequired,
    hideMonitorPlans,
    displayPlans,
    selectedPlanId,
    selectedDetail,
    monitorAccountId,
    operationAccountId,
    plans,
    strategies,
    parameterPresets,
    generationTasks,
    workerStatuses,
    traderHeartbeats,
    liveSignals,
    liveExecutions,
    securitiesAccounts,
    planGenerationWatermark,
    equity,
    realtimeEquity,
    executions,
    operationLogs,
    loading,
    generateLoading,
    tasksLoading,
    watermarkLoading,
    workerStatusLoading,
    liveOpsLoading,
    operationLogsLoading,
    aiRiskRunning,
    llmRiskRunning,
    message,
    currentGenerationTask,
    llmRiskMeta,
    generateForm,
    loadPlans,
    loadStrategies,
    loadParameterPresets,
    loadGenerationTasks,
    loadWorkerStatus,
    loadLiveOps,
    loadPlanGenerationWatermark,
    loadSecuritiesAccounts,
    loadEquity,
    loadRealtimeEquity,
    loadExecutions,
    loadOperationLogs,
    refreshAll,
    reportFirstRejected,
    generatePlan,
    startGenerationTaskPolling,
    pollGenerationTask,
    reloadSelectedPlan,
    selectPlan,
    runAiRisk,
    pollAiRiskTask,
    runLlmRisk,
    pollLlmRiskRun,
    formatApiDetail,
    filterBySelectedAccount,
  }
}
