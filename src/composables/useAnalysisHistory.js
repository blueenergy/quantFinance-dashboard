// useAnalysisHistory.js
// 可插拔的历史分析逻辑 composable
import { ref } from 'vue'
import request from '../utils/request'
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
        const body = await request({
          url: '/analysis-history',
          method: 'get',
          params: { symbol, include_full: true },
        })
        console.log(`[loadHistory] API 响应:`, body)
        const raw = body?.data || []
        console.log(`[loadHistory] 解析后的数据数量: ${raw.length}`)
        analysisHistory.value[symbol] = raw.map((h) => {
          const ar = h.analysis_result || {}
          const analysis = ar.analysis || h.analysis || null
          const analysisMode = h.analysis_mode || ar.analysis_mode || analysis?.analysis_mode || 'classic'
          return {
            ...h,
            analysis_mode: analysisMode,
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

  return {
    analysisHistory,
    loadHistory,
  }
}
