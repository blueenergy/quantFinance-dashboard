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
import { computed, onMounted, ref, watch } from 'vue'
import {
  enqueuePortfolioLlmRisk,
  forceRebalanceLineage,
  getPortfolioLlmRiskRun,
  getPortfolioPlanLiveSummary,
  getLineagePaperExecutions,
  getLineagePaperPositions,
  getPortfolioPlan,
  getPortfolioPlanGenerationTask,
  getPortfolioPlanLineageEquity,
  getPortfolioPlanLineageTimeline,
  getPortfolioPlanSummary,
  listPortfolios,
  rerunPortfolioPlanAiRisk,
  resumePortfolioLineage,
} from '../api/portfolioPlans'
import { getSecuritiesAccounts } from '../api/trader'
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
  formatShareDelta,
} from '../composables/usePortfolioPlanFormat'
import {
  canExecutePaperNowFromState,
  paperExecuteReadyTextFromState,
} from '../utils/paperExecutionEligibility'
import { isSubmittingForKey } from '../utils/scopedSubmitting'

const portfolios = ref([])
const portfolioSummary = ref(null)
const selectedPortfolioKey = ref('')
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

const forceRebalanceSubmitting = computed(() => (
  isSubmittingForKey(forceRebalanceSubmittingKey.value, selectedPortfolioKey.value)
))
const securitiesAccounts = ref([])
const selectedLiveAccountId = ref('')

const selectedPortfolio = computed(() => (
  portfolios.value.find((row) => portfolioKey(row) === selectedPortfolioKey.value) || null
))

const selectedPortfolioDisplay = computed(() => {
  if (!selectedPortfolio.value) return null
  return { ...selectedPortfolio.value, ...(portfolioSummary.value || {}) }
})

const selectedLatestPlanId = computed(() => selectedPortfolio.value?.latest_plan_id || '')
const selectedOperationPlanId = computed(() => timelineData.value?.operation_plan?.plan_id || selectedLatestPlanId.value)

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

