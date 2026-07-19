<template>
  <div class="stock-workbench">
    <WorkbenchSearchBar
      v-model="directSymbol"
      :loading="loading"
      :recent-stocks="recentStocks"
      @select="selectSearchCandidate"
      @submit="submitDirectSymbol"
      @load-symbol="loadSymbol"
      @clear-recent="clearRecentSymbols"
    />

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      class="mb-4"
    >
      {{ error }}
    </v-alert>

    <section v-if="!payload && !loading" class="empty-state">
      <h3>选择一只股票开始研究</h3>
      <p>例如输入 600519、000858 或股票名称，工作台会自动聚合评分、财务与深度分析结果。</p>
    </section>

    <template v-if="payload">
      <WorkbenchHero
        :name="stockName"
        :symbol="stockSymbol"
        :fallback-symbol="payload.symbol"
        :industry="stockIndustry"
        :industry-l2="stockIndustryL2"
        :industry-l3="stockIndustryL3"
        :index-codes="indexCodes"
        :section-status-items="sectionStatusItems"
        :latest-price="latestPrice"
        :latest-pct-change="latestPctChange"
        :change-class="changeClass"
        :price-change-title="priceChangeTitle"
        :quote-loading="sectionLoading.quote"
        :composite-score="currentCompositeScore"
        :rating-text="ratingText"
        :score-date="dataStatus.score_date"
        :quote-date="dataStatus.quote_date"
        @select-panel="activePanel = $event"
      />

      <v-tabs v-model="activePanel" class="workbench-tabs" color="primary">
        <v-tab value="overview">总览</v-tab>
        <v-tab value="quote">行情资金</v-tab>
        <v-tab value="nine-turn">神奇九转</v-tab>
        <v-tab value="scores">量化评分</v-tab>
        <v-tab value="financial">财务业绩</v-tab>
        <v-tab value="valuation">估值模型</v-tab>
        <v-tab value="shareholders">股东筹码</v-tab>
        <v-tab value="swot">SWOT</v-tab>
        <v-tab value="analysis">深度分析</v-tab>
      </v-tabs>

      <v-window v-model="activePanel">
        <v-window-item value="overview">
          <WorkbenchOverviewPanel
            :score-items="scoreItems"
            :deep-analysis="deepAnalysis"
            :analysis-summary="analysisSummary"
            :analysis-points="analysisPoints"
            :overview-quote-metrics="overviewQuoteMetrics"
            :status-items="statusItems"
            :quote-data-available="overviewQuoteDataAvailable"
            :active="activePanel === 'overview'"
            @goto-panel="activePanel = $event"
          />
        </v-window-item>

        <v-window-item value="quote">
          <WorkbenchQuotePanel
            v-model:quote-kline-tf="quoteKlineTf"
            :quote-section-date="quoteSectionDate"
            :loading="sectionLoading.quote"
            :quote-metrics="quoteMetrics"
            :latest-money-flow="latestMoneyFlow"
            :money-flow-metrics="moneyFlowMetrics"
            :entry-risk="entryRisk"
            :entry-risk-severity="entryRiskSeverity"
            :entry-risk-severity-label="entryRiskSeverityLabel"
            :entry-risk-narrative-rows="entryRiskNarrativeRows"
            :quote-kline-tf-options="quoteKlineTfOptions"
            :quote-kline-title="quoteKlineTitle"
            :quote-kline-short-label="quoteKlineShortLabel"
            :quote-kline-rows="quoteKlineRows"
            :quote-kline-is-loading="quoteKlineIsLoading"
            :active-money-flow-history="activeMoneyFlowHistory"
            :money-flow-summary="moneyFlowSummary"
            :money-flow-is-loading="moneyFlowIsLoading"
            @refresh="refreshQuoteSection"
          />
        </v-window-item>

        <v-window-item value="nine-turn">
          <WorkbenchNineTurnPanel
            :nine-turn-status="nineTurnStatus"
            :loading="sectionLoading.nine_turn"
            :latest-nine-turn-signal="latestNineTurnSignal"
            :nine-turn-daily-rows="nineTurnDailyRows"
            :nine-turn-signals="nineTurnSignals"
            :nine-turn-markers="nineTurnMarkers"
          />
        </v-window-item>

        <v-window-item value="scores">
          <WorkbenchScoresPanel
            :score-items="scoreItems"
            :score-history="scoreHistory"
            :loading="sectionLoading.scores"
          />
        </v-window-item>

        <v-window-item value="financial">
          <WorkbenchFinancialPanel
            v-model:financial-mode="financialMode"
            :financial-mode-label="financialModeLabel"
            :financial-chart-data="financialChartData"
            :financial-metrics="financialMetrics"
            :financial-metrics-period-text="financialMetricsPeriodText"
            :financial-quality-cards="financialQualityCards"
            :income-report-sections="incomeReportSections"
            :balance-rows="balanceRows"
            :cashflow-report-sections="cashflowReportSections"
            :indicator-rows="indicatorRows"
            :earnings-events="earningsEvents"
            :report-rc-rows="reportRcRows"
            :loading="sectionLoading.financials"
          />
        </v-window-item>

        <v-window-item value="valuation">
          <WorkbenchValuationPanel
            :valuation-status="valuationStatus"
            :valuation-data-status-found="valuationDataStatusFound"
            :valuation-conclusion-metrics="valuationConclusionMetrics"
            :valuation-confidence="valuationConfidence"
            :valuation-confidence-label="valuationConfidenceLabel"
            :valuation-suitability="valuationSuitability"
            :valuation-model-label="valuationModelLabel"
            :valuation-value-score="valuationValueScore"
            :valuation-applicability-items="valuationApplicabilityItems"
            :valuation-suitability-reasons="valuationSuitabilityReasons"
            :valuation-ddm="valuationDdm"
            :valuation-ddm-dividend-quality="valuationDdmDividendQuality"
            :valuation-ddm-scenarios="valuationDdmScenarios"
            :valuation-ddm-ke-breakdown-summary="valuationDdmKeBreakdownSummary"
            :valuation-ddm-annual-rows="valuationDdmAnnualRows"
            :valuation-is-financial="valuationIsFinancial"
            :valuation-dcf="valuationDcf"
            :valuation-dcf-net-debt-note="valuationDcfNetDebtNote"
            :valuation-dcf-per-share-note="valuationDcfPerShareNote"
            :valuation-dcf-shares-basis-note="valuationDcfSharesBasisNote"
            :valuation-dcf-fair-value-gap-note="valuationDcfFairValueGapNote"
            :valuation-dcf-scenarios="valuationDcfScenarios"
            :valuation-dcf-sensitivity-variables="valuationDcfSensitivityVariables"
            :valuation-multiple-metrics="valuationMultipleMetrics"
            :loading="sectionLoading.valuation"
            @refresh="refreshValuationSection"
          />
        </v-window-item>

        <v-window-item value="shareholders">
          <WorkbenchShareholdersPanel
            :summary="shSummary"
            :holder-numbers="shHolderNumbers"
            :hk-hold="shHkHold"
            :holder-trades="shHolderTrades"
            :share-floats="shShareFloats"
            :repurchases="shRepurchases"
            :top10-change="shTop10Change"
            :intl-changes="shIntlChanges"
            :hksc="shHksc"
            :loading="sectionLoading.shareholders"
            :active="activePanel === 'shareholders'"
            :symbol="stockSymbol"
            :reset-key="shareholdersUiResetKey"
          />
        </v-window-item>

        <v-window-item value="swot">
          <StockWorkbenchSwotPanel
            :symbol="stockSymbol"
            :name="stockName"
            :swot="swotPayload.swot"
            :signal-review="swotPayload.signal_review"
            :internal-signal-review="swotPayload.internal_signal_review"
            :industry-reference="swotPayload.industry_signal_reference"
            :data-status="swotPayload.data_status"
            :loading="sectionLoading.signals"
            :error="swotError"
            :collecting="signalCollecting"
            :collection-message="signalCollectionMessage"
            :collection-error="signalCollectionError"
            :internal-refreshing="internalSignalRefreshing"
            :internal-refresh-message="internalSignalRefreshMessage"
            :internal-refresh-error="internalSignalRefreshError"
            :pending-finding="pendingSwotFinding"
            @changed="refreshSwotSection"
            @retry="refreshSwotSection"
            @collect="collectSwotSignals"
            @refresh-internal="refreshInternalSwotSignals"
            @analyze-url="analyzeSwotNewsUrl"
          />
        </v-window-item>

        <v-window-item value="analysis">
          <WorkbenchAnalysisPanel
            v-model:analysis-mode="analysisMode"
            :evaluation-summary="evaluationSummary"
            :evaluation-rows="evaluationRows"
            :analysis-history="analysisHistory"
            :evaluation-by-history-id="evaluationByHistoryId"
            :deep-analysis="deepAnalysis"
            :watchlist-context="watchlistContext"
            :watchlist-strategies="watchlistStrategies"
            :trading-positions="tradingPositions"
            :recent-trade-signals="recentTradeSignals"
            :section-loading-ai="sectionLoading.ai"
            :section-loading-trading="sectionLoading.trading"
            :stock-symbol="stockSymbol"
            :analysis-mode-options="analysisModeOptions"
            :analysis-submitting="analysisSubmitting"
            :analysis-submit-status="analysisSubmitStatus"
            :analysis-submit-error="analysisSubmitError"
            @submit="submitDeepAnalysis"
            @select-history="selectAnalysisHistory"
          />
        </v-window-item>
      </v-window>
    </template>

    <v-overlay :model-value="loading && !payload" class="align-center justify-center" persistent>
      <v-progress-circular indeterminate size="48" />
    </v-overlay>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStockWorkbench } from '../composables/useStockWorkbench'
