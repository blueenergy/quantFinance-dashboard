<template>
  <section class="portfolio-plans">
    <header class="page-header">
      <div>
        <p class="eyebrow">Portfolio Plans</p>
        <h2>组合交易计划</h2>
        <p class="subtitle">审核与运维工作台：默认聚焦需处理的调仓计划；每日观察计划可在总览页查看周期脉络。</p>
      </div>
      <button :disabled="loading" @click="refreshAll">刷新</button>
    </header>

    <section class="toolbar">
      <label>
        策略
        <select v-model="selectedStrategyId" @change="loadPlans">
          <option value="">全部策略</option>
          <option v-for="strategy in strategies" :key="strategy.strategy_template_id" :value="strategy.strategy_template_id">
            {{ strategyOptionLabel(strategy) }}
          </option>
        </select>
      </label>
      <label>
        状态
        <select v-model="statusFilter" @change="loadPlans">
          <option value="">全部</option>
          <option value="generated">generated</option>
          <option value="needs_review">needs_review</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
          <option value="executed_paper">executed_paper</option>
          <option value="partially_executed">partially_executed</option>
        </select>
      </label>
      <label class="inline-check">
        <input v-model="showOnlyActionRequired" type="checkbox" />
        只看需要处理
      </label>
      <label class="inline-check">
        <input v-model="hideMonitorPlans" type="checkbox" />
        隐藏观察日计划
      </label>
    </section>

    <section class="card ops-workbench-card">
      <div class="task-list-header">
        <div>
          <h3>运维工具</h3>
          <p class="muted">数据水位、Worker 状态等内部功能，默认折叠。</p>
        </div>
        <button type="button" @click="opsWorkbenchExpanded = !opsWorkbenchExpanded">
          {{ opsWorkbenchExpanded ? '折叠' : '展开' }}
        </button>
      </div>
    </section>

    <PlanGenerationPanel
      v-if="opsWorkbenchExpanded"
      :expanded="generateFormExpanded"
      :form="generateForm"
      :strategies="availableStrategies"
      :selected-strategy="selectedGenerateStrategy"
      :presets="parameterPresets"
      :selected-preset="selectedPreset"
      :evidence-rows="presetEvidenceRows"
      :universe-options="universeOptions"
      :loading="generateLoading"
      :task="currentGenerationTask"
      :strategy-label="strategyOptionLabel"
      @toggle="generateFormExpanded = !generateFormExpanded"
      @strategy-change="setGenerateStrategy"
      @field-change="setGenerateField"
      @preset-change="setGeneratePreset"
      @param-change="setGenerateParam"
      @growth-change="setGrowthWeight"
      @cycle-change="setCycleWeight"
      @watermark-refresh="loadPlanGenerationWatermark"
      @generate="generatePlan"
    />

    <p v-if="message" class="message">{{ message }}</p>

    <PlanGenerationWatermarkPanel
      v-if="opsWorkbenchExpanded"
      :watermark="planGenerationWatermark"
      :loading="watermarkLoading"
      :disabled="!generateForm.strategy_template_id"
      :target-scoring-run-text="targetScoringRunText"
      :latest-completed-scoring-text="latestCompletedScoringText"
      :latest-available-score-text="latestAvailableScoreText"
      :latest-available-score-meta="latestAvailableScoreMeta"
      :latest-scoring-run-text="latestScoringRunText"
      @refresh="loadPlanGenerationWatermark"
    />

    <PlanWorkerStatusPanel v-if="opsWorkbenchExpanded" :workers="workerStatuses" :loading="workerStatusLoading" @refresh="loadWorkerStatus" />

    <LiveOpsMonitorPanel
      v-model:account-id="monitorAccountId"
      :plan-id="selectedPlanId"
      :signal-summary="formatSummary(liveSignalStatusSummary)"
      :execution-summary="formatSummary(liveExecutionStatusSummary)"
      :latest-heartbeat="latestTraderHeartbeat"
      :account-options="liveAccountOptions"
      :loading="liveOpsLoading"
      :expanded="liveOpsExpanded"
      :heartbeats="traderHeartbeats"
      :signals="liveSignals"
      :executions="liveExecutions"
      @refresh="loadLiveOps"
      @toggle="liveOpsExpanded = !liveOpsExpanded"
    />

    <PlanTaskHistoryPanel
      :tasks="generationTasks"
      :latest-task="latestGenerationTask"
      :current-task-id="currentGenerationTask?.task_id || ''"
      :expanded="generationTasksExpanded"
      :loading="tasksLoading"
      @toggle="generationTasksExpanded = !generationTasksExpanded"
      @refresh="loadGenerationTasks"
      @select="currentGenerationTask = $event"
    />

    <div class="layout">
      <PortfolioPlanList
        :plans="displayPlans"
        :all-plans="plans"
        :selected-plan-id="selectedPlanId"
        :selected-detail="selectedDetail"
        :loading="loading"
        :only-action-required="showOnlyActionRequired"
        :display-title="planDisplayTitle"
        @select="selectPlan"
      />

      <main class="card detail">
        <template v-if="selectedDetail">
          <PortfolioPlanDetailHeader
            :detail="selectedDetail"
            :display-title="planDisplayTitle"
            :signal-review-summary="signalReviewSummary"
            :monitor-no-trade="selectedPlanIsMonitorNoTrade"
            :score-snapshot-stale="scoreSnapshotStale"
            :overlay="liveOverlay"
          />

          <PlanReviewPanel
            :visible="needsReviewPlan && Boolean(selectedDetail)"
            :plan-id="reviewPlanId"
            :items="planTargetRows"
            :overlay="liveOverlay"
            :score-snapshot-stale="scoreSnapshotStale"
            :summary="planReviewSummary"
            :risk-summary="planReviewRiskSummary"
            :llm-risk-summary="llmRiskSummary"
            :approve-submitting="approveSubmitting"
            :reject-submitting="rejectSubmitting"
            :review-ai-risk-loading="aiRiskRunning"
            :review-llm-risk-loading="llmRiskRunning"
            :can-reselect-items="canReselectItems"
            :selected-reselect-symbols="selectedReselectSymbols"
            :selected-plan-excluded="selectedPlanExcluded"
            :selected-reselect-count="selectedReselectCount"
            :action-loading="reselectActionLoading"
            :reselect-busy="reselectBusy"
            :pending-reselect-symbol="pendingReselect?.symbol || ''"
            :reselect-status="reselectStatus"
            :reselect-task-meta="reselectTaskMeta"
            :last-reselect-summary="lastReselectSummary"
            @approve="approvePendingPlan"
            @reject="rejectPendingPlan"
            @rerun-ai-risk="runAiRisk"
            @rerun-llm-risk="runLlmRisk"
            @toggle-reselect="toggleReselectSelection"
            @reselect="reselectItem"
            @bulk-reselect="bulkReselectItems"
            @select-high-risk="selectHighRiskReselectItems"
          />

          <PlanOpsPanel
            :visible="showPlanOpsPanel"
            :plan-id="selectedOperationPlanId"
            :plan-status="selectedPlanStatus"
            :execution-mode-label="selectedPlanExecutionModeLabel"
            :execution-venue="executionVenue"
            :execution-venue-label="executionVenueLabel"
            :overlay="liveOverlay"
            :score-snapshot-stale="scoreSnapshotStale"
            :is-paper="isPaperPortfolio"
            :can-execute-paper-now="canExecutePaperNow"
            :paper-execute-ready-text="paperExecuteReadyText"
            :paper-execute-loading="paperExecuteLoading"
            v-model:selected-live-account-id="operationAccountId"
            :live-account-options="liveAccountOptions"
            :can-publish-live-signals="canPublishLiveSignals"
            :has-published-live-signals="selectedPlanHasPublishedLiveSignals"
            :live-publish-loading="livePublishLoading"
            :live-publish-blockers="livePublishBlockers"
            :can-confirm-publish="canConfirmLivePublish"
            :allow-partial-publish="allowPartialPublish"
            :can-cancel-current-plan="canCancelCurrentPlan"
            :cancel-plan-ready-text="cancelPlanReadyText"
            :cancel-plan-loading="cancelPlanLoading"
            :llm-risk-summary="llmRiskSummary"
            :llm-risk-loading="llmRiskRunning"
            :remainder-preview="remainderPreview"
            :remainder-rows="remainderRows"
            :remainder-actionable-count="remainderActionableCount"
            :remainder-blockers="remainderBlockers"
            :remainder-skipped="remainderSkipped"
            :remainder-publishable-count="remainderPublishableCount"
            :can-confirm-remainder="canConfirmRemainder"
            :allow-partial-remainder="allowPartialRemainder"
            :remainder-loading="remainderLoading"
            v-model:remainder-reason="remainderReason"
            @execute-paper="executePaperNow"
            @preview-publish="previewLivePublish"
            @confirm-publish="publishLiveSignals"
            @preview-remainder="previewRemainder"
            @confirm-remainder="confirmRemainder"
            @update:allow-partial-remainder="setAllowPartialRemainder"
            @cancel-plan="cancelCurrentPlan"
            @rerun-llm-risk="runLlmRisk"
          />

          <PlanPublishPreviewModal
            :visible="showPublishModal"
            :preview="livePublishPreview"
            :loading="livePublishLoading"
            :blocker-messages="livePublishBlockers"
            :allow-partial="allowPartialPublish"
            :confirm-disabled="!canConfirmLivePublish"
            @close="showPublishModal = false"
            @update:allow-partial="setAllowPartialPublish"
            @confirm="publishLiveSignals"
          />

          <PortfolioPlanLineageSummary :plan="selectedDetail.plan" :plans="plans" @select="selectPlan" />

          <PortfolioPlanCapitalBasis :plan="selectedDetail.plan" />

          <PlanOperationLogsPanel :logs="operationLogs" :loading="operationLogsLoading" :disabled="!selectedPlanId" @refresh="loadOperationLogs" />

          <section v-if="showPaperExecutionStatus" class="execution-status">
            <h4>后台执行状态</h4>
            <p v-if="selectedDetail.plan.status === 'approved'" class="muted">
              已审核，后台将按模拟成交价自动执行；“立即执行 Paper”使用同一 waterfall：开盘价 → 最近收盘价 → 计划价。
            </p>
            <div class="status-grid">
              <div>
                <span>execute_date</span>
                <strong>{{ executionStatus.execute_date || '-' }}</strong>
                <small v-if="executionStatus.uses_runtime_execute_date">
                  后台将按运行日期 {{ executionStatus.effective_execute_date || '-' }} 检查
                </small>
              </div>
              <div>
                <span>模拟成交价</span>
                <strong>{{ paperExecutionPriceStatusText(executionStatus) }}</strong>
                <small v-if="executionStatus.execution_price_fallback_count">
                  {{ executionStatus.execution_price_fallback_count }} 个将回退收盘价/计划价
                </small>
                <small v-else-if="!executionStatus.open_price_ready">
                  开盘价缺失 {{ executionStatus.missing_open_price_count ?? 0 }} 个（可回退）
                </small>
              </div>
              <div>
                <span>后台执行状态</span>
                <strong>{{ executionStatus.backend_execution_status || '-' }}</strong>
              </div>
              <div>
                <span>最近一次执行结果</span>
                <strong>{{ latestExecutionText }}</strong>
                <small v-if="executionStatus.execution_count">累计 {{ executionStatus.execution_count }} 条成交记录</small>
              </div>
            </div>
            <p v-if="executionStatus.execution_price_fallback_examples?.length" class="muted">
              回退示例：{{ executionStatus.execution_price_fallback_examples.join(', ') }}
            </p>
            <p v-if="executionStatus.missing_execution_price_examples?.length" class="muted">
              无可用价格示例：{{ executionStatus.missing_execution_price_examples.join(', ') }}
            </p>
            <p v-if="selectedDetail.plan.status === 'approved' && executionStatus.open_price_ready === false" class="watermark-warning">
              execute_date 开盘价尚未全部同步，Paper 执行将回退使用最近收盘价或计划价；仅当标的完全没有任何可用价格时才会 blocked。
            </p>
          </section>

          <PortfolioPlanItemsPanel
            :visible="!needsReviewPlan"
            :items="selectedDetail.items"
            :overlay="liveOverlay"
            :plan-id="selectedDetail.plan?.plan_id || ''"
            :ai-risk-summary="aiRiskSummary"
            :llm-risk-summary="llmRiskSummary"
            :risk-snapshot="riskSnapshot"
            :ai-risk-running="aiRiskRunning"
            :llm-risk-running="llmRiskRunning"
            :llm-risk-meta="llmRiskMeta"
            :can-reselect-items="canReselectItems"
            :selected-reselect-count="selectedReselectCount"
            :action-loading="combinedActionLoading"
            :reselect-busy="reselectBusy"
            :reselect-status="reselectStatus"
            :reselect-task-meta="reselectTaskMeta"
            :last-reselect-summary="lastReselectSummary"
            :excluded-symbols="selectedPlanExcluded"
            :pending-reselect-symbol="pendingReselect?.symbol || ''"
            :selected-reselect-symbols="selectedReselectSymbols"
            :has-live-signals="selectedPlanHasLiveSignals"
            :monitor-no-trade="selectedPlanIsMonitorNoTrade"
            @select-high-risk="selectHighRiskReselectItems"
            @bulk-reselect="bulkReselectItems"
            @run-ai-risk="runAiRisk"
            @run-llm-risk="runLlmRisk"
            @toggle-reselect="toggleReselectSelection"
            @reselect="reselectItem"
            @risk-changed="reloadSelectedPlan"
          />

          <PortfolioPlanEquityPanel
            v-if="selectedPlanHasLiveSignals || showPaperSections"
            :live="selectedPlanHasLiveSignals"
            :realtime-equity="realtimeEquity"
            :rows="equityRows"
            :chart="equityChart"
          />

          <PortfolioPlanPaperFillsPanel v-if="showPaperSections" :executions="executions" :realtime-prices="realtimePriceBySymbol" />
        </template>
        <p v-else class="muted">请选择一份计划。</p>
      </main>
    </div>
  </section>
