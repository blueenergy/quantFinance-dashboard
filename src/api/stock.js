/**
 * Stock Information API
 * 股票信息查询相关 API
 */

import request from '../utils/request'

async function unwrapData(config) {
    const result = await request(config)
    return result.data
}

/**
 * 搜索股票
 * @param {string} query - 搜索关键词 (代码、名称或拼音)
 */
export async function searchStocks(query) {
    if (!query) return [];

    const cleanQuery = query.replace(/\.(SZ|SH|BJ)$/i, '');
    const result = await request({
        url: '/stock/search',
        method: 'get',
        params: { q: cleanQuery },
    })
    return result.data || [];
}

/**
 * 获取股票详细信息
 * @param {string} symbol - 股票代码
 */
export async function getStockInfo(symbol) {
    return unwrapData({
        url: `/stock/info/${encodeURIComponent(symbol)}`,
        method: 'get',
    })
}

/**
 * 获取股票工作台聚合数据
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbench(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench`,
        method: 'get',
    })
}

/**
 * 获取股票工作台行情资金分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchQuote(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/quote`,
        method: 'get',
    })
}

/**
 * 获取股票工作台指定周期 K 线
 * @param {string} symbol - 股票代码
 * @param {string} tf - 1d / 1w / 1m
 */
export async function getStockWorkbenchKline(symbol, tf = '1d') {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/kline`,
        method: 'get',
        params: { tf },
    })
}

/**
 * 获取股票工作台指定周期资金流历史
 * @param {string} symbol - 股票代码
 * @param {string} tf - 1d / 1w / 1m
 */
export async function getStockWorkbenchMoneyFlow(symbol, tf = '1d') {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/money-flow`,
        method: 'get',
        params: { tf },
    })
}

/**
 * 获取股票工作台神奇九转分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchNineTurn(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/nine-turn`,
        method: 'get',
    })
}

/**
 * 获取股票工作台量化评分分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchScores(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/scores`,
        method: 'get',
    })
}

/**
 * 获取股票工作台财务业绩分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchFinancials(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/financials`,
        method: 'get',
    })
}

/**
 * 获取股票工作台估值模型分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchValuation(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/valuation`,
        method: 'get',
    })
}

/**
 * 获取股票工作台 AI 分析分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchAi(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/ai`,
        method: 'get',
    })
}

/**
 * 获取股票工作台交易上下文分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchTrading(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/trading`,
        method: 'get',
    })
}

/**
 * 获取股票工作台股东筹码分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchShareholders(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/shareholders`,
        method: 'get',
    })
}

/**
 * 获取股票工作台 SWOT 信号分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchSignals(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/signals`,
        method: 'get',
    })
}

/**
 * 触发单只股票的机会与风险证据搜集分析
 */
export async function collectStockWorkbenchSignals(symbol) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/signals/collect`,
        method: 'post',
    })
}

/**
 * 刷新单只股票的规则型优势与劣势信号
 */
export async function refreshStockWorkbenchInternalSignals(symbol, { force = false } = {}) {
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/signals/refresh-internal`,
        method: 'post',
        data: { force },
    })
}

/**
 * 提交新闻链接，触发后台抓取与 LLM 风险/机会分析
 */
export async function analyzeStockWorkbenchNewsUrl(symbol, { url, findingKey } = {}) {
    const data = { url }
    if (findingKey) data.finding_key = findingKey
    return unwrapData({
        url: `/stock/${encodeURIComponent(symbol)}/workbench/signals/analyze-url`,
        method: 'post',
        data,
    })
}

/**
 * 获取机会与风险搜集任务状态
 */
export async function getStockWorkbenchSignalTask(taskId) {
    return request({
        url: `/analysis-tasks/${encodeURIComponent(taskId)}`,
        method: 'get',
    })
}

/**
 * 获取股票财务报表数据
 * @param {string} symbol - 股票代码
 * @param {string} statement - income|balance|cashflow|indicator|daily_basic
 * @param {number} periods - 最近多少期
 */
export async function getStockFinancial(symbol, statement = 'indicator', periods = 8) {
    const result = await request({
        url: `/stock/${encodeURIComponent(symbol)}/financial`,
        method: 'get',
        params: { statement, periods },
    })
    return result.data || [];
}
