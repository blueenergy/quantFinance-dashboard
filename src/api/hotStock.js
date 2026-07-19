/**
 * 热股分析 API 调用 (THS 同花顺 / DC 东方财富)
 */

import request from '../utils/request'

export async function analyzeHotStock(source = 'ths', force = false) {
    return request({
        url: '/hot-stock/analyze',
        method: 'post',
        data: { source, force },
    })
}

export async function getHotStockTask(taskId) {
    return request({
        url: `/hot-stock/task/${taskId}`,
        method: 'get',
    })
}

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

export async function pollHotStockTask(taskId, onProgress, intervalMs = 2000, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await getHotStockTask(taskId);
        if (onProgress) onProgress(result);
        if (result.status === 'completed' || result.status === 'failed') {
            return result;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return { status: 'timeout', error: '分析超时' };
}
