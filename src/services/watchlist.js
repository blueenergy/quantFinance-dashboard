/**
 * 用户自选股服务
 * 管理用户的自选股列表
 */

import axios from 'axios'

const API_BASE_URL = ''  // 使用空字符串，让请求通过vite代理

class WatchlistService {
  // 获取认证头部
  getAuthHeaders() {
    const token = localStorage.getItem('access_token')
    return token ? {
      'Authorization': `Bearer ${token}`
    } : {}
  }

  // 获取用户自选股列表
  async getUserWatchlist() {
    try {
      console.log('🌐 开始请求自选股API:', `${API_BASE_URL}/api/user/watchlist`)
      const headers = this.getAuthHeaders()
      console.log('🔑 请求头部:', headers)
      
      const response = await axios.get(`${API_BASE_URL}/api/user/watchlist`, {
        headers: headers
      })
      
      console.log('📡 API响应状态:', response.status)
      console.log('📡 API响应数据:', response.data)
      
      if (response.data.success) {
        const symbols = response.data.data.symbols || []
        console.log('✅ 成功解析symbols:', symbols, '数量:', symbols.length)
        return symbols
      } else {
        throw new Error(response.data.message || '获取自选股失败')
      }
    } catch (error) {
      console.error('❌ 获取自选股失败:', error)
      throw error
    }
  }

  // 获取用户自选股详细信息
  async getUserWatchlistStocks() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/user/watchlist-stocks`, {
        headers: this.getAuthHeaders()
      })
      
      if (response.data.success) {
        return response.data.data || []
      } else {
        throw new Error(response.data.message || '获取自选股详情失败')
      }
    } catch (error) {
      console.error('获取自选股详情失败:', error)
      throw error
    }
  }

  // 添加股票到自选股
  async addToWatchlist(symbol) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/user/watchlist/add`, 
        { symbol }, 
        { headers: this.getAuthHeaders() }
      )
      
      if (response.data.success) {
        return response.data
      } else {
        throw new Error(response.data.message || '添加自选股失败')
      }
    } catch (error) {
      console.error('添加自选股失败:', error)
      throw error
    }
  }

  // 从自选股中移除股票
  async removeFromWatchlist(symbol) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/user/watchlist/remove/${symbol}`, {
        headers: this.getAuthHeaders()
      })
      
      if (response.data.success) {
        return response.data
      } else {
        throw new Error(response.data.message || '移除自选股失败')
      }
    } catch (error) {
      console.error('移除自选股失败:', error)
      throw error
    }
  }

  // 批量更新自选股
  async updateWatchlist(symbols) {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/user/watchlist`, 
        { symbols }, 
        { headers: this.getAuthHeaders() }
      )
      
      if (response.data.success) {
        return response.data
      } else {
        throw new Error(response.data.message || '更新自选股失败')
      }
    } catch (error) {
      console.error('更新自选股失败:', error)
      throw error
    }
  }

  // 从localStorage迁移到服务器
  async migrateFromLocalStorage() {
    try {
      const localWatchlist = JSON.parse(localStorage.getItem('watchList') || '[]')
      
      if (localWatchlist.length > 0) {
        console.log('正在迁移本地自选股到服务器...', localWatchlist)
        await this.updateWatchlist(localWatchlist)
        
        // 迁移成功后清除本地数据
        localStorage.removeItem('watchList')
        console.log('本地自选股迁移完成')
        
        return true
      }
      
      return false
    } catch (error) {
      console.error('迁移本地自选股失败:', error)
      return false
    }
  }

  // 检查用户是否已登录
  isLoggedIn() {
    return !!localStorage.getItem('access_token')
  }

  // 获取本地自选股（用于未登录用户）
  getLocalWatchlist() {
    return JSON.parse(localStorage.getItem('watchList') || '[]')
  }

  // 设置本地自选股（用于未登录用户）
  setLocalWatchlist(symbols) {
    localStorage.setItem('watchList', JSON.stringify(symbols))
  }
}

// 导出单例
export const watchlistService = new WatchlistService()
export default watchlistService
