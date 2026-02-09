/**
 * Trading API Module
 * 手动交易相关 API
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
 * 创建手动交易信号
 * @param {string} symbol - 股票代码 (如 000001.SZ)
 * @param {string} action - 操作类型: 'buy' | 'sell'
 * @param {number} size - 交易数量
 * @param {number|null} price - 价格 (null=市价)
 */
export async function createManualSignal(symbol, action, size, price = null) {
    const url = `${API_BASE}/trade-signals/manual-create`;

    const body = {
        symbol,
        action,
        size: parseInt(size)
    };

    if (price !== null && price !== '' && price > 0) {
        body.price = parseFloat(price);
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Failed to create signal: ${res.status}`);
    }
    return await res.json();
}

/**
 * 获取手动创建的交易信号列表
 * @param {number} limit - 返回数量限制
 */
export async function getManualSignals(limit = 20) {
    const url = `${API_BASE}/trade-signals/manual?limit=${limit}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get manual signals: ${res.status}`);
    return await res.json();
}

/**
 * 获取交易信号状态统计
 */
export async function getSignalStatusSummary() {
    const url = `${API_BASE}/trade-signals/status-summary`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get status summary: ${res.status}`);
    return await res.json();
}

/**
 * 获取特定股票的交易执行记录
 * @param {string} symbol - 股票代码
 * @param {number} limit - 返回数量限制
 */
export async function getTradeExecutionsBySymbol(symbol, limit = 50) {
    // trade_execution_router is registered at /api, so path is /api/trade-executions/...
    const url = `${API_BASE}/trade-executions/symbol/${encodeURIComponent(symbol)}?limit=${limit}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: authHeaders()
    });

    if (!res.ok) throw new Error(`Failed to get trade executions: ${res.status}`);
    return await res.json();
}
