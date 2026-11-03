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

export function getNationalTeamDates(params = {}) {
  return request({
    url: '/etf/national-team/dates',
    method: 'get',
    params,
  })
}
