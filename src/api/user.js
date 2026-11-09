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

export async function getStrategyPositionGuard(symbol, strategy) {
  return request({
    url: '/strategy/position-guard',
    method: 'get',
    params: { symbol, strategy_key: strategy },
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
    const detail = data?.detail
    // Position guard responses carry a structured payload the disable dialog
    // needs; plain string details keep the old message behaviour.
    if (
      err.response?.status === 409
      && detail
      && typeof detail === 'object'
      && detail.code
    ) {
      const guardError = new Error(detail.message || '该策略当前有持仓，需要确认如何处理')
      guardError.code = detail.code
      guardError.guard = detail.guard
      throw guardError
    }
    const message = typeof detail === 'string'
      ? detail
      : detail?.message || data?.message || `设置策略失败：${err.response?.status || 'unknown'}`
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
