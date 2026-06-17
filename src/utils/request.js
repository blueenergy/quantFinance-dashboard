import axios from 'axios'

// 创建axios实例
const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api', // API的base_url
  timeout: 30000 // 请求超时时间
})

// 请求拦截器
service.interceptors.request.use(
  config => {
    // 在发送请求之前做些什么
    config.metadata = { startTime: Date.now() }
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers['Authorization'] = 'Bearer ' + token
    }
    config.headers['Content-Type'] = 'application/json'
    return config
  },
  error => {
    // 对请求错误做些什么
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  response => {
    // 对响应数据做点什么
    return response.data
  },
  error => {
    // 对响应错误做点什么
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
    if (error.response && error.response.status === 401) {
      // token过期等处理：与 App.vue 缓存清理策略保持一致
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
      } catch (e) {
        // ignore in non-browser contexts
      }
      window.location.href = '/login'
    }
    // 轮询/后台请求可传 silentErrorLog: true，避免控制台被 ECONNABORTED 刷屏
    if (!error.config?.silentErrorLog) {
      console.error('Response error:', diagnostic, error)
    }
    return Promise.reject(error)
  }
)

export default service