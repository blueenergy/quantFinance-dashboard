/**
 * 市场趋势全景图 API
 */

import request from '../utils/request'

/**
 * 获取宽基 + 申万行业指数的趋势分矩阵。
 * @param {{ days?: number, include_themes?: boolean }} params
 */
export function fetchMarketTrendPanorama(params = {}) {
  return request({
    url: '/market-trend/panorama',
    method: 'get',
    params,
  })
}

/**
 * 获取盘中行业短线强弱（2 分钟快照 + 全市场广度）。
 * @param {{ date?: string, level?: string, ma_period?: number }} params
 */
export function fetchMarketIntradayStrength(params = {}) {
  return request({
    url: '/market-trend/intraday',
    method: 'get',
    params,
  })
}
