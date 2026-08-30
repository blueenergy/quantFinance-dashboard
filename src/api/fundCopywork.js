import request from '../utils/request'

export function getFundCopyworkPeriods() {
  return request({ url: '/fund-copywork/periods', method: 'get' })
}

export function getFundCopyworkWatchlist(params) {
  return request({ url: '/fund-copywork/watchlist', method: 'get', params })
}

export function getFundCopyworkProduct(fundKey, params) {
  return request({
    url: `/fund-copywork/products/${encodeURIComponent(fundKey)}`,
    method: 'get',
    params,
  })
}

export function getFundCopyworkConsensus(params) {
  return request({ url: '/fund-copywork/consensus', method: 'get', params })
}

export function getFundCopyworkStock(symbol, params) {
  return request({
    url: `/fund-copywork/stock/${encodeURIComponent(symbol)}`,
    method: 'get',
    params,
  })
}
