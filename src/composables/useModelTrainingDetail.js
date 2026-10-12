import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { getModelTrainingJob, getModelTrainingResults } from '../api/modelTraining'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'
import {
  buildFoldComparisonRows,
  buildModelTrainingParamRows,
  maxAbsIcForChart,
} from '../utils/modelTrainingView'
import { isRequestCanceled } from '../utils/request'

export function useModelTrainingDetail({
  setErrorMessage = () => {},
} = {}) {
  const selectedJobId = ref('')
  const selectedJob = ref(null)
  const resultDetail = ref(null)
  const detailMaximized = ref(false)
  const detailBodyRef = ref(null)
  let selectSeq = 0

  const mobileShowDetail = computed(() => Boolean(selectedJobId.value))
  const paramRows = computed(() => buildModelTrainingParamRows(selectedJob.value))
  const foldRows = computed(() => buildFoldComparisonRows(resultDetail.value?.fold_reports))
  const chartMaxIc = computed(() => maxAbsIcForChart(resultDetail.value?.fold_reports))

  function scrollDetailToTop() {
    if (detailBodyRef.value) detailBodyRef.value.scrollTop = 0
  }

  function toggleDetailFullscreen() {
    detailMaximized.value = !detailMaximized.value
  }

  function exitDetailFullscreen() {
    detailMaximized.value = false
  }

  function backToList() {
    detailMaximized.value = false
    selectedJobId.value = ''
    selectedJob.value = null
    resultDetail.value = null
  }

  function onDetailFullscreenKeydown(event) {
    if (event.key === 'Escape' && detailMaximized.value) {
      event.preventDefault()
      event.stopPropagation()
      exitDetailFullscreen()
    }
  }

  watch(detailMaximized, (value) => {
    document.body.style.overflow = value ? 'hidden' : ''
    if (value) {
      window.addEventListener('keydown', onDetailFullscreenKeydown, true)
    } else {
      window.removeEventListener('keydown', onDetailFullscreenKeydown, true)
    }
  })

  watch(selectedJobId, () => {
    detailMaximized.value = false
  })

  onBeforeUnmount(() => {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onDetailFullscreenKeydown, true)
  })

  async function selectJob(jobId, { scrollDetail = false } = {}) {
    if (!jobId) return
    const seq = ++selectSeq
    const isCurrent = () => seq === selectSeq && selectedJobId.value === jobId
    selectedJobId.value = jobId
    if (scrollDetail) resultDetail.value = null
    try {
      const jobRes = await getModelTrainingJob(jobId)
      if (!isCurrent()) return
      selectedJob.value = jobRes.data
      if (selectedJob.value?.result_id || selectedJob.value?.status === 'completed') {
        try {
          const resultRes = await getModelTrainingResults(jobId)
          if (!isCurrent()) return
          resultDetail.value = resultRes.data
        } catch (err) {
          if (!isCurrent() || isRequestCanceled(err)) return
          if (selectedJob.value?.status === 'completed') {
            setErrorMessage(formatResearchApiError(err, '加载训练结果失败'))
          }
        }
      } else if (scrollDetail) {
        resultDetail.value = null
      }
      if (scrollDetail) {
        await nextTick()
        if (isCurrent()) scrollDetailToTop()
      }
    } catch (err) {
      if (!isCurrent() || isRequestCanceled(err)) return
      setErrorMessage(formatResearchApiError(err, '加载训练任务失败'))
    }
  }

  return {
    selectedJobId,
    selectedJob,
    resultDetail,
    detailMaximized,
    detailBodyRef,
    mobileShowDetail,
    paramRows,
    foldRows,
    chartMaxIc,
    toggleDetailFullscreen,
    exitDetailFullscreen,
    backToList,
    selectJob,
  }
}
