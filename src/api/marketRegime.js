const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function authHeaders() {
  const token = localStorage.getItem('access_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function getMarketRegimeLatest() {
  const res = await fetch(`${API_BASE}/market-regime/latest`, { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`getMarketRegimeLatest failed: ${res.status}`)
  return await res.json()
}

export async function getMarketRegimeHistory(limit = 60) {
  const res = await fetch(`${API_BASE}/market-regime/history?limit=${limit}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`getMarketRegimeHistory failed: ${res.status}`)
  return await res.json()
}

export async function getMarketBreadthHistory(limit = 120) {
  const res = await fetch(`${API_BASE}/market-regime/breadth?limit=${limit}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`getMarketBreadthHistory failed: ${res.status}`)
  return await res.json()
}

export async function getIndexCapeHistory(indexCode = '000300.SH', limit = 180) {
  const res = await fetch(`${API_BASE}/market-regime/cape?index_code=${encodeURIComponent(indexCode)}&limit=${limit}`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`getIndexCapeHistory failed: ${res.status}`)
  return await res.json()
}