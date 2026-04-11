/**
 * 组合分析 API 调用
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

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
    const url = `${API_BASE}/analyze/portfolio-opportunities`;

    const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`Failed to analyze portfolio: ${res.status}`);
    return await res.json();
}

/**
 * 仅分析自选股机会
 */
export async function getWatchlistOpportunities() {
    const url = `${API_BASE}/analyze/watchlist-opportunities`;

    const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`Failed to analyze watchlist: ${res.status}`);
    return await res.json();
}

/**
 * 仅分析持仓机会
 */
export async function getPositionsOpportunities() {
    const url = `${API_BASE}/analyze/positions-opportunities`;

    const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`Failed to analyze positions: ${res.status}`);
    return await res.json();
}

/**
 * 获取最新的组合分析结果
 * @param {string} type - 可选: watchlist, positions, combined
 */
export async function getLatestPortfolioAnalysis(type = null) {
    let url = `${API_BASE}/analyze/portfolio-opportunities/latest`;
    const params = new URLSearchParams();
    if (type) params.set('analysis_type', type);
    params.set('_t', Date.now());  // 禁用浏览器缓存
    const qs = params.toString();
    if (qs) url += '?' + qs;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`Failed to get latest analysis: ${res.status}`);
    return await res.json();
}

/**
 * 查询组合分析任务状态
 * @param {string} taskId - 任务ID
 */
export async function getPortfolioTaskStatus(taskId) {
    const url = `${API_BASE}/analyze/portfolio-task/${taskId}?_t=${Date.now()}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`Failed to get task status: ${res.status}`);
    return await res.json();
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
