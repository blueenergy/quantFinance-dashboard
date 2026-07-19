import axios from 'axios'
import { authService } from '../services/auth.js'

// 创建 axios 实例（api 层统一入口）
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

function buildResponseErrorHandler() {
  return (error) => {
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
    if (!error.config?.silentErrorLog) {
      console.error('Response error:', diagnostic, error)
    }
    return Promise.reject(error)
  }
}

function installRequestInterceptor(instance) {
  instance.interceptors.request.use(
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
}

// api 模块：解包 response.data
installRequestInterceptor(service)
service.interceptors.response.use(
  (response) => response.data,
  buildResponseErrorHandler(),
)

// 过渡期：页面/composable 仍用裸 axios 时自动带 Bearer（与旧 App.vue 拦截器一致）
if (axios.interceptors?.request && axios.interceptors?.response) {
  installRequestInterceptor(axios)
  axios.interceptors.response.use(
    (response) => response,
    buildResponseErrorHandler(),
  )
}

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
