import request from '../utils/request'

export function listModelScoreModels() {
  return request({ url: '/model-scores/models', method: 'get' })
}

export function getDailyModelScores(params = {}) {
  return request({ url: '/model-scores/daily', method: 'get', params })
}
