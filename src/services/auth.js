/**
 * 认证服务
 * 管理用户登录状态、token验证等功能
 */

import { ref, computed } from 'vue'

class AuthService {
  constructor() {
    this.user = ref(null)
    this.token = ref(null)
    this.loading = ref(false)
    
    // 初始化时检查本地存储的认证信息
    this.initAuth()
  }

  // 初始化认证状态
  initAuth() {
    const storedToken = localStorage.getItem('access_token')
    const storedUser = localStorage.getItem('user_info')
    
    if (storedToken && storedUser) {
      try {
        this.token.value = storedToken
        this.user.value = JSON.parse(storedUser)
      } catch (error) {
        console.error('解析用户信息失败:', error)
        this.clearAuth()
      }
    }
  }

  // 计算属性：是否已登录
  get isAuthenticated() {
    return computed(() => !!this.token.value && !!this.user.value)
  }

  // 计算属性：当前用户
  get currentUser() {
    return computed(() => this.user.value)
  }

  // 设置认证信息
  setAuth(authData) {
    this.token.value = authData.access_token
    this.user.value = authData.user
    
    // 保存到本地存储
    localStorage.setItem('access_token', authData.access_token)
    localStorage.setItem('user_info', JSON.stringify(authData.user))
  }

  // 清除认证信息
  clearAuth() {
    this.token.value = null
    this.user.value = null
    
    // 清除本地存储
    localStorage.removeItem('access_token')
    localStorage.removeItem('user_info')
  }

  // 获取认证头
  getAuthHeaders() {
    if (!this.token.value) {
      return {}
    }
    
    return {
      'Authorization': `Bearer ${this.token.value}`
    }
  }

  // 检查token是否有效
  async validateToken() {
    if (!this.token.value) {
      return false
    }

    try {
      const response = await fetch('/api/profile', {
        headers: this.getAuthHeaders()
      })

      if (response.ok) {
        const userData = await response.json()
        this.user.value = userData
        localStorage.setItem('user_info', JSON.stringify(userData))
        return true
      } else {
        this.clearAuth()
        return false
      }
    } catch (error) {
      console.error('Token验证失败:', error)
      this.clearAuth()
      return false
    }
  }

  // 登录
  async login(credentials) {
    this.loading.value = true
    
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || '登录失败')
      }

      this.setAuth(data)
      return { success: true, data }
      
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      this.loading.value = false
    }
  }

  // 注册
  async register(userData) {
    this.loading.value = true
    
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || '注册失败')
      }

      return { success: true, data }
      
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      this.loading.value = false
    }
  }

  // 登出
  logout() {
    this.clearAuth()
  }

  // 带认证的API请求
  async authenticatedRequest(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...(options.headers || {})
    }

    const response = await fetch(url, {
      ...options,
      headers
    })

    // 如果返回401，清除认证信息
    if (response.status === 401) {
      this.clearAuth()
      throw new Error('认证失效，请重新登录')
    }

    return response
  }
}

// 创建全局认证服务实例
export const authService = new AuthService()

// 提供给组合式API使用的hook
export function useAuth() {
  return {
    user: authService.currentUser,
    isAuthenticated: authService.isAuthenticated,
    loading: authService.loading,
    login: authService.login.bind(authService),
    register: authService.register.bind(authService),
    logout: authService.logout.bind(authService),
    validateToken: authService.validateToken.bind(authService),
    authenticatedRequest: authService.authenticatedRequest.bind(authService)
  }
}