</template>

<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { getPortfolioPlanGenerationTask } from '../api/portfolioPlans'
import PortfolioPlanList from '../components/portfolio/PortfolioPlanList.vue'
import {
  buildEquityChart,
  buildEquityRows,
  formatSummary,
  formatSignalReviewAt,
  scoringRunText,
  signalReviewStatusText,
  summarizeByStatus,
} from '../composables/usePortfolioPlanFormat'
import { usePlanOps } from '../composables/usePlanOps'
import { usePortfolioPlanGeneration } from '../composables/usePortfolioPlanGeneration'
import { usePortfolioPlansWorkbench } from '../composables/usePortfolioPlansWorkbench'
import { useReselectPlanItems } from '../composables/useReselectPlanItems'
import {
  canExecutePaperNowFromState,
  paperExecuteReadyTextFromState,
  paperExecutionPriceStatusText,
} from '../utils/paperExecutionEligibility'

const PlanGenerationPanel = defineAsyncComponent(() => import('../components/portfolio/PlanGenerationPanel.vue'))
const PlanGenerationWatermarkPanel = defineAsyncComponent(() => import('../components/portfolio/PlanGenerationWatermarkPanel.vue'))
const PlanWorkerStatusPanel = defineAsyncComponent(() => import('../components/portfolio/PlanWorkerStatusPanel.vue'))
const PlanTaskHistoryPanel = defineAsyncComponent(() => import('../components/portfolio/PlanTaskHistoryPanel.vue'))
const LiveOpsMonitorPanel = defineAsyncComponent(() => import('../components/portfolio/LiveOpsMonitorPanel.vue'))
const PlanReviewPanel = defineAsyncComponent(() => import('../components/portfolio/PlanReviewPanel.vue')); const PlanOpsPanel = defineAsyncComponent(() => import('../components/portfolio/PlanOpsPanel.vue'))
const PlanPublishPreviewModal = defineAsyncComponent(() => import('../components/portfolio/PlanPublishPreviewModal.vue')); const PortfolioPlanDetailHeader = defineAsyncComponent(() => import('../components/portfolio/PortfolioPlanDetailHeader.vue'))
const PortfolioPlanLineageSummary = defineAsyncComponent(() => import('../components/portfolio/PortfolioPlanLineageSummary.vue')); const PortfolioPlanCapitalBasis = defineAsyncComponent(() => import('../components/portfolio/PortfolioPlanCapitalBasis.vue'))
const PlanOperationLogsPanel = defineAsyncComponent(() => import('../components/portfolio/PlanOperationLogsPanel.vue')); const PortfolioPlanItemsPanel = defineAsyncComponent(() => import('../components/portfolio/PortfolioPlanItemsPanel.vue'))
const PortfolioPlanEquityPanel = defineAsyncComponent(() => import('../components/portfolio/PortfolioPlanEquityPanel.vue')); const PortfolioPlanPaperFillsPanel = defineAsyncComponent(() => import('../components/portfolio/PortfolioPlanPaperFillsPanel.vue'))