import { useWorkbenchDeepAnalysis } from '../composables/useWorkbenchDeepAnalysis'
import { useWorkbenchSwotSignals } from '../composables/useWorkbenchSwotSignals'
import StockWorkbenchSwotPanel from '../components/stock/StockWorkbenchSwotPanel.vue'
import WorkbenchAnalysisPanel from '../components/stock/WorkbenchAnalysisPanel.vue'
import WorkbenchFinancialPanel from '../components/stock/WorkbenchFinancialPanel.vue'
import WorkbenchHero from '../components/stock/WorkbenchHero.vue'
import WorkbenchNineTurnPanel from '../components/stock/WorkbenchNineTurnPanel.vue'
import WorkbenchOverviewPanel from '../components/stock/WorkbenchOverviewPanel.vue'
import WorkbenchQuotePanel from '../components/stock/WorkbenchQuotePanel.vue'
import WorkbenchSearchBar from '../components/stock/WorkbenchSearchBar.vue'
import WorkbenchScoresPanel from '../components/stock/WorkbenchScoresPanel.vue'
import WorkbenchShareholdersPanel from '../components/stock/WorkbenchShareholdersPanel.vue'
import WorkbenchValuationPanel from '../components/stock/WorkbenchValuationPanel.vue'
import {
  calcYoy,
  diffOrNull,
  firstFinite,
  fmtAmount,
  fmtNumber,
  fmtPctFromRatio,
  fmtPctPlain,
  fmtStatementAmount,
  fmtWanAmount,
  ratioPct,
  reportQuarter,
  reportYear,
  signedPctPoint,
  signedRelativePct,
  statementReportTypeLabel,
  sumFinite,
  toNumber,
  valuationRelativeLabel,
  valueClass,
} from '../utils/workbenchFormat'

const props = defineProps({
  pendingNavigation: {
    type: Object,
    default: null,
  },
})

const SCORE_DEFS = [
  { key: 'technical', label: '技术面' },
  { key: 'fundamental', label: '基本面' },
  { key: 'value', label: '价值' },
  { key: 'growth', label: '成长' },
  { key: 'money_flow', label: '资金流' },
  { key: 'cycle', label: '动量' },
]

const financialMode = ref('quarterly')
const shareholdersUiResetKey = ref(0)
let deepAnalysisApi = null
let swotSignalsApi = null

const {
  loading,
  error,
  payload,
  activePanel,
  directSymbol,
  recentStocks,
  sectionLoading,
  sectionLoaded,
  incomeRows,
  indicatorRows,
  balanceRows,
  cashflowRows,
  earnings,
  tradingContext,
  valuationData,
  shareholderData,
  swotData,
  swotError,
  quoteKlineTf,
  quoteKlineLoading,
  moneyFlowLoading,
  stockSymbol,
  loadSymbol,
  loadWorkbenchSection,
  isCurrentWorkbenchSymbol,
  refreshQuoteSection,
  refreshValuationSection,
  refreshSwotSection,
  selectSearchCandidate,
  submitDirectSymbol,
  clearRecentSymbols,
} = useStockWorkbench({
  pendingNavigation: () => props.pendingNavigation,
  onBeforeLoadSymbol() {
    deepAnalysisApi?.clearAnalysisPolling()
    swotSignalsApi?.clearSignalCollectionPolling()
    if (deepAnalysisApi) {
      deepAnalysisApi.analysisSubmitStatus.value = ''
      deepAnalysisApi.analysisSubmitError.value = ''
    }
    if (swotSignalsApi) {
      swotSignalsApi.signalCollectionMessage.value = ''
      swotSignalsApi.signalCollectionError.value = false
      swotSignalsApi.internalSignalRefreshMessage.value = ''
      swotSignalsApi.internalSignalRefreshError.value = false
    }
    shareholdersUiResetKey.value += 1
  },
})

