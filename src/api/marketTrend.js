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
