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
