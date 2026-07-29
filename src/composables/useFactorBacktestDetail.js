import { computed, ref } from 'vue'
import {
  deleteFactorBacktestJob,
  getFactorBacktestJob,
  getFactorBacktestResults,
} from '../api/factorBacktest'
import { formatResearchApiError as formatApiError } from '../utils/portfolioResearchPayload'
import {
  buildCoverageCards,
  buildFactorParamRows,
  buildIcRows,
  buildNetReturnRows,
  buildQuantileBars,
  buildScreenRows,
  buildYearlyIcRows,
  factorDiagnostics,
  reportHorizons,
  universePitLabel,
} from '../utils/factorBacktestView'
import { isRequestCanceled } from '../utils/request'

export function useFactorBacktestDetail({
  loadJobs = async () => {},
  setMessage = () => {},
  setErrorMessage = () => {},
} = {}) {
  const selectedJobId = ref('')
  const selectedJob = ref(null)
  const report = ref(null)
  const resultLoading = ref(false)
  const deleteLoading = ref(false)
  const selectedFactor = ref('')
  const selectedHorizon = ref('')
  let selectSeq = 0

  const mobileShowDetail = computed(() => Boolean(selectedJobId.value))
  const paramRows = computed(() => buildFactorParamRows(selectedJob.value))
  const coverageCards = computed(() => (report.value ? buildCoverageCards(report.value) : []))
  const pitLabel = computed(() => universePitLabel(report.value))
  const screenRows = computed(() => buildScreenRows(report.value))
  const horizons = computed(() => reportHorizons(report.value))
  const icRows = computed(() => (
    selectedHorizon.value ? buildIcRows(report.value, selectedHorizon.value) : []
  ))
  const diagnostics = computed(() => (
    selectedFactor.value && selectedHorizon.value
      ? factorDiagnostics(report.value, selectedFactor.value, selectedHorizon.value)
      : null
  ))
  const quantileBars = computed(() => buildQuantileBars(diagnostics.value))
  const yearlyIcRows = computed(() => buildYearlyIcRows(diagnostics.value))
  const netReturnRows = computed(() => buildNetReturnRows(report.value, selectedFactor.value))
  const deleteDisabledReason = computed(() => {
    const status = selectedJob.value?.status
    if (status === 'pending' || status === 'running') {
      return '任务仍在排队或运行中，完成后可删除'
    }
    return '删除任务与回测报告'
  })

  /** Keeps the drill-down on a factor/horizon that the current report has. */
  function syncSelection() {
    const available = horizons.value
    if (!available.includes(String(selectedHorizon.value))) {
      const screened = report.value?.screen?.horizon
      selectedHorizon.value = available.includes(String(screened))
        ? String(screened)
        : (available[available.length - 1] || '')
    }
    const factors = Object.keys(report.value?.factors || {})
    if (!factors.includes(selectedFactor.value)) {
      selectedFactor.value = screenRows.value.find((row) => factors.includes(row.factor))?.factor
        || factors[0]
        || ''
    }
  }

  function selectFactor(factor) {
    if (factor) selectedFactor.value = factor
  }

  function selectHorizon(horizon) {
    selectedHorizon.value = String(horizon || '')
  }

  function backToList() {
    selectedJobId.value = ''
    selectedJob.value = null
    report.value = null
  }

  async function selectJob(jobId, { resetResult = false } = {}) {
    if (!jobId) return
    const seq = ++selectSeq
    const isCurrent = () => seq === selectSeq && selectedJobId.value === jobId
    selectedJobId.value = jobId
    if (resetResult) report.value = null
    try {
      const jobRes = await getFactorBacktestJob(jobId)
      if (!isCurrent()) return
      selectedJob.value = jobRes.data
      if (selectedJob.value?.result_id || selectedJob.value?.status === 'completed') {
        resultLoading.value = true
        try {
          const resultRes = await getFactorBacktestResults(jobId)
          if (!isCurrent()) return
          report.value = resultRes.data?.report || null
          syncSelection()
        } catch (err) {
          if (!isCurrent() || isRequestCanceled(err)) return
          if (selectedJob.value?.status === 'completed') {
            setErrorMessage(formatApiError(err, '加载因子回测结果失败'))
          }
        } finally {
          if (isCurrent()) resultLoading.value = false
        }
      } else if (resetResult) {
        report.value = null
      }
    } catch (err) {
      if (!isCurrent() || isRequestCanceled(err)) return
      setErrorMessage(formatApiError(err, '加载因子回测任务失败'))
    }
  }

  async function deleteJob() {
    if (!selectedJobId.value || !selectedJob.value) return
    const jobId = selectedJobId.value
    const name = selectedJob.value.name || jobId
    const confirmed = window.confirm(`确认删除因子回测「${name}」？\n将删除任务与报告，且不可恢复。`)
    if (!confirmed) return

    deleteLoading.value = true
    setMessage('')
    setErrorMessage('')
    try {
      await deleteFactorBacktestJob(jobId)
      setMessage(`已删除因子回测 ${jobId}`)
      if (selectedJobId.value === jobId) backToList()
      await loadJobs()
    } catch (err) {
      if (!isRequestCanceled(err)) {
        setErrorMessage(formatApiError(err, '删除因子回测失败'))
      }
    } finally {
      deleteLoading.value = false
    }
  }

  return {
    selectedJobId,
    selectedJob,
    report,
    resultLoading,
    deleteLoading,
    selectedFactor,
    selectedHorizon,
    mobileShowDetail,
    paramRows,
    coverageCards,
    pitLabel,
    screenRows,
    horizons,
    icRows,
    diagnostics,
    quantileBars,
    yearlyIcRows,
    netReturnRows,
    deleteDisabledReason,
    syncSelection,
    selectFactor,
    selectHorizon,
    backToList,
    selectJob,
    deleteJob,
  }
}
