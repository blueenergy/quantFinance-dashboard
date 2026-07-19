<template>
  <section class="holdings-section">
    <HoldingsTableToolbar
      :selected-latest-plan-id="selectedLatestPlanId"
      :risk-loading="riskLoading"
      :has-manual-changes="Boolean(manualChangeRows.length)"
      :has-holdings="Boolean(latestHoldingRows.length)"
      :liquidate-submitting="liquidateSubmitting"
      :is-live-portfolio="isLivePortfolio"
      :external-manual-submitting="externalManualSubmitting"
      @load-risk="$emit('load-risk')"
      @open-manual="$emit('open-manual')"
      @open-liquidate="$emit('open-liquidate')"
      @open-external-manual="$emit('open-external-manual')"
    />

    <HoldingsTable
      :latest-holding-rows="latestHoldingRows"
      :trades-by-symbol="tradesBySymbol"
      :holdings-risk="holdingsRisk"
      :holdings-risk-by-symbol="holdingsRiskBySymbol"
      :holding-plan-risk-by-symbol="holdingPlanRiskBySymbol"
      :holding-plan-opportunity-by-symbol="holdingPlanOpportunityBySymbol"
      :holding-plan-internal-swot-by-symbol="holdingPlanInternalSwotBySymbol"
      :holdings-risk-by-symbol-high="holdingsRiskBySymbolHigh"
      :llm-detail-key="llmDetail?.key || ''"
      :effective-target="effectiveTarget"
      :manual-delta="manualDelta"
      :risk-row-class="riskRowClass"
      :format-risk-time="formatRiskTime"
      :half-target-shares="halfTargetShares"
      :signed-money="signedMoney"
      @update-target="(...args) => $emit('update-target', ...args)"
      @open-swap="(row) => $emit('open-swap', row)"
      @quick-reduce="(...args) => $emit('quick-reduce', ...args)"
      @open-llm="openLlm"
    />

    <HoldingsBenchPanel
      :bench-data="benchData"
      :bench-expanded="benchExpanded"
      :bench-loading="benchLoading"
      :bench-risk="benchRisk"
      :bench-risk-by-symbol="benchRiskBySymbol"
      :bench-risk-loading="benchRiskLoading"
      :bench-llm-risk-loading="benchLlmRiskLoading"
      :llm-detail-key="llmDetail?.key || ''"
      @toggle-bench="$emit('toggle-bench')"
      @load-bench-risk="$emit('load-bench-risk')"
      @load-bench-llm-risk="$emit('load-bench-llm-risk')"
      @open-llm="openLlm"
    />

    <LlmRiskDetailPanel
      :detail="llmDetail"
      :font-px="llmFontPx"
      :min="LLM_FONT_MIN"
      :max="LLM_FONT_MAX"
      :copied="copiedLlmRiskKey === llmDetail?.key"
      :action-busy="actionBusy"
      @inc="incLlmFont"
      @dec="decLlmFont"
      @copy="copyLlmRisk(llmDetail.mode === 'opportunity' ? llmDetail.opportunity : llmDetail.risk, llmDetail.key, llmDetail.mode)"
      @close="closeLlmDetail"
      @confirm-resolution="confirmResolution"
      @resolve="resolveFinding"
      @realize-opportunity="realizeOpportunity"
      @invalidate-opportunity="invalidateOpportunity"
      @manual-add="manualAddRisk"
    />
  </section>
</template>

<script setup>
import HoldingsBenchPanel from './HoldingsBenchPanel.vue'
import HoldingsTable from './HoldingsTable.vue'
import HoldingsTableToolbar from './HoldingsTableToolbar.vue'
import LlmRiskDetailPanel from './LlmRiskDetailPanel.vue'
import { useLlmRiskDetail } from '../../composables/useLlmRiskDetail'

defineProps({
  selectedLatestPlanId: { type: String, default: '' },
  riskLoading: { type: Boolean, default: false },
  manualChangeRows: { type: Array, default: () => [] },
  latestHoldingRows: { type: Array, default: () => [] },
  tradesBySymbol: { type: Object, default: () => ({}) },
  liquidateSubmitting: { type: Boolean, default: false },
  isLivePortfolio: { type: Boolean, default: false },
  externalManualSubmitting: { type: Boolean, default: false },
  holdingsRisk: { type: Object, default: null },
  holdingsRiskBySymbol: { type: Object, default: () => ({}) },
  holdingPlanRiskBySymbol: { type: Object, default: () => ({}) },
  holdingPlanOpportunityBySymbol: { type: Object, default: () => ({}) },
  holdingPlanInternalSwotBySymbol: { type: Object, default: () => ({}) },
  holdingsRiskBySymbolHigh: { type: Array, default: () => [] },
  benchData: { type: Object, default: null },
  benchExpanded: { type: Boolean, default: false },
  benchLoading: { type: Boolean, default: false },
  benchRisk: { type: Object, default: null },
  benchRiskBySymbol: { type: Object, default: () => ({}) },
  benchRiskLoading: { type: Boolean, default: false },
  benchLlmRiskLoading: { type: Boolean, default: false },
  effectiveTarget: { type: Function, required: true },
  manualDelta: { type: Function, required: true },
  riskRowClass: { type: Function, required: true },
  formatRiskTime: { type: Function, required: true },
  halfTargetShares: { type: Function, required: true },
  signedMoney: { type: Function, required: true },
})

const emit = defineEmits([
  'load-risk',
  'open-manual',
  'open-liquidate',
  'open-external-manual',
  'update-target',
  'open-swap',
  'quick-reduce',
  'toggle-bench',
  'load-bench-risk',
  'load-bench-llm-risk',
  'risk-changed',
])

const {
  detail: llmDetail,
  copiedKey: copiedLlmRiskKey,
  fontPx: llmFontPx,
  LLM_FONT_MIN,
  LLM_FONT_MAX,
  incLlmFont,
  decLlmFont,
  toggleLlmDetail: openLlmDetail,
  closeLlmDetail,
  copyLlmText: copyLlmRisk,
  actionBusy,
  confirmResolution,
  resolveFinding,
  realizeOpportunity,
  invalidateOpportunity,
  manualAddRisk,
} = useLlmRiskDetail({
  onRiskChanged: () => emit('risk-changed'),
})

function openLlm({ payload, row, scope, event, mode = 'risk' }) {
  openLlmDetail({
    key: `${scope}:${row?.symbol || row?.name || 'unknown'}`,
    symbol: row?.symbol || '',
    name: row?.name || '',
    risk: mode === 'opportunity' ? null : payload,
    opportunity: mode === 'opportunity' ? payload : null,
    mode,
    event,
  })
}
</script>

<style scoped>
.holdings-section {
  margin-top: 8px;
}
</style>
