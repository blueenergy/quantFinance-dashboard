import { computed, ref, toValue } from 'vue'
import {
  calcYoy,
  diffOrNull,
  firstFinite,
  fmtNumber,
  fmtPctPlain,
  fmtStatementAmount,
  ratioPct,
  reportQuarter,
  reportYear,
  statementReportTypeLabel,
  sumFinite,
  toNumber,
} from '../utils/workbenchFormat'

export function useWorkbenchFinancials({
  incomeRows,
  indicatorRows,
  balanceRows,
  cashflowRows,
  earnings,
  quote,
}) {
  const rows = (source) => {
    const value = toValue(source)
    return Array.isArray(value) ? value : []
  }
  const objectValue = (source) => toValue(source) || {}
  const financialMode = ref('quarterly')

  function groupStatementRowsByReportType(statementRows) {
    const grouped = new Map()
    for (const row of statementRows || []) {
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

  const financialChartData = computed(() => {
    const incomeByPeriod = new Map()
    for (const row of rows(incomeRows)) {
      const period = row.end_date || row.period || row.report_date
      if (period) incomeByPeriod.set(period, row)
    }
    const normalizedRows = rows(indicatorRows).map((indicator) => {
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

    const byYearQuarter = new Map(normalizedRows.map((row) => [`${row.year}-${row.quarter}`, row]))
    const normalized = normalizedRows
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
    const latest = rows(indicatorRows)[0] || {}
    const latestBalance = rows(balanceRows)[0] || {}
    const latestCashflow = rows(cashflowRows)[0] || {}
    return [
      { label: 'ROE', value: fmtNumber(latest.roe || latest.roe_dt, 2, '%') },
      { label: '毛利率', value: fmtNumber(latest.grossprofit_margin, 2, '%') },
      { label: '净利同比', value: fmtNumber(latest.netprofit_yoy || latest.profit_to_gr, 2, '%') },
      { label: '营收同比', value: fmtNumber(latest.tr_yoy || latest.or_yoy, 2, '%') },
      { label: 'PE TTM', value: fmtNumber(latest.pe_ttm || objectValue(quote).pe_ttm) },
      { label: 'PB', value: fmtNumber(latest.pb || objectValue(quote).pb) },
      { label: '总资产', value: fmtStatementAmount(latestBalance.total_assets) },
      { label: '经营现金流', value: fmtStatementAmount(latestCashflow.n_cashflow_act) },
    ]
  })
  const financialMetricsPeriodText = computed(() => {
    const latest = rows(indicatorRows)[0] || {}
    const latestBalance = rows(balanceRows)[0] || {}
    const latestCashflow = rows(cashflowRows)[0] || {}
    const parts = [
      ['指标', latest.end_date || latest.period || latest.report_date],
      ['资产负债', latestBalance.end_date || latestBalance.period || latestBalance.report_date],
      ['现金流', latestCashflow.end_date || latestCashflow.period || latestCashflow.report_date],
    ].filter(([, value]) => value)
    if (!parts.length) return '暂无报告期'
    return parts.map(([label, value]) => `${label} ${value}`).join(' · ')
  })
  const incomeReportSections = computed(() => groupStatementRowsByReportType(rows(incomeRows)))
  const cashflowReportSections = computed(() => groupStatementRowsByReportType(rows(cashflowRows)))

  const financialQualityCards = computed(() => {
    const chartRows = financialChartData.value
    const latest = chartRows[chartRows.length - 1] || {}
    const previous = chartRows[chartRows.length - 2] || {}
    const latestIndicator = rows(indicatorRows)[0] || {}
    const latestBalance = rows(balanceRows)[0] || {}
    const latestCashflow = rows(cashflowRows)[0] || {}
    const latestIncome = rows(incomeRows)[0] || {}
    const cards = []

    if (latest.tr_yoy != null || latest.netprofit_yoy != null) {
      const revenueYoy = toNumber(latest.tr_yoy)
      const profitYoy = toNumber(latest.netprofit_yoy)
      const improving = [revenueYoy, profitYoy].filter((value) => value != null && value > 0).length
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
      const cashflowRatio = netProfit ? operatingCashflow / Math.abs(netProfit) : null
      cards.push({
        key: 'cashflow',
        label: '现金流质量',
        level: cashflowRatio == null ? 'neutral' : cashflowRatio >= 0.8 ? 'good' : cashflowRatio >= 0 ? 'neutral' : 'warn',
        title: cashflowRatio == null ? '现金流待观察' : cashflowRatio >= 0.8 ? '现金流匹配利润' : cashflowRatio >= 0 ? '现金流弱于利润' : '经营现金流为负',
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

    const receivablesRatio = ratioPct(
      sumFinite(latestBalance.accounts_receiv, latestBalance.notes_receiv),
      latestBalance.total_assets,
    )
    const inventoryRatio = ratioPct(latestBalance.inventories, latestBalance.total_assets)
    if (receivablesRatio != null || inventoryRatio != null) {
      const riskHigh = (receivablesRatio != null && receivablesRatio > 20)
        || (inventoryRatio != null && inventoryRatio > 20)
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
    const result = []
    const source = objectValue(earnings)
    for (const row of source.forecast || []) result.push({ type: '业绩预告', date: row.ann_date || row.end_date, title: row.type || row.summary || '业绩预告', raw: row })
    for (const row of source.express || []) result.push({ type: '业绩快报', date: row.ann_date || row.end_date, title: row.revenue ? `营收 ${fmtStatementAmount(row.revenue)}` : '业绩快报', raw: row })
    for (const row of source.disclosure || []) result.push({ type: '披露日历', date: row.ann_date || row.pre_date, title: row.pre_date ? `预计披露 ${row.pre_date}` : '披露日历', raw: row })
    return result.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 8)
  })
  const reportRcRows = computed(() => {
    const reportRows = Array.isArray(objectValue(earnings).report_rc) ? objectValue(earnings).report_rc : []
    return [...reportRows].sort((a, b) => String(b.report_date || b.create_time || '').localeCompare(String(a.report_date || a.create_time || '')))
  })

  return {
    financialMode,
    financialModeLabel,
    financialChartData,
    financialMetrics,
    financialMetricsPeriodText,
    incomeReportSections,
    cashflowReportSections,
    groupStatementRowsByReportType,
    financialQualityCards,
    earningsEvents,
    reportRcRows,
  }
}
