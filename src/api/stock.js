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
 * 获取股票工作台指定周期 K 线
 * @param {string} symbol - 股票代码
 * @param {string} tf - 1d / 1w / 1m
 */
export async function getStockWorkbenchKline(symbol, tf = '1d') {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/kline?tf=${encodeURIComponent(tf)}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench kline: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取股票工作台指定周期资金流历史
 * @param {string} symbol - 股票代码
 * @param {string} tf - 1d / 1w / 1m
 */
export async function getStockWorkbenchMoneyFlow(symbol, tf = '1d') {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/money-flow?tf=${encodeURIComponent(tf)}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench money flow: ${res.status}`);
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
 * 获取股票工作台估值模型分区
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchValuation(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/valuation`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench valuation: ${res.status}`);
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
 * 获取股票工作台 SWOT 信号分区（台账 O/T；S/W 预留）
 * @param {string} symbol - 股票代码
 */
export async function getStockWorkbenchSignals(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/signals`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench signals: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 触发单只股票的机会与风险证据搜集分析
 */
export async function collectStockWorkbenchSignals(symbol) {
    const url = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/signals/collect`;
    const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to collect stock workbench signals: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 提交新闻链接，触发后台抓取与 LLM 风险/机会分析
 */
export async function analyzeStockWorkbenchNewsUrl(symbol, { url, findingKey } = {}) {
    const endpoint = `${API_BASE}/stock/${encodeURIComponent(symbol)}/workbench/signals/analyze-url`;
    const body = { url };
    if (findingKey) body.finding_key = findingKey;
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Failed to analyze stock workbench news url: ${res.status}`);
    const result = await res.json();
    return result.data;
}

/**
 * 获取机会与风险搜集任务状态
 */
export async function getStockWorkbenchSignalTask(taskId) {
    const url = `${API_BASE}/analysis-tasks/${encodeURIComponent(taskId)}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get stock workbench signal task: ${res.status}`);
    return res.json();
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
