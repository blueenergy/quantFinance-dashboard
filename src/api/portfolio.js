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
    if (type) url += `?analysis_type=${type}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });
    if (!res.ok) throw new Error(`Failed to get latest analysis: ${res.status}`);
    return await res.json();
}
