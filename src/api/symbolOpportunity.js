import request from '../utils/request'

export function addManualSymbolOpportunity(symbol, data = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/opportunity-findings`,
    method: 'post',
    data,
  })
}

export function realizeSymbolOpportunity(symbol, findingKey, data = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/opportunity-findings/${encodeURIComponent(findingKey)}/realize`,
    method: 'post',
    data,
  })
}

export function invalidateSymbolOpportunity(symbol, findingKey, data = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/opportunity-findings/${encodeURIComponent(findingKey)}/invalidate`,
    method: 'post',
    data,
  })
}

export function reopenSymbolOpportunity(symbol, findingKey, data = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/opportunity-findings/${encodeURIComponent(findingKey)}/reopen`,
    method: 'post',
    data,
  })
}
