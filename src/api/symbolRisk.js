import request from '../utils/request'

export function addManualSymbolRisk(symbol, data = {}, params = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/risk-findings`,
    method: 'post',
    data,
    params,
  })
}

export function confirmSymbolRiskResolution(symbol, findingKey, data = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/risk-findings/${encodeURIComponent(findingKey)}/confirm-resolution`,
    method: 'post',
    data,
  })
}

export function resolveSymbolRisk(symbol, findingKey, data = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/risk-findings/${encodeURIComponent(findingKey)}/resolve`,
    method: 'post',
    data,
  })
}

export function reopenSymbolRisk(symbol, findingKey, data = {}) {
  return request({
    url: `/symbols/${encodeURIComponent(symbol)}/risk-findings/${encodeURIComponent(findingKey)}/reopen`,
    method: 'post',
    data,
  })
}
