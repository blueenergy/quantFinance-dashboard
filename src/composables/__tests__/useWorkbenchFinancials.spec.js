import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useWorkbenchFinancials } from '../useWorkbenchFinancials'

describe('useWorkbenchFinancials', () => {
  it('switches chart periods and groups statement report types', () => {
    const incomeRows = ref([
      { end_date: '20250331', report_type: '1', revenue: 100, n_income_attr_p: 10 },
      { end_date: '20250630', report_type: '2', revenue: 230, n_income_attr_p: 25 },
      { end_date: '20250930', report_type: '1', revenue: 370, n_income_attr_p: 41 },
      { end_date: '20251231', report_type: '1', revenue: 520, n_income_attr_p: 58 },
    ])
    const financials = useWorkbenchFinancials({
      incomeRows,
      indicatorRows: ref([
        { end_date: '20250331', tr_yoy: 10, netprofit_yoy: 8 },
        { end_date: '20250630', tr_yoy: 12, netprofit_yoy: 9 },
        { end_date: '20250930', tr_yoy: 14, netprofit_yoy: 10 },
        { end_date: '20251231', tr_yoy: 15, netprofit_yoy: 11 },
      ]),
      balanceRows: ref([]),
      cashflowRows: ref([]),
      earnings: ref({}),
      quote: ref({}),
    })

    expect(financials.financialChartData.value.map((row) => row.period)).toEqual([
      '2025Q1',
      '2025Q2',
      '2025Q3',
      '2025Q4',
    ])

    financials.financialMode.value = 'annual'
    expect(financials.financialChartData.value.map((row) => row.period)).toEqual(['2025'])
    expect(financials.incomeReportSections.value.map((section) => section.key)).toEqual(['1', '2'])
    expect(financials.incomeReportSections.value[0].rows).toHaveLength(3)
  })
})