deepAnalysisApi = useWorkbenchDeepAnalysis({
  payload,
  stockSymbol,
  directSymbol,
  stockName: () => stockName.value,
  analysisHistory: () => analysisHistory.value,
  isCurrentWorkbenchSymbol,
})
const {
  analysisMode,
  analysisSubmitting,
  analysisSubmitStatus,
  analysisSubmitError,
  selectAnalysisHistory,
  submitDeepAnalysis,
} = deepAnalysisApi

swotSignalsApi = useWorkbenchSwotSignals({
  stockSymbol,
  directSymbol,
  isCurrentWorkbenchSymbol,
  loadWorkbenchSection,
})
const {
  signalCollecting,
  signalCollectionMessage,
  signalCollectionError,
  internalSignalRefreshing,
  internalSignalRefreshMessage,
  internalSignalRefreshError,
  collectSwotSignals,
  refreshInternalSwotSignals,
  analyzeSwotNewsUrl,
} = swotSignalsApi

const analysisModeOptions = [
  { title: '多专家', value: 'multi_expert_v1' },
  { title: '经典', value: 'classic' },
]

const score = computed(() => payload.value?.score || {})
const stock = computed(() => payload.value?.stock || {})
const quote = computed(() => payload.value?.quote || {})
const deepAnalysis = computed(() => payload.value?.deep_analysis || null)
const dataStatus = computed(() => payload.value?.data_status || {})
const analysisHistory = computed(() => Array.isArray(payload.value?.analysis_history) ? payload.value.analysis_history : [])
const evaluationSummary = computed(() => payload.value?.evaluation_summary || {})
const evaluationRows = computed(() => Array.isArray(evaluationSummary.value.latest_evaluations) ? evaluationSummary.value.latest_evaluations : [])
const evaluationByHistoryId = computed(() => Object.fromEntries(
  evaluationRows.value
    .filter((row) => row.history_id)
    .map((row) => [row.history_id, row]),
))
const scoreHistory = computed(() => Array.isArray(payload.value?.score_history) ? payload.value.score_history : [])
const quoteDailyRows = computed(() => Array.isArray(payload.value?.daily_quotes) ? payload.value.daily_quotes : [])
const quoteWeeklyRows = computed(() => Array.isArray(payload.value?.weekly_quotes) ? payload.value.weekly_quotes : [])
const quoteMonthlyRows = computed(() => Array.isArray(payload.value?.monthly_quotes) ? payload.value.monthly_quotes : [])
const latestDailyBasic = computed(() => payload.value?.daily_basic || {})
const latestMoneyFlow = computed(() => payload.value?.money_flow || null)
const moneyFlowHistory = computed(() => Array.isArray(payload.value?.money_flow_history) ? payload.value.money_flow_history : [])
const moneyFlowHistoryByTf = computed(() => payload.value?.money_flow_history_by_tf || {})
const moneyFlowSummary = computed(() => payload.value?.money_flow_summary || {})
const entryRisk = computed(() => payload.value?.entry_risk || {})
const entryRiskMetrics = computed(() => entryRisk.value?.metrics || {})
const quoteSectionDate = computed(() => dataStatus.value?.sections?.quote?.as_of || latestDailyBasic.value.trade_date || quote.value.trade_date || '')
const nineTurnDailyRows = computed(() => Array.isArray(payload.value?.nine_turn_daily_quotes) ? payload.value.nine_turn_daily_quotes : [])
const nineTurnSignals = computed(() => {
  const rows = Array.isArray(payload.value?.nine_turn_signals) ? payload.value.nine_turn_signals : []
  return [...rows].sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
})
const latestNineTurnSignal = computed(() => payload.value?.latest_nine_turn_signal || nineTurnSignals.value[0] || null)
const swotPayload = computed(() => swotData.value || {})

