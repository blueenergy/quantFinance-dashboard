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

export function getBatch(batchId) {
  return request({ url: `/backtest/batches/${batchId}`, method: 'get' })
}

export function getBatchResults(batchId, params = {}) {
  return request({ url: `/backtest/batches/${batchId}/results`, method: 'get', params })
}

export function cancelBatch(batchId) {
  return request({ url: `/backtest/batches/${batchId}/cancel`, method: 'post' })
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
