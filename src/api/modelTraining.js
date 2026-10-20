import request from '../utils/request'

export function listModelTrainingJobs(params = {}) {
  return request({ url: '/model-training/jobs', method: 'get', params })
}

export function listModelTrainingSnapshots(params = {}) {
  return request({ url: '/model-training/snapshots', method: 'get', params })
}

export function listPredictionModels(params = {}) {
  return request({ url: '/model-training/prediction-models', method: 'get', params })
}

export function createModelTrainingJob(data) {
  return request({ url: '/model-training/jobs', method: 'post', data })
}

export function getModelTrainingJob(jobId) {
  return request({ url: `/model-training/jobs/${jobId}`, method: 'get' })
}

export function getModelTrainingResults(jobId) {
  return request({ url: `/model-training/jobs/${jobId}/results`, method: 'get' })
}

export function getModelTrainingPromotionContext(jobId) {
  return request({ url: `/model-training/jobs/${jobId}/promotion-context`, method: 'get' })
}
