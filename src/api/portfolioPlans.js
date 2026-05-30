import request from '../utils/request'

export function listPortfolioStrategies(params = {}) {
  return request({ url: '/portfolio-plans/strategies', method: 'get', params })
}

export function listPortfolioPlans(params = {}) {
  return request({ url: '/portfolio-plans/plans', method: 'get', params })
}

export function generatePortfolioPlan(data) {
  return request({ url: '/portfolio-plans/plans/generate', method: 'post', data })
}

export function getPortfolioPlanGenerationTask(taskId) {
  return request({ url: `/portfolio-plans/plans/generation-tasks/${taskId}`, method: 'get' })
}

export function listPortfolioPlanGenerationTasks(params = {}) {
  return request({ url: '/portfolio-plans/plans/generation-tasks', method: 'get', params })
}

export function listPortfolioWorkerStatus(params = {}) {
  return request({ url: '/portfolio-plans/workers/status', method: 'get', params })
}

export function getPortfolioPlanGenerationWatermark(params = {}) {
  return request({ url: '/portfolio-plans/data-watermarks/plan-generation', method: 'get', params })
}

export function getPortfolioPlan(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}`, method: 'get' })
}

export function approvePortfolioPlan(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/approve`, method: 'post', data })
}

export function rejectPortfolioPlan(planId, data = {}) {
  return request({ url: `/portfolio-plans/plans/${planId}/reject`, method: 'post', data })
}

export function getPortfolioPlanExecutions(planId) {
  return request({ url: `/portfolio-plans/plans/${planId}/executions`, method: 'get' })
}

export function getPortfolioStrategyEquity(strategyId, params = {}) {
  return request({ url: `/portfolio-plans/strategies/${strategyId}/equity`, method: 'get', params })
}

export function getPortfolioStrategyRealtimeEquity(strategyId) {
  return request({ url: `/portfolio-plans/strategies/${strategyId}/realtime-equity`, method: 'get' })
}
