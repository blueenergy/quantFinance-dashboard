// Trade execution API client
import request from '../utils/request'

export async function getAllTradeExecutions(limit = 100, skip = 0) {
  return request({
    url: '/trade-executions/',
    method: 'get',
    params: { limit, skip },
  })
}

export async function getTradeExecutionsBySymbol(symbol, limit = 100, skip = 0) {
  return request({
    url: `/trade-executions/symbol/${symbol}`,
    method: 'get',
    params: { limit, skip },
  })
}

export async function getTradeExecutionsByDate(date, limit = 100, skip = 0) {
  return request({
    url: `/trade-executions/date/${date}`,
    method: 'get',
    params: { limit, skip },
  })
}

export async function getTradeExecutionStats() {
  return request({
    url: '/trade-executions/stats',
    method: 'get',
  })
}

export async function getTradeActivitiesStats() {
  return request({
    url: '/trade-activities/stats',
    method: 'get',
  })
}

export async function getTradeStrategies() {
  return request({
    url: '/trade-executions/strategies',
    method: 'get',
  })
}

function buildTradeActivitiesParams(params = {}) {
  const result = {}
  if (params.limit) result.limit = params.limit
  if (params.skip) result.skip = params.skip
  if (params.days) result.days = params.days
  if (params.all_dates) result.all_dates = 'true'
  if (params.start_date) result.start_date = params.start_date
  if (params.end_date) result.end_date = params.end_date
  if (params.status_filter) result.status_filter = params.status_filter
  if (params.activity_type) result.activity_type = params.activity_type
  return result
}

export async function getAllTradeActivities(params = {}) {
  return request({
    url: '/trade-activities/',
    method: 'get',
    params: buildTradeActivitiesParams(params),
  })
}

export async function previewTraderSignalReprice(orderId) {
  try {
    return await request({
      url: `/trader/signals/${encodeURIComponent(orderId)}/reprice`,
      method: 'post',
      data: {},
    })
  } catch (err) {
    const text = typeof err.response?.data === 'string'
      ? err.response.data
      : err.response?.data?.detail || err.response?.data?.message
    throw new Error(text || `reprice preview failed: ${err.response?.status || 'unknown'}`)
  }
}

export async function confirmTraderSignalReprice(orderId, body) {
  try {
    return await request({
      url: `/trader/signals/${encodeURIComponent(orderId)}/reprice/confirm`,
      method: 'post',
      data: body,
    })
  } catch (err) {
    const text = typeof err.response?.data === 'string'
      ? err.response.data
      : err.response?.data?.detail || err.response?.data?.message
    throw new Error(text || `reprice confirm failed: ${err.response?.status || 'unknown'}`)
  }
}

export async function getTradePnlSummary(params = {}) {
  const queryParams = {}
  if (params.days) queryParams.days = params.days
  if (params.all_dates) queryParams.all_dates = 'true'
  if (params.start_date) queryParams.start_date = params.start_date
  if (params.end_date) queryParams.end_date = params.end_date

  return request({
    url: '/trade-executions/pnl-summary',
    method: 'get',
    params: Object.keys(queryParams).length ? queryParams : undefined,
  })
}
