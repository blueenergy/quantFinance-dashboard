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

export async function getTradeActivitiesStats() {
  const res = await fetch(`${API_BASE}/trade-activities/stats`, { 
    headers: authHeaders() 
  });
  if (!res.ok) throw new Error(`Failed to fetch trade activities stats: ${res.status}`);
  return res.json();
}

export async function getTradeStrategies() {
  const res = await fetch(`${API_BASE}/trade-executions/strategies`, { 
    headers: authHeaders() 
  });
  if (!res.ok) throw new Error(`Failed to fetch trade strategies: ${res.status}`);
  return res.json();
}

export async function getAllTradeActivities(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.skip) queryParams.append('skip', params.skip);
  if (params.days) queryParams.append('days', params.days);
  if (params.all_dates) queryParams.append('all_dates', 'true');
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);
  if (params.status_filter) queryParams.append('status_filter', params.status_filter);
  
  const res = await fetch(`${API_BASE}/trade-activities/?${queryParams.toString()}`, {
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(`Failed to fetch trade activities: ${res.status}`);
  return res.json();
}

export async function previewTraderSignalReprice(orderId) {
  const res = await fetch(
    `${API_BASE}/trader/signals/${encodeURIComponent(orderId)}/reprice`,
    {
      method: "POST",
      headers: authHeaders(),
      body: "{}",
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `reprice preview failed: ${res.status}`);
  }
  return res.json();
}

export async function confirmTraderSignalReprice(orderId, body) {
  const res = await fetch(
    `${API_BASE}/trader/signals/${encodeURIComponent(orderId)}/reprice/confirm`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `reprice confirm failed: ${res.status}`);
  }
  return res.json();
}

export async function getTradePnlSummary(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.days) queryParams.append('days', params.days);
  if (params.all_dates) queryParams.append('all_dates', 'true');
  if (params.start_date) queryParams.append('start_date', params.start_date);
  if (params.end_date) queryParams.append('end_date', params.end_date);

  const query = queryParams.toString();
  const url = query
    ? `${API_BASE}/trade-executions/pnl-summary?${query}`
    : `${API_BASE}/trade-executions/pnl-summary`;

  const res = await fetch(url, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch trade PnL summary: ${res.status}`);
  return res.json();
}
