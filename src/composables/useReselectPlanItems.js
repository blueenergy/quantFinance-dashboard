import { computed, ref } from 'vue'
import {
  bulkRejectPortfolioPlanItems,
  rejectPortfolioPlanItem,
  restorePortfolioPlanItem,
} from '../api/portfolioPlans'
import { riskDisplaySeverity } from './usePortfolioPlanFormat'

function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

/**
 * Shared plan-item reselect (exclude / restore / bulk reject) for portfolio
 * overview review and portfolio plans detail. The view supplies runTask, which
 * must poll to completion and refresh plan detail before resolving so
 * describeReselectResult can diff against fresh items.
 */
export function useReselectPlanItems({
  getPlanId,
  getItems,
  getExcluded,
  runTask,
  setMessage,
  onTaskEnqueued,
} = {}) {
  const actionLoading = ref(false)
  const pendingReselect = ref(null)
  const lastReselectSummary = ref('')
  const reselectStatus = ref({ state: 'idle', text: '' })
  const reselectTaskMeta = ref({ taskId: '', status: '' })
  const selectedReselectSymbols = ref(new Set())

  const reselectBusy = computed(() => reselectStatus.value.state === 'running')
  const selectedReselectCount = computed(() => selectedReselectSymbols.value.size)
  const selectedPlanExcluded = computed(() => getExcluded?.() || [])

  function canSelectReselectItem(item) {
    return Boolean(item?.symbol && item.rank != null && !selectedPlanExcluded.value.includes(item.symbol))
  }

  function targetSymbols(items) {
    return (items || [])
      .filter((item) => item.rank != null)
      .map((item) => item.symbol)
  }

  function describeReselectResult(pending) {
    const items = getItems?.() || []
    const nameOf = (sym) => {
      const hit = items.find((item) => item.symbol === sym)
      return hit?.name ? `${sym}(${hit.name})` : sym
    }
    const before = new Set(pending?.beforeTargets || [])
    const afterTargets = targetSymbols(items)
    const rejected = new Set(pending?.symbols || (pending?.symbol ? [pending.symbol] : []))
    const added = afterTargets.filter((sym) => !before.has(sym) && !rejected.has(sym))
    if (pending?.type === 'bulkReject') {
      const rejectedText = [...rejected].join('、')
      if (added.length) {
        return `已批量排除 ${rejectedText}，补位换为 ${added.map(nameOf).join('、')}`
      }
      return `已批量排除 ${rejectedText}，候选池无可补位标的（目标持仓数减少）`
    }
    if (pending?.type === 'restore') {
      return afterTargets.includes(pending.symbol)
        ? `已恢复 ${nameOf(pending.symbol)}，重新纳入目标`
        : `已恢复 ${pending.symbol}（当前排名未进入目标）`
    }
    if (added.length) {
      return `已排除 ${pending.symbol}，补位换为 ${added.map(nameOf).join('、')}`
    }
    return `已排除 ${pending.symbol}，候选池无可补位标的（目标持仓数减少）`
  }

  /** Clear in-flight selection only; keep success summary visible. */
  function resetReselectSelection() {
    selectedReselectSymbols.value = new Set()
    pendingReselect.value = null
    if (reselectStatus.value.state === 'running') {
      reselectStatus.value = { state: 'idle', text: '' }
    }
    if (reselectTaskMeta.value.status === 'pending' || reselectTaskMeta.value.status === 'running') {
      reselectTaskMeta.value = { taskId: '', status: '' }
    }
  }

  /** Full reset when switching plans or leaving review context. */
  function clearReselectUi() {
    resetReselectSelection()
    lastReselectSummary.value = ''
    reselectStatus.value = { state: 'idle', text: '' }
    reselectTaskMeta.value = { taskId: '', status: '' }
  }

  function toggleReselectSelection(symbol, checked) {
    if (!symbol) return
    const next = new Set(selectedReselectSymbols.value)
    if (checked) next.add(symbol)
    else next.delete(symbol)
    selectedReselectSymbols.value = next
  }

  function selectHighRiskReselectItems() {
    const symbols = (getItems?.() || [])
      .filter((item) => canSelectReselectItem(item) && riskDisplaySeverity(item?.ai_risk) === 'high')
      .map((item) => item.symbol)
    if (!symbols.length) {
      setMessage?.('当前没有可批量换股的 AI 高风险标的', false)
      return
    }
    const allHighSelected = symbols.every((sym) => selectedReselectSymbols.value.has(sym))
    const next = new Set(selectedReselectSymbols.value)
    if (allHighSelected) {
      symbols.forEach((sym) => next.delete(sym))
    } else {
      symbols.forEach((sym) => next.add(sym))
    }
    selectedReselectSymbols.value = next
  }

  async function finishTaskRun(taskId, pendingSnapshot) {
    reselectTaskMeta.value = { taskId, status: 'running' }
    try {
      const result = await runTask(taskId, pendingSnapshot)
      const summary = describeReselectResult(pendingSnapshot)
      lastReselectSummary.value = summary
      reselectStatus.value = { state: 'success', text: summary }
      reselectTaskMeta.value = { taskId, status: 'completed' }
      setMessage?.(summary, false)
      resetReselectSelection()
      return result
    } catch (error) {
      const detailText = formatApiDetail(error?.response?.data?.detail)
      const errText = detailText || error?.message || '重选任务失败'
      reselectStatus.value = { state: 'error', text: `重选任务失败：${errText}` }
      reselectTaskMeta.value = { taskId, status: 'failed' }
      setMessage?.(errText, true)
      throw error
    }
  }

  async function reselectItem(symbol, restore = false) {
    const planId = getPlanId?.()
    if (!planId || !symbol || reselectBusy.value) return
    if (restore && !selectedPlanExcluded.value.includes(symbol)) {
      const txt = `无需恢复：${symbol} 当前不在已排除列表中`
      reselectStatus.value = { state: 'success', text: txt }
      lastReselectSummary.value = txt
      return
    }
    actionLoading.value = true
    const beforeTargets = targetSymbols(getItems?.())
    try {
      const apiCall = restore ? restorePortfolioPlanItem : rejectPortfolioPlanItem
      const res = await apiCall(planId, symbol)
      const task = res.data?.task
      if (task?.task_id) {
        lastReselectSummary.value = ''
        const pendingSnapshot = { type: restore ? 'restore' : 'reject', symbol, beforeTargets }
        pendingReselect.value = pendingSnapshot
        reselectTaskMeta.value = { taskId: task.task_id, status: 'pending' }
        reselectStatus.value = {
          state: 'running',
          text: restore
            ? `正在恢复 ${symbol}，任务 ${task.task_id} 执行中…`
            : `正在重选 ${symbol}，任务 ${task.task_id} 执行中…`,
        }
        setMessage?.(
          restore ? `已恢复 ${symbol}，正在重算计划…` : `已排除 ${symbol}，正在重选补位…`,
          false,
        )
        await onTaskEnqueued?.(task)
        await finishTaskRun(task.task_id, pendingSnapshot)
      } else if (res.data?.operation_log?.status === 'noop') {
        const noopMsg = res.data?.operation_log?.message || `无需恢复：${symbol}`
        reselectStatus.value = { state: 'success', text: noopMsg }
        lastReselectSummary.value = noopMsg
        setMessage?.(noopMsg, false)
      } else {
        reselectStatus.value = { state: 'error', text: '重选任务创建失败：未返回 task_id' }
        reselectTaskMeta.value = { taskId: '', status: 'create_failed' }
      }
    } catch (error) {
      const detailText = formatApiDetail(error.response?.data?.detail)
      const errText = detailText || error.message || '重选失败'
      reselectStatus.value = { state: 'error', text: `重选失败：${errText}` }
      reselectTaskMeta.value = { taskId: '', status: 'request_failed' }
      setMessage?.(errText, true)
    } finally {
      actionLoading.value = false
      pendingReselect.value = null
    }
  }

  async function bulkReselectItems() {
    const planId = getPlanId?.()
    if (!planId || reselectBusy.value || !selectedReselectCount.value) return
    const symbols = [...selectedReselectSymbols.value]
    actionLoading.value = true
    const beforeTargets = targetSymbols(getItems?.())
    try {
      const res = await bulkRejectPortfolioPlanItems(planId, symbols)
      const task = res.data?.task
      if (task?.task_id) {
        lastReselectSummary.value = ''
        const pendingSnapshot = { type: 'bulkReject', symbols, beforeTargets }
        pendingReselect.value = pendingSnapshot
        selectedReselectSymbols.value = new Set()
        reselectTaskMeta.value = { taskId: task.task_id, status: 'pending' }
        reselectStatus.value = {
          state: 'running',
          text: `正在批量重选 ${symbols.length} 只标的，任务 ${task.task_id} 执行中…`,
        }
        setMessage?.(`已排除 ${symbols.join('、')}，正在批量重选补位…`, false)
        await onTaskEnqueued?.(task)
        await finishTaskRun(task.task_id, pendingSnapshot)
      } else {
        reselectStatus.value = { state: 'error', text: '批量重选任务创建失败：未返回 task_id' }
        reselectTaskMeta.value = { taskId: '', status: 'create_failed' }
      }
    } catch (error) {
      const detailText = formatApiDetail(error.response?.data?.detail)
      const errText = detailText || error.message || '批量重选失败'
      reselectStatus.value = { state: 'error', text: `批量重选失败：${errText}` }
      reselectTaskMeta.value = { taskId: '', status: 'request_failed' }
      setMessage?.(errText, true)
    } finally {
      actionLoading.value = false
      pendingReselect.value = null
    }
  }

  return {
    actionLoading,
    pendingReselect,
    lastReselectSummary,
    reselectStatus,
    reselectTaskMeta,
    selectedReselectSymbols,
    reselectBusy,
    selectedReselectCount,
    selectedPlanExcluded,
    canSelectReselectItem,
    describeReselectResult,
    resetReselectSelection,
    clearReselectUi,
    toggleReselectSelection,
    selectHighRiskReselectItems,
    reselectItem,
    bulkReselectItems,
  }
}