const opsWorkbenchExpanded = ref(false)
const generateFormExpanded = ref(false)
const generationTasksExpanded = ref(false)
const liveOpsExpanded = ref(false)
let generationController

function normalizePlanParams(params) {
  return generationController?.normalizePlanParams(params) || params
}

function syncGenerateParamsFromStrategy() {
  generationController?.syncGenerateParamsFromStrategy()
}

function applyDefaultPreset() {
  generationController?.applyDefaultPreset()
}

const {
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
  loadParameterPresets,
  loadGenerationTasks,
  loadWorkerStatus,
  loadLiveOps,
  loadPlanGenerationWatermark,
  loadOperationLogs,
  refreshAll,
  generatePlan,
  reloadSelectedPlan,
  selectPlan,
  runAiRisk,
  runLlmRisk,
} = usePortfolioPlansWorkbench({
  normalizePlanParams,
  syncGenerateParamsFromStrategy,
  applyDefaultPreset,
  onBeforeSelect: () => {
    resetPlanOpsState()
    clearReselectUi()
  },
})

generationController = usePortfolioPlanGeneration({
  strategies,
  generateForm,
  parameterPresets,
  loadParameterPresets,
  loadPlanGenerationWatermark,
})
const {
  availableStrategies,
  selectedGenerateStrategy,
  selectedPreset,
  presetEvidenceRows,
  universeOptions,
  strategyOptionLabel,
  planDisplayTitle,
  setGenerateStrategy,
  setGenerateField,
  setGenerateParam,
  setGeneratePreset,
  setGrowthWeight,
  setCycleWeight,
} = generationController

