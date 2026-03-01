/**
 * 概念板块分析 API 调用 (DC 东方财富 / THS 同花顺)
 */

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

/**
 * Submit a sector concept analysis task (async).
 * @param {string} date - Trade date (YYYYMMDD)
 * @param {string} source - "dc" or "ths"
 */
export async function analyzeSectorConcept(date, source = 'dc') {
    const res = await fetch(`${API_BASE}/sector-concept/analyze`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ date, source }),
    });
    if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
    return await res.json();
}

/**
 * Poll task status.
 * @param {string} taskId
 */
export async function getSectorConceptTask(taskId) {
    const res = await fetch(`${API_BASE}/sector-concept/task/${taskId}`, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
    return await res.json();
}

/**
 * Get latest analysis result.
 * @param {string} source - "dc" or "ths"
 * @param {string} date - Trade date YYYYMMDD (optional)
 */
export async function getLatestSectorConcept(source = 'dc', date = null) {
    let url = `${API_BASE}/sector-concept/latest?source=${source}`;
    if (date) url += `&date=${date}`;
    const res = await fetch(url, {
        headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Get latest failed: ${res.status}`);
    return await res.json();
}

/**
 * Poll until task completes, calling onProgress callback.
 * @param {string} taskId
 * @param {Function} onProgress
 * @param {number} intervalMs
 * @param {number} maxAttempts
 */
export async function pollSectorConceptTask(taskId, onProgress, intervalMs = 2000, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
        const result = await getSectorConceptTask(taskId);

        if (onProgress) onProgress(result);

        if (result.status === 'completed' || result.status === 'failed') {
            return result;
        }

        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return { status: 'timeout', error: '分析超时，请稍后查看结果' };
}
