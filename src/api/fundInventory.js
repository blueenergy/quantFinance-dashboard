import request from '../utils/request'

export function getFundInventoryPeriods() {
  return request({ url: '/fund-inventory/periods', method: 'get' })
}

export function getFundInventorySnapshots(params = {}) {
  return request({ url: '/fund-inventory/snapshots', method: 'get', params })
}
