import request from '../utils/request'

export function getFactorRegistrySummary() {
  return request({ url: '/factor-registry/summary', method: 'get' })
}

export function listFactorRegistry(params = {}) {
  return request({ url: '/factor-registry/factors', method: 'get', params })
}

export function getFactorRegistryDetail(factorId) {
  return request({
    url: `/factor-registry/factors/${encodeURIComponent(factorId)}`,
    method: 'get',
  })
}

export function listModelCandidates(params = {}) {
  return request({ url: '/factor-registry/model-candidates', method: 'get', params })
}
