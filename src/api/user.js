// Simple user API client
import request from '../utils/request'

export async function getWatchlist() {
  return request({
    url: '/user/watchlist',
    method: 'get',
  })
}

export async function getWatchlistStrategies() {
  return request({
    url: '/user/watchlist/strategies',
    method: 'get',
  })
}

export async function setWatchlistStrategy(payload) {
  try {
    return await request({
      url: '/user/watchlist/strategy',
      method: 'post',
      data: payload,
    })
  } catch (err) {
    const data = err.response?.data
    const message = data?.detail || data?.message || `设置策略失败：${err.response?.status || 'unknown'}`
    throw new Error(message)
  }
}

export async function getAvailableStrategies() {
  const data = await request({
    url: '/strategy/strategies',
    method: 'get',
  })
  if (Array.isArray(data)) return data
  if (Array.isArray(data.strategies)) return data.strategies
  return []
}

export async function getSecuritiesAccounts() {
  return request({
    url: '/user/securities_accounts',
    method: 'get',
  })
}

export async function createSecuritiesAccount(payload) {
  return request({
    url: '/user/securities_accounts',
    method: 'post',
    data: payload,
  })
}

export async function updateSecuritiesAccount(account_id, payload) {
  return request({
    url: `/user/securities_accounts/${account_id}`,
    method: 'put',
    data: payload,
  })
}

export async function deleteSecuritiesAccount(account_id) {
  return request({
    url: `/user/securities_accounts/${account_id}`,
    method: 'delete',
  })
}

export async function changePassword(oldPassword, newPassword) {
  try {
    return await request({
      url: '/user/change-password',
      method: 'post',
      data: { old_password: oldPassword, new_password: newPassword },
    })
  } catch (err) {
    const data = err.response?.data
    const message = data?.detail || data?.message || `Failed to change password: ${err.response?.status || 'unknown'}`
    throw new Error(message)
  }
}
