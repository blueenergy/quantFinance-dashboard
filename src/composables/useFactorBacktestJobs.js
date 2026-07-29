import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listFactorBacktestJobs } from '../api/factorBacktest'
import { formatResearchApiError as formatApiError } from '../utils/portfolioResearchPayload'

const POLL_INTERVAL_MS = 30000

export function useFactorBacktestJobs({
  selectedJobId = ref(''),
  selectedJob = ref(null),
  report = ref(null),
  refreshSelected = async () => {},
} = {}) {
  const jobs = ref([])
  const statusFilter = ref('')
  const factorSetFilter = ref('')
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

  async function loadJobs() {
    loading.value = true
    errorMessage.value = ''
    try {
      const params = {}
      if (statusFilter.value) params.status = statusFilter.value
      if (factorSetFilter.value) params.factor_set = factorSetFilter.value
      if (indexFilter.value) params.index_code = indexFilter.value
      const res = await listFactorBacktestJobs(params)
      jobs.value = res.data || []
      if (selectedJobId.value && jobs.value.some((job) => job.job_id === selectedJobId.value)) {
        selectedJob.value = jobs.value.find((job) => job.job_id === selectedJobId.value)
      } else if (selectedJobId.value) {
        // A filter change or a delete dropped the selection out of the list.
        selectedJobId.value = ''
        selectedJob.value = null
        report.value = null
      }
    } catch (err) {
      errorMessage.value = formatApiError(err, '加载因子回测任务失败')
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
      }, POLL_INTERVAL_MS)
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
    factorSetFilter,
    indexFilter,
    loading,
    message,
    errorMessage,
    nowMs,
    hasActiveJobs,
    loadJobs,
    refreshAll,
    startActiveJobTimers,
    stopActiveJobTimers,
  }
}
