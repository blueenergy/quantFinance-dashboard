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

    <template v-if="selectedPortfolioKey && selectedPortfolio">
      <PortfolioIdentityCard
        :portfolio="selectedPortfolio"
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

      <PlanReviewPanel
        :visible="needsReviewPlan && planTargetRows.length > 0"
        :plan-id="selectedOperationPlanId"
        :items="planTargetRows"
        :overlay="liveOverlay"
        :score-snapshot-stale="scoreSnapshotStale"
        :summary="planReviewSummary"
        :risk-summary="planReviewRiskSummary"
        :approve-submitting="approveSubmitting"
        :reject-submitting="rejectSubmitting"
        :review-ai-risk-loading="reviewAiRiskLoading"
        @approve="approvePendingPlan"
        @reject="rejectPendingPlan"
        @rerun-ai-risk="rerunReviewAiRisk"
        @copy-plan-id="copyPlanId"
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
        :can-cancel-current-plan="canCancelCurrentPlan"
        :cancel-plan-ready-text="cancelPlanReadyText"
        :cancel-plan-loading="cancelPlanLoading"
        :pending-items="pendingPlanRows"
        :pending-summary="pendingPlanSummary"
        :remainder-preview="remainderPreview"
        :remainder-rows="remainderRows"
        :remainder-actionable-count="remainderActionableCount"
        :remainder-blockers="remainderBlockers"
        :remainder-loading="remainderLoading"
        v-model:remainder-reason="remainderReason"
        @copy-plan-id="copyPlanId"
        @execute-paper="executePaperNow"
        @preview-publish="previewLivePublish"
        @confirm-publish="publishLiveSignals"
        @preview-remainder="previewRemainder"
        @confirm-remainder="confirmRemainder"
        @cancel-plan="cancelCurrentPlan"
      />

      <PlanPublishPreviewModal
        :visible="showPublishModal"
        :preview="livePublishPreview"
        :loading="livePublishLoading"
        :blocker-messages="livePublishBlockers"
        :confirm-disabled="Boolean(livePublishBlockers.length)"
        @close="showPublishModal = false"
        @confirm="publishLiveSignals"
      />

      <LineageTimeline
        :entries="foldedTimeline"
        :expanded-plan-id="expandedTimelinePlanId"
        @toggle-detail="toggleTimelineDetail"
      />

      <section v-if="equityCaveat" class="caveat-box">
        <strong>说明：</strong>{{ equityCaveat }}
      </section>

      <section class="summary-cards" v-if="bookEquity">
        <div class="card">
          <div class="label">连续权益（一本账）</div>
          <div class="value">{{ money(bookEquity.equity) }}</div>
        </div>
        <div class="card">
          <div class="label">初始本金</div>
          <div class="value">{{ money(bookEquity.initial_capital) }}</div>
        </div>
        <div class="card">
          <div class="label">可用现金</div>
          <div class="value">{{ money(bookEquity.cash) }}</div>
        </div>
        <div class="card">
          <div class="label">累计盈亏</div>
          <div class="value">{{ signedMoney(Number(bookEquity.realized_pnl || 0) + Number(bookEquity.unrealized_pnl || 0)) }}</div>
        </div>
      </section>

      <section class="chart-section">
        <h3>净值曲线（账户整体权益 · 日频）</h3>
        <div v-if="!equityRowsForChart.length" class="muted">暂无净值数据。</div>
        <div v-else class="equity-chart" aria-label="Lineage equity curve" @mouseleave="onChartLeave">
          <svg
            class="equity-svg"
            :viewBox="`0 0 ${equityChart.width} ${equityChart.height}`"
            @mousemove="onChartMove"
          >
            <defs>
              <linearGradient :id="equityGradId" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="equityChart.up ? 'rgba(220,38,38,0.30)' : 'rgba(22,163,74,0.30)'" />
                <stop offset="100%" stop-color="rgba(0,0,0,0)" />
              </linearGradient>
            </defs>
            <g class="grid">
              <line
                v-for="tick in equityChart.yTicks"
                :key="`grid-${tick.y}`"
                :x1="equityChart.plotLeft"
                :x2="equityChart.plotRight"
                :y1="tick.y"
                :y2="tick.y"
              />
              <text
                v-for="tick in equityChart.yTicks"
                :key="`yl-${tick.y}`"
                class="axis-label"
                :x="equityChart.plotLeft - 8"
                :y="tick.y + 4"
                text-anchor="end"
              >{{ tick.label }}</text>
            </g>
            <g v-if="equityChart.baselineY != null">
              <line
                class="baseline"
                :x1="equityChart.plotLeft"
                :x2="equityChart.plotRight"
                :y1="equityChart.baselineY"
                :y2="equityChart.baselineY"
              />
              <text class="baseline-label" :x="equityChart.plotRight" :y="equityChart.baselineY - 6" text-anchor="end">
                成本线 {{ moneyShort(equityChart.baseline) }}
              </text>
            </g>
            <path v-if="equityChart.areaPath" class="area" :d="equityChart.areaPath" :fill="`url(#${equityGradId})`" />
            <polyline class="line" :class="equityChart.up ? 'up' : 'down'" :points="equityChart.linePoints" />
            <text
              v-for="tick in equityChart.xTicks"
              :key="`xl-${tick.x}`"
              class="axis-label"
              :x="tick.x"
              :y="equityChart.height - 8"
              :text-anchor="tick.anchor"
            >{{ tick.text }}</text>
            <g v-if="hoverPoint">
              <line
                class="crosshair"
                :x1="hoverPoint.x"
                :x2="hoverPoint.x"
                :y1="equityChart.plotTop"
                :y2="equityChart.plotBottom"
              />
              <circle class="dot" :cx="hoverPoint.x" :cy="hoverPoint.y" r="4.5" />
            </g>
          </svg>
          <div v-if="hoverPoint" class="equity-tip" :style="hoverPoint.tipStyle">
            <div class="tip-date">{{ hoverPoint.date }}</div>
            <div class="tip-row"><span>账户总额</span><strong>{{ money(hoverPoint.equity) }}</strong></div>
            <div class="tip-row">
              <span>当日盈亏</span>
              <strong :class="signClass(hoverPoint.dayPnl)">{{ signedMoney(hoverPoint.dayPnl) }} · {{ signedPct(hoverPoint.dayPct) }}</strong>
            </div>
            <div class="tip-row">
              <span>累计盈亏</span>
              <strong :class="signClass(hoverPoint.cumPnl)">{{ signedMoney(hoverPoint.cumPnl) }} · {{ signedPct(hoverPoint.cumPct) }}</strong>
            </div>
          </div>
          <p v-if="equityChart.latestReturn != null" class="chart-meta">
            区间收益：<strong :class="signClass(equityChart.latestReturn)">{{ signedPct(equityChart.latestReturn) }}</strong>
            <span class="chart-meta-hint">· 悬浮查看每日净值与盈亏</span>
          </p>
          <p v-if="equityRows.length === 0 && equityRowsForChart.length" class="muted chart-note">
            当前暂无账户日权益快照；这里用一本账当前权益生成一个估算点。
          </p>
        </div>
      </section>

      <section class="summary-cards" v-if="positionSummary">
        <div class="card">
          <div class="label">持仓市值</div>
          <div class="value">{{ money(positionSummary.total_market_value) }}</div>
        </div>
        <div class="card">
          <div class="label">已实现盈亏</div>
          <div class="value">{{ signedMoney(positionSummary.total_realized_pnl) }}</div>
        </div>
        <div class="card">
          <div class="label">浮动盈亏</div>
          <div class="value">{{ signedMoney(positionSummary.total_unrealized_pnl) }}</div>
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
        :liquidate-submitting="liquidateSubmitting"
        :is-live-portfolio="isLivePortfolio"
        :external-manual-submitting="externalManualSubmitting"
        :holdings-risk="holdingsRisk"
        :holdings-risk-by-symbol="holdingsRiskBySymbol"
        :holdings-risk-by-symbol-high="holdingsRiskBySymbolHigh"
        :bench-data="benchData"
        :bench-expanded="benchExpanded"
        :bench-loading="benchLoading"
        :bench-risk="benchRisk"
        :bench-risk-by-symbol="benchRiskBySymbol"
        :bench-risk-loading="benchRiskLoading"
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
      />

      <SwapModal
        :visible="showSwapModal"
        :starter="swapStarter"
        :bench-data="benchData"
        :bench-risk="benchRisk"
        :bench-risk-by-symbol="benchRiskBySymbol"
        :bench-risk-loading="benchRiskLoading"
        :submitting="fastActionSubmitting"
        :error="swapError"
        @close="showSwapModal = false"
        @load-bench-risk="loadBenchRisk"
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
  forceRebalanceLineage,
  getLineageLiveEquity,
  getLineageLiveExecutions,
  getLineageLivePositions,
  getLineagePaperExecutions,
  getLineagePaperPositions,
  getPortfolioPlan,
  getPortfolioPlanGenerationTask,
  getPortfolioPlanLineageEquity,
  getPortfolioPlanLineageTimeline,
  listPortfolios,
  rerunPortfolioPlanAiRisk,
  resumePortfolioLineage,
} from '../api/portfolioPlans'
import { getSecuritiesAccounts } from '../api/trader'
import PortfolioIdentityCard from '../components/portfolio/PortfolioIdentityCard.vue'
import CurrentPeriodStatus from '../components/portfolio/CurrentPeriodStatus.vue'
import PlanReviewPanel from '../components/portfolio/PlanReviewPanel.vue'
import PlanOpsPanel from '../components/portfolio/PlanOpsPanel.vue'
import PlanPublishPreviewModal from '../components/portfolio/PlanPublishPreviewModal.vue'
import LineageTimeline from '../components/portfolio/LineageTimeline.vue'
import ExecutionsPanel from '../components/portfolio/ExecutionsPanel.vue'
import HoldingsPanel from '../components/portfolio/HoldingsPanel.vue'
import SwapModal from '../components/portfolio/SwapModal.vue'
import FastActionModal from '../components/portfolio/FastActionModal.vue'
import ManualRebalanceModal from '../components/portfolio/ManualRebalanceModal.vue'
import LiquidateModal from '../components/portfolio/LiquidateModal.vue'
import ExternalManualModal from '../components/portfolio/ExternalManualModal.vue'
import { useHoldingsOps } from '../composables/useHoldingsOps'
import { usePlanOps } from '../composables/usePlanOps'
import {
  formatShareDelta,
} from '../composables/usePortfolioPlanFormat'

