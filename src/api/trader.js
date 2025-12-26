// Trader API client using fetch; assumes JWT in localStorage
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
  const token = localStorage.getItem("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function getTraderAccount() {
  const res = await fetch(`${API_BASE}/trader/account`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to get trader account: ${res.status}`);
  const data = await res.json();
  return data.data || {};
}

export async function getTraderPositions() {
  const res = await fetch(`${API_BASE}/trader/positions`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Failed to get trader positions: ${res.status}`);
  const data = await res.json();
  return data.data || [];
}

export { API_BASE, authHeaders };