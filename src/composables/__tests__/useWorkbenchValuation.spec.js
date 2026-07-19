import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useWorkbenchValuation } from '../useWorkbenchValuation'

describe('useWorkbenchValuation', () => {
  it('marks financial-sector DCF as not applicable and keeps its note path', () => {
    const valuation = useWorkbenchValuation({
      valuationData: ref({
        data_status: { found: true },
        model_suitability: {
          signals: { industry_tags: ['financial'] },
        },
        dcf: {
          status: 'ok',
          net_debt_adjustment: {
            skipped_financial_sector: true,
          },
          scenarios: [{ name: 'base', fair_value_per_share: 12, safety_margin_pct: 8 }],
        },
      }),
      dataStatus: ref({}),
      latestPrice: ref(10),
    })

    expect(valuation.valuationIsFinancial.value).toBe(true)
    expect(valuation.valuationDcfNetDebtNote.value).toContain('金融行业')
    expect(valuation.valuationConclusionMetrics.value[1].value).toBe('不适用')
  })

  it('reports empty found=false data as unavailable', () => {
    const valuation = useWorkbenchValuation({
      valuationData: ref({ data_status: { found: false } }),
      dataStatus: ref({ sections: { valuation: { found: false } } }),
      latestPrice: ref(null),
    })

    expect(valuation.valuationDataStatusFound.value).toBe(false)
    expect(valuation.valuationIsFinancial.value).toBe(false)
  })
})