const isLivePortfolio = computed(() => selectedPortfolio.value?.execution_venue === 'live')
const isPaperPortfolio = computed(() => selectedPortfolio.value?.execution_venue === 'paper')

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
const selectedPlanHasLiveSignals = computed(() => selectedPlanExecutionMode.value === 'live')
const selectedPlanHasPublishedLiveSignals = computed(() => (
  Boolean(latestPlan.value?.live_signals_published_at)
  || Number(latestPlan.value?.live_signal_count || 0) > 0
))
const selectedPlanLiveSignalCount = computed(() => Number(liveExecutionContext.value?.signal_count || 0))
const selectedPlanActiveLiveSignalCount = computed(() => Number(liveExecutionContext.value?.active_signal_count || 0))
const latestPlanItems = computed(() => latestPlanDetail.value?.items || [])
const liveOverlay = computed(() => latestPlanDetail.value?.live_overlay || null)
const scoreSnapshotStale = computed(() => Boolean(liveOverlay.value?.score_snapshot_stale))
const paperExecutionCount = computed(() => Number(executionStatus.value?.execution_count || 0))
const hasPaperExecution = computed(() => Boolean(latestPlan.value?.paper_executed_at) || paperExecutionCount.value > 0)
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
const showPlanOpsPanel = computed(() => (
  Boolean(selectedOperationPlanId.value)
  && selectedPlanStatus.value === 'approved'
  && (isPaperPortfolio.value || isLivePortfolio.value)
))
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
  latestPlanItems.value
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
      return (order[a.action] ?? 9) - (order[b.action] ?? 9) || String(a.symbol).localeCompare(String(b.symbol))
    })
))
const holdingPlanRiskBySymbol = computed(() => {
  const map = {}
  for (const row of planTargetRows.value) {
    if (!row?.symbol || !row.ai_risk) continue
    map[row.symbol] = row.ai_risk
    const bareSymbol = String(row.symbol).split('.')[0]
    if (bareSymbol) map[bareSymbol] = row.ai_risk
  }
  return map
})
const holdingPlanOpportunityBySymbol = computed(() => {
  const map = {}
  for (const row of planTargetRows.value) {
    if (!row?.symbol || !row.ai_opportunity) continue
    map[row.symbol] = row.ai_opportunity
    const bareSymbol = String(row.symbol).split('.')[0]
    if (bareSymbol) map[bareSymbol] = row.ai_opportunity
  }
  return map
})
const holdingPlanInternalSwotBySymbol = computed(() => {
  const map = {}
  for (const row of planTargetRows.value) {
    if (!row?.symbol || !row.internal_swot) continue
    map[row.symbol] = row.internal_swot
    const bareSymbol = String(row.symbol).split('.')[0]
    if (bareSymbol) map[bareSymbol] = row.internal_swot
  }
  return map
})
function summarizePlanRows(rows) {
  return rows.reduce(
    (acc, row) => {
      if (row.action === 'buy') acc.buy += 1
      else if (row.action === 'sell') acc.sell += 1
      else if (row.action === 'hold') acc.hold += 1
      return acc
    },
    { buy: 0, sell: 0, hold: 0 },
  )
}
const needsReviewPlan = computed(() => selectedPlanStatus.value === 'needs_review')
// Single source of truth for which plan the review card acts on. Prefer the
// timeline's action-required node, but fall back to the currently selected
// latest plan so approve/reject always target the plan the user is looking at.
const reviewPlanId = computed(() => pendingActionPlan.value?.plan_id || selectedOperationPlanId.value || '')
const planReviewRiskSummary = computed(() => planTargetRows.value.reduce(
  (acc, row) => {
    const severity = row.ai_risk?.severity
    if (severity === 'high') acc.high += 1
    else if (severity === 'medium') acc.medium += 1
    else if (severity === 'low') acc.low += 1
    return acc
  },
  { high: 0, medium: 0, low: 0 },
))
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

const cycleProgressPct = computed(() => {
  const cycle = timelineData.value?.current_cycle
  if (!cycle?.rebalance_days) return 0
  const elapsed = Number(cycle.elapsed_trading_days || 0)
  return Math.min(100, Math.round((elapsed / cycle.rebalance_days) * 100))
})

const trailingStopTriggersOnly = computed(() => {
  const verbosity = timelineData.value?.latest_trailing_stop_run?.verbosity
  return verbosity === 'triggers_only'
})

const trailingStopDefaultExpanded = computed(() => {
  const run = timelineData.value?.latest_trailing_stop_run
  if (!run) return false
  const triggered = Number(run.triggered_count ?? run.summary?.triggered_count ?? 0)
  return triggered > 0
})