const executionStatus = computed(() => selectedDetail.value?.execution_status || {})
const selectedPlanExecutionMode = computed(() => selectedDetail.value?.execution_mode || 'not_executed')
const selectedPlanStatus = computed(() => selectedDetail.value?.plan?.status || '')
const selectedPlanHasLiveSignals = computed(() => selectedPlanExecutionMode.value === 'live')
const selectedPlanHasPublishedLiveSignals = computed(() => (
  selectedPlanHasLiveSignals.value
  || Boolean(selectedDetail.value?.plan?.live_signals_published_at)
  || Number(selectedDetail.value?.plan?.live_signal_count || 0) > 0
))
const liveExecutionContext = computed(() => selectedDetail.value?.live_execution_context || {})
const selectedPlanLiveSignalCount = computed(() => Number(liveExecutionContext.value?.signal_count || 0))
const selectedPlanActiveLiveSignalCount = computed(() => Number(liveExecutionContext.value?.active_signal_count || 0))
const selectedPlanIsMonitorNoTrade = computed(() => selectedDetail.value?.plan?.executable === false)
const selectedPlanExcluded = computed(() => selectedDetail.value?.plan?.excluded_symbols || [])
// Only an unpublished, pre-approval plan can be reselected in place.
const canReselectItems = computed(() => ['needs_review', 'generated', 'draft'].includes(selectedDetail.value?.plan?.status))

