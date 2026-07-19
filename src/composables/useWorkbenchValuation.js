import { computed, toValue } from 'vue'
import {
  fmtAmount,
  fmtNumber,
  valuationRelativeLabel,
} from '../utils/workbenchFormat'

export function useWorkbenchValuation({ valuationData, dataStatus, latestPrice }) {
  const valuationDataValue = () => toValue(valuationData) || {}
  const dataStatusValue = () => toValue(dataStatus) || {}

  const valuationStatus = computed(() => (
    dataStatusValue()?.sections?.valuation
    || valuationDataValue().data_status
    || {}
  ))
  const valuationDataStatusFound = computed(() => Boolean(
    valuationStatus.value.found || valuationDataValue()?.data_status?.found,
  ))
  const valuationMarket = computed(() => valuationDataValue().market_multiples || {})
  const valuationCurrentMultiples = computed(() => valuationMarket.value.current || {})
  const valuationPercentiles = computed(() => valuationMarket.value.percentiles || {})
  const valuationDcf = computed(() => valuationDataValue().dcf || {})
  const valuationDcfScenarios = computed(() => Array.isArray(valuationDcf.value.scenarios) ? valuationDcf.value.scenarios : [])
  const valuationDcfSensitivity = computed(() => valuationDcf.value.sensitivity || {})
  const valuationDcfSensitivityVariables = computed(() => Array.isArray(valuationDcfSensitivity.value.variables) ? valuationDcfSensitivity.value.variables : [])
  const valuationBaseScenario = computed(() => valuationDcfScenarios.value.find((row) => row.name === 'base') || valuationDcfScenarios.value[0] || {})
  const valuationDdm = computed(() => valuationDataValue().ddm || {})
  const valuationDdmScenarios = computed(() => Array.isArray(valuationDdm.value.scenarios) ? valuationDdm.value.scenarios : [])
  const valuationDdmAnnualRows = computed(() => Array.isArray(valuationDdm.value.annual_dividends) ? valuationDdm.value.annual_dividends : [])
  const valuationDdmDividendQuality = computed(() => valuationDdm.value.dividend_quality || {})
  const valuationDdmBaseScenario = computed(() => valuationDdmScenarios.value.find((row) => row.name === 'base') || {})
  const valuationDdmKeBreakdownSummary = computed(() => {
    const breakdown = valuationDdmBaseScenario.value.ke_breakdown
    if (!breakdown || typeof breakdown !== 'object') return ''
    const riskFree = Number(breakdown.risk_free)
    const equityRiskPremium = Number(breakdown.equity_risk_premium)
    const riskAdjustment = Number(breakdown.risk_adjustment)
    const finalKe = Number(breakdown.final_ke)
    if (![riskFree, equityRiskPremium, riskAdjustment, finalKe].every((value) => Number.isFinite(value))) return ''
    return `中性档股权成本构成：无风险 ${(riskFree * 100).toFixed(2)}% + ERP ${(equityRiskPremium * 100).toFixed(2)}% + 风险调整 ${(riskAdjustment * 100).toFixed(2)}% → ke ${(finalKe * 100).toFixed(2)}%（不低于中性档 WACC）。`
  })
  const valuationDcfNetDebtNote = computed(() => {
    const adjustment = valuationDcf.value.net_debt_adjustment
    if (!adjustment || valuationDcf.value.status !== 'ok') return ''
    if (adjustment.skipped_financial_sector) {
      return adjustment.reason || '金融行业：未扣净债务，表内「股权价值」等同于企业价值 EV，仅作同口径参考。'
    }
    if (adjustment.status === 'missing') {
      return adjustment.reason || '缺少资产负债表，净债务与少数股东权益按 0 处理。'
    }
    const netDebt = adjustment.net_debt_wan
    const minorityInterest = adjustment.minority_interest_wan
    const parts = []
    if (netDebt != null && Number.isFinite(Number(netDebt))) parts.push(`净债务约 ${fmtAmount(netDebt)}`)
    if (minorityInterest != null && Number.isFinite(Number(minorityInterest))) parts.push(`少数股东权益约 ${fmtAmount(minorityInterest)}`)
    if (!parts.length) return ''
    return `各情景股权价值 = 企业价值 EV − ${parts.join(' − ')}。`
  })
  const valuationDcfPerShareNote = computed(() => {
    const perShare = valuationDcf.value.per_share
    if (!perShare || perShare.status !== 'missing_inputs' || !perShare.reason) return ''
    return perShare.reason
  })
  const valuationDcfSharesBasisNote = computed(() => {
    const perShare = valuationDcf.value.per_share
    if (!perShare || perShare.status !== 'ok' || !perShare.shares_basis) return ''
    const sharesWan = perShare.shares_implied_wan
    const tail = sharesWan != null && Number.isFinite(Number(sharesWan))
      ? ` 推算股本约 ${Number(sharesWan).toFixed(2)} 万股（市值÷价）。`
      : ''
    return `股本推算依据：${perShare.shares_basis}。${tail}`
  })
  const valuationDcfFairValueGapNote = computed(() => {
    const perShare = valuationDcf.value.per_share
    if (!perShare || perShare.status !== 'ok' || valuationDcf.value.status !== 'ok') return ''
    const base = valuationDcfScenarios.value.find((row) => row.name === 'base') || {}
    const enterpriseValue = base.enterprise_value_wan
    const fairValue = base.fair_value_per_share
    if (fairValue != null && Number.isFinite(Number(fairValue))) return ''
    if (
      enterpriseValue == null
      && base.wacc != null
      && base.terminal_growth != null
      && base.wacc <= base.terminal_growth
    ) {
      return '中性档 WACC 不高于永续增长，永续价值未闭合，企业价值与每股价值无法给出数值（非数据缺失）。'
    }
    if (enterpriseValue == null) return '中性档企业价值未算出（例如折现参数导致永续项无效），每股价值显示为「-」。'
    return ''
  })
  const valuationRelative = computed(() => valuationDataValue().relative_valuation || {})
  const valuationSuitability = computed(() => valuationDataValue().model_suitability || {})
  const valuationSuitabilityReasons = computed(() => Array.isArray(valuationSuitability.value.reasons) ? valuationSuitability.value.reasons : [])
  const valuationApplicability = computed(() => valuationSuitability.value.model_applicability || {})
  const valuationIsFinancial = computed(() => {
    const tags = valuationSuitability.value.signals?.industry_tags
    return Array.isArray(tags) && tags.includes('financial')
  })
  const valuationConfidence = computed(() => valuationDataValue().valuation_confidence || {})
  const valuationConfidenceLabel = computed(() => ({
    high: '高',
    medium: '中',
    low: '低',
  })[valuationConfidence.value.level] || '待判断')
  const valuationValueScore = computed(() => valuationDataValue().value_score_link?.value_score)
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

  function valuationMultipleWithPercentile(field, suffix = '') {
    const value = fmtNumber(valuationCurrentMultiples.value?.[field], 2, suffix)
    const percentile = valuationPercentiles.value?.[field]
    if (percentile == null) return value
    return `${value} / P${Number(percentile).toFixed(0)}`
  }

  const valuationConclusionMetrics = computed(() => [
    { label: '当前价格', value: fmtNumber(toValue(latestPrice)) },
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

  return {
    valuationStatus,
    valuationDataStatusFound,
    valuationMarket,
    valuationCurrentMultiples,
    valuationPercentiles,
    valuationDcf,
    valuationDcfScenarios,
    valuationDcfSensitivity,
    valuationDcfSensitivityVariables,
    valuationBaseScenario,
    valuationDdm,
    valuationDdmScenarios,
    valuationDdmAnnualRows,
    valuationDdmDividendQuality,
    valuationDdmBaseScenario,
    valuationDdmKeBreakdownSummary,
    valuationDcfNetDebtNote,
    valuationDcfPerShareNote,
    valuationDcfSharesBasisNote,
    valuationDcfFairValueGapNote,
    valuationRelative,
    valuationSuitability,
    valuationSuitabilityReasons,
    valuationApplicability,
    valuationIsFinancial,
    valuationConfidence,
    valuationConfidenceLabel,
    valuationValueScore,
    valuationModelLabel,
    valuationApplicabilityItems,
    valuationConclusionMetrics,
    valuationMultipleMetrics,
    valuationMultipleWithPercentile,
  }
}
