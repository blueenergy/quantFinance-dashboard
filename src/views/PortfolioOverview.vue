<template>
  <div class="portfolio-overview">
    <header class="overview-header">
      <h2>组合总览（实盘 + 纸面）</h2>
      <p class="muted">
        按策略参数血缘（params_hash）合并多期 plan；实盘需有 live 成交回报才标为实盘，纸面展示 paper 净值与观察周期。
      </p>
    </header>

    <section class="toolbar">
      <label class="field">
        <span>选择组合</span>
        <select v-model="selectedPortfolioKey" :disabled="loadingList || !portfolios.length">
          <option value="">请选择</option>
          <option
            v-for="p in portfolios"
            :key="portfolioKey(p)"
            :value="portfolioKey(p)"
          >
            [{{ executionVenueLabel(p.execution_venue) }}] {{ portfolioOptionLabel(p) }}
          </option>
        </select>
      </label>
      <button type="button" :disabled="!selectedPortfolioKey || loadingDetail" @click="refreshDetail">
        <span v-if="loadingDetail" class="spinner" />
        {{ loadingDetail ? '加载中…' : '刷新' }}
      </button>
    </section>

    <p v-if="message" class="message" :class="{ error: messageIsError }">{{ message }}</p>

    <template v-if="selectedPortfolioKey && selectedPortfolioDisplay">
      <PortfolioIdentityCard
        :portfolio="selectedPortfolioDisplay"
        :resume-submitting="manualSubmitting"
        @resume-lineage="resumeLineageAction"
      />

      <section v-if="holdingsOutOfSync" class="reconcile-banner">
        <div class="reconcile-head">
          <strong>⚠ 系统账本与券商实时持仓不一致</strong>
          <button type="button" :disabled="!isLivePortfolio" @click="openExternalManualModal">补录 miniQMT 手工操作</button>
        </div>
        <p class="muted">
          可能是 miniQMT 端手工买卖后系统尚未记录。补录后账本即可与券商对齐。
          <span v-if="reconcileData?.account_synced_at"> · 券商同步于 {{ formatSyncedAt(reconcileData.account_synced_at) }}</span>
        </p>
        <div class="table-wrap">
          <table class="lineup-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>账本股数</th>
                <th>券商股数</th>
                <th>差异</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in reconcileData.diffs" :key="row.symbol">
                <td>{{ row.symbol }}</td>
                <td>{{ row.name || '-' }}</td>
                <td>{{ row.ledger_shares }}</td>
                <td>{{ row.account_shares }}</td>
                <td :class="row.diff > 0 ? 'pos' : 'neg'">{{ formatShareDelta(row.diff) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <CurrentPeriodStatus
        :timeline-data="timelineData"
        :execution-venue="selectedPortfolio.execution_venue"
        :execution-venue-label="executionVenueLabel(selectedPortfolio.execution_venue)"
        :cycle-progress-pct="cycleProgressPct"
        :pending-action-plan="pendingActionPlan"
        :latest-plan-id="selectedLatestPlanId"
        :operation-plan-id="selectedOperationPlanId"
        :force-rebalance-submitting="forceRebalanceSubmitting"
        :force-rebalance-block-reason="forceRebalanceBlockReason"
        @force-rebalance="submitForceRebalance"
      />

      <TrailingStopMonitorPanel
        v-if="!isLivePortfolio"
        :latest-run="timelineData?.latest_trailing_stop_run"
        :trailing-stop-setting="timelineData?.trailing_stop_setting"
        :plan-id="selectedLatestPlanId"
        :default-expanded="trailingStopDefaultExpanded"
        :triggers-only="trailingStopTriggersOnly"
        @setting-updated="refreshDetail"
      />

      <PlanReviewPanel
        :visible="needsReviewPlan && Boolean(reviewPlanId)"
        :plan-id="reviewPlanId"
        :items="planTargetRows"
        :overlay="liveOverlay"
        :score-snapshot-stale="scoreSnapshotStale"
        :summary="planReviewSummary"
        :risk-summary="planReviewRiskSummary"
        :llm-risk-summary="overviewLlmRiskSummary"
        :approve-submitting="approveSubmitting"
        :reject-submitting="rejectSubmitting"
        :review-ai-risk-loading="reviewAiRiskLoading"
        :review-llm-risk-loading="reviewLlmRiskLoading"
        :can-reselect-items="canReselectItems"
        :selected-reselect-symbols="selectedReselectSymbols"
        :selected-plan-excluded="reselectExcludedSymbols"
        :selected-reselect-count="selectedReselectCount"
        :action-loading="reselectActionLoading"
        :reselect-busy="reselectBusy"
        :pending-reselect-symbol="pendingReselectSymbol"
        :reselect-status="reselectStatus"
        :reselect-task-meta="reselectTaskMeta"
        :last-reselect-summary="lastReselectSummary"
        @approve="approvePendingPlan"
        @reject="rejectPendingPlan"
        @rerun-ai-risk="rerunReviewAiRisk"
        @rerun-llm-risk="() => rerunPlanLlmRisk(reviewPlanId, 'review')"
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
        :execution-venue="selectedPortfolio.execution_venue"
        :execution-venue-label="executionVenueLabel(selectedPortfolio.execution_venue)"
        :overlay="liveOverlay"
        :score-snapshot-stale="scoreSnapshotStale"
        :is-paper="isPaperPortfolio"
        :can-execute-paper-now="canExecutePaperNow"
        :paper-execute-ready-text="paperExecuteReadyText"
        :paper-execute-loading="paperExecuteLoading"
        v-model:selected-live-account-id="selectedLiveAccountId"
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
        :pending-items="pendingPlanRows"
        :pending-summary="pendingPlanSummary"
        :llm-risk-summary="overviewLlmRiskSummary"
        :llm-risk-loading="opsLlmRiskLoading"
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
        @rerun-llm-risk="() => rerunPlanLlmRisk(selectedOperationPlanId, 'ops')"
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

      <LineageTimeline
        :entries="foldedTimeline"
        :expanded-plan-id="expandedTimelinePlanId"
        @toggle-detail="toggleTimelineDetail"
      />

      <PortfolioEquityChart
        :equity-rows="equityRows"
        :book-equity="bookEquity"
        :equity-caveat="equityCaveat"
      />

      <section class="summary-cards" v-if="positionSummary">
        <div class="card">
          <div class="label">持仓市值</div>
          <div class="value">{{ money(positionSummary.total_market_value) }}</div>
        </div>
        <div class="card">
          <div class="label">已实现盈亏</div>
          <div class="value">{{ signedMoney(latestHoldingsPnlSummary.realized) }}</div>
        </div>
        <div class="card">
          <div class="label">总盈亏</div>
          <div class="value" :title="latestHoldingsPnlTitle">
            {{ signedMoney(latestHoldingsPnlSummary.total) }}
          </div>
        </div>
        <div class="card">
          <div class="label">持仓标的数</div>
          <div class="value">{{ positionSummary.holding_count }}</div>
        </div>
      </section>

      <HoldingsPanel
        :selected-latest-plan-id="selectedLatestPlanId"
        :risk-loading="riskLoading"
        :manual-change-rows="manualChangeRows"
        :latest-holding-rows="latestHoldingRows"
        :trades-by-symbol="tradesBySymbol"
        :liquidate-submitting="liquidateSubmitting"
        :is-live-portfolio="isLivePortfolio"
        :external-manual-submitting="externalManualSubmitting"
        :holdings-risk="holdingsRisk"
        :holdings-risk-by-symbol="holdingsRiskBySymbol"
        :holding-plan-risk-by-symbol="holdingPlanRiskBySymbol"
        :holding-plan-opportunity-by-symbol="holdingPlanOpportunityBySymbol"
        :holding-plan-internal-swot-by-symbol="holdingPlanInternalSwotBySymbol"
        :holdings-risk-by-symbol-high="holdingsRiskBySymbolHigh"
        :bench-data="benchData"
        :bench-expanded="benchExpanded"
        :bench-loading="benchLoading"
        :bench-risk="benchRisk"
        :bench-risk-by-symbol="benchRiskBySymbol"
        :bench-risk-loading="benchRiskLoading"
        :bench-llm-risk-loading="benchLlmRiskLoading"
        :effective-target="effectiveTarget"
        :manual-delta="manualDelta"
        :risk-row-class="riskRowClass"
        :format-risk-time="formatRiskTime"
        :half-target-shares="halfTargetShares"
        :signed-money="signedMoney"
        @load-risk="loadHoldingsRisk(true)"
        @open-manual="openManualModal"
        @open-liquidate="openLiquidateModal"
        @open-external-manual="openExternalManualModal"
        @update-target="setManualTarget"
        @open-swap="openSwapModal"
        @quick-reduce="openQuickReduceModal"
        @toggle-bench="benchExpanded = !benchExpanded"
        @load-bench-risk="loadBenchRisk"
        @load-bench-llm-risk="loadBenchLlmRisk"
      />

      <SwapModal
        :visible="showSwapModal"
        :starter="swapStarter"
        :bench-data="benchData"
        :bench-risk="benchRisk"
        :bench-risk-by-symbol="benchRiskBySymbol"
        :bench-risk-loading="benchRiskLoading"
        :bench-llm-risk-loading="benchLlmRiskLoading"
        :submitting="fastActionSubmitting"
        :error="swapError"
        @close="showSwapModal = false"
        @load-bench-risk="loadBenchRisk"
        @load-bench-llm-risk="loadBenchLlmRisk"
        @preview-swap="previewSwap"
      />

      <FastActionModal
        :visible="showFastActionModal"
        :preview="fastActionPreview"
        :submitting="fastActionSubmitting"
        :is-live-portfolio="isLivePortfolio"
        @close="showFastActionModal = false"
        @confirm="confirmFastAction"
      />

      <ManualRebalanceModal
        v-model:exclude-after="excludeAfter"
        :visible="showManualModal"
        :is-live-portfolio="isLivePortfolio"
        :high-risk-rows="holdingsRiskBySymbolHigh"
        :rows="manualChangeRows"
        :will-pause-after-manual="willPauseAfterManual"
        :submitting="manualSubmitting"
        @close="showManualModal = false"
        @confirm="submitManualRebalance"
      />

      <LiquidateModal
        v-model:exclude-after="liquidateExcludeAfter"
        :visible="showLiquidateModal"
        :is-live-portfolio="isLivePortfolio"
        :targets="liquidateTargets"
        :holding-name-by-symbol="holdingNameBySymbol"
        :holding-shares-by-symbol="holdingSharesBySymbol"
        :submitting="liquidateSubmitting"
        @close="showLiquidateModal = false"
        @confirm="submitLiveLiquidate"
      />

      <ExternalManualModal
        v-model:exclude-after="externalManualExcludeAfter"
        v-model:pause-lineage="externalManualPauseLineage"
        :visible="showExternalManualModal"
        :rows="externalManualRows"
        :submitting="externalManualSubmitting"
        :ready="externalManualReady"
        @close="showExternalManualModal = false"
        @confirm="submitExternalManual"
        @add-row="addExternalManualRow"
        @remove-row="removeExternalManualRow"
        @update-row="updateExternalManualRow"
      />

      <ExecutionsPanel
        :rows="tradeDetailRows"
        :totals="tradeTotals"
        :is-live="isLivePortfolio"
      />
    </template>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import PortfolioIdentityCard from '../components/portfolio/PortfolioIdentityCard.vue'
import CurrentPeriodStatus from '../components/portfolio/CurrentPeriodStatus.vue'
import TrailingStopMonitorPanel from '../components/portfolio/TrailingStopMonitorPanel.vue'
import PlanReviewPanel from '../components/portfolio/PlanReviewPanel.vue'
import PlanOpsPanel from '../components/portfolio/PlanOpsPanel.vue'
import PlanPublishPreviewModal from '../components/portfolio/PlanPublishPreviewModal.vue'
import LineageTimeline from '../components/portfolio/LineageTimeline.vue'
import ExecutionsPanel from '../components/portfolio/ExecutionsPanel.vue'
import HoldingsPanel from '../components/portfolio/HoldingsPanel.vue'
import PortfolioEquityChart from '../components/portfolio/PortfolioEquityChart.vue'
import SwapModal from '../components/portfolio/SwapModal.vue'
import FastActionModal from '../components/portfolio/FastActionModal.vue'
import ManualRebalanceModal from '../components/portfolio/ManualRebalanceModal.vue'
import LiquidateModal from '../components/portfolio/LiquidateModal.vue'
import ExternalManualModal from '../components/portfolio/ExternalManualModal.vue'
import { useHoldingsOps } from '../composables/useHoldingsOps'
import { usePlanOps } from '../composables/usePlanOps'
import { useReselectPlanItems } from '../composables/useReselectPlanItems'
import {
  buildPlanReviewRiskSummary,
  buildPlanSignalMaps,
  buildPlanTargetRows,
  summarizePlanRows,
  usePlanExecutionState,
} from '../composables/usePortfolioPlanViewModel'
import { usePortfolioOverviewWorkbench } from '../composables/usePortfolioOverviewWorkbench'
import {
  formatShareDelta,
} from '../composables/usePortfolioPlanFormat'
import {
  cycleProgressPct as calculateCycleProgressPct,
  executionVenueLabel,
  foldedTimeline as foldTimeline,
  formatSyncedAt,
  portfolioKey,
  portfolioOptionLabel,
  trailingStopDefaultExpanded as shouldExpandTrailingStop,
  trailingStopTriggersOnly as showTrailingStopTriggersOnly,
} from '../utils/portfolioOverviewFormat'

const {
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
  refreshDetail,
  rerunReviewAiRisk,
  rerunPlanLlmRisk,
  submitForceRebalance,
  resumeLineageAction,
  pollGenerationTask,
  toggleTimelineDetail,
} = usePortfolioOverviewWorkbench({
  onBeforeSelect: () => {
    resetHoldingsOpsState()
    resetPlanOpsState()
    clearReselectUi()
  },
  onPlanDetailLoaded: () => resetPlanOpsState(),
  onDetailLoaded: () => syncManualTargets(),
  onLoadBench: (options) => loadBench(options),
  onLoadReconcile: () => loadReconcile(),
  onReconcileData: (data) => {
    reconcileData.value = data
  },
  onResumeSubmitting: (value) => {
    manualSubmitting.value = value
  },
  getForceRebalanceBlockReason: () => forceRebalanceBlockReason.value,
})

const {
  holdingsRisk,
  excludeAfter,
  showManualModal,
  manualSubmitting,
  riskLoading,
  showLiquidateModal,
  liquidateSubmitting,
  liquidateExcludeAfter,
  liquidateTargets,
  showExternalManualModal,
  externalManualSubmitting,
  externalManualRows,
  externalManualExcludeAfter,
  externalManualPauseLineage,
  benchData,
  benchLoading,
  benchRisk,
  benchRiskLoading,
  benchLlmRiskLoading,
  benchExpanded,
  reconcileData,
  showSwapModal,
  swapStarter,
  swapError,
  showFastActionModal,
  fastActionSubmitting,
  fastActionPreview,
  latestHoldingRows,
  holdingsRiskBySymbol,
  holdingsRiskBySymbolHigh,
  benchRiskBySymbol,
  holdingNameBySymbol,
  holdingSharesBySymbol,
  manualChangeRows,
  willPauseAfterManual,
  externalManualReady,
  holdingsOutOfSync,
  syncManualTargets,
  manualDelta,
  riskRowClass,
  formatRiskTime,
  openManualModal,
  loadHoldingsRisk,
  submitManualRebalance,
  halfTargetShares,
  openSwapModal,
  openQuickReduceModal,
  previewSwap,
  confirmFastAction,
  loadBench,
  loadBenchRisk,
  loadBenchLlmRisk,
  loadReconcile,
  openLiquidateModal,
  submitLiveLiquidate,
  openExternalManualModal,
  addExternalManualRow,
  removeExternalManualRow,
  updateExternalManualRow,
  submitExternalManual,
  effectiveTarget,
  setManualTarget,
  resetHoldingsOpsState,
} = useHoldingsOps({
  selectedPortfolio,
  selectedLatestPlanId,
  benchPlanId,
  isLivePortfolio,
  positionRows,
  tradeRows,
  pollGenerationTask,
  onRefresh: async () => {
    await loadPortfolios()
    await refreshDetail()
  },
  onMessage: (msg, isError) => {
    message.value = msg
    messageIsError.value = isError
  },
  getMessage: () => message.value,
})

const latestPlan = computed(() => latestPlanDetail.value?.plan || null)
const executionStatus = computed(() => latestPlanDetail.value?.execution_status || {})
const operationPlanStatus = computed(() => timelineData.value?.operation_plan?.status || '')
const selectedPlanStatus = computed(() => latestPlan.value?.status || operationPlanStatus.value || '')
const selectedPlanExecutionMode = computed(() => latestPlanDetail.value?.execution_mode || 'not_executed')
const liveExecutionContext = computed(() => latestPlanDetail.value?.live_execution_context || {})
const {
  hasPaperExecution,
  selectedPlanHasLiveSignals,
  selectedPlanHasPublishedLiveSignals,
  selectedPlanLiveSignalCount,
  canExecutePaperNow,
  canPublishLiveSignals,
  canCancelCurrentPlan,
  paperExecuteReadyText,
  cancelPlanReadyText,
  selectedPlanExecutionModeLabel,
} = usePlanExecutionState({
  plan: latestPlan,
  planStatus: selectedPlanStatus,
  executionStatus,
  executionMode: selectedPlanExecutionMode,
  liveExecutionContext,
  venue: executionVenue,
})
const latestPlanItems = computed(() => latestPlanDetail.value?.items || [])
const liveOverlay = computed(() => latestPlanDetail.value?.live_overlay || null)
const scoreSnapshotStale = computed(() => Boolean(liveOverlay.value?.score_snapshot_stale))
const hasApprovedPlanAwaitingAction = computed(() => (
  selectedPlanStatus.value === 'approved'
  && !selectedPlanHasLiveSignals.value
  && !hasPaperExecution.value
))
const forceRebalanceBlockReason = computed(() => {
  const openPlan = openLineageTradePlan.value
  if (openPlan?.status === 'needs_review') {
    return '当前已有待审批交易计划，请先批准或拒绝后再重新生成'
  }
  if (openPlan?.status === 'approved' || hasApprovedPlanAwaitingAction.value) {
    return '当前已有已批准交易计划，请先发布/执行或拒绝后再重新生成'
  }
  return ''
})
const showPlanOpsPanel = computed(() => (
  Boolean(selectedOperationPlanId.value)
  && selectedPlanStatus.value === 'approved'
  && (isPaperPortfolio.value || isLivePortfolio.value)
))
const liveAccountOptions = computed(() => securitiesAccounts.value.map((account) => ({
  id: account.id || account._id,
  label: `${account.broker || '-'} / ${account.account_id || '-'}${account.live_trading_enabled ? ' / live on' : ''}`,
})))
// Normalized plan target list (buy/sell/hold, skip filtered, score-sorted).
// AI risk (ai_risk) is written onto each item by the plan-generation worker, so
// it is available as soon as the plan exists — including while it is still
// needs_review. The display gating below is purely about *which lifecycle
// states* should surface this table, not about data availability.
const planTargetRows = computed(() => (
  buildPlanTargetRows(latestPlanItems.value)
))
const planSignalMaps = computed(() => buildPlanSignalMaps(planTargetRows.value))
const holdingPlanRiskBySymbol = computed(() => planSignalMaps.value.holdingPlanRiskBySymbol)
const holdingPlanOpportunityBySymbol = computed(() => planSignalMaps.value.holdingPlanOpportunityBySymbol)
const holdingPlanInternalSwotBySymbol = computed(() => planSignalMaps.value.holdingPlanInternalSwotBySymbol)
const needsReviewPlan = computed(() => selectedPlanStatus.value === 'needs_review')
// Single source of truth for which plan the review card acts on. Prefer the
// timeline's action-required node, but fall back to the currently selected
// latest plan so approve/reject always target the plan the user is looking at.
const reviewPlanId = computed(() => pendingActionPlan.value?.plan_id || selectedOperationPlanId.value || '')
const planReviewRiskSummary = computed(() => buildPlanReviewRiskSummary(planTargetRows.value))
const pendingPlanRows = computed(() => (
  hasApprovedPlanAwaitingAction.value ? planTargetRows.value : []
))
const pendingPlanSummary = computed(() => summarizePlanRows(pendingPlanRows.value))
const planReviewSummary = computed(() => summarizePlanRows(planTargetRows.value))
const overviewLlmRiskSummary = computed(() => latestPlan.value?.summary?.ai_risk_llm_summary || null)

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
  selectedLiveAccountId,
  canPublishLiveSignals,
  canExecutePaperNow,
  canCancelCurrentPlan,
  reviewPlanId,
  onRefresh: async () => {
    await loadPortfolios()
    await refreshDetail()
  },
  onMessage: (msg, isError) => {
    message.value = msg
    messageIsError.value = isError
  },
})

