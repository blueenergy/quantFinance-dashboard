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
import { computed, defineAsyncComponent, ref } from 'vue'
import WorkbenchHero from '../components/stock/WorkbenchHero.vue'
import WorkbenchSearchBar from '../components/stock/WorkbenchSearchBar.vue'
import { useStockWorkbench } from '../composables/useStockWorkbench'
import { useWorkbenchDeepAnalysis } from '../composables/useWorkbenchDeepAnalysis'
import { useWorkbenchFinancials } from '../composables/useWorkbenchFinancials'
import { useWorkbenchQuote } from '../composables/useWorkbenchQuote'
import { useWorkbenchShareholders } from '../composables/useWorkbenchShareholders'
import { useWorkbenchSwotSignals } from '../composables/useWorkbenchSwotSignals'
import { useWorkbenchValuation } from '../composables/useWorkbenchValuation'
import {
  firstFinite,
  fmtNumber,
  toNumber,
} from '../utils/workbenchFormat'

const StockWorkbenchSwotPanel = defineAsyncComponent(() => import('../components/stock/StockWorkbenchSwotPanel.vue'))
const WorkbenchAnalysisPanel = defineAsyncComponent(() => import('../components/stock/WorkbenchAnalysisPanel.vue'))
const WorkbenchFinancialPanel = defineAsyncComponent(() => import('../components/stock/WorkbenchFinancialPanel.vue'))
const WorkbenchNineTurnPanel = defineAsyncComponent(() => import('../components/stock/WorkbenchNineTurnPanel.vue'))
const WorkbenchOverviewPanel = defineAsyncComponent(() => import('../components/stock/WorkbenchOverviewPanel.vue'))
const WorkbenchQuotePanel = defineAsyncComponent(() => import('../components/stock/WorkbenchQuotePanel.vue'))
const WorkbenchScoresPanel = defineAsyncComponent(() => import('../components/stock/WorkbenchScoresPanel.vue'))
const WorkbenchShareholdersPanel = defineAsyncComponent(() => import('../components/stock/WorkbenchShareholdersPanel.vue'))
const WorkbenchValuationPanel = defineAsyncComponent(() => import('../components/stock/WorkbenchValuationPanel.vue'))

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

const score = computed(() => payload.value?.score || {})
const stock = computed(() => payload.value?.stock || {})
const quote = computed(() => payload.value?.quote || {})
const dataStatus = computed(() => payload.value?.data_status || {})
const deepAnalysis = computed(() => payload.value?.deep_analysis || null)
const stockName = computed(() => stock.value.name || stock.value.stock_name || '')
const shenwan = computed(() => stock.value.shenwan_industry || {})
const stockIndustry = computed(() => shenwan.value.l1_name || stock.value.industry || '')
const stockIndustryL2 = computed(() => shenwan.value.l2_name || '')
const stockIndustryL3 = computed(() => shenwan.value.l3_name || '')
const indexCodes = computed(() => Array.isArray(score.value.index_codes) ? score.value.index_codes : [])
const latestPrice = computed(() => quote.value.close ?? quote.value.price ?? quote.value.latest_price)

const {
  latestMoneyFlow,
  moneyFlowSummary,
  entryRisk,
  quoteSectionDate,
  nineTurnDailyRows,
  nineTurnSignals,
  latestNineTurnSignal,
  nineTurnStatus,
  nineTurnMarkers,
  quoteKlineTfOptions,
  quoteKlineTitle,
  quoteKlineShortLabel,
  quoteKlineRows,
  quoteKlineIsLoading,
  activeMoneyFlowHistory,
  moneyFlowIsLoading,
  quoteMetrics,
  moneyFlowMetrics,
  entryRiskSeverity,
  entryRiskSeverityLabel,
  entryRiskNarrativeRows,
  overviewQuoteMetrics,
  overviewQuoteDataAvailable,
} = useWorkbenchQuote({
  payload,
  dataStatus,
  quoteKlineTf,
  quoteKlineLoading,
  moneyFlowLoading,
  sectionLoading,
})

const {
  financialMode,
  financialModeLabel,
  financialChartData,
  financialMetrics,
  financialMetricsPeriodText,
  incomeReportSections,
  cashflowReportSections,
  financialQualityCards,
  earningsEvents,
  reportRcRows,
} = useWorkbenchFinancials({
  incomeRows,
  indicatorRows,
  balanceRows,
  cashflowRows,
  earnings,
  quote,
})

const {
  valuationStatus,
  valuationDataStatusFound,
  valuationConclusionMetrics,
  valuationConfidence,
  valuationConfidenceLabel,
  valuationSuitability,
  valuationModelLabel,
  valuationValueScore,
  valuationApplicabilityItems,
  valuationSuitabilityReasons,
  valuationDdm,
  valuationDdmDividendQuality,
  valuationDdmScenarios,
  valuationDdmKeBreakdownSummary,
  valuationDdmAnnualRows,
  valuationIsFinancial,
  valuationDcf,
  valuationDcfNetDebtNote,
  valuationDcfPerShareNote,
  valuationDcfSharesBasisNote,
  valuationDcfFairValueGapNote,
  valuationDcfScenarios,
  valuationDcfSensitivityVariables,
  valuationMultipleMetrics,
} = useWorkbenchValuation({ valuationData, dataStatus, latestPrice })

