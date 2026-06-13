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

/**
 * 获取股票工作台聚合数据
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbench(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台行情资金分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchQuote(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/quote`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench quote: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台神奇九转分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchNineTurn(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/nine-turn`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench nine-turn: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台量化评分分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchScores(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/scores`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench scores: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台财务业绩分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchFinancials(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/financials`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench financials: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台 AI 分析分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchAi(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/ai`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench ai: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台交易上下文分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchTrading(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/trading`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench trading: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台股东筹码分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchShareholders(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/shareholders`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench shareholders: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票财务报表数据
 * @param {string} symbol - 股票代码
 * @param {string} statement - income|balance|cashflow|indicator|daily_basic
 * @param {number} periods - 最近多少期
 */
export async function getStockFinancial(symbol, statement = 'indicator', periods = 8) {
    const params = new URLSearchParams({
        statement,
        periods: String(periods)
    });
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/financial?${params.toString()}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock financial: ${res.status}`);
    const result = await res.json();
    return result.data || [];
}
