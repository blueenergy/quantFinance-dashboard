/**
 * 市场风险预警 API 调用
 */

import request, { requestOrNull } from '../utils/request'

/**
 * 获取单日全行业风险概览（dashboard 卡片）
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function getRiskOverview(date = null) {
    return request({
        url: '/risk-reports/overview',
        method: 'get',
        params: date ? { date } : undefined,
    })
}

/**
 * 获取单行业单日完整信号详情
 * @param {string} sector - 行业 key，如 semicon / nev
 * @param {string|null} date - YYYYMMDD，默认今天
 * @param {boolean} withAnalysis - 是否附带 LLM 解读
 */
export async function getRiskDetail(sector, date = null, withAnalysis = false) {
    const params = { sector }
    if (date) params.date = date
    if (withAnalysis) params.with_analysis = 'true'
    return requestOrNull({
        url: '/risk-reports/detail',
        method: 'get',
        params,
    })
}

/**
 * 获取单行业历史风险得分趋势（折线图数据）
 * @param {string} sector - 行业 key
 * @param {number} limit - 最近 N 个交易日，默认 30
 */
export async function getRiskTrend(sector, limit = 30) {
    return request({
        url: '/risk-reports/trend',
        method: 'get',
        params: { sector, limit },
    })
}

/**
 * 触发单行业 LLM 风险解读任务
 * @param {string} sector - 行业 key
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function triggerRiskAnalysis(sector, date = null) {
    return request({
        url: '/risk-reports/analyze',
        method: 'post',
        params: { sector, ...(date ? { date } : {}) },
    })
}

/**
 * 获取全市场日报 LLM 解读结果（scope=market_daily）
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function getMarketDailyAnalysis(date = null) {
    return request({
        url: '/risk-reports/market-daily-analysis',
        method: 'get',
        params: date ? { date } : undefined,
    })
}

/**
 * 触发全市场日报 LLM 解读任务（A股）
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function triggerMarketDailyAnalysis(date = null) {
    return request({
        url: '/risk-reports/analyze/market-daily',
        method: 'post',
        params: date ? { date } : undefined,
    })
}

/**
 * 获取美股市场日报 LLM 解读结果（scope=us_market_daily）
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function getUsMarketDailyAnalysis(date = null) {
    return request({
        url: '/risk-reports/us-market-daily-analysis',
        method: 'get',
        params: date ? { date } : undefined,
    })
}

/**
 * 触发美股市场日报 LLM 解读任务
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function triggerUsMarketDailyAnalysis(date = null) {
    return request({
        url: '/risk-reports/analyze/us-market-daily',
        method: 'post',
        params: date ? { date } : undefined,
    })
}

/**
 * 获取A股波动率快照（含缓存的 LLM 解读文本）
 */
export async function getIVSnapshot() {
    return request({
        url: '/risk-reports/iv-snapshot',
        method: 'get',
    })
}

/**
 * 触发A股波动率 LLM 专业解读（同步，约10-20秒）
 */
export async function interpretIVSnapshot() {
    return request({
        url: '/risk-reports/iv-snapshot/interpret',
        method: 'post',
        timeout: 120000,
    })
}
