import request from '../utils/request'

/**
 * 获取深度分析历史记录
 */
export function getDeepAnalysisHistory(params = {}) {
  return request({
    url: '/analysis/strategy/analysis-detail',
    method: 'get',
    params
  })
}

/**
 * 获取特定策略的分析详情
 */
export function getStrategyAnalysisDetail(strategyName, params = {}) {
  return request({
    url: `/analysis/strategy/${strategyName}/analysis-detail`,
    method: 'get',
    params
  })
}

/**
 * 获取特定股票的分析详情
 */
export function getSymbolAnalysisDetail(symbol, params = {}) {
  return request({
    url: `/analysis/symbol/${symbol}/analysis-detail`,
    method: 'get',
    params
  })
}

/**
 * 获取分析摘要统计
 */
export function getAnalysisSummary() {
  return request({
    url: '/analysis/analysis-summary',
    method: 'get'
  })
}