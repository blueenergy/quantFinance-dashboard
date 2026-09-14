import request from '../utils/request'

export function listOpsRepairJobs(params = {}) {
  return request({ url: '/ops-repair/jobs', method: 'get', params })
}

export function createOpsRepairJob(data) {
  return request({ url: '/ops-repair/jobs', method: 'post', data })
}

export function getOpsRepairJob(jobId) {
  return request({ url: `/ops-repair/jobs/${jobId}`, method: 'get' })
}