const pendingSwotFinding = computed(() => {
  const nav = props.pendingNavigation
  if (!nav?.findingKey) return null
  return {
    findingKey: nav.findingKey,
    dimension: nav.dimension || 'strength',
  }
})
const nineTurnStatus = computed(() => dataStatus.value?.sections?.nine_turn || {})
const nineTurnMarkers = computed(() => nineTurnSignals.value.map((signal) => ({
  trade_date: signal.trade_date,
  direction: signal.direction,
  label: signal.count || 9,
  grade: signal.grade,
  high: signal.high,
  low: signal.low,
})))
const watchlistContext = computed(() => tradingContext.value.watchlist || {})
const watchlistStrategies = computed(() => Array.isArray(tradingContext.value.watchlist_strategies) ? tradingContext.value.watchlist_strategies : [])
const tradingPositions = computed(() => Array.isArray(tradingContext.value.positions) ? tradingContext.value.positions : [])
const recentTradeSignals = computed(() => Array.isArray(tradingContext.value.recent_signals) ? tradingContext.value.recent_signals : [])
const shSummary = computed(() => shareholderData.value.summary || {})
const shHolderNumbers = computed(() => Array.isArray(shareholderData.value.holder_numbers) ? shareholderData.value.holder_numbers : [])
const shHkHold = computed(() => Array.isArray(shareholderData.value.hk_hold) ? shareholderData.value.hk_hold : [])
const shHolderTrades = computed(() => Array.isArray(shareholderData.value.holder_trades) ? shareholderData.value.holder_trades : [])
const shShareFloats = computed(() => Array.isArray(shareholderData.value.share_floats) ? shareholderData.value.share_floats : [])
const shRepurchases = computed(() => Array.isArray(shareholderData.value.repurchases) ? shareholderData.value.repurchases : [])
const shTop10Change = computed(() => shareholderData.value.top10_float_change || {})
const shIntlNew = computed(() => Array.isArray(shTop10Change.value.intl_new) ? shTop10Change.value.intl_new : [])
const shIntlChanges = computed(() => {
  if (Array.isArray(shTop10Change.value.intl_changes)) {
    return shTop10Change.value.intl_changes.filter((row) => row?.change_type !== 'unchanged')
  }
  return shIntlNew.value.map((row) => ({
    norm_key: row.norm_key,
    norm_label: row.norm_label,
    holder_name: row.holder_name,
    change_type: 'new',
    current: row,
    previous: null,
    hold_amount_chg: null,
    hold_ratio_chg: null,
    hold_ratio_rel_chg_pct: null,
  }))
})
const shHksc = computed(() => shTop10Change.value.hksc || {})
const valuationStatus = computed(() => dataStatus.value?.sections?.valuation || valuationData.value.data_status || {})
const valuationDataStatusFound = computed(() => Boolean(valuationStatus.value.found || valuationData.value?.data_status?.found))
const valuationMarket = computed(() => valuationData.value.market_multiples || {})
const valuationCurrentMultiples = computed(() => valuationMarket.value.current || {})
const valuationPercentiles = computed(() => valuationMarket.value.percentiles || {})
const valuationDcf = computed(() => valuationData.value.dcf || {})
const valuationDcfScenarios = computed(() => Array.isArray(valuationDcf.value.scenarios) ? valuationDcf.value.scenarios : [])
const valuationDcfSensitivity = computed(() => valuationDcf.value.sensitivity || {})
const valuationDcfSensitivityVariables = computed(() => Array.isArray(valuationDcfSensitivity.value.variables) ? valuationDcfSensitivity.value.variables : [])
const valuationBaseScenario = computed(() => valuationDcfScenarios.value.find((row) => row.name === 'base') || valuationDcfScenarios.value[0] || {})
const valuationDdm = computed(() => valuationData.value.ddm || {})
const valuationDdmScenarios = computed(() => Array.isArray(valuationDdm.value.scenarios) ? valuationDdm.value.scenarios : [])
const valuationDdmAnnualRows = computed(() => Array.isArray(valuationDdm.value.annual_dividends) ? valuationDdm.value.annual_dividends : [])
const valuationDdmDividendQuality = computed(() => valuationDdm.value.dividend_quality || {})
const valuationDdmBaseScenario = computed(() => valuationDdmScenarios.value.find((row) => row.name === 'base') || {})
const valuationDdmKeBreakdownSummary = computed(() => {
  const kb = valuationDdmBaseScenario.value.ke_breakdown
  if (!kb || typeof kb !== 'object') return ''
  const rf = Number(kb.risk_free)
  const erp = Number(kb.equity_risk_premium)
  const ra = Number(kb.risk_adjustment)
  const fk = Number(kb.final_ke)
  if (![rf, erp, ra, fk].every((x) => Number.isFinite(x))) return ''
  return `中性档股权成本构成：无风险 ${(rf * 100).toFixed(2)}% + ERP ${(erp * 100).toFixed(2)}% + 风险调整 ${(ra * 100).toFixed(2)}% → ke ${(fk * 100).toFixed(2)}%（不低于中性档 WACC）。`
})
const valuationDcfNetDebtNote = computed(() => {
  const adj = valuationDcf.value.net_debt_adjustment
  if (!adj || valuationDcf.value.status !== 'ok') return ''
  if (adj.skipped_financial_sector) {
    return adj.reason || '金融行业：未扣净债务，表内「股权价值」等同于企业价值 EV，仅作同口径参考。'
  }
  if (adj.status === 'missing') {
    return adj.reason || '缺少资产负债表，净债务与少数股东权益按 0 处理。'
  }
  const nd = adj.net_debt_wan
  const mi = adj.minority_interest_wan
  const parts = []
  if (nd != null && Number.isFinite(Number(nd))) parts.push(`净债务约 ${fmtAmount(nd)}`)
  if (mi != null && Number.isFinite(Number(mi))) parts.push(`少数股东权益约 ${fmtAmount(mi)}`)
  if (!parts.length) return ''
  return `各情景股权价值 = 企业价值 EV − ${parts.join(' − ')}。`
})
const valuationDcfPerShareNote = computed(() => {
  const ps = valuationDcf.value.per_share
  if (!ps || ps.status !== 'missing_inputs' || !ps.reason) return ''
  return ps.reason
})
/** 后端成功推算 implied 万股时展示数据来源，便于与行情侧核对 */
const valuationDcfSharesBasisNote = computed(() => {
  const ps = valuationDcf.value.per_share
  if (!ps || ps.status !== 'ok' || !ps.shares_basis) return ''
  const sw = ps.shares_implied_wan
  const tail =
    sw != null && Number.isFinite(Number(sw))
      ? ` 推算股本约 ${Number(sw).toFixed(2)} 万股（市值÷价）。`
      : ''
  return `股本推算依据：${ps.shares_basis}。${tail}`
})
const valuationDcfFairValueGapNote = computed(() => {
  const ps = valuationDcf.value.per_share
  if (!ps || ps.status !== 'ok' || valuationDcf.value.status !== 'ok') return ''
  const base = valuationDcfScenarios.value.find((row) => row.name === 'base') || {}
  const ev = base.enterprise_value_wan
  const fv = base.fair_value_per_share
  if (fv != null && Number.isFinite(Number(fv))) return ''
  if (ev == null && (base.wacc != null && base.terminal_growth != null) && base.wacc <= base.terminal_growth) {
    return '中性档 WACC 不高于永续增长，永续价值未闭合，企业价值与每股价值无法给出数值（非数据缺失）。'
  }
  if (ev == null) return '中性档企业价值未算出（例如折现参数导致永续项无效），每股价值显示为「-」。'
  return ''
})
const valuationRelative = computed(() => valuationData.value.relative_valuation || {})
const valuationSuitability = computed(() => valuationData.value.model_suitability || {})
const valuationSuitabilityReasons = computed(() => Array.isArray(valuationSuitability.value.reasons) ? valuationSuitability.value.reasons : [])
const valuationApplicability = computed(() => valuationSuitability.value.model_applicability || {})
const valuationIsFinancial = computed(() => {
  const tags = valuationSuitability.value.signals?.industry_tags
  return Array.isArray(tags) && tags.includes('financial')
})
const valuationConfidence = computed(() => valuationData.value.valuation_confidence || {})
const valuationConfidenceLabel = computed(() => ({
  high: '高',
  medium: '中',
  low: '低',
})[valuationConfidence.value.level] || '待判断')
const valuationValueScore = computed(() => valuationData.value.value_score_link?.value_score)
const valuationModelLabel = computed(() => ({
  dcf: 'DCF 现金流折现',
  relative_valuation: '相对估值',
  pb_roe_or_ddm: 'PB-ROE / DDM',
  ddm: 'DDM 分红折现',
  tech_ps: '科技 PS 框架',
})[valuationSuitability.value.recommended_model] || valuationSuitability.value.recommended_model || '-')
const valuationApplicabilityItems = computed(() => {
  const modelLabels = {
    dcf: 'DCF 现金流折现',
    relative_valuation: '相对估值',
    ddm: 'DDM 分红折现',
    tech_ps: '科技 PS 框架',
  }
  const statusLabels = {
    primary: '主模型',
    secondary: '辅助',
    not_recommended: '不推荐',
    not_applicable: '不适用',
  }
  return ['dcf', 'relative_valuation', 'ddm', 'tech_ps']
    .map((key) => {
      const item = valuationApplicability.value?.[key] || {}
      const reasons = Array.isArray(item.reasons) ? item.reasons : []
      return {
        key,
        label: modelLabels[key] || key,
        statusLabel: statusLabels[item.status] || item.status || '-',
        reason: reasons[0] || '-',
      }
    })
    .filter((item) => item.statusLabel !== '-')
})
const valuationConclusionMetrics = computed(() => [
  { label: '当前价格', value: fmtNumber(latestPrice.value) },
  { label: '中性每股价值', value: valuationIsFinancial.value ? '不适用' : fmtNumber(valuationBaseScenario.value.fair_value_per_share) },
  { label: '安全边际', value: valuationIsFinancial.value ? '不适用' : fmtNumber(valuationBaseScenario.value.safety_margin_pct, 2, '%') },
  { label: '数据可信度', value: valuationConfidence.value.score != null ? `${valuationConfidenceLabel.value} / ${fmtNumber(valuationConfidence.value.score, 0)}` : '-' },
  { label: '相对估值', value: valuationRelativeLabel(valuationRelative.value.verdict) },
  { label: 'PE TTM', value: fmtNumber(valuationCurrentMultiples.value.pe_ttm) },
  { label: 'PB', value: fmtNumber(valuationCurrentMultiples.value.pb) },
])
const valuationMultipleMetrics = computed(() => [
  { label: 'PE TTM', value: valuationMultipleWithPercentile('pe_ttm') },
  { label: 'PB', value: valuationMultipleWithPercentile('pb') },
  { label: 'PS TTM', value: valuationMultipleWithPercentile('ps_ttm') },
  { label: '股息率 TTM', value: valuationMultipleWithPercentile('dv_ttm', '%') },
  { label: 'PEG', value: fmtNumber(valuationRelative.value.peg) },
  { label: '历史样本', value: valuationMarket.value.history_sample_count ? `${valuationMarket.value.history_sample_count} 条` : '-' },
])

