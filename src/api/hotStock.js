/**
 * 热股分析 API 调用 (THS 同花顺 / DC 东方财富)
 *
 * 只读。分析由服务端定时任务生成（22:50 同步热榜 → 23:05 分析），
 * 页面不再提供手动触发入口，因此这里没有 analyze / poll。
 * 后端 POST /hot-stock/analyze 仍保留，供运维/脚本使用。
 */

import request from '../utils/request'

export async function getLatestHotStock(source = 'ths') {
    return request({
        url: '/hot-stock/latest',
        method: 'get',
        params: { source },
    })
}

export async function getHotStockHistory(source = 'ths', date = null) {
    const params = { source }
    if (date) params.date = date
    return request({
        url: '/hot-stock/history',
        method: 'get',
        params,
    })
}

export async function getHotStockDataStatus(source = 'ths') {
    return request({
        url: '/hot-stock/data-status',
        method: 'get',
        params: { source },
    })
}

/** 港股人气榜 → 次日执行提示（只读，基于 P1 检验结论）。 */
export async function getHkExecutionHint(topN = 20) {
    return request({
        url: '/hot-stock/hk-execution-hint',
        method: 'get',
        params: { top_n: topN },
    })
}
