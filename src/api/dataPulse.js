/**
 * Data Pulse API — 数据脉搏
 * 展示系统实时数据状态、国际新闻、同步健康度
 */

import request from '../utils/request'

/** 获取综合数据脉搏概览 */
export async function fetchDataPulseOverview() {
    return request({
        url: '/data-pulse/overview',
        method: 'get',
    })
}

/** 获取国际新闻列表 */
export async function fetchDataPulseNews(category = null) {
    return request({
        url: '/data-pulse/news',
        method: 'get',
        params: category ? { category } : undefined,
    })
}

/** 获取覆盖率缺口股票（须为目录中带 coverage 的集合） */
export async function fetchCoverageGaps({ database = "quant_data", collection, period = null, skip = 0, limit = 200 } = {}) {
    if (!collection) throw new Error("collection is required");
    const params = {
        database,
        collection,
        skip,
        limit,
    }
    if (period) params.period = String(period).replace(/-/g, "").slice(0, 8)
    try {
        return await request({
            url: '/data-pulse/coverage-gaps',
            method: 'get',
            params,
        })
    } catch (err) {
        const errText = typeof err.response?.data === 'string'
            ? err.response.data
            : JSON.stringify(err.response?.data || '')
        throw new Error(`coverage-gaps failed: ${err.response?.status || 'unknown'} ${errText}`)
    }
}

/** 获取数据同步任务状态 */
export async function fetchDataPulseStatus() {
    return request({
        url: '/data-pulse/status',
        method: 'get',
    })
}

/** 获取数据合约健康度 + 冷启动 bootstrap 进度 */
export async function fetchDataPulseContracts() {
    return request({
        url: '/data-pulse/contracts',
        method: 'get',
    })
}
