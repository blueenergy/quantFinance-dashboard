/**
 * 连板天梯 API 调用
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

/**
 * 获取每日连板天梯
 * @param {string} date - 日期 YYYYMMDD，可选，默认今天
 */
export async function getDailyLadder(date = null) {
    let url = `${API_BASE}/ladder/daily`;
    if (date) url += `?date=${date}`;

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to get daily ladder: ${res.status}`);
    return await res.json();
}

/**
 * 获取历史对比
 * @param {string} fromDate - 起始日期 YYYYMMDD
 * @param {string} toDate - 结束日期 YYYYMMDD
 */
export async function compareLadder(fromDate, toDate) {
    const url = `${API_BASE}/ladder/compare?from=${fromDate}&to=${toDate}`;

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to compare ladder: ${res.status}`);
    return await res.json();
}

/**
 * 获取板块排名
 * @param {string} date - 日期 YYYYMMDD，可选
 */
export async function getSectorRanking(date = null) {
    let url = `${API_BASE}/ladder/sectors`;
    if (date) url += `?date=${date}`;

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to get sector ranking: ${res.status}`);
    return await res.json();
}

/**
 * 获取情绪指标
 * @param {string} date - 日期 YYYYMMDD，可选
 * @param {number} days - 获取最近N天，默认5
 */
export async function getIndicators(date = null, days = 5) {
    let url = `${API_BASE}/ladder/indicators?days=${days}`;
    if (date) url += `&date=${date}`;

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to get indicators: ${res.status}`);
    return await res.json();
}

/**
 * 获取历史天梯数据
 * @param {string} startDate - 开始日期 YYYYMMDD
 * @param {string} endDate - 结束日期 YYYYMMDD
 */
export async function getLadderHistory(startDate, endDate) {
    const url = `${API_BASE}/ladder/history?start_date=${startDate}&end_date=${endDate}`;

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Failed to get ladder history: ${res.status}`);
    return await res.json();
}
