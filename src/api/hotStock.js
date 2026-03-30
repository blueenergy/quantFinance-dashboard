/**
 * 热股分析 API 调用 (THS 同花顺 / DC 东方财富)
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

export async function analyzeHotStock(source = 'ths', force = false) {
    const res = await fetch(`${API_BASE}/hot-stock/analyze`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ source, force }),
    });
    if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
    return await res.json();
}

export async function getHotStockTask(taskId) {
    const res = await fetch(`${API_BASE}/hot-stock/task/${taskId}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
    return await res.json();
}

export async function getLatestHotStock(source = 'ths') {
    const res = await fetch(`${API_BASE}/hot-stock/latest?source=${source}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Get latest failed: ${res.status}`);
    return await res.json();
}

export async function getHotStockHistory(source = 'ths', date = null) {
    let url = `${API_BASE}/hot-stock/history?source=${source}`;
    if (date) url += `&date=${date}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Get history failed: ${res.status}`);
    return await res.json();
}

export async function getHotStockDataStatus(source = 'ths') {
    const res = await fetch(`${API_BASE}/hot-stock/data-status?source=${source}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Get data status failed: ${res.status}`);
    return await res.json();
}

export async function pollHotStockTask(taskId, onProgress, intervalMs = 2000, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await getHotStockTask(taskId);
        if (onProgress) onProgress(result);
        if (result.status === 'completed' || result.status === 'failed') {
            return result;
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return { status: 'timeout', error: '分析超时' };
}
