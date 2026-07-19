/**
 * Trading API Module
 * 手动交易相关 API
 */

import request from '../utils/request'

/**
 * 创建手动交易信号
 * @param {string} symbol - 股票代码 (如 000001.SZ)
 * @param {string} action - 操作类型: 'buy' | 'sell'
 * @param {number} size - 交易数量
 * @param {number|null} price - 价格 (null=市价)
 * @param {string} securitiesAccountId - 证券账户 ID
 */
export async function createManualSignal(symbol, action, size, price = null, securitiesAccountId = '') {
    const body = {
        securities_account_id: securitiesAccountId,
        symbol,
        action,
        size: parseInt(size),
    }

    if (price !== null && price !== '' && price > 0) {
        body.price = parseFloat(price)
    }

    try {
        return await request({
            url: '/trade-signals/manual-create',
            method: 'post',
            data: body,
        })
    } catch (err) {
        const detail = err.response?.data?.detail
        throw new Error(detail || `Failed to create signal: ${err.response?.status || 'unknown'}`)
    }
}

/**
 * 获取手动创建的交易信号列表
 * @param {number} limit - 返回数量限制
 */
export async function getManualSignals(limit = 20) {
    return request({
        url: '/trade-signals/manual',
        method: 'get',
        params: { limit },
    })
}

/**
 * 获取交易信号状态统计
 */
export async function getSignalStatusSummary() {
    return request({
        url: '/trade-signals/status-summary',
        method: 'get',
    })
}

/**
 * 获取特定股票的交易执行记录
 * @param {string} symbol - 股票代码
 * @param {number} limit - 返回数量限制
 */
export async function getTradeExecutionsBySymbol(symbol, limit = 50) {
    return request({
        url: `/trade-executions/symbol/${encodeURIComponent(symbol)}`,
        method: 'get',
        params: { limit },
    })
}