const portfolios = ref([])
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
const forceRebalanceSubmitting = ref(false)
const securitiesAccounts = ref([])
const selectedLiveAccountId = ref('')

const selectedPortfolio = computed(() => (
  portfolios.value.find((row) => portfolioKey(row) === selectedPortfolioKey.value) || null
))

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
const selectedPlanStatus = computed(() => latestPlan.value?.status || '')
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
const canExecutePaperNow = computed(() => (
  isPaperPortfolio.value
  && selectedPlanStatus.value === 'approved'
  && !selectedPlanHasLiveSignals.value
  && !hasPaperExecution.value
  && executionStatus.value?.open_price_ready !== false
))
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
const paperExecuteReadyText = computed(() => {
  if (!isPaperPortfolio.value) return '仅纸面组合支持 Paper 执行'
  if (hasPaperExecution.value) return '该 plan 已执行过 Paper，不能重复执行'
  if (selectedPlanHasLiveSignals.value) return '该 plan 存在实盘信号历史，不能再执行 Paper'
  if (selectedPlanStatus.value !== 'approved') return '需要先审核通过 plan'
  if (executionStatus.value?.missing_execute_date) return '缺少 execute_date，请等待自动执行或先补齐下一交易日 execute_date'
  if (executionStatus.value?.open_price_ready === false) {
    const date = executionStatus.value.execute_date || executionStatus.value.effective_execute_date || '-'
    const count = executionStatus.value.missing_open_price_count ?? 0
    return `开盘价未就绪：execute_date=${date}，缺失 ${count} 个标的`
  }
  return '使用 execute_date 开盘价立即执行 Paper'
})
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

