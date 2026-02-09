/**
 * Stock Information API
 * 股票信息查询相关 API
 */

// 使用与其他 API 模块相同的配置
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
    const token = localStorage.getItem('access_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

/**
 * 搜索股票
 * @param {string} query - 搜索关键词 (代码、名称或拼音)
 */
export async function searchStocks(query) {
    if (!query) return [];

    // 如果 query 包含 .SH/.SZ/.BJ 后缀，去掉后缀再搜索
    // 主要是为了处理用户输入完整代码的情况
    const cleanQuery = query.replace(/\.(SZ|SH|BJ)$/i, '');

    const url = `${API_BASE}/stock/search?q=${encodeURIComponent(cleanQuery)}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to search stocks: ${res.status}`);
    const result = await res.json();
    return result.data || [];
}

/**
 * 获取股票详细信息
 * @param {string} symbol - 股票代码
 */
export async function getStockInfo(symbol) {
    const url = `${API_BASE}/stock/info/${encodeURIComponent(symbol)}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock info: ${res.status}`);
    const result = await res.json();
    return result.data;
}
