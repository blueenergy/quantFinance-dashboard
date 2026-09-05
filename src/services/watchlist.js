/**
 * 用户自选股服务
 * 管理用户的自选股列表
 */

import request from '../utils/request'

export const WATCHLIST_SESSION_SNAPSHOT_KEY = 'watchlist_session_snapshot_v1'

export function mapRealtimeWatchlistRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((stock) => ({
    symbol: stock.symbol,
    name: stock.name,
    asset_type: stock.asset_type,
    industry: stock.industry,
    sw_industry: stock.sw_industry,
    price: stock.price,
    open: stock.open,
    high: stock.high,
    low: stock.low,
    close: stock.price,
    change: stock.change,
    change_pct: stock.change_pct,
    volume: stock.volume,
    update_time: stock.update_time,
  }))
}

export function mapHistoryWatchlistRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((stock) => ({
    symbol: stock.symbol,
    name: stock.name,
    asset_type: stock.asset_type,
    industry: stock.industry,
    sw_industry: stock.sw_industry,
    close: stock.close,
    open: stock.open,
    high: stock.high,
    low: stock.low,
    change: stock.change,
    change_percent: stock.change_percent,
    volume: stock.volume,
    turnover: stock.turnover,
    turnover_rate: stock.turnover_rate,
    pe: stock.pe,
    market_cap: stock.market_cap,
    circ_market_cap: stock.circ_market_cap,
    date: stock.trade_date,
  }))
}

export function symbolsFromWatchlistRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((stock) => stock?.symbol).filter(Boolean)
}

class WatchlistService {
  // 获取认证头部（部分组件仍直接传 headers，过渡期保留）
  getAuthHeaders() {
    const token = localStorage.getItem('access_token')
    return token ? {
      'Authorization': `Bearer ${token}`
    } : {}
  }

  // 获取用户自选股列表 → symbols 数组
  async getUserWatchlist() {
    try {
      console.log('🌐 开始请求自选股API:', '/user/watchlist')
      const body = await request({
        url: '/user/watchlist',
        method: 'get',
      })

      console.log('📡 API响应数据:', body)

      if (body.success) {
        const symbols = body.data?.symbols || []
        console.log('✅ 成功解析symbols:', symbols, '数量:', symbols.length)
        return symbols
      }
      throw new Error(body.message || '获取自选股失败')
    } catch (error) {
      console.error('❌ 获取自选股失败:', error)
      throw error
    }
  }

  // 获取用户自选股详细信息 → data 数组
  async getUserWatchlistStocks() {
    try {
      const body = await request({
        url: '/user/watchlist-stocks',
        method: 'get',
      })

      if (body.success) {
        return body.data || []
      }
      throw new Error(body.message || '获取自选股详情失败')
    } catch (error) {
      console.error('获取自选股详情失败:', error)
      throw error
    }
  }

  // 获取用户自选股实时数据（基于分钟K线）→ data 数组
  async getUserWatchlistRealtime() {
    try {
      const body = await request({
        url: '/user/watchlist-stocks/realtime',
        method: 'get',
      })

      if (body.success) {
        return body.data || []
      }
      throw new Error(body.message || '获取实时数据失败')
    } catch (error) {
      console.error('获取实时数据失败:', error)
      throw error
    }
  }

  // 添加股票到自选股 → 整段 envelope body
  async addToWatchlist(symbol) {
    try {
      const body = await request({
        url: '/user/watchlist/add',
        method: 'post',
        data: { symbol },
      })

      if (body.success) {
        return body
      }
      throw new Error(body.message || '添加自选股失败')
    } catch (error) {
      console.error('添加自选股失败:', error)
      throw error
    }
  }

  // 从自选股中移除股票 → 整段 envelope body
  async removeFromWatchlist(symbol) {
    try {
      const body = await request({
        url: `/user/watchlist/remove/${symbol}`,
        method: 'delete',
      })

      if (body.success) {
        return body
      }
      throw new Error(body.message || '移除自选股失败')
    } catch (error) {
      console.error('移除自选股失败:', error)
      throw error
    }
  }

  // 批量更新自选股 → 整段 envelope body
  async updateWatchlist(symbols) {
    try {
      const body = await request({
        url: '/user/watchlist',
        method: 'put',
        data: { symbols },
      })

      if (body.success) {
        return body
      }
      throw new Error(body.message || '更新自选股失败')
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

  getSessionSnapshot(username) {
    if (!username) return null
    try {
      const raw = sessionStorage.getItem(WATCHLIST_SESSION_SNAPSHOT_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed || parsed.username !== username) return null
      const symbols = Array.isArray(parsed.symbols) ? parsed.symbols : []
      const stocks = Array.isArray(parsed.stocks) ? parsed.stocks : []
      return { symbols, stocks }
    } catch {
      return null
    }
  }

  setSessionSnapshot(username, { symbols = [], stocks = [] } = {}) {
    if (!username) return
    try {
      sessionStorage.setItem(WATCHLIST_SESSION_SNAPSHOT_KEY, JSON.stringify({
        username,
        symbols: Array.isArray(symbols) ? symbols : [],
        stocks: Array.isArray(stocks) ? stocks : [],
      }))
    } catch {
      /* storage quota / private mode */
    }
  }

  clearSessionSnapshot() {
    try {
      sessionStorage.removeItem(WATCHLIST_SESSION_SNAPSHOT_KEY)
    } catch {
      /* ignore */
    }
  }
}

// 导出单例
export const watchlistService = new WatchlistService()
export default watchlistService