const foldedTimeline = computed(() => {
  const nodes = timelineData.value?.timeline || []
  const folded = []
  let monitorRun = null
  for (const node of nodes) {
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
})

function portfolioKey(portfolio) {
  return `${portfolio.strategy_template_id}:${portfolio.params_hash}`
}

function portfolioOptionLabel(portfolio) {
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

function executionVenueLabel(venue) {
  if (venue === 'live') return '实盘'
  if (venue === 'paper') return '纸面'
  return venue || '-'
}

function shortPlanId(planId) {
  const text = String(planId || '')
  if (!text) return '-'
  if (text.length <= 28) return text
  return `${text.slice(0, 18)}…${text.slice(-8)}`
}

function paperExecutionModeLabel(mode) {
  if (mode === 'auto_shadow') return '自动跟跑'
  if (mode === 'manual_review') return '人工审核'
  return mode || '-'
}

function toggleTimelineDetail(planId) {
  expandedTimelinePlanId.value = expandedTimelinePlanId.value === planId ? null : planId
}

function normalizePlanItemRow(item) {
  const current = Number(item?.current_shares ?? 0)
  const target = Number(item?.target_shares ?? 0)
  const rawDelta = item?.delta_shares ?? (target - current)
  const delta = Number(rawDelta || 0)
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

function formatSyncedAt(value) {
  const seconds = Number(value)
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  return new Date(seconds * 1000).toLocaleString()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// The heavy work (manual plan generation, holdings risk review) runs in the
// plan-generation worker. The API returns a task_id; poll it until terminal.
async function pollGenerationTask(taskId, { attempts = 90, intervalMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await getPortfolioPlanGenerationTask(taskId)
    const task = res.data || {}
    if (task.status === 'completed') return task
    if (task.status === 'failed') {
      throw new Error(task.error_message || '任务执行失败')
    }
    await sleep(intervalMs)
  }
  throw new Error('任务处理超时，请稍后到「组合交易计划」查看结果')
}

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
  getItems: () => latestPlanItems.value,
  getExcluded: () => latestPlan.value?.excluded_symbols || [],
  setMessage: (text, isError = false) => {
    message.value = text
    messageIsError.value = isError
  },
  runTask: async (taskId) => {
    const task = await pollGenerationTask(taskId)
    if (task.status === 'failed') {
      throw new Error(task.error_message || '生成计划失败')
    }
    await Promise.all([loadPortfolios(), refreshDetail()])
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

async function rerunReviewAiRisk() {
  const planId = selectedOperationPlanId.value
  if (!planId) return
  reviewAiRiskLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await rerunPortfolioPlanAiRisk(planId)
    const taskId = res.data?.task_id
    if (taskId) await pollGenerationTask(taskId)
    await refreshDetail()
    message.value = '规则风控已复检，标的风险等级已刷新。'
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '规则风控复检失败'
    messageIsError.value = true
  } finally {
    reviewAiRiskLoading.value = false
  }
}

async function pollLlmRiskRun(planId, runId, { attempts = 90, intervalMs = 2000 } = {}) {
  for (let i = 0; i < attempts; i += 1) {
    const res = await getPortfolioLlmRiskRun(planId, runId)
    const run = res.data || {}
    if (['completed', 'completed_with_failures', 'failed'].includes(run.status)) return run
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error('AI 风险/机会分析任务处理超时，请稍后刷新查看结果')
}

async function rerunPlanLlmRisk(planIdRef, source = 'ops') {
  const planId = typeof planIdRef === 'object' ? planIdRef.value : planIdRef
  if (!planId) return
  const isReviewPlan = source === 'review'
  if (isReviewPlan) reviewLlmRiskLoading.value = true
  else opsLlmRiskLoading.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const res = await enqueuePortfolioLlmRisk(planId)
    const runId = res.data?.run_id
    if (runId) {
      const run = await pollLlmRiskRun(planId, runId)
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
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || 'AI 风险/机会分析失败'
    messageIsError.value = true
  } finally {
    reviewLlmRiskLoading.value = false
    opsLlmRiskLoading.value = false
  }
}

async function submitForceRebalance() {
  const planId = selectedOperationPlanId.value
  if (!planId) {
    message.value = '当前组合没有可操作的计划，无法发起立即调仓。'
    messageIsError.value = true
    return
  }
  if (forceRebalanceBlockReason.value) {
    message.value = forceRebalanceBlockReason.value
    messageIsError.value = true
    return
  }
  const submitKey = selectedPortfolioKey.value
  forceRebalanceSubmittingKey.value = submitKey
  message.value = ''
  messageIsError.value = false
  let taskId = ''
  try {
    const res = await forceRebalanceLineage(planId, {})
    taskId = res.data?.task_id || ''
    message.value = '已提交立即调仓任务，正在等待 worker 生成计划…'
    const task = await pollGenerationTask(taskId)
    const newPlanId = task.plan_id || task.result?.plan_id
    message.value = newPlanId
      ? `已提交立即调仓，新计划 ${newPlanId} 待审批。`
      : '已提交立即调仓任务，请稍后刷新查看新计划。'
    await Promise.all([loadPortfolios(), refreshDetail()])
  } catch (error) {
    const detail = formatApiDetail(error.response?.data?.detail) || error.message || '立即调仓提交失败'
    if (detail.includes('任务处理超时')) {
      message.value = taskId
        ? `任务 ${taskId} 已提交，但 3 分钟内未生成计划。请到「组合交易计划」查看任务状态；若长时间停留在 pending，请确认计划生成服务(quant-portfolio worker)是否在运行。`
        : '立即调仓任务已提交，但 3 分钟内未生成计划。请稍后刷新查看，若无结果请确认计划生成服务是否在运行。'
      messageIsError.value = false
      await Promise.all([loadPortfolios(), refreshDetail()])
    } else {
      message.value = detail
      messageIsError.value = true
    }
  } finally {
    if (forceRebalanceSubmittingKey.value === submitKey) {
      forceRebalanceSubmittingKey.value = ''
    }
  }
}

async function resumeLineageAction() {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  manualSubmitting.value = true
  try {
    await resumePortfolioLineage(planId)
    message.value = '已恢复该组合的自动调仓。'
    messageIsError.value = false
    await loadPortfolios()
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '恢复失败'
    messageIsError.value = true
  } finally {
    manualSubmitting.value = false
  }
}

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

function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

async function loadPortfolios() {
  loadingList.value = true
  message.value = ''
  messageIsError.value = false
  const previousKey = selectedPortfolioKey.value
  try {
    const res = await listPortfolios()
    portfolios.value = res.data?.portfolios || []
    if (!portfolios.value.length) {
      selectedPortfolioKey.value = ''
      message.value = '当前没有已执行的实盘或纸面组合血缘。'
      return
    }
    if (previousKey && portfolios.value.some((row) => portfolioKey(row) === previousKey)) {
      selectedPortfolioKey.value = previousKey
    }
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载组合列表失败'
    messageIsError.value = true
  } finally {
    loadingList.value = false
  }
}

async function loadSecuritiesAccounts() {
  try {
    const accounts = await getSecuritiesAccounts()
    securitiesAccounts.value = Array.isArray(accounts)
      ? accounts
      : (Array.isArray(accounts?.data) ? accounts.data : [])
    syncSelectedLiveAccount()
  } catch (error) {
    securitiesAccounts.value = []
  }
}

function syncSelectedLiveAccount() {
  const portfolioAccount = selectedPortfolio.value?.securities_account_id
  if (portfolioAccount) {
    selectedLiveAccountId.value = portfolioAccount
    return
  }
  if (!selectedLiveAccountId.value && securitiesAccounts.value.length) {
    selectedLiveAccountId.value = securitiesAccounts.value[0].id || securitiesAccounts.value[0]._id || ''
  }
}

async function refreshDetail() {
  const planId = selectedLatestPlanId.value
  if (!planId) return
  loadingDetail.value = true
  message.value = ''
  messageIsError.value = false
  try {
    const capture = (promise) => promise.then(
      (value) => ({ value, error: null }),
      (error) => ({ value: null, error }),
    )
    const isLive = isLivePortfolio.value
    const reconcilePromise = isLive ? Promise.resolve() : loadReconcile()
    const selectedPlanDetailPromise = capture(getPortfolioPlan(planId))
    const portfolioSummaryPromise = capture(getPortfolioPlanSummary(planId))
    const lineageDataPromise = capture(
      isLive
        ? getPortfolioPlanLiveSummary(planId)
        : Promise.all([
            getPortfolioPlanLineageEquity(planId),
            getLineagePaperPositions(planId),
            getLineagePaperExecutions(planId),
          ]),
    )

    const timelineRes = await getPortfolioPlanLineageTimeline(planId, { limit: 40 })
    timelineData.value = timelineRes.data || null
    const benchPromise = loadBench()
    const operationPlanId = timelineData.value?.operation_plan?.plan_id || planId
    let latestPlanRes
    if (operationPlanId === planId) {
      const selectedPlanDetail = await selectedPlanDetailPromise
      if (selectedPlanDetail.error) throw selectedPlanDetail.error
      latestPlanRes = selectedPlanDetail.value
    } else {
      latestPlanRes = await getPortfolioPlan(operationPlanId)
    }
    latestPlanDetail.value = latestPlanRes.data || null
    resetPlanOpsState()
    syncSelectedLiveAccount()

    const summaryResult = await portfolioSummaryPromise
    if (summaryResult.error) throw summaryResult.error
    portfolioSummary.value = summaryResult.value?.data || null

    const lineageData = await lineageDataPromise
    if (lineageData.error) throw lineageData.error

    if (isLive) {
      const summaryData = lineageData.value?.data || {}
      const equity = summaryData.equity || {}
      equityRows.value = (equity.rows || []).map((row) => ({
        ...row,
        equity: Number(row.equity),
      }))
      equityCaveat.value = equity.caveat || ''
      bookEquity.value = equity.current_book_equity || null
      positionRows.value = summaryData.positions?.positions || []
      positionSummary.value = summaryData.positions?.summary || null
      tradeRows.value = summaryData.trades || []
      reconcileData.value = summaryData.reconcile || null
    } else {
      const [eqRes, posRes, exRes] = lineageData.value
      const rows = eqRes.data?.rows || []
      equityRows.value = rows.map((row) => ({
        ...row,
        equity: Number(row.equity),
      }))
      const snapshotDate = posRes.data?.as_of_date
      equityCaveat.value = snapshotDate
        ? `纸面净值由各 plan 日更 portfolio_paper_equity 拼接；最新持仓快照 ${snapshotDate}（plan ${posRes.data?.source_plan_id || '-'}）。`
        : '纸面净值由各 plan 日更 portfolio_paper_equity 拼接；当前血缘暂无 paper 持仓快照。'
      const latestRow = rows[rows.length - 1]
      const summary = posRes.data?.summary || {}
      bookEquity.value = latestRow || summary.equity
        ? {
            equity: Number(summary.equity || latestRow?.equity || 0),
            initial_capital: Number(
              eqRes.data?.initial_capital ||
              latestPlanDetail.value?.plan?.params_snapshot?.initial_capital ||
              selectedPortfolio.value?.initial_capital ||
              rows[0]?.equity ||
              0,
            ),
            cash: Number(summary.cash || latestRow?.cash || 0),
            realized_pnl: 0,
            unrealized_pnl: Number(summary.total_unrealized_pnl || 0),
          }
        : null
      positionRows.value = posRes.data?.positions || []
      positionSummary.value = summary.holding_count != null
        ? summary
        : {
            total_market_value: positionRows.value.reduce((sum, row) => sum + Number(row.market_value || 0), 0),
            total_realized_pnl: 0,
            total_unrealized_pnl: 0,
            holding_count: positionRows.value.length,
          }
      tradeRows.value = exRes.data?.trades || []
    }
    syncManualTargets()
    await Promise.all([benchPromise, reconcilePromise])
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || '加载详情失败'
    messageIsError.value = true
  } finally {
    loadingDetail.value = false
  }
}

watch(selectedPortfolioKey, (key) => {
  expandedTimelinePlanId.value = null
  resetHoldingsOpsState()
  latestPlanDetail.value = null
  resetPlanOpsState()
  clearReselectUi()
  if (key) refreshDetail()
  else {
    portfolioSummary.value = null
    timelineData.value = null
    equityRows.value = []
    equityCaveat.value = ''
    bookEquity.value = null
    positionRows.value = []
    positionSummary.value = null
    tradeRows.value = []
  }
})

watch(latestHoldingRows, () => {
  syncManualTargets()
}, { immediate: true })

onMounted(() => {
  loadSecuritiesAccounts()
  loadPortfolios()
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
