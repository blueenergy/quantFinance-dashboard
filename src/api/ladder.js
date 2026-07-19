/**
 * 连板天梯 API 调用
 */

import request from '../utils/request'

function normalizeTsCode(symbol) {
    const raw = String(symbol || "").trim();
    if (!raw) return raw;
    if (raw.includes(".")) return raw;
    const bare = raw.split(".")[0];
    if (bare.length !== 6) return raw;
    if (bare.startsWith("30") || bare.startsWith("00") || bare.startsWith("12")) return `${bare}.SZ`;
    if (bare.startsWith("60") || bare.startsWith("68") || bare.startsWith("11")) return `${bare}.SH`;
    if (bare.startsWith("8") || bare.startsWith("4") || bare.startsWith("92")) return `${bare}.BJ`;
    return raw;
}

/**
 * 获取每日连板天梯
 * @param {string} date - 日期 YYYYMMDD，可选，默认今天
 */
export async function getDailyLadder(date = null) {
    return request({
        url: '/ladder/daily',
        method: 'get',
        params: date ? { date } : undefined,
    })
}

/**
 * 获取历史对比
 * @param {string} fromDate - 起始日期 YYYYMMDD
 * @param {string} toDate - 结束日期 YYYYMMDD
 */
export async function compareLadder(fromDate, toDate) {
    return request({
        url: '/ladder/compare',
        method: 'get',
        params: { from: fromDate, to: toDate },
    })
}

/**
 * 获取板块排名
 * @param {string} date - 日期 YYYYMMDD，可选
 */
export async function getSectorRanking(date = null) {
    return request({
        url: '/ladder/sectors',
        method: 'get',
        params: date ? { date } : undefined,
    })
}

/**
 * 获取情绪指标
 * @param {string} date - 日期 YYYYMMDD，可选
 * @param {number} days - 获取最近N天，默认5
 */
export async function getIndicators(date = null, days = 5) {
    const params = { days }
    if (date) params.date = date
    return request({
        url: '/ladder/indicators',
        method: 'get',
        params,
    })
}

/**
 * 获取历史天梯数据
 * @param {string} startDate - 开始日期 YYYYMMDD
 * @param {string} endDate - 结束日期 YYYYMMDD
 */
export async function getLadderHistory(startDate, endDate) {
    return request({
        url: '/ladder/history',
        method: 'get',
        params: { start_date: startDate, end_date: endDate },
    })
}

/**
 * 获取个股归因详情
 * @param {string} symbol - 股票代码
 * @param {string} date - 日期 YYYYMMDD，可选
 */
export async function getReasoningDetail(symbol, date = null) {
    return request({
        url: `/ladder/reasoning/${encodeURIComponent(normalizeTsCode(symbol))}`,
        method: 'get',
        params: date ? { date } : undefined,
    })
}

/**
 * 提交涨停/炸板股票的归因反馈
 * @param {string} symbol - 股票代码
 * @param {string} date - 日期 YYYYMMDD
 * @param {string} feedback - 用户的文本反馈
 * @param {boolean} isBroken - 是否为炸板股票
 */
export async function submitReasoningFeedback(symbol, date, feedback, isBroken = false) {
    return request({
        url: `/ladder/reasoning/${symbol}/feedback`,
        method: 'post',
        data: {
            date,
            feedback,
            is_broken: isBroken,
        },
    })
}

/**
 * 获取市场阴阳谱/分布数据
 * @param {string} date - 日期 YYYYMMDD
 */
export async function getMarketSpectrum(date) {
    return request({
        url: '/market-spectrum',
        method: 'get',
        params: { start_date: date, end_date: date },
    })
}

/**
 * 获取涨停全景市场动向总结（LLM 生成）
 * @param {string} date - 日期 YYYYMMDD，可选，默认最新有数据的交易日
 */
export async function getLimitUpNarrative(date = null) {
    return request({
        url: '/ladder/narrative',
        method: 'get',
        params: date ? { date } : undefined,
    })
}
