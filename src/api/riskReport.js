/**
 * 市场风险预警 API 调用
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

/**
 * 获取单日全行业风险概览（dashboard 卡片）
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function getRiskOverview(date = null) {
    let url = `${API_BASE}/risk-reports/overview`;
    if (date) url += `?date=${date}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`getRiskOverview failed: ${res.status}`);
    return await res.json();
}

/**
 * 获取单行业单日完整信号详情
 * @param {string} sector - 行业 key，如 semicon / nev
 * @param {string|null} date - YYYYMMDD，默认今天
 * @param {boolean} withAnalysis - 是否附带 LLM 解读
 */
export async function getRiskDetail(sector, date = null, withAnalysis = false) {
    let url = `${API_BASE}/risk-reports/detail?sector=${sector}`;
    if (date) url += `&date=${date}`;
    if (withAnalysis) url += `&with_analysis=true`;
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`getRiskDetail failed: ${res.status}`);
    return await res.json();
}

/**
 * 获取单行业历史风险得分趋势（折线图数据）
 * @param {string} sector - 行业 key
 * @param {number} limit - 最近 N 个交易日，默认 30
 */
export async function getRiskTrend(sector, limit = 30) {
    const url = `${API_BASE}/risk-reports/trend?sector=${sector}&limit=${limit}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`getRiskTrend failed: ${res.status}`);
    return await res.json();
}

/**
 * 触发单行业 LLM 风险解读任务
 * @param {string} sector - 行业 key
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function triggerRiskAnalysis(sector, date = null) {
    let url = `${API_BASE}/risk-reports/analyze?sector=${sector}`;
    if (date) url += `&date=${date}`;
    const res = await fetch(url, { method: "POST", headers: authHeaders() });
    if (!res.ok) throw new Error(`triggerRiskAnalysis failed: ${res.status}`);
    return await res.json();
}

/**
 * 获取全市场日报 LLM 解读结果（scope=market_daily）
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function getMarketDailyAnalysis(date = null) {
    let url = `${API_BASE}/risk-reports/market-daily-analysis`;
    if (date) url += `?date=${date}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`getMarketDailyAnalysis failed: ${res.status}`);
    return await res.json();
}

/**
 * 触发全市场日报 LLM 解读任务
 * @param {string|null} date - YYYYMMDD，默认今天
 */
export async function triggerMarketDailyAnalysis(date = null) {
    let url = `${API_BASE}/risk-reports/analyze/market-daily`;
    if (date) url += `?date=${date}`;
    const res = await fetch(url, { method: "POST", headers: authHeaders() });
    if (!res.ok) throw new Error(`triggerMarketDailyAnalysis failed: ${res.status}`);
    return await res.json();
}
