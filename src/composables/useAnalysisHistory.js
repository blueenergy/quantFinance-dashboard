// useAnalysisHistory.js
// 可插拔的历史分析逻辑 composable
import { ref } from 'vue'
import axios from 'axios'
import { useAuth } from '../services/auth.js'

export function useAnalysisHistory() {
  const analysisHistory = ref({})
  const { isAuthenticated } = useAuth()

  async function loadHistory(symbol) {
    if (!symbol || symbol === 'undefined') {
      console.warn('loadHistory 被调用但 symbol 无效:', symbol)
      return
    }
    if (isAuthenticated?.value) {
      // 登录状态下从后端获取
      try {
        const token = localStorage.getItem('access_token')
        const resp = await axios.get(`/api/analysis-history?symbol=${symbol}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        analysisHistory.value[symbol] = resp.data.data || []
      } catch (e) {
        analysisHistory.value[symbol] = []
      }
    } else {
      // 未登录用本地
      const raw = localStorage.getItem('analysisHistory')
      analysisHistory.value = raw ? JSON.parse(raw) : {}
    }
  }

  async function addHistory(symbol, result, provider, model) {
    if (isAuthenticated?.value) {
      // 登录状态下保存到后端
      try {
        const token = localStorage.getItem('access_token')
        await axios.post('/api/analysis-history', {
          symbol,
          analysis_result: result,
          provider,
          model,
          timestamp: new Date().toISOString()
        }, {
          headers: { Authorization: `Bearer ${token}` }
        })
        await loadHistory(symbol)
      } catch (e) {}
    } else {
      // 未登录保存到本地
      if (!analysisHistory.value[symbol]) analysisHistory.value[symbol] = []
      analysisHistory.value[symbol].unshift({
        symbol,
        data: result,
        timestamp: new Date().toISOString()
      })
      analysisHistory.value[symbol] = analysisHistory.value[symbol].slice(0, 10)
      localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory.value))
    }
  }

  return {
    analysisHistory,
    loadHistory,
    addHistory
  }
}
