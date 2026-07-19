import { computed, toValue } from 'vue'
import {
  fmtAmount,
  fmtNumber,
  fmtPctFromRatio,
  fmtWanAmount,
  toNumber,
  valueClass,
} from '../utils/workbenchFormat'

export function useWorkbenchQuote({
  payload,
  dataStatus,
  quoteKlineTf,
  quoteKlineLoading,
  moneyFlowLoading,
  sectionLoading,
}) {
  const payloadValue = () => toValue(payload) || {}
  const dataStatusValue = () => toValue(dataStatus) || {}
  const quoteKlineTfValue = () => toValue(quoteKlineTf) || '1d'
  const quoteKlineLoadingValue = () => toValue(quoteKlineLoading) || {}
  const moneyFlowLoadingValue = () => toValue(moneyFlowLoading) || {}
  const sectionLoadingValue = () => toValue(sectionLoading) || {}

  const quoteDailyRows = computed(() => Array.isArray(payloadValue().daily_quotes) ? payloadValue().daily_quotes : [])
  const quoteWeeklyRows = computed(() => Array.isArray(payloadValue().weekly_quotes) ? payloadValue().weekly_quotes : [])
  const quoteMonthlyRows = computed(() => Array.isArray(payloadValue().monthly_quotes) ? payloadValue().monthly_quotes : [])
  const latestDailyBasic = computed(() => payloadValue().daily_basic || {})
  const latestMoneyFlow = computed(() => payloadValue().money_flow || null)
  const moneyFlowHistory = computed(() => Array.isArray(payloadValue().money_flow_history) ? payloadValue().money_flow_history : [])
  const moneyFlowHistoryByTf = computed(() => payloadValue().money_flow_history_by_tf || {})
  const moneyFlowSummary = computed(() => payloadValue().money_flow_summary || {})
  const entryRisk = computed(() => payloadValue().entry_risk || {})
  const entryRiskMetrics = computed(() => entryRisk.value?.metrics || {})
  const quoteSectionDate = computed(() => (
    dataStatusValue()?.sections?.quote?.as_of
    || latestDailyBasic.value.trade_date
    || payloadValue().quote?.trade_date
    || ''
  ))
  const nineTurnDailyRows = computed(() => Array.isArray(payloadValue().nine_turn_daily_quotes) ? payloadValue().nine_turn_daily_quotes : [])
  const nineTurnSignals = computed(() => {
    const rows = Array.isArray(payloadValue().nine_turn_signals) ? payloadValue().nine_turn_signals : []
    return [...rows].sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
  })
  const latestNineTurnSignal = computed(() => payloadValue().latest_nine_turn_signal || nineTurnSignals.value[0] || null)
  const nineTurnStatus = computed(() => dataStatusValue()?.sections?.nine_turn || {})
  const nineTurnMarkers = computed(() => nineTurnSignals.value.map((signal) => ({
    trade_date: signal.trade_date,
    direction: signal.direction,
    label: signal.count || 9,
    grade: signal.grade,
    high: signal.high,
    low: signal.low,
  })))

  const quoteKlineTfOptions = [
    { value: '1d', label: '日 K', title: '日线 K 线', shortLabel: '日线' },
    { value: '1w', label: '周 K', title: '周线 K 线', shortLabel: '周线' },
    { value: '1m', label: '月 K', title: '月线 K 线', shortLabel: '月线' },
  ]
  const quoteKlineTfMeta = computed(
    () => quoteKlineTfOptions.find((item) => item.value === quoteKlineTfValue()) || quoteKlineTfOptions[0],
  )
  const quoteKlineTitle = computed(() => quoteKlineTfMeta.value.title)
  const quoteKlineShortLabel = computed(() => quoteKlineTfMeta.value.shortLabel)
  const quoteKlineRows = computed(() => {
    if (quoteKlineTfValue() === '1w') return quoteWeeklyRows.value
    if (quoteKlineTfValue() === '1m') return quoteMonthlyRows.value
    return quoteDailyRows.value
  })
  const quoteKlineIsLoading = computed(() => quoteKlineTfValue() === '1d'
    ? Boolean(sectionLoadingValue().quote)
    : Boolean(quoteKlineLoadingValue()[quoteKlineTfValue()]))
  const activeMoneyFlowHistory = computed(() => {
    if (quoteKlineTfValue() === '1d') return moneyFlowHistory.value
    const rows = moneyFlowHistoryByTf.value?.[quoteKlineTfValue()]
    return Array.isArray(rows) ? rows : []
  })
  const moneyFlowIsLoading = computed(() => quoteKlineTfValue() === '1d'
    ? Boolean(sectionLoadingValue().quote)
    : Boolean(
      moneyFlowLoadingValue()[quoteKlineTfValue()]
      || quoteKlineLoadingValue()[quoteKlineTfValue()],
    ))

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
    {
      label: '主力净额',
      value: fmtWanAmount(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount),
      className: valueClass(moneyFlowSummary.value.main_net_today ?? latestMoneyFlow.value?.net_mf_amount),
    },
  ])
  const overviewQuoteDataAvailable = computed(() => Boolean(
    quoteDailyRows.value.length
    || latestMoneyFlow.value
    || Object.keys(latestDailyBasic.value).length,
  ))

  return {
    quoteDailyRows,
    quoteWeeklyRows,
    quoteMonthlyRows,
    latestDailyBasic,
    latestMoneyFlow,
    moneyFlowHistory,
    moneyFlowHistoryByTf,
    moneyFlowSummary,
    entryRisk,
    entryRiskMetrics,
    quoteSectionDate,
    nineTurnDailyRows,
    nineTurnSignals,
    latestNineTurnSignal,
    nineTurnStatus,
    nineTurnMarkers,
    quoteKlineTfOptions,
    quoteKlineTfMeta,
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
  }
}
