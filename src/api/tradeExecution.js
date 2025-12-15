// Trade execution API client
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function authHeaders() {
  const token = localStorage.getItem("access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function getAllTradeExecutions(limit = 100, skip = 0) {
  const res = await fetch(`${API_BASE}/trade-executions/?limit=${limit}&skip=${skip}`, { 
    headers: authHeaders() 
  });
  if (!res.ok) throw new Error(`Failed to fetch trade executions: ${res.status}`);
  return res.json();
}

export async function getTradeExecutionsBySymbol(symbol, limit = 100, skip = 0) {
  const res = await fetch(`${API_BASE}/trade-executions/symbol/${symbol}?limit=${limit}&skip=${skip}`, { 
    headers: authHeaders() 
  });
  if (!res.ok) throw new Error(`Failed to fetch trade executions for symbol ${symbol}: ${res.status}`);
  return res.json();
}

export async function getTradeExecutionsByDate(date, limit = 100, skip = 0) {
  const res = await fetch(`${API_BASE}/trade-executions/date/${date}?limit=${limit}&skip=${skip}`, { 
    headers: authHeaders() 
  });
  if (!res.ok) throw new Error(`Failed to fetch trade executions for date ${date}: ${res.status}`);
  return res.json();
}

export async function getTradeExecutionStats() {
  const res = await fetch(`${API_BASE}/trade-executions/stats`, { 
    headers: authHeaders() 
  });
  if (!res.ok) throw new Error(`Failed to fetch trade execution stats: ${res.status}`);
  return res.json();
}

export async function getTradeStrategies() {
  const res = await fetch(`${API_BASE}/trade-executions/strategies`, { 
    headers: authHeaders() 
  });
  if (!res.ok) throw new Error(`Failed to fetch trade strategies: ${res.status}`);
  return res.json();
}