import { ref, computed } from 'vue'
import {
  listAnalysisTasks,
  getAnalysisTaskDetail,
  getAnalysisTaskResolved,
  getAnalysisTaskRevisions,
  submitAnalysisTaskFeedback
} from '../api/analysisTasks'
import { normalizeTaskItem, normalizeTaskDetail } from '../adapters/analysisTaskAdapter'

export function useAnalysisTasks() {
  const loading = ref(false)
  const error = ref('')
  const tasks = ref([])
  const page = ref(1)
  const limit = ref(20)
  const total = ref(0)
  const selectedTask = ref(null)
  const selectedResolved = ref(null)
  const revisions = ref([])

  const filters = ref({
    status: '',
    type: '',
    symbol: ''
  })

  let listTimer = null

  const hasMore = computed(() => page.value * limit.value < total.value)

  async function loadTasks({ reset = false } = {}) {
    if (reset) page.value = 1
    loading.value = true
    error.value = ''
    try {
      const params = {
        page: page.value,
        limit: limit.value,
        status: filters.value.status || undefined,
        symbol: filters.value.symbol || undefined
      }
      if (filters.value.type === '__all_with_market_global__') {
        params.include_market_global = true
      } else if (filters.value.type) {
        params.type = filters.value.type
      }
      const resp = await listAnalysisTasks(params)
      const items = (resp?.items || []).map(normalizeTaskItem)
      tasks.value = reset ? items : [...tasks.value, ...items]
      total.value = resp?.pagination?.total || 0
    } catch (e) {
      error.value = e?.response?.data?.detail || e?.message || '加载任务失败'
    } finally {
      loading.value = false
    }
  }

  async function loadTaskDetail(taskId) {
    const detail = await getAnalysisTaskDetail(taskId)
    selectedTask.value = normalizeTaskDetail(detail)
    const [resolved, rev] = await Promise.all([
      getAnalysisTaskResolved(taskId).catch(() => null),
      getAnalysisTaskRevisions(taskId).catch(() => ({ revisions: [] }))
    ])
    selectedResolved.value = resolved
    revisions.value = rev?.revisions || []
  }

  async function submitFeedback(taskId, feedback) {
    return submitAnalysisTaskFeedback(taskId, feedback)
  }

  function startPolling(intervalMs = 12000) {
    stopPolling()
    listTimer = window.setInterval(() => {
      loadTasks({ reset: true })
    }, intervalMs)
  }

  function stopPolling() {
    if (listTimer) {
      window.clearInterval(listTimer)
      listTimer = null
    }
  }

  function resetDetail() {
    selectedTask.value = null
    selectedResolved.value = null
    revisions.value = []
  }

  return {
    loading,
    error,
    tasks,
    page,
    limit,
    total,
    hasMore,
    filters,
    selectedTask,
    selectedResolved,
    revisions,
    loadTasks,
    loadTaskDetail,
    submitFeedback,
    startPolling,
    stopPolling,
    resetDetail
  }
}
