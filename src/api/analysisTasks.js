import request from '../utils/request'

export function listAnalysisTasks(params = {}) {
  return request({
    url: '/analysis-tasks',
    method: 'get',
    params
  })
}

export function getAnalysisTaskDetail(taskId) {
  return request({
    url: `/analysis-tasks/${taskId}`,
    method: 'get'
  })
}

export function getAnalysisTaskResolved(taskId) {
  return request({
    url: `/analysis-tasks/${taskId}/resolved`,
    method: 'get'
  })
}

export function getAnalysisTaskRevisions(taskId) {
  return request({
    url: `/analysis-tasks/${taskId}/revisions`,
    method: 'get'
  })
}

export function submitAnalysisTaskFeedback(taskId, feedback) {
  return request({
    url: `/analysis-tasks/${taskId}/feedback`,
    method: 'post',
    data: { feedback }
  })
}
