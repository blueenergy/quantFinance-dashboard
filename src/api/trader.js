// Trader API client using fetch; assumes JWT in localStorage
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
  const token = localStorage.getItem("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function getTraderAccount(securitiesAccountId = null) {
  let url = `${API_BASE}/trader/account`;
  if (securitiesAccountId) {
    url += `?securities_account_id=${encodeURIComponent(securitiesAccountId)}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to get trader account: ${res.status}`);
  const data = await res.json();
  return data.data || {};
}

export async function getTraderPositions(securitiesAccountId = null) {
  let url = `${API_BASE}/trader/positions`;
  if (securitiesAccountId) {
    url += `?securities_account_id=${encodeURIComponent(securitiesAccountId)}`;
  }
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to get trader positions: ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

export async function getTraderHeartbeats(limit = 50) {
  const url = `${API_BASE}/trader/heartbeat?limit=${encodeURIComponent(limit)}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to get trader heartbeats: ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

// 获取用户的所有证券账户
export async function getSecuritiesAccounts() {
  const res = await fetch(`${API_BASE}/user/securities_accounts`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to get securities accounts: ${res.status}`);
  return await res.json();
}

// 获取交易信号（用于观察模式模拟盈亏计算）
export async function getTradeSignals(securitiesAccountId = null, status = null, symbol = null) {
  let url = `${API_BASE}/trade-signals/`;
  const params = new URLSearchParams();
  if (securitiesAccountId) params.append('securities_account_id', securitiesAccountId);
  if (status) params.append('status', status);
  if (symbol) params.append('symbol', symbol);
  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to get trade signals: ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

export { API_BASE, authHeaders };