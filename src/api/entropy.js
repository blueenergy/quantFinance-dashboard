import request from '../utils/request'

export function getEntropyDates(params = {}) {
  return request({ url: '/entropy/dates', method: 'get', params })
}

export function getEntropyRankings(params = {}) {
  return request({ url: '/entropy/rankings', method: 'get', params })
}

export function getSymbolEntropyHistory(symbol, params = {}) {
  return request({ url: `/entropy/history/${encodeURIComponent(symbol)}`, method: 'get', params })
}
