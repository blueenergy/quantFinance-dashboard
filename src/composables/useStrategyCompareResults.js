import { ref } from 'vue'
import { getBatchResults } from '../api/strategyLab'
import { buildBacktestSweepView, sortRows } from '../utils/backtestSweepView'

export function useStrategyCompareResults() {
  const rows = ref([])
  const loading = ref(false)
  const errorMessage = ref('')
  const sortKey = ref('total_return')
  const sortOrder = ref('desc')
  const sweepView = ref({ sweep_axes: [], rows: [] })

  async function loadResults(batchId) {
    if (!batchId) {
      rows.value = []
      sweepView.value = { sweep_axes: [], rows: [] }
      return
    }
    loading.value = true
    errorMessage.value = ''
    try {
      const payload = await getBatchResults(batchId, {
        sort_by: sortKey.value,
        order: sortOrder.value,
        limit: 500,
      })
      const rawRows = payload?.rows || []
      if (payload?.total && rawRows.length < payload.total) {
        errorMessage.value = `结果截断：仅显示 ${rawRows.length}/${payload.total} 行`
      }
      rows.value = sortRows(rawRows, sortKey.value, sortOrder.value)
      sweepView.value = buildBacktestSweepView(rows.value)
    } catch (err) {
      rows.value = []
      sweepView.value = { sweep_axes: [], rows: [] }
      errorMessage.value = err?.response?.data?.detail || err?.message || '加载结果失败'
    } finally {
      loading.value = false
    }
  }

  function setSort(key) {
    if (sortKey.value === key) {
      sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
    } else {
      sortKey.value = key
      sortOrder.value = 'desc'
    }
    rows.value = sortRows(rows.value, sortKey.value, sortOrder.value)
  }

  return {
    rows,
    loading,
    errorMessage,
    sortKey,
    sortOrder,
    sweepView,
    loadResults,
    setSort,
  }
}