const {
  livePublishPreview,
  livePublishLoading,
  showPublishModal,
  livePublishBlockers,
  paperExecuteLoading,
  cancelPlanLoading,
  remainderPreview,
  remainderLoading,
  remainderReason,
  remainderRows,
  remainderActionableCount,
  remainderBlockers,
  approveSubmitting,
  rejectSubmitting,
  previewLivePublish,
  publishLiveSignals,
  previewRemainder,
  confirmRemainder,
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
  const holdings = portfolio.execution_venue === 'paper'
    ? ` · 持仓${portfolio.paper_holding_count ?? 0}`
    : ''
  const account = portfolio.securities_account_id
    ? ` · 账户${portfolio.securities_account_id.slice(-6)}`
    : ''
  return `${name} · ${params} · ${range}（${portfolio.plan_count}期${holdings}${account} · #${hash}）`
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

async function copyPlanId(planId) {
  const text = String(planId || '')
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    message.value = `已复制 plan_id：${text}`
    messageIsError.value = false
  } catch {
    message.value = `无法自动复制，请手动复制 plan_id：${text}`
    messageIsError.value = true
  }
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
    message.value = 'AI 风控已复检，标的风险等级已刷新。'
  } catch (error) {
    message.value = formatApiDetail(error.response?.data?.detail) || error.message || 'AI 风控复检失败'
    messageIsError.value = true
  } finally {
    reviewAiRiskLoading.value = false
  }
}

