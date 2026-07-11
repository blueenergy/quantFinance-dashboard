export function canExecutePaperNowFromState({
  planStatus,
  hasLiveSignals = false,
  hasPaperExecution = false,
  missingExecuteDate = false,
  isPaperPortfolio = true,
}) {
  if (!isPaperPortfolio) return false
  if (planStatus !== 'approved') return false
  if (hasLiveSignals) return false
  if (hasPaperExecution) return false
  if (missingExecuteDate) return false
  return true
}

export function paperExecuteReadyTextFromState({
  hasPaperExecution = false,
  hasLiveSignals = false,
  planStatus,
  executionStatus = null,
  isPaperPortfolio = true,
}) {
  if (!isPaperPortfolio) return '仅纸面组合支持 Paper 执行'
  if (hasPaperExecution) return '该 plan 已执行过 Paper，不能重复执行'
  if (hasLiveSignals) return '该 plan 存在实盘信号历史，不能再执行 Paper'
  if (planStatus !== 'approved') return '需要先审核通过 plan'
  if (executionStatus?.missing_execute_date) {
    return '缺少 execute_date，请等待自动执行或先补齐下一交易日 execute_date'
  }
  const fallbackCount = executionStatus?.execution_price_fallback_count ?? 0
  if (fallbackCount > 0) {
    const examples = (executionStatus?.execution_price_fallback_examples || []).slice(0, 3).join(', ')
    const suffix = examples ? `（如 ${examples}）` : ''
    return `优先使用 execute_date 开盘价；${fallbackCount} 个标的将回退最近收盘价/计划价${suffix}`
  }
  if (executionStatus?.open_price_ready === false) {
    const date = executionStatus.execute_date || executionStatus.effective_execute_date || '-'
    const count = executionStatus.missing_open_price_count ?? 0
    return `开盘价未就绪（execute_date=${date}，缺失 ${count} 个），将回退最近收盘价/计划价`
  }
  return '优先使用 execute_date 开盘价；缺失时回退最近收盘价/计划价'
}

export function paperExecutionPriceStatusText(executionStatus = null) {
  if (!executionStatus) return '-'
  if (executionStatus.execution_price_ready) return '已就绪'
  const missing = executionStatus.missing_execution_price_count ?? 0
  if (missing > 0) return `部分缺失（${missing} 个）`
  return '待确认'
}