const quoteKlineTfOptions = [
  { value: '1d', label: '日 K', title: '日线 K 线', shortLabel: '日线' },
  { value: '1w', label: '周 K', title: '周线 K 线', shortLabel: '周线' },
  { value: '1m', label: '月 K', title: '月线 K 线', shortLabel: '月线' },
]
const quoteKlineTfMeta = computed(
  () => quoteKlineTfOptions.find((item) => item.value === quoteKlineTf.value) || quoteKlineTfOptions[0],
)
const quoteKlineTitle = computed(() => quoteKlineTfMeta.value.title)
const quoteKlineShortLabel = computed(() => quoteKlineTfMeta.value.shortLabel)
const quoteKlineRows = computed(() => {
  if (quoteKlineTf.value === '1w') return quoteWeeklyRows.value
  if (quoteKlineTf.value === '1m') return quoteMonthlyRows.value
  return quoteDailyRows.value
})
const quoteKlineIsLoading = computed(() => quoteKlineTf.value === '1d'
  ? Boolean(sectionLoading.value.quote)
  : Boolean(quoteKlineLoading.value[quoteKlineTf.value]))
const activeMoneyFlowHistory = computed(() => {
  if (quoteKlineTf.value === '1d') return moneyFlowHistory.value
  const rows = moneyFlowHistoryByTf.value?.[quoteKlineTf.value]
  return Array.isArray(rows) ? rows : []
})
const moneyFlowIsLoading = computed(() => quoteKlineTf.value === '1d'
  ? Boolean(sectionLoading.value.quote)
  : Boolean(moneyFlowLoading.value[quoteKlineTf.value] || quoteKlineLoading.value[quoteKlineTf.value]))

const stockName = computed(() => stock.value.name || stock.value.stock_name || '')
const shenwan = computed(() => stock.value.shenwan_industry || {})
const stockIndustry = computed(() => shenwan.value.l1_name || stock.value.industry || '')
const stockIndustryL2 = computed(() => shenwan.value.l2_name || '')
const stockIndustryL3 = computed(() => shenwan.value.l3_name || '')
const indexCodes = computed(() => Array.isArray(score.value.index_codes) ? score.value.index_codes : [])

