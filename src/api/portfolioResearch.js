import request from '../utils/request'

export function listPortfolioResearchJobs(params = {}) {
  return request({ url: '/portfolio-research/jobs', method: 'get', params })
}

export function createPortfolioResearchJob(data) {
  return request({ url: '/portfolio-research/jobs', method: 'post', data })
}

export function getPortfolioResearchJob(jobId) {
  return request({ url: `/portfolio-research/jobs/${jobId}`, method: 'get' })
}

export function getPortfolioResearchResults(jobId) {
  return request({ url: `/portfolio-research/jobs/${jobId}/results`, method: 'get' })
}

export function listPortfolioResearchCombos(jobId) {
  return request({ url: `/portfolio-research/jobs/${jobId}/combos`, method: 'get' })
}

export function getPortfolioResearchComboDetail(jobId, comboKey) {
  return request({ url: `/portfolio-research/jobs/${jobId}/combos/${encodeURIComponent(comboKey)}`, method: 'get' })
}

export function publishPortfolioResearchResult(resultId, data = {}) {
  return request({ url: `/portfolio-research/results/${resultId}/publish`, method: 'post', data })
}

export function disablePortfolioResearchPreset(presetId) {
  return request({ url: `/portfolio-research/parameter-presets/${presetId}/disable`, method: 'post' })
}
