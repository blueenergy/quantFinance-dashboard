import request from '../utils/request'

export function getNationalTeamSnapshot(params = {}) {
  return request({
    url: '/etf/national-team/snapshot',
    method: 'get',
    params,
  })
}

export function getNationalTeamCurve(params = {}) {
  return request({
    url: '/etf/national-team/curve',
    method: 'get',
    params,
  })
}