const latestPrice = computed(() => quote.value.close ?? quote.value.price ?? quote.value.latest_price)
const latestPctChange = computed(() => {
  const normalizedPct = toNumber(quote.value.display_pct_chg)
  if (normalizedPct != null) return normalizedPct

  const explicitPct = firstFinite([
    quote.value.pct_chg,
    quote.value.pct_change,
    quote.value.change_percent,
  ])
  if (explicitPct != null && Math.abs(explicitPct) <= 30) {
    return explicitPct
  }

  const close = toNumber(latestPrice.value)
  const previousClose = firstFinite([
    quote.value.pre_close,
    quote.value.prev_close,
    quote.value.previous_close,
    quote.value.yesterday_close,
    quote.value.last_close,
  ])
  if (close != null && previousClose > 0) {
    return ((close - previousClose) / previousClose) * 100
  }

  return null
})
const priceChangeTitle = computed(() => {
  const source = quote.value.display_pct_chg_source
  const preClose = toNumber(quote.value.display_pre_close)
  if (source && source !== 'unavailable') {
    const preText = preClose != null ? `，昨收 ${fmtNumber(preClose)}` : ''
    return `当日涨跌幅：后端已按“最新价相对昨收价”归一计算${preText}。来源：${source}。`
  }
  return '当日涨跌幅：优先使用后端归一字段 display_pct_chg；缺失时才使用行情 pct_chg / pct_change 或用昨收价计算。'
})
const changeClass = computed(() => {
  const n = Number(latestPctChange.value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
})

const compositeScore = computed(() => score.value.composite_score || {})
const currentCompositeScore = computed(() => {
  if (compositeScore.value && typeof compositeScore.value === 'object') {
    if (compositeScore.value.balanced != null) return compositeScore.value.balanced
    const firstKey = Object.keys(compositeScore.value).find((key) => compositeScore.value[key] != null)
    return firstKey ? compositeScore.value[firstKey] : null
  }
  return compositeScore.value
})
const ratingText = computed(() => {
  const n = Number(currentCompositeScore.value)
  if (n >= 80) return '强烈关注'
  if (n >= 70) return '推荐关注'
  if (n >= 60) return '谨慎观察'
  if (n >= 50) return '暂不推荐'
  return Number.isFinite(n) ? '回避' : '-'
})

const scoreItems = computed(() => {
  const details = score.value.details || {}
  return SCORE_DEFS.map((def) => ({
    ...def,
    score: score.value[`${def.key}_score`],
    details: details[`${def.key}_details`] || score.value[`${def.key}_details`] || {},
  })).filter((item) => item.score != null || Object.keys(item.details || {}).length > 0)
})

const statusItems = computed(() => [
  { label: '行情', value: dataStatus.value.quote_found ? '已覆盖' : '未覆盖' },
  { label: '评分', value: dataStatus.value.score_found ? '已覆盖' : '未覆盖' },
  { label: 'AI分析', value: dataStatus.value.deep_analysis_found ? '已覆盖' : '未覆盖' },
])
const sectionStatusItems = computed(() => {
  const sections = dataStatus.value.sections || {}
  const defs = [
    { key: 'quote', label: '行情资金', panel: 'quote' },
    { key: 'nine_turn', label: '神奇九转', panel: 'nine-turn' },
    { key: 'scores', label: '量化评分', panel: 'scores' },
    { key: 'financials', label: '财务业绩', panel: 'financial' },
    { key: 'valuation', label: '估值模型', panel: 'valuation' },
    { key: 'shareholders', label: '股东筹码', panel: 'shareholders' },
    { key: 'signals', label: 'SWOT', panel: 'swot' },
    { key: 'ai', label: 'AI 分析', panel: 'analysis' },
    { key: 'trading', label: '交易状态', panel: 'analysis' },
  ]
  return defs.map((def) => {
    const status = sections[def.key] || {}
    const fallbackFound = {
      quote: dataStatus.value.quote_found,
      nine_turn: Boolean(nineTurnSignals.value.length),
      scores: dataStatus.value.score_found,
      financials: Boolean(incomeRows.value.length || indicatorRows.value.length),
      valuation: Boolean(valuationData.value?.data_status?.found),
      shareholders: Boolean(shHolderNumbers.value.length || shHkHold.value.length),
      signals: Boolean(swotPayload.value?.data_status?.found),
      ai: dataStatus.value.deep_analysis_found,
      trading: Boolean(watchlistContext.value.in_watchlist || tradingPositions.value.length || recentTradeSignals.value.length),
    }[def.key]
    return {
      ...def,
      found: status.found ?? fallbackFound,
      stale: Boolean(status.stale),
      asOf: status.as_of || '',
      title: `${def.label}：${status.expected_freshness || '暂无新鲜度说明'}${status.source ? `；来源 ${status.source}` : ''}`,
    }
  })
})

const analysisObj = computed(() => deepAnalysis.value?.analysis || {})
const analysisSummary = computed(() => {
  const a = analysisObj.value
  return a.final_conclusion
    || a.investment_advice
    || a.long_term_forecast
    || a.mid_term_forecast
    || '暂无结构化摘要。'
})
const analysisPoints = computed(() => {
  const a = analysisObj.value
  const points = a.key_points || a.consensus_points || a.risk_factors || []
  if (Array.isArray(points)) return points.slice(0, 5)
  if (typeof points === 'string') return [points]
  return []
})

const financialChartData = computed(() => {
  const incomeByPeriod = new Map()
  for (const row of incomeRows.value) {
    const period = row.end_date || row.period || row.report_date
    if (period) incomeByPeriod.set(period, row)
  }
  const rows = indicatorRows.value.map((indicator) => {
    const period = indicator.end_date || indicator.period || indicator.report_date
    const income = incomeByPeriod.get(period) || {}
    const quarter = reportQuarter(period)
    return {
      period,
      year: reportYear(period),
      quarter,
      periodLabel: quarter ? `${reportYear(period)}Q${quarter}` : period,
      cumulative_revenue: toNumber(income.revenue || income.total_revenue || indicator.revenue),
      cumulative_net_profit: toNumber(income.n_income_attr_p || income.net_profit || indicator.net_profit),
      revenue: toNumber(income.revenue || income.total_revenue || indicator.revenue),
      net_profit: toNumber(income.n_income_attr_p || income.net_profit || indicator.net_profit),
      tr_yoy: toNumber(indicator.tr_yoy || indicator.or_yoy || indicator.revenue_yoy),
      revenue_yoy: toNumber(indicator.tr_yoy || indicator.or_yoy || indicator.revenue_yoy),
      netprofit_yoy: toNumber(indicator.netprofit_yoy || indicator.profit_to_gr),
      dt_netprofit_yoy: toNumber(indicator.dt_netprofit_yoy),
      grossprofit_margin: toNumber(indicator.grossprofit_margin),
      gross_margin: toNumber(indicator.grossprofit_margin),
      roe: toNumber(indicator.roe || indicator.roe_dt),
    }
  }).filter((row) => row.period && row.year && row.quarter)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))

  const byYearQuarter = new Map(rows.map((row) => [`${row.year}-${row.quarter}`, row]))
  const normalized = rows
    .filter((row) => financialMode.value === 'annual' ? row.quarter === 4 : true)
    .map((row) => {
      if (financialMode.value === 'annual') {
        return {
          ...row,
          period: String(row.year),
          tr_yoy: row.revenue_yoy,
        }
      }
      const previousQuarter = row.quarter > 1 ? byYearQuarter.get(`${row.year}-${row.quarter - 1}`) : null
      const previousYearSameQuarter = byYearQuarter.get(`${row.year - 1}-${row.quarter}`)
      const revenue = row.quarter === 1
        ? row.cumulative_revenue
        : diffOrNull(row.cumulative_revenue, previousQuarter?.cumulative_revenue)
      const netProfit = row.quarter === 1
        ? row.cumulative_net_profit
        : diffOrNull(row.cumulative_net_profit, previousQuarter?.cumulative_net_profit)
      const priorRevenue = previousYearSameQuarter
        ? (row.quarter === 1
          ? previousYearSameQuarter.cumulative_revenue
          : diffOrNull(
            previousYearSameQuarter.cumulative_revenue,
            byYearQuarter.get(`${row.year - 1}-${row.quarter - 1}`)?.cumulative_revenue,
          ))
        : null
      const priorNetProfit = previousYearSameQuarter
        ? (row.quarter === 1
          ? previousYearSameQuarter.cumulative_net_profit
          : diffOrNull(
            previousYearSameQuarter.cumulative_net_profit,
            byYearQuarter.get(`${row.year - 1}-${row.quarter - 1}`)?.cumulative_net_profit,
          ))
        : null
      return {
        ...row,
        period: row.periodLabel,
        revenue,
        net_profit: netProfit,
        tr_yoy: calcYoy(revenue, priorRevenue),
        revenue_yoy: calcYoy(revenue, priorRevenue),
        netprofit_yoy: calcYoy(netProfit, priorNetProfit),
      }
    })
    .filter((row) => row.revenue != null || row.net_profit != null || row.tr_yoy != null || row.netprofit_yoy != null)

  return normalized.slice(-8)
})

