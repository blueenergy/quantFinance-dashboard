import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listModelTrainingJobs } from '../api/modelTraining'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'

export function useModelTrainingJobs({
  selectedJobId = ref(''),
  selectedJob = ref(null),
  resultDetail = ref(null),
  refreshSelected = async () => {},
} = {}) {
  const jobs = ref([])
  const statusFilter = ref('')
  const indexFilter = ref('')
  const loading = ref(false)
  const message = ref('')
  const errorMessage = ref('')
  const nowMs = ref(Date.now())

  let clockTimer = null
  let pollTimer = null

  const hasActiveJobs = computed(() =>
    jobs.value.some((job) => job.status === 'running' || job.status === 'pending')
      || selectedJob.value?.status === 'running'
      || selectedJob.value?.status === 'pending',
  )

  function applyIndexFilter(rows) {
    const code = String(indexFilter.value || '').trim()
    if (!code) return rows
    return rows.filter((job) => (job.params?.index_code || '') === code)
  }

  async function loadJobs() {
    loading.value = true
    errorMessage.value = ''
    try {
      const params = {}
      if (statusFilter.value) params.status = statusFilter.value
      const res = await listModelTrainingJobs(params)
      const allRows = res.data || []
      jobs.value = applyIndexFilter(allRows)
      if (selectedJobId.value) {
        const match = allRows.find((job) => job.job_id === selectedJobId.value)
        if (match) selectedJob.value = match
      }
    } catch (err) {
      errorMessage.value = formatResearchApiError(err, '加载训练任务失败')
    } finally {
      loading.value = false
    }
  }

  async function refreshAll() {
    await loadJobs()
    if (selectedJobId.value) await refreshSelected(selectedJobId.value)
  }

  function startActiveJobTimers() {
    if (clockTimer === null) {
      clockTimer = setInterval(() => {
        nowMs.value = Date.now()
      }, 1000)
    }
    if (pollTimer === null) {
      pollTimer = setInterval(() => {
        refreshAll()
      }, 15000)
    }
  }

  function stopActiveJobTimers() {
    if (clockTimer !== null) {
      clearInterval(clockTimer)
      clockTimer = null
    }
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  watch(hasActiveJobs, (active) => {
    if (active) startActiveJobTimers()
    else stopActiveJobTimers()
  })

  onMounted(() => {
    if (hasActiveJobs.value) startActiveJobTimers()
  })

  onBeforeUnmount(stopActiveJobTimers)

  return {
    jobs,
    statusFilter,
    indexFilter,
    loading,
    message,
    errorMessage,
    nowMs,
    hasActiveJobs,
    loadJobs,
    refreshAll,
  }
}
