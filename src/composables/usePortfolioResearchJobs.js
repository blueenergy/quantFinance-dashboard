import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listPortfolioResearchJobs } from '../api/portfolioResearch'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'

export function usePortfolioResearchJobs({
  selectedJobId = ref(''),
  selectedJob = ref(null),
  resultDetail = ref(null),
  selectedResultRow = ref(null),
  refreshSelected = async () => {},
} = {}) {
  const jobs = ref([])
  const statusFilter = ref('')
  const universeFilter = ref('')
  const growthCycleWeightFilter = ref('')
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
      if (universeFilter.value) params.universe_index = universeFilter.value
      const weight = String(growthCycleWeightFilter.value || '').trim()
      if (weight) params.growth_cycle_weight = weight
      const res = await listPortfolioResearchJobs(params)
      jobs.value = res.data || []
      if (selectedJobId.value && jobs.value.some((job) => job.job_id === selectedJobId.value)) {
        selectedJob.value = jobs.value.find((job) => job.job_id === selectedJobId.value)
      } else if (selectedJobId.value) {
        selectedJobId.value = ''
        selectedJob.value = null
        resultDetail.value = null
        selectedResultRow.value = null
      }
    } catch (err) {
      errorMessage.value = formatResearchApiError(err, '加载研究任务失败')
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
      }, 30000)
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
    universeFilter,
    growthCycleWeightFilter,
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