const financialModeLabel = computed(() => financialMode.value === 'annual' ? '年度对比' : '单季对比')

const financialMetrics = computed(() => {
  const latest = indicatorRows.value[0] || {}
  const latestBalance = balanceRows.value[0] || {}
  const latestCashflow = cashflowRows.value[0] || {}
  return [
    { label: 'ROE', value: fmtNumber(latest.roe || latest.roe_dt, 2, '%') },
    { label: '毛利率', value: fmtNumber(latest.grossprofit_margin, 2, '%') },
    { label: '净利同比', value: fmtNumber(latest.netprofit_yoy || latest.profit_to_gr, 2, '%') },
    { label: '营收同比', value: fmtNumber(latest.tr_yoy || latest.or_yoy, 2, '%') },
    { label: 'PE TTM', value: fmtNumber((indicatorRows.value[0] || {}).pe_ttm || quote.value.pe_ttm) },
    { label: 'PB', value: fmtNumber((indicatorRows.value[0] || {}).pb || quote.value.pb) },
    { label: '总资产', value: fmtStatementAmount(latestBalance.total_assets) },
    { label: '经营现金流', value: fmtStatementAmount(latestCashflow.n_cashflow_act) },
  ]
})

const financialMetricsPeriodText = computed(() => {
  const latest = indicatorRows.value[0] || {}
  const latestBalance = balanceRows.value[0] || {}
  const latestCashflow = cashflowRows.value[0] || {}
  const parts = [
    ['指标', latest.end_date || latest.period || latest.report_date],
    ['资产负债', latestBalance.end_date || latestBalance.period || latestBalance.report_date],
    ['现金流', latestCashflow.end_date || latestCashflow.period || latestCashflow.report_date],
  ].filter(([, value]) => value)
  if (!parts.length) return '暂无报告期'
  return parts.map(([label, value]) => `${label} ${value}`).join(' · ')
})

const incomeReportSections = computed(() => groupStatementRowsByReportType(incomeRows.value))
const cashflowReportSections = computed(() => groupStatementRowsByReportType(cashflowRows.value))

function groupStatementRowsByReportType(rows) {
  const grouped = new Map()
  for (const row of rows || []) {
    const key = String(row.report_type ?? row.report_type_name ?? 'unknown')
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        label: statementReportTypeLabel(row.report_type ?? row.report_type_name),
        rows: [],
      })
    }
    grouped.get(key).rows.push(row)
  }
  const order = { '1': 1, '2': 2, unknown: 99 }
  return [...grouped.values()].sort((a, b) => (order[a.key] || 50) - (order[b.key] || 50))
}

const financialQualityCards = computed(() => {
  const rows = financialChartData.value
  const latest = rows[rows.length - 1] || {}
  const previous = rows[rows.length - 2] || {}
  const latestIndicator = indicatorRows.value[0] || {}
  const latestBalance = balanceRows.value[0] || {}
  const latestCashflow = cashflowRows.value[0] || {}
  const latestIncome = incomeRows.value[0] || {}

  const cards = []
  if (latest.tr_yoy != null || latest.netprofit_yoy != null) {
    const revenueYoy = toNumber(latest.tr_yoy)
    const profitYoy = toNumber(latest.netprofit_yoy)
    const improving = [revenueYoy, profitYoy].filter((v) => v != null && v > 0).length
    cards.push({
      key: 'growth',
      label: '增长质量',
      level: improving >= 2 ? 'good' : improving === 1 ? 'neutral' : 'warn',
      title: improving >= 2 ? '收入利润同步增长' : improving === 1 ? '增长结构分化' : '增长承压',
      detail: `营收同比 ${fmtPctPlain(revenueYoy)}，净利同比 ${fmtPctPlain(profitYoy)}。`,
    })
  }

  const grossMargin = toNumber(latest.grossprofit_margin ?? latest.gross_margin ?? latestIndicator.grossprofit_margin)
  const roe = toNumber(latest.roe ?? latestIndicator.roe ?? latestIndicator.roe_dt)
  if (grossMargin != null || roe != null) {
    const stableMargin = previous.grossprofit_margin == null || grossMargin == null
      ? true
      : grossMargin >= previous.grossprofit_margin - 1
    const strongProfitability = (roe != null && roe >= 10) || (grossMargin != null && grossMargin >= 25)
    cards.push({
      key: 'profitability',
      label: '盈利质量',
      level: strongProfitability && stableMargin ? 'good' : stableMargin ? 'neutral' : 'warn',
      title: strongProfitability && stableMargin ? '盈利能力较稳' : stableMargin ? '盈利能力一般' : '毛利率走弱',
      detail: `毛利率 ${fmtPctPlain(grossMargin)}，ROE ${fmtPctPlain(roe)}。`,
    })
  }

  const operatingCashflow = toNumber(latestCashflow.n_cashflow_act)
  const netProfit = toNumber(latestIncome.n_income_attr_p ?? latestIncome.n_income ?? latest.cumulative_net_profit)
  if (operatingCashflow != null || netProfit != null) {
    const ratio = netProfit ? operatingCashflow / Math.abs(netProfit) : null
    cards.push({
      key: 'cashflow',
      label: '现金流质量',
      level: ratio == null ? 'neutral' : ratio >= 0.8 ? 'good' : ratio >= 0 ? 'neutral' : 'warn',
      title: ratio == null ? '现金流待观察' : ratio >= 0.8 ? '现金流匹配利润' : ratio >= 0 ? '现金流弱于利润' : '经营现金流为负',
      detail: `经营现金流 ${fmtStatementAmount(operatingCashflow)}，归母净利 ${fmtStatementAmount(netProfit)}。`,
    })
  }

  const debtToAssets = firstFinite([
    latestIndicator.debt_to_assets,
    latestBalance.debt_to_assets,
    ratioPct(latestBalance.total_liab, latestBalance.total_assets),
  ])
  if (debtToAssets != null) {
    cards.push({
      key: 'leverage',
      label: '资产负债',
      level: debtToAssets <= 45 ? 'good' : debtToAssets <= 65 ? 'neutral' : 'warn',
      title: debtToAssets <= 45 ? '杠杆水平较低' : debtToAssets <= 65 ? '杠杆水平适中' : '杠杆压力偏高',
      detail: `资产负债率 ${fmtPctPlain(debtToAssets)}，总资产 ${fmtStatementAmount(latestBalance.total_assets)}。`,
    })
  }

  const receivablesRatio = ratioPct(sumFinite(latestBalance.accounts_receiv, latestBalance.notes_receiv), latestBalance.total_assets)
  const inventoryRatio = ratioPct(latestBalance.inventories, latestBalance.total_assets)
  if (receivablesRatio != null || inventoryRatio != null) {
    const riskHigh = (receivablesRatio != null && receivablesRatio > 20) || (inventoryRatio != null && inventoryRatio > 20)
    cards.push({
      key: 'risk',
      label: '风险项',
      level: riskHigh ? 'warn' : 'good',
      title: riskHigh ? '营运资产占比较高' : '营运资产压力不高',
      detail: `应收/票据占资产 ${fmtPctPlain(receivablesRatio)}，存货占资产 ${fmtPctPlain(inventoryRatio)}。`,
    })
  }

  return cards
})

