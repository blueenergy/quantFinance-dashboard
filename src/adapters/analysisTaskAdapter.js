const STATUS_LABELS = {
  pending: '排队中',
  processing: '处理中',
  completed: '已完成',
  completed_with_parse_error: '已完成(解析失败)',
  failed: '失败'
}

export function normalizeTaskItem(raw = {}) {
  return {
    taskId: raw.task_id || '',
    taskType: raw.task_type || 'deep_analysis',
    status: raw.status || 'unknown',
    symbol: raw.symbol || '-',
    stockName: raw.stock_name || '',
    summary: raw.result_summary || '',
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || '',
    completedAt: raw.completed_at || '',
    dataDate: raw.data_date || '',
    error: raw.error || '',
    renderType: raw.render_type || 'fallback',
    revisionOf: raw.revision_of || null
  }
}

export function normalizeTaskDetail(raw = {}) {
  const taskMeta = raw.task_meta || {}
  return {
    taskId: taskMeta.task_id || '',
    taskType: taskMeta.task_type || 'deep_analysis',
    status: taskMeta.status || 'unknown',
    symbol: taskMeta.symbol || '',
    stockName: taskMeta.stock_name || '',
    createdAt: taskMeta.created_at || '',
    updatedAt: taskMeta.updated_at || '',
    completedAt: taskMeta.completed_at || '',
    dataDate: taskMeta.data_date || '',
    error: taskMeta.error || '',
    baseResult: raw.base_result || null,
    resultCompleteness: raw.result_completeness || 'full',
    renderType: raw.render_type || 'fallback',
    latestRevision: raw.latest_revision || null
  }
}

export function statusLabel(status) {
  return STATUS_LABELS[status] || status || '未知'
}
