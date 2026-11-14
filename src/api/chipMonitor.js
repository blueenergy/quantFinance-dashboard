import request from '../utils/request'

export function getChipMonitorLatest(params = {}) {
  return request({ url: '/chip-monitor/latest', method: 'get', params })
}
