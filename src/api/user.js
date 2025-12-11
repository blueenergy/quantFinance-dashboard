// Simple user API client using fetch; assumes JWT in localStorage
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
  const token = localStorage.getItem("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function getWatchlist() {
  const res = await fetch(`${API_BASE}/user/watchlist`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed watchlist: ${res.status}`);
  return res.json();
}

export async function getWatchlistStrategies() {
  const res = await fetch(`${API_BASE}/user/watchlist/strategies`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed strategies: ${res.status}`);
  return res.json();
}

export async function setWatchlistStrategy(payload) {
  const res = await fetch(`${API_BASE}/user/watchlist/strategy`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed set strategy: ${res.status}`);
  return res.json();
}

const STRATEGIES_API_URL = import.meta.env.VITE_STRATEGIES_API_URL || "http://10.183.72.186:8000/strategies";
export async function getAvailableStrategies() {
  const res = await fetch(STRATEGIES_API_URL, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed available strategies: ${res.status}`);
  const data = await res.json();
  // 支持直接数组或 { strategies: [...] }
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.strategies)) return data.strategies;
  return [];
}

export async function getSecuritiesAccounts() {
  const res = await fetch(`${API_BASE}/securities_account`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`Failed to get accounts: ${res.status}`)
  return await res.json()
}
export async function createSecuritiesAccount(payload) {
  const res = await fetch(`${API_BASE}/securities_account`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create account: ${res.status}`)
  return await res.json()
}
export async function updateSecuritiesAccount(account_id, payload) {
  const res = await fetch(`${API_BASE}/securities_account/${account_id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update account: ${res.status}`)
  return await res.json()
}
export async function deleteSecuritiesAccount(account_id) {
  const res = await fetch(`${API_BASE}/securities_account/${account_id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Failed to delete account: ${res.status}`)
  return await res.json()
}

export { API_BASE, authHeaders }
