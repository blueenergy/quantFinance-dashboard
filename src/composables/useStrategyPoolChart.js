import { computed, ref } from 'vue'
import { fetchStrategyPoolChartContext } from '../api/strategyPool'

export function useStrategyPoolChart() {
  const selectedStock = ref(null)
  const loading = ref(false)
  const error = ref('')
  const context = ref(null)
  let requestSeq = 0

  const records = computed(() => (
    Array.isArray(context.value?.kline?.records) ? context.value.kline.records : []
  ))
  const markers = computed(() => (
    Array.isArray(context.value?.markers) ? context.value.markers : []
  ))
  const rounds = computed(() => (
    Array.isArray(context.value?.rounds) ? context.value.rounds : []
  ))
  const forwardReturns = computed(() => context.value?.forward_returns || null)
  const disclaimer = computed(() => context.value?.disclaimer || '')
  const signalDate = computed(() => (
    selectedStock.value?.date || context.value?.signal_date || ''
  ))
  const chartMeta = computed(() => ({
    showMa: false,
    focusDate: signalDate.value,
    markLineDate: signalDate.value,
    focusBarsBefore: 60,
    focusBarsAfter: 40,
  }))

  async function selectStock(stock, { strategy, preset } = {}) {
    selectedStock.value = stock || null
    if (!stock?.symbol) {
      context.value = null
      error.value = ''
      loading.value = false
      return
    }

    const mySeq = ++requestSeq
    loading.value = true
    error.value = ''
    try {
      const body = await fetchStrategyPoolChartContext({
        symbol: stock.symbol,
        strategy: stock.strategy || strategy,
        preset: stock.preset || preset,
        signalDate: stock.date,
      })
      if (mySeq !== requestSeq) return
      context.value = body
    } catch (err) {
      if (mySeq !== requestSeq) return
      context.value = null
      error.value = err?.response?.data?.detail || err?.message || '加载K线失败'
    } finally {
      if (mySeq === requestSeq) loading.value = false
    }
  }

  function clear() {
    requestSeq += 1
    selectedStock.value = null
    context.value = null
    error.value = ''
    loading.value = false
  }

  return {
    selectedStock,
    loading,
    error,
    context,
    records,
    markers,
    rounds,
    forwardReturns,
    disclaimer,
    signalDate,
    chartMeta,
    selectStock,
    clear,
  }
}
