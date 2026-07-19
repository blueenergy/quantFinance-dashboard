/**
 * 组合分析 API 调用
 */

import request from '../utils/request'

function normalizeTaskStatus(rawStatus) {
    if (rawStatus == null) return "unknown";
    let s = String(rawStatus);
    if (s.startsWith("TaskStatus.")) {
        s = s.split(".", 2)[1] || s;
    }
    return s.toLowerCase();
}

/**
 * 获取组合机会分析（自选股 + 持仓）
 */
export async function getPortfolioOpportunities() {
    return request({
        url: '/analyze/portfolio-opportunities',
        method: 'post',
    })
}

/**
 * 仅分析自选股机会
 */
export async function getWatchlistOpportunities() {
    return request({
        url: '/analyze/watchlist-opportunities',
        method: 'post',
    })
}

/**
 * 仅分析持仓机会
 */
export async function getPositionsOpportunities() {
    return request({
        url: '/analyze/positions-opportunities',
        method: 'post',
    })
}

/**
 * 获取最新的组合分析结果
 * @param {string} type - 可选: watchlist, positions, combined
 */
export async function getLatestPortfolioAnalysis(type = null) {
    const params = { _t: Date.now() }
    if (type) params.analysis_type = type
    return request({
        url: '/analyze/portfolio-opportunities/latest',
        method: 'get',
        params,
    })
}

/**
 * 查询组合分析任务状态
 * @param {string} taskId - 任务ID
 */
export async function getPortfolioTaskStatus(taskId) {
    return request({
        url: `/analyze/portfolio-task/${taskId}`,
        method: 'get',
        params: { _t: Date.now() },
    })
}

/**
 * 轮询组合分析任务，直到完成或失败
 * @param {string} taskId - 任务ID
 * @param {Function} onProgress - 进度回调 (status) => void
 * @param {number} intervalMs - 轮询间隔（毫秒），默认 3000
 * @param {number} maxAttempts - 最大轮询次数，默认 60（约 3 分钟）
 * @returns {Promise<Object>} 最终的任务结果
 */
export async function pollPortfolioTask(taskId, onProgress = null, intervalMs = 3000, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await getPortfolioTaskStatus(taskId);
        const normalizedStatus = normalizeTaskStatus(result.status);
        result.status = normalizedStatus;
        
        if (onProgress) onProgress(result);
        
        if (normalizedStatus === 'completed' || normalizedStatus === 'failed') {
            return result;
        }
        
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error('分析超时，请稍后查看结果');
}
