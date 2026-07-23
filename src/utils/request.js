import axios from 'axios'
import { authService } from '../services/auth.js'

// 创建 axios 实例（业务 HTTP 唯一入口）
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 30000,
})

export function clearSessionCaches() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user_info')
  localStorage.removeItem('activeTab')
  localStorage.removeItem('activeTab_v2')
  localStorage.removeItem('activeTab_username_v2')
  sessionStorage.removeItem('nav_visible_tab_ids_v1')
  sessionStorage.removeItem('nav_visible_tab_ids_v2')
  sessionStorage.removeItem('nav_visible_tab_ids_v3')
  sessionStorage.removeItem('nav_visible_tab_ids_v4')
  sessionStorage.removeItem('nav_visible_tab_ids_v5')
  sessionStorage.removeItem('nav_visible_tab_ids_v6')
  sessionStorage.removeItem('nav_visible_tab_username_v1')
  sessionStorage.removeItem('nav_visible_tab_username_v2')
  try {
    window.currentSourceInfo = null
  } catch {
    // ignore in non-browser contexts
  }
}

function handleUnauthorized() {
  authService.clearAuth()
  clearSessionCaches()
  window.location.href = '/login'
}

/** Intentional AbortController / axios cancel — not a failed request. */
export function isRequestCanceled(error) {
  if (!error) return false
  return (
    error.code === 'ERR_CANCELED'
    || error.name === 'CanceledError'
    || error.name === 'AbortError'
  )
}

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    config.metadata = { startTime: Date.now() }
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    if (!(config.data instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json'
    }
    return config
  },
  (error) => {
    console.error('Request error:', error)
    return Promise.reject(error)
  },
)

// 响应拦截器：成功返回 HTTP body；401 统一清会话并跳转登录
service.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const startedAt = error.config?.metadata?.startTime
    const elapsedMs = startedAt ? Date.now() - startedAt : undefined
    const method = (error.config?.method || 'get').toUpperCase()
    const url = `${error.config?.baseURL || ''}${error.config?.url || ''}`
    const diagnostic = {
      method,
      url,
      params: error.config?.params,
      status: error.response?.status,
      code: error.code,
      message: error.message,
      elapsedMs,
      timeout: error.config?.timeout,
    }
    if (error.response?.status === 401) {
      handleUnauthorized()
    }
    if (!error.config?.silentErrorLog && !isRequestCanceled(error)) {
      console.error('Response error:', diagnostic, error)
    }
    return Promise.reject(error)
  },
)

export async function requestOrNull(config) {
  try {
    return await service(config)
  } catch (err) {
    if (err.response?.status === 404) {
      return null
    }
    throw err
  }
}

export default service
