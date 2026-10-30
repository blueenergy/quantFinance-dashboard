import request from '../utils/request'

/**
 * 自选/持仓定期报告 AI 解读（earnings_report_analysis 产出）。
 */
export const earningsWatchApi = {
  listReports({ days = 30, symbol = null, limit = 50 } = {}) {
    return request({
      url: '/earnings/watch-reports',
      method: 'get',
      params: { days, symbol, limit },
    })
  },
}