const cycleProgressPct = computed(() => calculateCycleProgressPct(timelineData.value))

const trailingStopTriggersOnly = computed(() => (
  showTrailingStopTriggersOnly(timelineData.value?.latest_trailing_stop_run)
))

const trailingStopDefaultExpanded = computed(() => (
  shouldExpandTrailingStop(timelineData.value?.latest_trailing_stop_run)
))

const foldedTimeline = computed(() => foldTimeline(timelineData.value?.timeline))

const {
  actionLoading: reselectActionLoading,
  pendingReselect,
  lastReselectSummary,
  reselectStatus,
  reselectTaskMeta,
  selectedReselectSymbols,
  reselectBusy,
  selectedReselectCount,
  selectedPlanExcluded: reselectExcludedSymbols,
  clearReselectUi,
  toggleReselectSelection,
  selectHighRiskReselectItems,
  reselectItem,
  bulkReselectItems,
} = useReselectPlanItems({
  getPlanId: () => reviewPlanId.value,
  getContextKey: () => selectedPortfolioKey.value,
  getItems: () => latestPlanItems.value,
  getExcluded: () => latestPlan.value?.excluded_symbols || [],
  setMessage: (text, isError = false) => {
    message.value = text
    messageIsError.value = isError
  },
  runTask: async (taskId) => {
    const capturedKey = selectedPortfolioKey.value
    const task = await pollGenerationTask(taskId, { portfolioKey: capturedKey })
    if (!task || task.cancelled || selectedPortfolioKey.value !== capturedKey) {
      return { cancelled: true }
    }
    if (task.status === 'failed') {
      throw new Error(task.error_message || '生成计划失败')
    }
    await loadPortfolios()
    if (selectedPortfolioKey.value !== capturedKey) return { cancelled: true }
    await refreshDetail()
    if (selectedPortfolioKey.value !== capturedKey) return { cancelled: true }
    return task
  },
})

