import { computed, ref } from 'vue'
import { getReasoningDetail } from '../api/ladder'

function compactDate(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8)
}

export function useLimitUpReasoningDialog() {
  const open = ref(false)
  const loading = ref(false)
  const error = ref('')
  const stock = ref(null)
  const detail = ref(null)

  const reasoning = computed(() => detail.value?.reasoning || null)
  const newsContext = computed(() => detail.value?.news_context || [])
  const tradeDate = computed(() => compactDate(stock.value?.trade_date))

  async function showLimitUpReasoning(row) {
    stock.value = row
    detail.value = null
    error.value = ''
    loading.value = true
    open.value = true

    const date = compactDate(row?.limit_up_reasoning_date || row?.trade_date)
    const symbol = row?.limit_up_reasoning_symbol || row?.symbol
    try {
      const res = await getReasoningDetail(symbol, date || null)
      if (res?.success) {
        detail.value = res.data
        error.value = ''
        return
      }
      error.value = res?.error || '该股暂无涨停归因或 LLM 解读结果'
    } catch (err) {
      error.value = err?.message || '加载涨停归因失败'
    } finally {
      loading.value = false
    }
  }

  function closeLimitUpReasoning() {
    open.value = false
  }

  return {
    limitUpReasoningOpen: open,
    limitUpReasoningLoading: loading,
    limitUpReasoningError: error,
    limitUpReasoningStock: stock,
    limitUpReasoningDetail: detail,
    limitUpReasoning: reasoning,
    limitUpReasoningNewsContext: newsContext,
    limitUpReasoningTradeDate: tradeDate,
    showLimitUpReasoning,
    closeLimitUpReasoning,
  }
}
