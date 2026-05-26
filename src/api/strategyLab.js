import request from '../utils/request'

export function listBatches(params = {}) {
  return request({ url: '/backtest/batches', method: 'get', params })
}

export function createBatch(data) {
  return request({ url: '/backtest/batches', method: 'post', data })
}

export function listStrategies() {
  return request({ url: '/strategy/strategies', method: 'get' })
}

export function listStrategyTemplates(params = {}) {
  return request({ url: '/strategy/templates', method: 'get', params })
}

export function listEtfs(params = {}) {
  return request({ url: '/etf/list', method: 'get', params })
}

export function getBatch(batchId) {
  return request({ url: `/backtest/batches/${batchId}`, method: 'get' })
}

export function getBatchResults(batchId, params = {}) {
  return request({ url: `/backtest/batches/${batchId}/results`, method: 'get', params })
}

export function cancelBatch(batchId) {
  return request({ url: `/backtest/batches/${batchId}/cancel`, method: 'post' })
}

export function deleteBatch(batchId) {
  return request({ url: `/backtest/batches/${batchId}`, method: 'delete' })
}

export function deleteBacktestTask(taskId) {
  return request({ url: `/backtest/tasks/${taskId}`, method: 'delete' })
}

export function retryFailedBatch(batchId) {
  return request({ url: `/backtest/batches/${batchId}/retry-failed`, method: 'post' })
}

export function requestBatchReview(batchId, data = {}) {
  return request({ url: `/backtest/batches/${batchId}/review`, method: 'post', data })
}

export function listBatchReviews(batchId, params = {}) {
  return request({ url: `/backtest/batches/${batchId}/reviews`, method: 'get', params })
}

export function rerunBatch(batchId, data = {}) {
  return request({ url: `/backtest/batches/${batchId}/rerun`, method: 'post', data })
}

export function listLoops(params = {}) {
  return request({ url: '/backtest/loops', method: 'get', params })
}

export function getLoopHealth() {
  return request({ url: '/backtest/loops/health', method: 'get' })
}

export function createLoop(data) {
  return request({ url: '/backtest/loops', method: 'post', data })
}

export function getLoop(loopId) {
  return request({ url: `/backtest/loops/${loopId}`, method: 'get' })
}

export function getLoopSummary(loopId) {
  return request({ url: `/backtest/loops/${loopId}/summary`, method: 'get' })
}

export function queueLoopFinalReport(loopId, force = false) {
  return request({
    url: `/backtest/loops/${loopId}/final-report`,
    method: 'post',
    params: { force },
  })
}

export function pauseLoop(loopId) {
  return request({ url: `/backtest/loops/${loopId}/pause`, method: 'post' })
}

export function resumeLoop(loopId) {
  return request({ url: `/backtest/loops/${loopId}/resume`, method: 'post' })
}

export function cancelLoop(loopId) {
  return request({ url: `/backtest/loops/${loopId}/cancel`, method: 'post' })
}

export function deleteLoop(loopId) {
  return request({ url: `/backtest/loops/${loopId}`, method: 'delete' })
}

export function advanceLoop(loopId) {
  return request({ url: `/backtest/loops/${loopId}/advance`, method: 'post' })
}
