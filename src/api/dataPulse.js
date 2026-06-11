/**
 * Data Pulse API — 数据脉搏
 * 展示系统实时数据状态、国际新闻、同步健康度
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

/** 获取综合数据脉搏概览 */
export async function fetchDataPulseOverview() {
    const res = await fetch(`${API_BASE}/data-pulse/overview`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Data pulse overview failed: ${res.status}`);
    return res.json();
}

/** 获取国际新闻列表 */
export async function fetchDataPulseNews(category = null) {
    let url = `${API_BASE}/data-pulse/news`;
    if (category) url += `?category=${encodeURIComponent(category)}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`Data pulse news failed: ${res.status}`);
    return res.json();
}

/** 获取覆盖率缺口股票（须为目录中带 coverage 的集合） */
export async function fetchCoverageGaps({ database = "quant_data", collection, period = null, skip = 0, limit = 200 } = {}) {
    if (!collection) throw new Error("collection is required");
    const params = new URLSearchParams();
    params.set("database", database);
    params.set("collection", collection);
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    if (period) params.set("period", String(period).replace(/-/g, "").slice(0, 8));
    const res = await fetch(`${API_BASE}/data-pulse/coverage-gaps?${params.toString()}`, {
        headers: authHeaders(),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`coverage-gaps failed: ${res.status} ${errText}`);
    }
    return res.json();
}

/** 获取数据同步任务状态 */
export async function fetchDataPulseStatus() {
    const res = await fetch(`${API_BASE}/data-pulse/status`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Data pulse status failed: ${res.status}`);
    return res.json();
}

/** 获取数据合约健康度 + 冷启动 bootstrap 进度 */
export async function fetchDataPulseContracts() {
    const res = await fetch(`${API_BASE}/data-pulse/contracts`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Data pulse contracts failed: ${res.status}`);
    return res.json();
}
