import request from '../utils/request'

export function listScoreAuditJobs(params = {}) {
  return request({ url: '/score-audit/jobs', method: 'get', params })
}

export function createScoreAuditJob(data) {
  return request({ url: '/score-audit/jobs', method: 'post', data })
}

export function getScoreAuditJob(jobId) {
  return request({ url: `/score-audit/jobs/${jobId}`, method: 'get' })
}

export function addScoreAuditRepairNote(jobId, data) {
  return request({ url: `/score-audit/jobs/${jobId}/repair-notes`, method: 'post', data })
}
