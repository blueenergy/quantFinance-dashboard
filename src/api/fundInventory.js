import request from '../utils/request'

export function getFundInventoryPeriods() {
  return request({ url: '/fund-inventory/periods', method: 'get' })
}

export function getFundInventoryPairs(params = {}) {
  return request({ url: '/fund-inventory/pairs', method: 'get', params })
}

export function getFundInventorySnapshots(params = {}) {
  return request({ url: '/fund-inventory/snapshots', method: 'get', params })
}

export function getFundInventoryComparison(params = {}) {
  return request({ url: '/fund-inventory/comparison', method: 'get', params })
}

export function triggerFundInventoryReview(data = {}) {
  return request({ url: '/fund-inventory/analysis/trigger', method: 'post', data })
}

export function getAnalysisTask(taskId) {
  return request({ url: `/analysis-tasks/${encodeURIComponent(taskId)}`, method: 'get' })
}