const {
  shSummary,
  shHolderNumbers,
  shHkHold,
  shHolderTrades,
  shShareFloats,
  shRepurchases,
  shTop10Change,
  shIntlChanges,
  shHksc,
} = useWorkbenchShareholders({ shareholderData })

const analysisHistory = computed(() => Array.isArray(payload.value?.analysis_history) ? payload.value.analysis_history : [])
const evaluationSummary = computed(() => payload.value?.evaluation_summary || {})
const evaluationRows = computed(() => Array.isArray(evaluationSummary.value.latest_evaluations) ? evaluationSummary.value.latest_evaluations : [])
const evaluationByHistoryId = computed(() => Object.fromEntries(
  evaluationRows.value
    .filter((row) => row.history_id)
    .map((row) => [row.history_id, row]),
))
const scoreHistory = computed(() => Array.isArray(payload.value?.score_history) ? payload.value.score_history : [])
const swotPayload = computed(() => swotData.value || {})
const pendingSwotFinding = computed(() => {
  const nav = props.pendingNavigation
  if (!nav?.findingKey) return null
  return {
    findingKey: nav.findingKey,
    dimension: nav.dimension || 'strength',
  }
})
const watchlistContext = computed(() => tradingContext.value.watchlist || {})
const watchlistStrategies = computed(() => Array.isArray(tradingContext.value.watchlist_strategies) ? tradingContext.value.watchlist_strategies : [])
const tradingPositions = computed(() => Array.isArray(tradingContext.value.positions) ? tradingContext.value.positions : [])
const recentTradeSignals = computed(() => Array.isArray(tradingContext.value.recent_signals) ? tradingContext.value.recent_signals : [])

deepAnalysisApi = useWorkbenchDeepAnalysis({
  payload,
  stockSymbol,
  directSymbol,
  stockName,
  analysisHistory,
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

const latestPctChange = computed(() => {
  const normalizedPct = toNumber(quote.value.display_pct_chg)
  if (normalizedPct != null) return normalizedPct
  const explicitPct = firstFinite([
    quote.value.pct_chg,
    quote.value.pct_change,
    quote.value.change_percent,
  ])
  if (explicitPct != null && Math.abs(explicitPct) <= 30) return explicitPct
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
  const value = Number(latestPctChange.value)
  return value > 0 ? 'is-up' : value < 0 ? 'is-down' : ''
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
  const value = Number(currentCompositeScore.value)
  if (value >= 80) return '强烈关注'
  if (value >= 70) return '推荐关注'
  if (value >= 60) return '谨慎观察'
  if (value >= 50) return '暂不推荐'
  return Number.isFinite(value) ? '回避' : '-'
})
const scoreItems = computed(() => {
  const details = score.value.details || {}
  return SCORE_DEFS.map((definition) => ({
    ...definition,
    score: score.value[`${definition.key}_score`],
    details: details[`${definition.key}_details`] || score.value[`${definition.key}_details`] || {},
  })).filter((item) => item.score != null || Object.keys(item.details || {}).length > 0)
})
const statusItems = computed(() => [
  { label: '行情', value: dataStatus.value.quote_found ? '已覆盖' : '未覆盖' },
  { label: '评分', value: dataStatus.value.score_found ? '已覆盖' : '未覆盖' },
  { label: 'AI分析', value: dataStatus.value.deep_analysis_found ? '已覆盖' : '未覆盖' },
])
const sectionStatusItems = computed(() => {
  const sections = dataStatus.value.sections || {}
  const definitions = [
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
  return definitions.map((definition) => {
    const status = sections[definition.key] || {}
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
    }[definition.key]
    return {
      ...definition,
      found: status.found ?? fallbackFound,
      stale: Boolean(status.stale),
      asOf: status.as_of || '',
      title: `${definition.label}：${status.expected_freshness || '暂无新鲜度说明'}${status.source ? `；来源 ${status.source}` : ''}`,
    }
  })
})
const analysisObj = computed(() => deepAnalysis.value?.analysis || {})
const analysisSummary = computed(() => {
  const analysis = analysisObj.value
  return analysis.final_conclusion
    || analysis.investment_advice
    || analysis.long_term_forecast
    || analysis.mid_term_forecast
    || '暂无结构化摘要。'
})
const analysisPoints = computed(() => {
  const analysis = analysisObj.value
  const points = analysis.key_points || analysis.consensus_points || analysis.risk_factors || []
  if (Array.isArray(points)) return points.slice(0, 5)
  if (typeof points === 'string') return [points]
  return []
})
</script>

<style src="../assets/styles/stock-workbench.css"></style>
