import request from '../utils/request'

export function listFactorCatalog(params = {}) {
  return request({ url: '/factor-backtest/factors', method: 'get', params })
}

export function listFactorBacktestJobs(params = {}) {
  return request({ url: '/factor-backtest/jobs', method: 'get', params })
}

export function createFactorBacktestJob(data) {
  return request({ url: '/factor-backtest/jobs', method: 'post', data })
}

export function getFactorBacktestJob(jobId) {
  return request({ url: `/factor-backtest/jobs/${jobId}`, method: 'get' })
}

export function getFactorBacktestResults(jobId) {
  return request({ url: `/factor-backtest/jobs/${jobId}/results`, method: 'get' })
}

export function deleteFactorBacktestJob(jobId) {
  return request({ url: `/factor-backtest/jobs/${jobId}`, method: 'delete' })
}
