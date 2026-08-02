import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { cancelBatch, deleteBatch, getBatch, listBatches } from '../api/strategyLab'
import { useVisibilityAwarePolling } from './useVisibilityAwarePolling'

const POLL_MS = 10000

export function useStrategyCompareBatches({ workspaceActive = ref(true) } = {}) {
  const batches = ref([])
  const loading = ref(false)
  const message = ref('')
  const errorMessage = ref('')
  const selectedBatchId = ref('')
  const selectedBatch = ref(null)

  const hasActiveBatches = computed(() =>
    batches.value.some((b) => ['pending', 'running'].includes(String(b.status || '').toLowerCase())) ||
    (selectedBatch.value &&
      ['pending', 'running'].includes(String(selectedBatch.value.status || '').toLowerCase())),
  )

  async function loadBatches() {
    loading.value = true
    errorMessage.value = ''
    try {
      const rows = await listBatches({ experiment_type: 'compare', limit: 100 })
      batches.value = rows || []
      if (selectedBatchId.value) {
        const hit = batches.value.find((b) => b.batch_id === selectedBatchId.value)
        if (hit) selectedBatch.value = hit
      }
    } catch (err) {
      errorMessage.value = err?.response?.data?.detail || err?.message || '加载批次失败'
    } finally {
      loading.value = false
    }
  }

  async function refreshSelected() {
    if (!selectedBatchId.value) return
    try {
      selectedBatch.value = await getBatch(selectedBatchId.value)
    } catch (err) {
      errorMessage.value = err?.response?.data?.detail || err?.message || '加载批次详情失败'
    }
  }

  async function refreshAll() {
    await loadBatches()
    await refreshSelected()
  }

  function selectBatch(batchId) {
    selectedBatchId.value = batchId
    selectedBatch.value = batches.value.find((b) => b.batch_id === batchId) || null
    void refreshSelected()
  }

  async function cancelSelected() {
    if (!selectedBatchId.value) return
    await cancelBatch(selectedBatchId.value)
    message.value = '已取消批次'
    await refreshAll()
  }

  async function deleteSelected() {
    if (!selectedBatchId.value) return
    await deleteBatch(selectedBatchId.value)
    selectedBatchId.value = ''
    selectedBatch.value = null
    message.value = '已删除批次'
    await loadBatches()
  }

  const polling = useVisibilityAwarePolling(
    () => refreshAll(),
    POLL_MS,
    computed(() => workspaceActive.value && hasActiveBatches.value),
  )

  onMounted(() => {
    void loadBatches()
  })

  onBeforeUnmount(() => {
    polling.stop()
  })

  return {
    batches,
    loading,
    message,
    errorMessage,
    selectedBatchId,
    selectedBatch,
    hasActiveBatches,
    loadBatches,
    refreshAll,
    refreshSelected,
    selectBatch,
    cancelSelected,
    deleteSelected,
  }
}
