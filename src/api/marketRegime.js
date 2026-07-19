import request, { requestOrNull } from '../utils/request'

export async function getMarketRegimeLatest() {
  return requestOrNull({
    url: '/market-regime/latest',
    method: 'get',
  })
}

export async function getMarketRegimeHistory(limit = 60) {
  return request({
    url: '/market-regime/history',
    method: 'get',
    params: { limit },
  })
}

export async function getMarketBreadthHistory(limit = 120) {
  return request({
    url: '/market-regime/breadth',
    method: 'get',
    params: { limit },
  })
}

export async function getIndexCapeHistory(indexCode = '000300.SH', limit = 180) {
  return request({
    url: '/market-regime/cape',
    method: 'get',
    params: { index_code: indexCode, limit },
  })
}

export async function getMarketRegimeAnalysisLatest() {
  return requestOrNull({
    url: '/market-regime/analysis/latest',
    method: 'get',
  })
}

export async function triggerMarketRegimeAnalysis(date = null, force = false) {
  const params = {}
  if (date) params.date = date
  if (force) params.force = 'true'
  return request({
    url: '/market-regime/analysis/trigger',
    method: 'post',
    params: Object.keys(params).length ? params : undefined,
  })
}
