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

/** 获取数据同步任务状态 */
export async function fetchDataPulseStatus() {
    const res = await fetch(`${API_BASE}/data-pulse/status`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Data pulse status failed: ${res.status}`);
    return res.json();
}