const canReselectItems = computed(() => (
  Boolean(reviewPlanId.value)
  && selectedPlanStatus.value === 'needs_review'
  && !selectedPlanHasLiveSignals.value
  && !selectedPlanHasPublishedLiveSignals.value
  && selectedPlanLiveSignalCount.value === 0
  && !reviewAiRiskLoading.value
  && !reviewLlmRiskLoading.value
  && !approveSubmitting.value
  && !rejectSubmitting.value
))

const pendingReselectSymbol = computed(() => pendingReselect.value?.symbol || '')

const tradeDetailRows = computed(() => tradeRows.value)

const tradeTotals = computed(() => {
  const rows = tradeDetailRows.value
  let netPnl = 0
  let fee = 0
  let buyAmount = 0
  let closedCount = 0
  let openCount = 0
  for (const row of rows) {
    const pnl = Number(row.net_pnl)
    if (Number.isFinite(pnl)) netPnl += pnl
    const f = Number(row.fee)
    if (Number.isFinite(f)) fee += f
    const amt = Number(row.buy_amount)
    if (Number.isFinite(amt)) buyAmount += amt
    if (row.status === 'open') openCount += 1
    else closedCount += 1
  }
  return { count: rows.length, closedCount, openCount, netPnl, fee, buyAmount }
})

