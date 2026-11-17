import request from '../utils/request'

export function getModelRegistrySummary() {
  return request({ url: '/model-registry/summary', method: 'get' })
}

export function listRegistryModels(params = {}) {
  return request({ url: '/model-registry/models', method: 'get', params })
}

export function getRegistryModel(modelId) {
  return request({ url: `/model-registry/models/${encodeURIComponent(modelId)}`, method: 'get' })
}

export function transitionRegistryModel(modelId, data) {
  return request({
    url: `/model-registry/models/${encodeURIComponent(modelId)}/transition`,
    method: 'post',
    data,
  })
}