const {
  actionLoading: reselectActionLoading,
  pendingReselect,
  lastReselectSummary,
  reselectStatus,
  reselectTaskMeta,
  selectedReselectSymbols,
  reselectBusy,
  selectedReselectCount,
  clearReselectUi,
  toggleReselectSelection,
  selectHighRiskReselectItems,
  reselectItem,
  bulkReselectItems,
} = useReselectPlanItems({
  getPlanId: () => selectedPlanId.value,
  getItems: () => selectedDetail.value?.items || [],
  getExcluded: () => selectedDetail.value?.plan?.excluded_symbols || [],
  setMessage: (text) => { message.value = text },
  onTaskEnqueued: async (task) => {
    currentGenerationTask.value = task
    await loadOperationLogs()
    await loadGenerationTasks()
  },
  runTask: async (taskId) => {
    for (let i = 0; i < 90; i += 1) {
      const res = await getPortfolioPlanGenerationTask(taskId)
      const task = res.data || {}
      currentGenerationTask.value = task
      if (task.status === 'completed') {
        await loadPlanGenerationWatermark()
        await loadWorkerStatus()
        await loadGenerationTasks()
        await loadPlans()
        if (task.plan_id) {
          await selectPlan(task.plan_id)
        }
        return task
      }
      if (task.status === 'failed') {
        throw new Error(task.error_message || '生成计划失败')
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    throw new Error('任务处理超时，请稍后刷新查看结果')
  },
})

const combinedActionLoading = computed(() => reselectActionLoading.value)
const paperExecutionCount = computed(() => Number(executionStatus.value?.execution_count || 0))
const hasPaperExecution = computed(() => Boolean(selectedDetail.value?.plan?.paper_executed_at) || paperExecutionCount.value > 0)
// Plan-detail page uses plan-level data only. Keep paper panels hidden while the
// plan is still reselectable to avoid showing stale history from prior plans.
const showPaperSections = computed(() => {
  if (!selectedDetail.value || selectedPlanHasLiveSignals.value || canReselectItems.value) return false
  return selectedPlanStatus.value === 'approved' || hasPaperExecution.value
})
const showPaperExecutionStatus = computed(() => showPaperSections.value && (
  selectedPlanStatus.value === 'approved' || paperExecutionCount.value > 0
))
const executionVenue = computed(() => {
  const plan = selectedDetail.value?.plan
  const capitalBasis = plan?.capital_basis || plan?.summary?.capital_basis
  return capitalBasis === 'rolling_paper' ? 'paper' : 'live'
})
const executionVenueLabel = computed(() => executionVenue.value === 'paper' ? '纸面' : '实盘')
const isPaperPortfolio = computed(() => executionVenue.value === 'paper')
const isLivePortfolio = computed(() => executionVenue.value === 'live')
const canExecutePaperNow = computed(() => canExecutePaperNowFromState({
  planStatus: selectedPlanStatus.value,
  hasLiveSignals: selectedPlanHasLiveSignals.value,
  hasPaperExecution: hasPaperExecution.value,
  missingExecuteDate: executionStatus.value?.missing_execute_date === true,
  isPaperPortfolio: isPaperPortfolio.value,
}))
const canPublishLiveSignals = computed(() => (
  isLivePortfolio.value
  && selectedPlanStatus.value === 'approved'
  && !selectedPlanHasPublishedLiveSignals.value
  && !hasPaperExecution.value
))
const canCancelCurrentPlan = computed(() => (
  selectedPlanStatus.value === 'approved'
  && !hasPaperExecution.value
))
const needsReviewPlan = computed(() => (
  ['needs_review', 'generated', 'draft'].includes(selectedPlanStatus.value)
))
const reviewPlanId = computed(() => needsReviewPlan.value ? selectedPlanId.value : '')
const selectedOperationPlanId = computed(() => (
  selectedPlanStatus.value === 'approved' ? selectedPlanId.value : ''
))
const showPlanOpsPanel = computed(() => (
  Boolean(selectedOperationPlanId.value)
  && selectedPlanStatus.value === 'approved'
))

const paperExecuteReadyText = computed(() => paperExecuteReadyTextFromState({
  hasPaperExecution: hasPaperExecution.value,
  hasLiveSignals: selectedPlanHasLiveSignals.value,
  planStatus: selectedPlanStatus.value,
  executionStatus: executionStatus.value,
  isPaperPortfolio: isPaperPortfolio.value,
}))
const cancelPlanReadyText = computed(() => {
  if (hasPaperExecution.value) return '该 plan 已执行 Paper，不能作废'
  if (selectedPlanStatus.value !== 'approved') return '只有 approved plan 可以作废'
  if (selectedPlanHasLiveSignals.value) return '该 plan 存在实盘信号历史；作废会取消未成交信号，若已有成交后端会拒绝'
  return '误点确认发布/审批后可作废；作废后状态变为 cancelled'
})
const selectedPlanExecutionModeLabel = computed(() => {
  if (selectedPlanExecutionMode.value === 'live') {
    if (selectedPlanActiveLiveSignalCount.value > 0) {
      return `实盘信号在途 ${selectedPlanActiveLiveSignalCount.value}/${selectedPlanLiveSignalCount.value}`
    }
    if (!selectedPlanHasPublishedLiveSignals.value) {
      return `有历史实盘信号（未标记发布，${selectedPlanLiveSignalCount.value} 条）`
    }
    return `有历史实盘信号（无在途，${selectedPlanLiveSignalCount.value} 条）`
  }
  if (selectedPlanExecutionMode.value === 'paper') return '已执行 Paper'
  return '未执行'
})

function normalizePlanItemRow(item) {
  const current = Number(item?.current_shares ?? 0)
  const target = Number(item?.target_shares ?? 0)
  const delta = Number((item?.delta_shares ?? (target - current)) || 0)
  let action = item?.action || ''
  if (!action) {
    if (delta > 0) action = 'buy'
    else if (delta < 0) action = 'sell'
    else if (target > 0) action = 'hold'
    else action = 'skip'
  }
  if (action === 'hold' && current > 0 && target > 0 && delta !== 0) {
    action = delta > 0 ? 'buy' : 'sell'
  }
  return {
    ...item,
    action,
    current_shares: current,
    target_shares: target,
    delta_shares: delta,
  }
}

const planTargetRows = computed(() => (
  (selectedDetail.value?.items || [])
    .map((item) => normalizePlanItemRow(item))
    .filter((item) => item.action !== 'skip')
    .sort((a, b) => {
      const order = { buy: 0, sell: 1, hold: 2, skip: 3 }
      const aScore = Number(a.score_value)
      const bScore = Number(b.score_value)
      const aHasScore = Number.isFinite(aScore)
      const bHasScore = Number.isFinite(bScore)
      if (aHasScore && bHasScore && bScore !== aScore) return bScore - aScore
      if (aHasScore !== bHasScore) return aHasScore ? -1 : 1
      return (order[a.action] ?? 9) - (order[b.action] ?? 9)
        || String(a.symbol).localeCompare(String(b.symbol))
    })
))

function summarizePlanRows(rows) {
  return rows.reduce(
    (summary, row) => {
      if (row.action === 'buy') summary.buy += 1
      else if (row.action === 'sell') summary.sell += 1
      else if (row.action === 'hold') summary.hold += 1
      return summary
    },
    { buy: 0, sell: 0, hold: 0 },
  )
}

const planReviewSummary = computed(() => summarizePlanRows(planTargetRows.value))
const planReviewRiskSummary = computed(() => (
  selectedDetail.value?.plan?.summary?.ai_risk_summary
  || { high: 0, medium: 0, low: 0 }
))

const {
  livePublishPreview,
  livePublishLoading,
  showPublishModal,
  allowPartialPublish,
  livePublishBlockers,
  canConfirmLivePublish,
  paperExecuteLoading,
  cancelPlanLoading,
  remainderPreview,
  remainderLoading,
  remainderReason,
  allowPartialRemainder,
  remainderRows,
  remainderActionableCount,
  remainderBlockers,
  remainderSkipped,
  remainderPublishableCount,
  canConfirmRemainder,
  approveSubmitting,
  rejectSubmitting,
  previewLivePublish,
  publishLiveSignals,
  setAllowPartialPublish,
  previewRemainder,
  confirmRemainder,
  setAllowPartialRemainder,
  executePaperNow,
  cancelCurrentPlan,
  approvePendingPlan,
  rejectPendingPlan,
  resetPlanOpsState,
} = usePlanOps({
  selectedOperationPlanId,
  selectedLiveAccountId: operationAccountId,
  canPublishLiveSignals,
  canExecutePaperNow,
  canCancelCurrentPlan,
  reviewPlanId,
  onRefresh: async () => {
    const planId = selectedPlanId.value
    if (planId) await selectPlan(planId)
    await Promise.all([
      loadPlans(),
      loadLiveOps(planId),
      loadOperationLogs(planId),
    ])
  },
  onMessage: (text) => {
    message.value = text
  },
})

const latestExecutionText = computed(() => {
  const latest = executionStatus.value.latest_execution_result
  if (!latest) return '暂无'
  const action = latest.action || 'unknown'
  const symbol = latest.symbol || '-'
  const quantity = latest.quantity ?? 0
  const blocker = latest.blocker ? ` / ${latest.blocker}` : ''
  return `${latest.execute_date || '-'} ${action} ${symbol} ${quantity}${blocker}`
})

const realtimePriceBySymbol = computed(() => {
  const rows = realtimeEquity.value?.positions || []
  return Object.fromEntries(rows.map((row) => [row.symbol, row.realtime_price]))
})

const latestGenerationTask = computed(() => generationTasks.value[0] || null)
const latestTraderHeartbeat = computed(() => traderHeartbeats.value[0] || null)
const liveSignalStatusSummary = computed(() => summarizeByStatus(liveSignals.value))
const liveExecutionStatusSummary = computed(() => summarizeByStatus(liveExecutions.value))
const liveAccountOptions = computed(() => securitiesAccounts.value.map((account) => ({
  id: account.id || account._id,
  label: `${account.broker || '-'} / ${account.account_id || '-'}${account.live_trading_enabled ? ' / live on' : ''}`,
})))
const liveOverlay = computed(() => selectedDetail.value?.live_overlay || null)
const scoreSnapshotStale = computed(() => Boolean(liveOverlay.value?.score_snapshot_stale))

const targetScoringRunText = computed(() => scoringRunText(planGenerationWatermark.value?.target_scoring_run))
const latestCompletedScoringText = computed(() => scoringRunText(planGenerationWatermark.value?.latest_completed_scoring_run))
const latestScoringRunText = computed(() => scoringRunText(planGenerationWatermark.value?.latest_scoring_run))
const latestAvailableScoreText = computed(() => {
  const watermark = planGenerationWatermark.value
  if (!watermark?.latest_available_score_date) return '暂无记录'
  return `${watermark.latest_available_score_date} / ${watermark.latest_available_score_count ?? 0} 条`
})
const latestAvailableScoreMeta = computed(() => {
  const scope = planGenerationWatermark.value?.latest_available_score_scope
  if (scope === 'index_codes') return '按当前 universe 匹配'
  if (scope === 'global') return '全局最新 fallback'
  return '-'
})

const equityRows = computed(() => buildEquityRows(equity.value))
const equityChart = computed(() => buildEquityChart(equityRows.value))

const aiRiskSummary = computed(() => selectedDetail.value?.plan?.summary?.ai_risk_summary || null)
const llmRiskSummary = computed(() => selectedDetail.value?.plan?.summary?.ai_risk_llm_summary || null)
const riskSnapshot = computed(() => selectedDetail.value?.risk_snapshot || null)
const signalReviewSummary = computed(() => {
  const reviews = (selectedDetail.value?.items || [])
    .map((item) => item.signal_review)
    .filter(Boolean)
  if (!reviews.length) return ''
  const analyzedTimes = reviews
    .map((review) => review.analyzed_at)
    .filter(Boolean)
    .sort()
  const latestAnalyzed = analyzedTimes[analyzedTimes.length - 1]
  const skipped = reviews.filter((review) => review.last_run_status === 'skipped_unchanged').length
  const parsed = reviews.filter((review) => review.last_run_status === 'parse_error').length
  const evidenceCount = reviews.reduce((sum, review) => sum + Number(review.evidence_count || 0), 0)
  const parts = []
  if (latestAnalyzed) parts.push(formatSignalReviewAt(latestAnalyzed))
  parts.push(`${reviews.length} 标的`)
  if (skipped) parts.push(`${skipped} 个无新证据跳过`)
  if (parsed) parts.push(`${parsed} 个上次解析失败`)
  if (evidenceCount) parts.push(`证据快照累计 ${evidenceCount} 项`)
  const latestStatus = reviews.find((review) => review.analyzed_at === latestAnalyzed)
  if (latestStatus?.last_run_status && !skipped && !parsed) {
    parts.push(signalReviewStatusText(latestStatus.last_run_status))
  }
  return parts.join(' · ')
})

</script>

<style src="../assets/styles/portfolio-plans.css"></style>