const earningsEvents = computed(() => {
  const rows = []
  const source = earnings.value || {}
  for (const row of source.forecast || []) rows.push({ type: '业绩预告', date: row.ann_date || row.end_date, title: row.type || row.summary || '业绩预告', raw: row })
  for (const row of source.express || []) rows.push({ type: '业绩快报', date: row.ann_date || row.end_date, title: row.revenue ? `营收 ${fmtStatementAmount(row.revenue)}` : '业绩快报', raw: row })
  for (const row of source.disclosure || []) rows.push({ type: '披露日历', date: row.ann_date || row.pre_date, title: row.pre_date ? `预计披露 ${row.pre_date}` : '披露日历', raw: row })
  return rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8)
})

const reportRcRows = computed(() => {
  const rows = Array.isArray(earnings.value?.report_rc) ? earnings.value.report_rc : []
  return [...rows].sort((a, b) => String(b.report_date || b.create_time || '').localeCompare(String(a.report_date || a.create_time || '')))
})

const quoteMetrics = computed(() => [
  { label: '换手率', value: fmtNumber(latestDailyBasic.value.turnover_rate, 2, '%') },
  { label: '量比', value: fmtNumber(latestDailyBasic.value.volume_ratio) },
  { label: 'PE TTM', value: fmtNumber(latestDailyBasic.value.pe_ttm ?? latestDailyBasic.value.pe) },
  { label: 'PB', value: fmtNumber(latestDailyBasic.value.pb) },
  { label: '股息率 TTM', value: fmtNumber(latestDailyBasic.value.dv_ttm, 2, '%') },
  { label: '流通市值', value: fmtAmount(latestDailyBasic.value.circ_mv) },
  { label: '总市值', value: fmtAmount(latestDailyBasic.value.total_mv) },
  { label: '日线样本', value: quoteDailyRows.value.length ? `${quoteDailyRows.value.length} 条` : '-' },
])

const moneyFlowMetrics = computed(() => {
  const mf = latestMoneyFlow.value || {}
  const mainNet = moneyFlowSummary.value.main_net_today ?? mf.net_mf_amount
  return [
    { label: '主力净额', value: fmtWanAmount(mainNet), className: valueClass(mainNet) },
    { label: '超大单买入', value: fmtAmount(mf.buy_elg_amount) },
    { label: '超大单卖出', value: fmtAmount(mf.sell_elg_amount) },
    { label: '大单买入', value: fmtAmount(mf.buy_lg_amount) },
    { label: '大单卖出', value: fmtAmount(mf.sell_lg_amount) },
    { label: '中单净额', value: fmtAmount(toNumber(mf.buy_md_amount) - toNumber(mf.sell_md_amount)) },
  ]
})
const entryRiskSeverity = computed(() => entryRisk.value?.severity || 'none')
const entryRiskSeverityLabel = computed(() => ({
  high: '高风险',
  medium: '中风险',
  low: '低风险',
  none: '正常',
})[entryRiskSeverity.value] || '正常')
const entryRiskNarrativeRows = computed(() => {
  const metrics = entryRiskMetrics.value || {}
  return [
    {
      label: '高位状态',
      value: `hipos120 ${fmtNumber(metrics.hipos120, 3)}，距离120日高点 ${fmtNumber(metrics.distance_to_120d_high_pct, 1, '%')}`,
    },
    {
      label: '主力20日净流',
      value: `mainflow20 ${fmtPctFromRatio(metrics.mainflow20)}`,
      className: valueClass(metrics.mainflow20),
    },
    {
      label: '资金流规模',
      value: `${fmtWanAmount(metrics.main_net_20d)} / 成交额 ${fmtWanAmount(metrics.amount_20d_wan)}`,
      className: valueClass(metrics.main_net_20d),
    },
    {
      label: '高位派发',
      value: `派发风险值 ${fmtNumber(metrics.distrib, 4)}，${entryRiskSeverityLabel.value}`,
      className: entryRiskSeverity.value === 'none' ? '' : `entry-risk-text-${entryRiskSeverity.value}`,
    },
  ]
})
const overviewQuoteMetrics = computed(() => [
  { label: '换手率', value: fmtNumber(latestDailyBasic.value.turnover_rate, 2, '%') },
  { label: 'PE TTM', value: fmtNumber(latestDailyBasic.value.pe_ttm ?? latestDailyBasic.value.pe) },
  { label: 'PB', value: fmtNumber(latestDailyBasic.value.pb) },
  { label: '主力净额', value: fmtWanAmount(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount), className: valueClass(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount) },
])
const overviewQuoteDataAvailable = computed(() => Boolean(
  quoteDailyRows.value.length
  || latestMoneyFlow.value
  || Object.keys(latestDailyBasic.value).length,
))

function valuationMultipleWithPercentile(field, suffix = '') {
  const value = fmtNumber(valuationCurrentMultiples.value?.[field], 2, suffix)
  const pct = valuationPercentiles.value?.[field]
  if (pct == null) return value
  return `${value} / P${Number(pct).toFixed(0)}`
}
</script>

<style scoped>
.stock-workbench {
  color: #e2e8f0;
  padding: 6px;
}

.empty-state {
  background: rgba(15, 23, 42, 0.76);
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 18px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
  padding: 44px;
  text-align: center;
}

.empty-state p {
  color: #94a3b8;
}

.workbench-tabs {
  margin-bottom: 14px;
}
</style>
