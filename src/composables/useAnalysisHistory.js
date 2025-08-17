// useAnalysisHistory.js
// 可插拔的历史分析逻辑 composable
import { ref } from 'vue'

export function useAnalysisHistory() {
  const analysisHistory = ref({})

  function loadHistory() {
    const raw = localStorage.getItem('analysisHistory')
    analysisHistory.value = raw ? JSON.parse(raw) : {}
  }

  function saveHistory() {
    localStorage.setItem('analysisHistory', JSON.stringify(analysisHistory.value))
  }

  function addHistory(symbol, result) {
    if (!analysisHistory.value[symbol]) analysisHistory.value[symbol] = []
    analysisHistory.value[symbol].unshift({
      symbol,
      data: result,
      timestamp: new Date().toISOString()
    })
    analysisHistory.value[symbol] = analysisHistory.value[symbol].slice(0, 10)
    saveHistory()
  }

  return {
    analysisHistory,
    loadHistory,
    addHistory
  }
}
