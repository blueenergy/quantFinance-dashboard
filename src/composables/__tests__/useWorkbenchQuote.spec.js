import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useWorkbenchQuote } from '../useWorkbenchQuote'

describe('useWorkbenchQuote', () => {
  it('derives quote metrics, timeframe rows, and nine-turn markers', () => {
    const payload = ref({
      quote: { trade_date: '20260717' },
      daily_quotes: [{ trade_date: '20260717' }],
      weekly_quotes: [{ trade_date: '20260711', close: 12.3 }],
      daily_basic: { pe_ttm: 9.8 },
      nine_turn_signals: [{
        trade_date: '20260716',
        direction: 'up',
        count: 8,
        grade: 'strong',
        high: 13,
        low: 11,
      }],
    })
    const dataStatus = computed(() => payload.value.data_status || {})
    const quoteKlineTf = ref('1d')
    const quote = useWorkbenchQuote({
      payload,
      dataStatus,
      quoteKlineTf,
      quoteKlineLoading: ref({}),
      moneyFlowLoading: ref({}),
      sectionLoading: ref({}),
    })

    expect(quote.quoteMetrics.value.find((item) => item.label === 'PE TTM').value).toBe('9.80')

    quoteKlineTf.value = '1w'
    expect(quote.quoteKlineRows.value).toEqual([{ trade_date: '20260711', close: 12.3 }])
    expect(quote.quoteKlineShortLabel.value).toBe('周线')
    expect(quote.nineTurnMarkers.value).toEqual([{
      trade_date: '20260716',
      direction: 'up',
      label: 8,
      grade: 'strong',
      high: 13,
      low: 11,
    }])
  })
})
