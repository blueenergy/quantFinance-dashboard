/**
 * 概念板块分析 API 调用 (DC 东方财富 / THS 同花顺)
 */

import request from '../utils/request'

/**
 * Submit a sector concept analysis task (async).
 * @param {string} date - Trade date (YYYYMMDD)
 * @param {string} source - "dc" or "ths"
 */
export async function analyzeSectorConcept(date, source = 'dc') {
    return request({
        url: '/sector-concept/analyze',
        method: 'post',
        data: { date, source },
    })
}

/**
 * Poll task status.
 * @param {string} taskId
 */
export async function getSectorConceptTask(taskId) {
    return request({
        url: `/sector-concept/task/${taskId}`,
        method: 'get',
    })
}

/**
 * Get latest analysis result.
 * @param {string} source - "dc" or "ths"
 * @param {string} date - Trade date YYYYMMDD (optional)
 */
export async function getLatestSectorConcept(source = 'dc', date = null) {
    const params = { source }
    if (date) params.date = date
    return request({
        url: '/sector-concept/latest',
        method: 'get',
        params,
    })
}

/**
 * Poll until task completes, calling onProgress callback.
 * @param {string} taskId
 * @param {Function} onProgress
 * @param {number} intervalMs
 * @param {number} maxAttempts
 */
export async function pollSectorConceptTask(taskId, onProgress, intervalMs = 2000, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await getSectorConceptTask(taskId);

        if (onProgress) onProgress(result);

        if (result.status === 'completed' || result.status === 'failed') {
            return result;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return { status: 'timeout', error: '分析超时，请稍后查看结果' };
}