const tradesBySymbol = computed(() => {
  /** @type {Record<string, any[]>} */
  const map = {}
  for (const row of tradeDetailRows.value) {
    const symbol = row.symbol
    if (!symbol) continue
    if (!map[symbol]) map[symbol] = []
    map[symbol].push(row)
  }
  return map
})

function money(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function num(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toFixed(2) : '-'
}

function signedMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function numericOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const latestHoldingsPnlSummary = computed(() => {
  let realized = 0
  let unrealized = 0
  for (const row of latestHoldingRows.value || []) {
    realized += numericOrZero(row?.realized_pnl)
    unrealized += numericOrZero(row?.unrealized_pnl)
  }
  return {
    realized,
    unrealized,
    total: realized + unrealized,
  }
})

const latestHoldingsPnlTitle = computed(() => {
  const summary = latestHoldingsPnlSummary.value
  return [
    `当前持仓已实现：${signedMoney(summary.realized)}`,
    `当前持仓浮动：${signedMoney(summary.unrealized)}`,
    `当前持仓合计：${signedMoney(summary.total)}`,
  ].join('\n')
})

watch(latestHoldingRows, () => {
  syncManualTargets()
}, { immediate: true })

watch(selectedLatestPlanId, (planId, previousPlanId) => {
  if (previousPlanId && planId !== previousPlanId) resetHoldingsOpsState()
})
</script>

<style scoped>
/* Align contrast with PortfolioPlans.vue: #111827 body, #374151 secondary */
.portfolio-overview {
  background: #fff;
  box-sizing: border-box;
  color: #111827;
  line-height: 1.5;
  margin: 0 auto;
  max-width: 1200px;
  padding: 24px;
  width: 100%;
}

.overview-header h2 {
  color: #111827;
  font-size: 20px;
  margin: 0 0 8px;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.toolbar {
  align-items: flex-end;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.field span {
  color: #111827;
  font-weight: 600;
}

.field select,
button {
  background: #fff;
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  padding: 8px 10px;
}

.field select {
  min-width: 420px;
}

.field select:disabled,
button:disabled {
  border-color: #9ca3af;
  color: #6b7280;
  cursor: not-allowed;
  opacity: 1;
}

.message {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #111827;
  font-size: 14px;
  padding: 10px 12px;
}

.message.error {
  background: #fef2f2;
  border-color: #b91c1c;
  color: #7f1d1d;
}

.summary-cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  margin: 16px 0;
}

.summary-cards .card {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px 14px;
}

.summary-cards .label {
  color: #374151;
  font-size: 12px;
  font-weight: 500;
}

.summary-cards .value {
  color: #111827;
  font-size: 18px;
  font-weight: 700;
  margin-top: 6px;
}

.table-wrap {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow-x: auto;
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid #e5e7eb;
  color: #111827;
  padding: 10px 12px;
  text-align: left;
}

th {
  background: #f3f4f6;
  color: #111827;
  font-size: 13px;
  font-weight: 600;
}

tbody tr:hover td {
  background: #f9fafb;
}

.spinner {
  animation: spin 0.8s linear infinite;
  border: 2px solid #d1d5db;
  border-radius: 50%;
  border-top-color: #111827;
  display: inline-block;
  height: 12px;
  margin-right: 6px;
  vertical-align: middle;
  width: 12px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

button {
  cursor: pointer;
  font-weight: 500;
}

.reconcile-banner {
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #fca5a5;
  border-radius: 10px;
  background: #fef2f2;
}

.reconcile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.reconcile-head strong {
  color: #b91c1c;
}

.reconcile-banner .pos {
  color: #047857;
  font-weight: 600;
}

.reconcile-banner .neg {
  color: #b91c1c;
  font-weight: 600;
}
</style>
