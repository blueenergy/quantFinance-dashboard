import request from '../utils/request'

export function getIntradayT0ExecutionSettings() {
  return request.get('/intraday-t0/execution/settings')
}

export function updateIntradayT0ExecutionSettings(data = {}) {
  return request.put('/intraday-t0/execution/settings', data)
}

export function previewIntradayT0Execution(data = {}) {
  return request.post('/intraday-t0/execution/preview', data)
}

export function submitIntradayT0Execution(data = {}) {
  return request.post('/intraday-t0/execution/submit', data)
}

export function listIntradayT0Executions(params = {}) {
  return request.get('/intraday-t0/execution/history', { params })
}