async function submitForceRebalance() {
  const planId = selectedOperationPlanId.value
  if (!planId) return
  if (forceRebalanceBlockReason.value) {
    message.value = forceRebalanceBlockReason.value
    messageIsError.value = true
    return
  }
  forceRebalanceSubmitting.value = true
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
        ? `任务 ${taskId} 已提交，worker 仍在后台生成计划；请稍后刷新组合总览或到「组合交易计划」查看结果。`
        : '立即调仓任务已提交，worker 仍在后台生成计划；请稍后刷新查看结果。'
      messageIsError.value = false
      await Promise.all([loadPortfolios(), refreshDetail()])
    } else {
      message.value = detail
      messageIsError.value = true
    }
  } finally {
    forceRebalanceSubmitting.value = false
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

const equityRowsForChart = computed(() => {
  if (equityRows.value.length) return equityRows.value
  const currentEquity = Number(bookEquity.value?.equity)
  if (!Number.isFinite(currentEquity) || currentEquity <= 0) return []
  return [{ date: '当前估算', equity: currentEquity, estimated: true }]
})

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

const hoverIndex = ref(null)
const equityGradId = `equityFill-${Math.random().toString(36).slice(2, 8)}`

function moneyShort(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return n.toFixed(0)
}

function shortDate(value) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) return `${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

const equityChart = computed(() => {
  const rows = equityRowsForChart.value
  const width = 720
  const height = 260
  const plotLeft = 58
  const plotRight = width - 18
  const plotTop = 18
  const plotBottom = height - 28
  const empty = {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints: '', areaPath: '', coords: [], yTicks: [], xTicks: [],
    min: 0, max: 0, baseline: null, baselineY: null, up: true, latestReturn: null,
  }
  if (!rows.length) return empty

  const values = rows.map((row) => Number(row.equity)).filter((v) => Number.isFinite(v))
  if (!values.length) return empty
  const baselineRaw = Number(bookEquity.value?.initial_capital)
  const baseline = Number.isFinite(baselineRaw) && baselineRaw > 0 ? baselineRaw : values[0]

  let min = Math.min(...values, baseline)
  let max = Math.max(...values, baseline)
  if (max === min) { max += 1; min -= 1 }
  const headroom = (max - min) * 0.08
  min -= headroom
  max += headroom
  const span = max - min || 1

  const xAt = (index) =>
    rows.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + (index * (plotRight - plotLeft)) / (rows.length - 1)
  const yAt = (equity) => plotBottom - ((equity - min) * (plotBottom - plotTop)) / span

  const coords = rows.map((row, index) => {
    const equity = Number(row.equity)
    const prev = index > 0 ? Number(rows[index - 1].equity) : equity
    const dayPnl = index > 0 ? equity - prev : 0
    const dayPct = index > 0 && prev ? equity / prev - 1 : 0
    return {
      x: xAt(index),
      y: yAt(equity),
      date: row.date,
      equity,
      dayPnl,
      dayPct,
      cumPnl: equity - baseline,
      cumPct: baseline ? equity / baseline - 1 : 0,
    }
  })

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const areaPath = coords.length > 1
    ? `M ${coords[0].x.toFixed(1)},${plotBottom} ` +
      coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
      ` L ${coords[coords.length - 1].x.toFixed(1)},${plotBottom} Z`
    : ''

  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = min + (span * i) / tickCount
    return { value, y: yAt(value), label: moneyShort(value) }
  })

  const labelCount = Math.min(rows.length, 5)
  const xTicks = Array.from({ length: labelCount }, (_, i) => {
    const index = labelCount === 1 ? 0 : Math.round((i * (rows.length - 1)) / (labelCount - 1))
    const c = coords[index]
    const anchor = i === 0 ? 'start' : i === labelCount - 1 ? 'end' : 'middle'
    return { x: c.x, text: shortDate(c.date), anchor }
  })

  const first = values[0]
  const latest = values[values.length - 1]
  return {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints, areaPath, coords, yTicks, xTicks,
    min, max,
    baseline,
    baselineY: yAt(baseline),
    up: latest >= baseline,
    latestReturn: first ? latest / first - 1 : null,
  }
})

const hoverPoint = computed(() => {
  const chart = equityChart.value
  const i = hoverIndex.value
  if (i == null || !chart.coords[i]) return null
  const c = chart.coords[i]
  const leftPct = Math.max(14, Math.min(86, (c.x / chart.width) * 100))
  return { ...c, tipStyle: { left: `${leftPct}%` } }
})

function onChartMove(event) {
  const chart = equityChart.value
  const n = chart.coords.length
  if (!n) { hoverIndex.value = null; return }
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width) return
  const frac = (event.clientX - rect.left) / rect.width
  const left = chart.plotLeft / chart.width
  const right = chart.plotRight / chart.width
  const t = Math.max(0, Math.min(1, (frac - left) / (right - left || 1)))
  hoverIndex.value = Math.round(t * (n - 1))
}

function onChartLeave() {
  hoverIndex.value = null
}

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

function signedPct(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

function pct(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-'
}

function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number > 0 ? 'positive' : 'negative'
}

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
    const timelineRes = await getPortfolioPlanLineageTimeline(planId, { limit: 120 })
    timelineData.value = timelineRes.data || null
    const operationPlanId = timelineData.value?.operation_plan?.plan_id || planId
    const latestPlanRes = await getPortfolioPlan(operationPlanId)
    latestPlanDetail.value = latestPlanRes.data || null
    resetPlanOpsState()
    syncSelectedLiveAccount()

    if (isLivePortfolio.value) {
      const [eqRes, posRes, exRes] = await Promise.all([
        getLineageLiveEquity(planId),
        getLineageLivePositions(planId),
        getLineageLiveExecutions(planId),
      ])
      equityRows.value = (eqRes.data?.rows || []).map((row) => ({
        ...row,
        equity: Number(row.equity),
      }))
      equityCaveat.value = eqRes.data?.caveat || ''
      bookEquity.value = eqRes.data?.current_book_equity || null
      positionRows.value = posRes.data?.positions || []
      positionSummary.value = posRes.data?.summary || null
      tradeRows.value = exRes.data?.trades || []
    } else {
      const [eqRes, posRes, exRes] = await Promise.all([
        getPortfolioPlanLineageEquity(planId),
        getLineagePaperPositions(planId),
        getLineagePaperExecutions(planId),
      ])
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
    await loadBench()
    await loadReconcile()
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
  if (key) refreshDetail()
  else {
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

.muted code {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  color: #111827;
  font-size: 12px;
  padding: 1px 6px;
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

.caveat-box {
  background: #fffbeb;
  border: 1px solid #d97706;
  border-radius: 6px;
  color: #422006;
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 16px;
  padding: 12px 14px;
}

.caveat-box strong {
  color: #1c1917;
}

.portfolio-identity-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.portfolio-identity-card h3 {
  font-size: 15px;
  margin: 0 0 12px;
}

.identity-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.identity-grid .label {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.identity-grid strong {
  color: #0f172a;
  display: block;
  font-size: 14px;
}

.identity-grid small {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 4px;
  word-break: break-all;
}

.cycle-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

.cycle-card.needs-action {
  background: #fffbeb;
  border-color: #d97706;
}

.cycle-card-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cycle-card-header h3 {
  font-size: 15px;
  margin: 0 0 4px;
}

.cycle-state {
  color: #1e293b;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}

.funding-badge {
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
}

.funding-badge.mode-live {
  background: #dbeafe;
  color: #1d4ed8;
}

.funding-badge.mode-paper {
  background: #ecfdf5;
  color: #047857;
}

.cycle-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.cycle-metrics .label {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.cycle-metrics strong {
  color: #0f172a;
  font-size: 15px;
}

.cycle-metrics small {
  color: #64748b;
  display: block;
  font-size: 12px;
  margin-top: 4px;
}

.progress-bar {
  background: #e2e8f0;
  border-radius: 999px;
  height: 6px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  background: #2563eb;
  height: 100%;
}

.monitor-hint {
  color: #475569;
  font-size: 13px;
  margin: 12px 0 0;
}

.plan-ops-card {
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  margin-bottom: 16px;
  padding: 14px 16px;
}

/* 待审批复核卡片：用琥珀色边框强调“需要先看清楚再批” */
.plan-review-card {
  border-color: #f59e0b;
  background: #fffdf7;
}

.plan-review-risk-warning {
  margin: 8px 0 4px;
}

.plan-review-actions {
  margin-top: 12px;
}

.plan-ops-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.plan-ops-header h3 {
  font-size: 15px;
  margin: 0 0 4px;
}

.plan-id-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 0;
}

.plan-id-row .label {
  color: #64748b;
  font-size: 12px;
  font-weight: 600;
}

.plan-id-row code {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  color: #0f172a;
  font-size: 12px;
  padding: 2px 6px;
}

.link-button {
  background: transparent;
  border: 0;
  color: #2563eb;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
}

.link-button:disabled {
  color: #94a3b8;
  cursor: not-allowed;
}

.plan-ops-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.plan-ops-actions select,
.plan-ops-actions input {
  border: 1px solid #111827;
  border-radius: 4px;
  color: #111827;
  min-height: 36px;
  padding: 8px 10px;
}

.reason-input {
  min-width: 220px;
}

.pending-plan-items {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.pending-plan-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pending-plan-header h4 {
  font-size: 14px;
  margin: 0 0 4px;
}

.pending-plan-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pending-plan-summary span {
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  white-space: nowrap;
}

.pending-plan-summary .tag-buy {
  background: #dc2626;
}

.pending-plan-summary .tag-sell {
  background: #16a34a;
}

.pending-plan-summary .tag-hold {
  background: #64748b;
}

.symbol-line {
  display: block;
}

.risk-report {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.risk-report p {
  margin: 0 0 8px;
}

.warning-text {
  color: #b45309;
  font-size: 13px;
}

.risk-report-table tr.blocked {
  background: #fef2f2;
}

.timeline-section {
  margin-bottom: 16px;
}

.timeline-list {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.timeline-item {
  border-bottom: 1px solid #e5e7eb;
  color: #64748b;
  display: block;
  font-size: 13px;
  padding: 10px 12px;
}

.timeline-node-head {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.timeline-expand {
  background: transparent;
  border: none;
  color: #1d4ed8;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
}

.timeline-plan-id {
  color: #475569;
  word-break: break-all;
}

.timeline-plan-id code {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  color: #0f172a;
  padding: 1px 4px;
}

.timeline-hint {
  font-size: 12px;
  margin: -4px 0 8px;
}

.timeline-trade-detail {
  margin-top: 10px;
  width: 100%;
}

.timeline-detail-note {
  color: #92400e;
  font-size: 12px;
  margin: 0 0 8px;
}

.action-tag {
  border-radius: 3px;
  color: #fff;
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  min-width: 20px;
  text-align: center;
}

.action-tag.tag-buy {
  background: #dc2626;
}

.action-tag.tag-sell {
  background: #16a34a;
}

.action-tag.tag-hold {
  background: #64748b;
}

.action-tag.tag-skip {
  background: #cbd5e1;
  color: #334155;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-item strong {
  color: #0f172a;
}

.timeline-fold {
  background: #f8fafc;
}

.timeline-strong {
  background: #fff;
  color: #1e293b;
  font-weight: 500;
}

.timeline-strong .node-type {
  color: #1d4ed8;
  font-weight: 600;
}

.timeline-rejected {
  background: #f8fafc;
  color: #64748b;
}

.timeline-rejected .node-type {
  color: #991b1b;
  font-weight: 600;
}

.chart-section h3,
section h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 8px;
}

.equity-chart {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  position: relative;
}

.equity-chart .equity-svg {
  width: 100%;
  height: auto;
  display: block;
  cursor: crosshair;
}

.equity-chart polyline.line {
  fill: none;
  stroke-width: 2.25;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.equity-chart polyline.line.up {
  stroke: #dc2626;
}

.equity-chart polyline.line.down {
  stroke: #16a34a;
}

.equity-chart .grid line {
  stroke: #eef2f7;
  stroke-width: 1;
}

.equity-chart .axis-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .baseline {
  stroke: #94a3b8;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.equity-chart .baseline-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .crosshair {
  stroke: #94a3b8;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.equity-chart .dot {
  fill: #fff;
  stroke: #1d4ed8;
  stroke-width: 2;
}

.equity-tip {
  position: absolute;
  top: 14px;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.94);
  color: #f8fafc;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.5;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
  z-index: 2;
}

.equity-tip .tip-date {
  font-weight: 600;
  margin-bottom: 4px;
  color: #e2e8f0;
}

.equity-tip .tip-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.equity-tip .tip-row span {
  color: #94a3b8;
}

.equity-tip .tip-row strong {
  font-weight: 600;
  color: #f8fafc;
}

.equity-tip .tip-row strong.positive {
  color: #f87171;
}

.equity-tip .tip-row strong.negative {
  color: #4ade80;
}

.chart-meta {
  color: #374151;
  font-size: 13px;
  margin: 10px 0 0;
}

.chart-meta strong {
  color: #111827;
}

.chart-meta strong.positive {
  color: #dc2626;
}

.chart-meta strong.negative {
  color: #16a34a;
}

.chart-meta-hint {
  color: #94a3b8;
  margin-left: 6px;
}

/* A-share convention: profit red, loss green. */
.positive {
  color: #dc2626;
}

.negative {
  color: #16a34a;
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

.table-wrap.compact table {
  font-size: 13px;
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

.open-trade td {
  background: #f8fafc;
}

.badge-open {
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 4px;
  color: #1d4ed8;
  font-size: 12px;
  padding: 1px 6px;
  white-space: nowrap;
}

.totals-row td {
  background: #f3f4f6;
  border-top: 2px solid #d1d5db;
  font-weight: 700;
}

.combo-note {
  margin-top: 8px;
}

.truncate {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

button.danger {
  background: #dc2626;
  border-color: #dc2626;
  color: #fff;
}

button.danger:disabled {
  background: #fca5a5;
  border-color: #fca5a5;
}

.off-universe-tag {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 8px;
  font-size: 11px;
  background: #fef3c7;
  color: #92400e;
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

button.secondary {
  background: #f3f4f6;
  border: 1px solid #d1d5db;
}
</style>
