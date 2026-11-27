import request, { requestOrNull } from '../utils/request'

export async function getMarketStatsOverview({ days = 750, peIndex } = {}) {
  const params = { days }
  if (peIndex) params.pe_index = peIndex
  return requestOrNull({
    url: '/market-stats/overview',
    method: 'get',
    params,
  })
}

export async function getMarketTurnover({ days = 250, window = 20 } = {}) {
  return requestOrNull({
    url: '/market-stats/turnover',
    method: 'get',
    params: { days, window },
  })
}

export async function getMarketTurnoverIntraday({ days = 60, window = 20, date } = {}) {
  const params = { days, window }
  if (date) params.date = date
  return requestOrNull({
    url: '/market-stats/turnover-intraday',
    method: 'get',
    params,
  })
}

export async function getMarketTurnoverOutlook({ index = 'csi1000' } = {}) {
  return requestOrNull({
    url: '/market-stats/turnover-outlook',
    method: 'get',
    params: { index },
  })
}

export async function getEtfPenetration({ index = 'hs300', days = 2500 } = {}) {
  return requestOrNull({
    url: '/market-stats/etf-penetration',
    method: 'get',
    params: { index, days },
  })
}
