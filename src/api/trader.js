// Trader API client
import request from '../utils/request'

export async function getTraderAccount(securitiesAccountId = null) {
  const params = securitiesAccountId
    ? { securities_account_id: securitiesAccountId }
    : undefined
  const data = await request({
    url: '/trader/account',
    method: 'get',
    params,
  })
  return data.data || {}
}

export async function getTraderAccountEquity(securitiesAccountId = null, params = {}) {
  const query = {}
  if (securitiesAccountId) query.securities_account_id = securitiesAccountId
  if (params.start_date) query.start_date = params.start_date
  if (params.end_date) query.end_date = params.end_date
  const data = await request({
    url: '/trader/account/equity',
    method: 'get',
    params: Object.keys(query).length ? query : undefined,
  })
  return data.data || []
}

export async function getTraderPositions(securitiesAccountId = null) {
  const params = securitiesAccountId
    ? { securities_account_id: securitiesAccountId }
    : undefined
  const data = await request({
    url: '/trader/positions',
    method: 'get',
    params,
  })
  return data.data || []
}

export async function getTraderHeartbeats(limit = 50) {
  const data = await request({
    url: '/trader/heartbeat',
    method: 'get',
    params: { limit },
  })
  return data.data || []
}

// 获取用户的所有证券账户
export async function getSecuritiesAccounts() {
  return request({
    url: '/user/securities_accounts',
    method: 'get',
  })
}

// 获取交易信号（用于观察模式模拟盈亏计算）
export async function getTradeSignals(securitiesAccountId = null, status = null, symbol = null) {
  const params = {}
  if (securitiesAccountId) params.securities_account_id = securitiesAccountId
  if (status) params.status = status
  if (symbol) params.symbol = symbol
  const data = await request({
    url: '/trade-signals/',
    method: 'get',
    params: Object.keys(params).length ? params : undefined,
  })
  return data.data || []
}
