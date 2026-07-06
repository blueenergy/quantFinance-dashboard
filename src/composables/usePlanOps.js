import { computed, ref } from 'vue'
import {
  approvePortfolioPlan,
  cancelPortfolioPlan,
  executePortfolioPlanPaper,
  publishPortfolioPlanLiveSignals,
  rejectPortfolioPlan,
  replanPortfolioPlanRemainder,
} from '../api/portfolioPlans'
import { blockerText } from './usePortfolioPlanFormat'

function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item?.msg || item?.message || JSON.stringify(item)).join('；')
  if (typeof detail === 'object') return detail.message || detail.msg || JSON.stringify(detail)
  return String(detail)
}

// Summarize per-symbol risk blockers so the toast reflects *why* a publish/topup
// was rejected, not just the generic top-level message.
function summarizeRiskBlockers(detail) {
  const items = detail?.risk_report?.items
  if (!Array.isArray(items)) return ''
  const reasons = items.flatMap((item) =>
    (item.blockers || []).map((blocker) => `${item.symbol}: ${blockerText(blocker)}`),
  )
  const cashBlockers = (detail?.cash_blockers || []).map((blocker) => blockerText(blocker))
  return [...reasons, ...cashBlockers].slice(0, 8).join('；')
}

// Build the clearest possible failure text from an axios error: prefer the
// backend detail, enrich with specific risk blockers, and always fall back to
// the HTTP status so a bare 500 never surfaces as an opaque axios message.
function formatApiError(error, fallback) {
  const response = error?.response
  const detail = response?.data?.detail
  const base = formatApiDetail(detail) || formatApiDetail(response?.data?.message)
  const blockers = summarizeRiskBlockers(detail)
  const message = [base, blockers].filter(Boolean).join('：')
  if (message) return message
  if (response) {
    const statusText = response.statusText ? ` ${response.statusText}` : ''
    return `${fallback}（HTTP ${response.status}${statusText}）`
  }
  return error?.message || fallback
}

