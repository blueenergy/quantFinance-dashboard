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
        const raw = resp.data?.data || []
        analysisHistory.value[symbol] = raw.map((h) => {
          const ar = h.analysis_result || {}
          const analysis = ar.analysis || h.analysis || null
          return {
            ...h,
            analysis_result: ar,
            analysis,
            stock_name: h.stock_name || analysis?.stock_name,
            provider: h.provider || ar.provider,
            model: h.model || ar.model
          }
        })
      } catch (e) {
        analysisHistory.value[symbol] = []
      }
    } else {
      // 未登录用本地
      const raw = localStorage.getItem('analysisHistory')
      analysisHistory.value = raw ? JSON.parse(raw) : {}
    }
  }

  async function addHistory(symbol, result, provider, model, stock_name) {
    if (isAuthenticated?.value) {
      // 登录状态下保存到后端
      try {
        const token = localStorage.getItem('access_token')
        const base = result?.analysis ? result.analysis : (result || {})
        const analysisPayload = { ...base }
        if (!analysisPayload.symbol) analysisPayload.symbol = symbol
        const resolvedName = stock_name || analysisPayload.stock_name || symbol
        if (!analysisPayload.stock_name) analysisPayload.stock_name = resolvedName
        await axios.post('/api/analysis-history', {
          symbol,
          stock_name: resolvedName,
          analysis_result: {
            analysis: analysisPayload,
            provider,
            model
          },
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
      const base = result?.analysis ? result.analysis : (result || {})
      const analysisPayload = { ...base }
      if (!analysisPayload.symbol) analysisPayload.symbol = symbol
      const resolvedName = stock_name || analysisPayload.stock_name || symbol
      if (!analysisPayload.stock_name) analysisPayload.stock_name = resolvedName
      analysisHistory.value[symbol].unshift({
        symbol,
        analysis: analysisPayload,
        analysis_result: { analysis: analysisPayload, provider, model },
        stock_name: resolvedName,
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
