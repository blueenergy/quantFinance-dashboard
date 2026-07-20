import { ref } from 'vue'
import request from '../utils/request'

export function useRankingWatchlist(options = {}) {
  const requestClient = options.requestClient || request
  const isUserLoggedIn = options.isUserLoggedIn || (() => localStorage.getItem('access_token') !== null)
  const notify = options.notify || ((message) => globalThis.alert?.(message))
  const confirmAction = options.confirmAction || ((message) => globalThis.confirm?.(message) ?? false)
  const dlog = options.dlog || (() => {})
  const getViewMode = options.getViewMode || (() => '')
  const onRankingRefresh = options.onRankingRefresh || (() => {})
  const watchlist = ref([])

  async function refreshRankingsIfVisible() {
    if (getViewMode() === 'watchlist') await onRankingRefresh()
  }

  async function fetchWatchlist() {
    if (!isUserLoggedIn()) {
      watchlist.value = []
      dlog('skip watchlist fetch (not logged in)')
      return watchlist.value
    }
    try {
      const response = await requestClient({ method: 'get', url: '/user/watchlist' })
      dlog('watchlist response', response)
      watchlist.value = response?.success && Array.isArray(response.data?.symbols)
        ? response.data.symbols
        : []
    } catch (error) {
      console.error('获取自选股失败:', error)
      if (error.response?.status === 401) watchlist.value = []
    }
    return watchlist.value
  }

  function isInWatchlist(symbol) {
    return watchlist.value.includes(symbol)
  }

  async function addToWatchlist(symbol) {
    try {
      const response = await requestClient({
        method: 'post',
        url: '/user/watchlist/add',
        data: { symbol },
      })
      dlog('add watchlist response', response)
      if (!response?.success) {
        notify('❌ 添加自选股失败')
        return false
      }
      if (!isInWatchlist(symbol)) watchlist.value.push(symbol)
      notify(`✅ 已将 ${symbol} 添加到自选股`)
      return true
    } catch (error) {
      console.error('添加自选股失败:', error)
      notify(`❌ 添加自选股失败: ${error.response?.data?.detail || error.message}`)
      return false
    }
  }

  async function removeFromWatchlist(symbol) {
    try {
      const strategyResponse = await requestClient({
        method: 'get',
        url: '/user/watchlist/strategies',
      })
      const activeStrategies = Array.isArray(strategyResponse?.data)
        ? strategyResponse.data.filter(item => item.symbol === symbol && item.enabled === true)
        : []
      if (strategyResponse?.success && activeStrategies.length > 0) {
        const names = activeStrategies.map(item => item.strategy_key).join(', ')
        notify(
          `❌ 无法删除：该股票还有 ${activeStrategies.length} 个策略处于激活状态 (${names})`
          + '\n\n请先在“策略配置”页面停用相关策略，然后再删除股票。'
        )
        return false
      }

      const response = await requestClient({
        method: 'delete',
        url: `/user/watchlist/remove/${symbol}`,
      })
      if (!response?.success) {
        notify('❌ 移除失败')
        return false
      }
      watchlist.value = watchlist.value.filter(item => item !== symbol)
      notify(`✅ 已将 ${symbol} 从自选股中移除`)
      await refreshRankingsIfVisible()
      return true
    } catch (error) {
      console.error('移除自选股失败:', error)
      notify(`❌ 移除自选股失败: ${error.response?.data?.detail || error.message}`)
      return false
    }
  }

  async function toggleWatchlist(symbol) {
    if (!isUserLoggedIn()) {
      notify('❌ 请先登录后再操作自选股')
      return false
    }
    return isInWatchlist(symbol)
      ? removeFromWatchlist(symbol)
      : addToWatchlist(symbol)
  }

  async function clearWatchlist() {
    if (!isUserLoggedIn()) {
      notify('❌ 请先登录')
      return false
    }
    if (!confirmAction('确定要清空自选股列表吗?')) return false

    try {
      const response = await requestClient({
        method: 'put',
        url: '/user/watchlist',
        data: { symbols: [] },
      })
      if (!response?.success) {
        notify('❌ 清空失败')
        return false
      }
      watchlist.value = []
      notify('🗑️ 自选股列表已清空')
      await refreshRankingsIfVisible()
      return true
    } catch (error) {
      console.error('清空自选股失败:', error)
      notify(`❌ 清空自选股失败: ${error.response?.data?.detail || error.message}`)
      return false
    }
  }

  async function viewWatchlistStocks() {
    if (!isUserLoggedIn()) {
      notify('❌ 请先登录后查看自选股')
      return
    }
    try {
      const response = await requestClient({ method: 'get', url: '/user/watchlist-stocks' })
      if (!response?.success) {
        notify('❌ 获取自选股信息失败')
        return
      }
      const stocks = Array.isArray(response.data) ? response.data : []
      if (stocks.length === 0) {
        notify('📝 自选股列表为空')
        return
      }
      const stockInfo = stocks.map(stock => (
        `${stock.symbol} ${stock.name}: ¥${stock.close || 'N/A'} `
        + `(${stock.change_percent ? `${stock.change_percent.toFixed(2)}%` : 'N/A'})`
      )).join('\n')
      notify(`📋 自选股详细信息:\n${stockInfo}`)
    } catch (error) {
      console.error('获取自选股详细信息失败:', error)
      notify(`❌ 获取自选股信息失败: ${error.response?.data?.detail || error.message}`)
    }
  }

  return {
    watchlist,
    fetchWatchlist,
    isInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
    clearWatchlist,
    viewWatchlistStocks,
  }
}
