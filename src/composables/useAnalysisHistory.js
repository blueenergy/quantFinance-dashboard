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
    console.log(`[loadHistory] 开始加载 ${symbol} 的历史记录`)
    if (isAuthenticated?.value) {
      // 登录状态下从后端获取
      try {
        const token = localStorage.getItem('access_token')
        // 使用 params 对象而不是 URL 字符串，确保客户端验证可以检测到 symbol
        const resp = await axios.get('/api/analysis-history', {
          headers: { Authorization: `Bearer ${token}` },
          params: { symbol }  // 明确使用 params 对象
        })
        console.log(`[loadHistory] API 响应:`, resp.data)
        const raw = resp.data?.data || []
        console.log(`[loadHistory] 解析后的数据数量: ${raw.length}`)
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
        console.log(`[loadHistory] 设置 analysisHistory[${symbol}]:`, analysisHistory.value[symbol])
      } catch (e) {
        console.error(`[loadHistory] 加载 ${symbol} 失败:`, e)
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