export function usePlanOps({
  selectedOperationPlanId,
  selectedLiveAccountId,
  canPublishLiveSignals,
  canExecutePaperNow,
  canCancelCurrentPlan,
  reviewPlanId,
  onRefresh,
  onMessage,
}) {
  const livePublishPreview = ref(null)
  const livePublishLoading = ref(false)
  const showPublishModal = ref(false)
  const paperExecuteLoading = ref(false)
  const cancelPlanLoading = ref(false)
  const remainderPreview = ref(null)
  const remainderLoading = ref(false)
  const remainderReason = ref('')
  const approveSubmitting = ref(false)
  const rejectSubmitting = ref(false)

  const livePublishBlockers = computed(() => {
    const items = livePublishPreview.value?.risk_report?.items || []
    const riskBlockers = items.flatMap((item) =>
      (item.blockers || []).map((blocker) => `${item.symbol}: ${blockerText(blocker)}`),
    )
    // Plan-level reprice/capital blockers (e.g. missing_price, missing_plan_equity)
    // are not tied to a single signal item, but still hard-block confirm on the
    // backend; surface them so the confirm button disables consistently.
    const repriceBlockers = (livePublishPreview.value?.reprice_summary?.blockers || []).map((blocker) =>
      blockerText(blocker),
    )
    return [...riskBlockers, ...repriceBlockers]
  })

  const livePublishRiskRows = computed(() => livePublishPreview.value?.risk_report?.items || [])
  const livePublishRepriceRows = computed(() => livePublishPreview.value?.reprice_summary?.items || [])
  const remainderRows = computed(() => remainderPreview.value?.remainder || [])
  const remainderActionableCount = computed(() => remainderPreview.value?.actionable_count || 0)
  const remainderBlockers = computed(() => {
    const items = remainderPreview.value?.risk_report?.items || []
    const riskBlockers = items.flatMap((item) =>
      (item.blockers || []).map((blocker) => `${item.symbol}: ${blockerText(blocker)}`),
    )
    const cashBlockers = (remainderPreview.value?.cash_blockers || []).map((blocker) => blockerText(blocker))
    return [...riskBlockers, ...cashBlockers]
  })

  async function previewLivePublish() {
    const planId = selectedOperationPlanId.value
    if (!planId || !selectedLiveAccountId.value || !canPublishLiveSignals.value) return
    livePublishLoading.value = true
    onMessage('', false)
    try {
      const res = await publishPortfolioPlanLiveSignals(planId, {
        securities_account_id: selectedLiveAccountId.value,
        dry_run: true,
      })
      livePublishPreview.value = res.data || {}
      showPublishModal.value = true
    } catch (error) {
      onMessage(formatApiError(error, '实盘发布预检失败'), true)
    } finally {
      livePublishLoading.value = false
    }
  }

  async function publishLiveSignals() {
    const planId = selectedOperationPlanId.value
    if (!planId || !selectedLiveAccountId.value || !canPublishLiveSignals.value) return
    livePublishLoading.value = true
    onMessage('', false)
    try {
      const res = await publishPortfolioPlanLiveSignals(planId, {
        securities_account_id: selectedLiveAccountId.value,
        dry_run: false,
      })
      livePublishPreview.value = res.data || {}
      showPublishModal.value = false
      onMessage(`已发布 ${res.data?.inserted_count ?? 0} 条 live signals，已有 ${res.data?.existing_count ?? 0} 条。`, false)
      await onRefresh()
    } catch (error) {
      const detail = error.response?.data?.detail
      livePublishPreview.value = detail?.risk_report ? { risk_report: detail.risk_report, blocked: true } : livePublishPreview.value
      onMessage(formatApiError(error, '实盘发布失败'), true)
      showPublishModal.value = true
    } finally {
      livePublishLoading.value = false
    }
  }

  async function previewRemainder() {
    const planId = selectedOperationPlanId.value
    if (!planId || !selectedLiveAccountId.value) return
    remainderLoading.value = true
    onMessage('', false)
    try {
      const res = await replanPortfolioPlanRemainder(planId, {
        securities_account_id: selectedLiveAccountId.value,
        dry_run: true,
        reason: remainderReason.value || '',
      })
      remainderPreview.value = res.data || {}
    } catch (error) {
      onMessage(formatApiError(error, '补缺口预检失败'), true)
    } finally {
      remainderLoading.value = false
    }
  }

  async function confirmRemainder() {
    const planId = selectedOperationPlanId.value
    if (!planId || !selectedLiveAccountId.value) return
    remainderLoading.value = true
    onMessage('', false)
    try {
      const res = await replanPortfolioPlanRemainder(planId, {
        securities_account_id: selectedLiveAccountId.value,
        dry_run: false,
        reason: remainderReason.value || '',
      })
      remainderPreview.value = res.data || {}
      onMessage(`已补发 ${res.data?.inserted_count ?? 0} 条 plan_topup 信号。`, false)
      await onRefresh()
    } catch (error) {
      const detail = error.response?.data?.detail
      remainderPreview.value = detail?.risk_report
        ? { ...(remainderPreview.value || {}), risk_report: detail.risk_report, blocked: true }
        : remainderPreview.value
      onMessage(formatApiError(error, '补缺口失败'), true)
    } finally {
      remainderLoading.value = false
    }
  }

  async function executePaperNow() {
    const planId = selectedOperationPlanId.value
    if (!planId || !canExecutePaperNow.value) return
    paperExecuteLoading.value = true
    onMessage('', false)
    try {
      const res = await executePortfolioPlanPaper(planId, { force: false })
      const status = res.data?.status || 'executed_paper'
      onMessage(`Paper 执行已触发：${status}。`, false)
      await onRefresh()
    } catch (error) {
      onMessage(formatApiError(error, '执行 Paper 失败'), true)
    } finally {
      paperExecuteLoading.value = false
    }
  }

  async function cancelCurrentPlan() {
    const planId = selectedOperationPlanId.value
    if (!planId || !canCancelCurrentPlan.value) return
    const ok = window.confirm(
      '确定作废当前计划吗？如果已发布 live signals 且尚未成交，会一起标记为 cancelled；如果已有成交，后端会拒绝作废。'
    )
    if (!ok) return
    cancelPlanLoading.value = true
    onMessage('', false)
    try {
      const res = await cancelPortfolioPlan(planId, { comment: 'cancelled from portfolio overview' })
      const count = res.data?.cancelled_signal_count ?? 0
      onMessage(`计划 ${planId} 已作废，取消 ${count} 条未成交 live signals。`, false)
      await onRefresh()
    } catch (error) {
      onMessage(formatApiError(error, '作废计划失败'), true)
    } finally {
      cancelPlanLoading.value = false
    }
  }

  async function approvePendingPlan() {
    const planId = reviewPlanId.value
    if (!planId) return
    approveSubmitting.value = true
    onMessage('', false)
    try {
      await approvePortfolioPlan(planId, { comment: 'approved from portfolio overview' })
      onMessage(`计划 ${planId} 已批准。`, false)
      await onRefresh()
    } catch (error) {
      onMessage(formatApiError(error, '批准失败'), true)
    } finally {
      approveSubmitting.value = false
    }
  }

  async function rejectPendingPlan() {
    const planId = reviewPlanId.value
    if (!planId) return
    const reason = window.prompt('请输入拒绝原因（可选）', 'rejected from portfolio overview')
    if (reason === null) return
    rejectSubmitting.value = true
    onMessage('', false)
    try {
      await rejectPortfolioPlan(planId, { comment: reason || 'rejected from portfolio overview' })
      onMessage(`计划 ${planId} 已拒绝。`, false)
      await onRefresh()
    } catch (error) {
      onMessage(formatApiError(error, '拒绝失败'), true)
    } finally {
      rejectSubmitting.value = false
    }
  }

  function resetPlanOpsState() {
    livePublishPreview.value = null
    remainderPreview.value = null
    remainderReason.value = ''
    showPublishModal.value = false
  }

  return {
    livePublishPreview,
    livePublishLoading,
    showPublishModal,
    livePublishBlockers,
    livePublishRiskRows,
    livePublishRepriceRows,
    paperExecuteLoading,
    cancelPlanLoading,
    remainderPreview,
    remainderLoading,
    remainderReason,
    remainderRows,
    remainderActionableCount,
    remainderBlockers,
    approveSubmitting,
    rejectSubmitting,
    previewLivePublish,
    publishLiveSignals,
    previewRemainder,
    confirmRemainder,
    executePaperNow,
    cancelCurrentPlan,
    approvePendingPlan,
    rejectPendingPlan,
    resetPlanOpsState,
  }
}
