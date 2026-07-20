import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  deletePortfolioResearchJob,
  getPortfolioResearchJob,
  getPortfolioResearchResults,
  getPortfolioResearchResultRows,
  publishPortfolioResearchResult,
} from '../api/portfolioResearch'
import { formatResearchApiError } from '../utils/portfolioResearchPayload'
import {
  buildResearchParamRows,
} from '../utils/portfolioResearchView'
import { isRequestCanceled } from '../utils/request'
import { buildCandidateConfigFromRow } from '../utils/sweepResultView'

const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE || '/api'

export function usePortfolioResearchDetail({
  loadJobs = async () => {},
  setMessage = () => {},
  setErrorMessage = () => {},
  apiBase = DEFAULT_API_BASE,
} = {}) {
  const selectedJobId = ref('')
  const selectedJob = ref(null)
  const resultDetail = ref(null)
  const selectedResultRow = ref(null)
  const deleteLoading = ref(false)
  const publishLoading = ref(false)
  const artifactLoading = ref(false)
  const detailMaximized = ref(false)
  const detailBodyRef = ref(null)
  let selectSeq = 0

  const mobileShowDetail = computed(() => Boolean(selectedJobId.value))
  const resultRows = computed(() => resultDetail.value?.rows || [])
  const candidateConfig = computed(() => {
    if (selectedResultRow.value) {
      return buildCandidateConfigFromRow(
        selectedResultRow.value,
        selectedJob.value || {},
        selectedJob.value?.params || resultDetail.value?.params || {},
      )
    }
    return resultDetail.value?.candidate_strategy_config || selectedJob.value?.candidate_strategy_config
  })
  const researchParamRows = computed(() => buildResearchParamRows(selectedJob.value))
  const publishedPresetId = computed(() => (
    resultDetail.value?.published_preset_id || selectedJob.value?.published_preset_id || ''
  ))
  const publishedStatus = computed(() => (
    resultDetail.value?.published_status || selectedJob.value?.published_status || ''
  ))
  const publishAction = computed(() => (
    resultDetail.value?.publish_action || selectedJob.value?.publish_action || ''
  ))
  const hasPublishedPreset = computed(() => Boolean(publishedPresetId.value))
  const publishedPresetLabel = computed(() => {
    if (!publishedPresetId.value) return '-'
    return publishedStatus.value
      ? `${publishedPresetId.value} (${publishedStatus.value})`
      : publishedPresetId.value
  })
  const publishActionLabel = computed(() => {
    const labels = {
      preset_published: '新建 preset',
      evidence_attached: '作为 evidence 附加',
    }
    return labels[publishAction.value] || '-'
  })
  const deleteDisabledReason = computed(() => {
    const status = selectedJob.value?.status
    if (status === 'pending' || status === 'running') {
      return '任务仍在排队或运行中，完成后可删除'
    }
    if (selectedJob.value?.published_preset_id || publishedPresetId.value) {
      return '删除报告与产物；已发布的参数预设会保留'
    }
    return '删除任务、结果与 HTML/combos 产物'
  })
  const universePitQualityLabel = computed(() => {
    const quality = selectedJob.value?.data_watermark?.universe_pit_quality
      || resultDetail.value?.data_watermark?.universe_pit_quality
    if (quality === 'point_in_time') return 'Point-in-time（当时成分）'
    if (quality === 'latest_only') return 'Latest-only（幸存者近似，需复核）'
    return '-'
  })
  const loadParamsHint = '将当前任务参数填入侧栏，可调整后提交重跑（保留来源链路）'

  function onSelectResultRow(row) {
    selectedResultRow.value = row
  }

  function syncSelectedResultRow() {
    selectedResultRow.value = resultDetail.value?.best_row
      || resultDetail.value?.rows?.[0]
      || null
  }

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
    selectedResultRow.value = null
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

  async function loadResearchResultDetail(jobId, isCurrent = () => true) {
    const resultRes = await getPortfolioResearchResults(jobId)
    if (!isCurrent()) return null
    const detail = resultRes.data
    if (!detail) return null
    try {
      const rowsRes = await getPortfolioResearchResultRows(jobId, { page: 1, page_size: 500 })
      if (!isCurrent()) return null
      const fullRows = rowsRes.data?.rows
      if (Array.isArray(fullRows) && fullRows.length) {
        detail.rows = fullRows
        if (rowsRes.data?.total) {
          detail.row_count_total = rowsRes.data.total
        }
      }
    } catch (err) {
      if (!isCurrent() || isRequestCanceled(err)) return null
      // Keep mongo preview rows when artifact pagination is unavailable.
    }
    return detail
  }

  async function selectJob(jobId, { scrollDetail = false } = {}) {
    if (!jobId) return
    const seq = ++selectSeq
    const isCurrent = () => seq === selectSeq && selectedJobId.value === jobId
    selectedJobId.value = jobId
    if (scrollDetail) {
      resultDetail.value = null
      selectedResultRow.value = null
    }
    try {
      const jobRes = await getPortfolioResearchJob(jobId)
      if (!isCurrent()) return
      selectedJob.value = jobRes.data
      if (selectedJob.value?.result_id || selectedJob.value?.status === 'completed') {
        try {
          const detail = await loadResearchResultDetail(jobId, isCurrent)
          if (!isCurrent()) return
          resultDetail.value = detail
          syncSelectedResultRow()
        } catch (err) {
          if (!isCurrent() || isRequestCanceled(err)) return
          if (selectedJob.value?.status === 'completed') {
            setErrorMessage(formatResearchApiError(err, '加载研究结果失败'))
          }
        }
      } else if (scrollDetail) {
        resultDetail.value = null
        selectedResultRow.value = null
      }
      if (scrollDetail) {
        await nextTick()
        if (isCurrent()) scrollDetailToTop()
      }
    } catch (err) {
      if (!isCurrent() || isRequestCanceled(err)) return
      setErrorMessage(formatResearchApiError(err, '加载研究任务失败'))
    }
  }

  async function deleteJob() {
    if (!selectedJobId.value || !selectedJob.value) return
    const jobId = selectedJobId.value
    const name = selectedJob.value.name || jobId
    const presetNote = (selectedJob.value.published_preset_id || publishedPresetId.value)
      ? '\n已发布的参数预设会保留，不会一并删除。'
      : ''
    const confirmed = window.confirm(
      `确认删除研究报告「${name}」？\n将删除任务、结果与 HTML/combos 产物，且不可恢复。${presetNote}`,
    )
    if (!confirmed) return

    deleteLoading.value = true
    setMessage('')
    setErrorMessage('')
    try {
      const res = await deletePortfolioResearchJob(jobId)
      const kept = res.data?.published_preset_kept
      setMessage(kept
        ? `已删除研究报告 ${jobId}（预设 ${kept} 已保留）`
        : `已删除研究报告 ${jobId}`)
      if (selectedJobId.value === jobId) {
        selectedJobId.value = ''
        selectedJob.value = null
        resultDetail.value = null
        selectedResultRow.value = null
      }
      await loadJobs()
    } catch (err) {
      if (!isRequestCanceled(err)) {
        setErrorMessage(formatResearchApiError(err, '删除研究报告失败'))
      }
    } finally {
      deleteLoading.value = false
    }
  }

  async function publish(status) {
    if (!resultDetail.value?.result_id) return
    publishLoading.value = true
    setMessage('')
    setErrorMessage('')
    try {
      const res = await publishPortfolioResearchResult(resultDetail.value.result_id, {
        status,
        selected_row: selectedResultRow.value || resultDetail.value?.best_row || null,
      })
      if (res.data?.attached_to_existing) {
        setMessage(`参数已存在，已作为 evidence 附加到预设 ${res.data?.preset?.preset_id}`)
      } else {
        setMessage(`已保存参数预设 ${res.data?.preset?.preset_id}`)
      }
      await selectJob(selectedJobId.value, { scrollDetail: false })
      await loadJobs()
    } catch (err) {
      if (!isRequestCanceled(err)) {
        setErrorMessage(formatResearchApiError(err, '发布策略失败'))
      }
    } finally {
      publishLoading.value = false
    }
  }

  async function openArtifact(jobId) {
    artifactLoading.value = true
    setErrorMessage('')
    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch(`${apiBase}/portfolio-research/jobs/${jobId}/artifact`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!response.ok) {
        const text = await response.text()
        throw new Error(text || `HTTP ${response.status}`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      if (!isRequestCanceled(err)) {
        setErrorMessage(err.message || '打开报告失败')
      }
    } finally {
      artifactLoading.value = false
    }
  }

  onBeforeUnmount(() => {
    selectSeq += 1
    window.removeEventListener('keydown', onDetailFullscreenKeydown, true)
    document.body.style.overflow = ''
  })

  return {
    selectedJobId,
    selectedJob,
    resultDetail,
    selectedResultRow,
    deleteLoading,
    publishLoading,
    artifactLoading,
    detailMaximized,
    detailBodyRef,
    mobileShowDetail,
    resultRows,
    candidateConfig,
    researchParamRows,
    publishedPresetId,
    publishedStatus,
    publishAction,
    hasPublishedPreset,
    publishedPresetLabel,
    publishActionLabel,
    deleteDisabledReason,
    universePitQualityLabel,
    loadParamsHint,
    onSelectResultRow,
    syncSelectedResultRow,
    scrollDetailToTop,
    toggleDetailFullscreen,
    exitDetailFullscreen,
    backToList,
    loadResearchResultDetail,
    selectJob,
    deleteJob,
    publish,
    openArtifact,
  }
}
