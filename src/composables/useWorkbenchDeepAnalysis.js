import { getCurrentInstance, onBeforeUnmount, ref, toValue } from 'vue'
import request from '../utils/request'

export function useWorkbenchDeepAnalysis(options = {}) {
  const {
    payload,
    stockSymbol,
    directSymbol,
    stockName,
    analysisHistory,
    isCurrentWorkbenchSymbol = () => true,
  } = options

  const analysisMode = ref('multi_expert_v1')
  const analysisSubmitting = ref(false)
  const analysisSubmitStatus = ref('')
  const analysisSubmitError = ref('')
  let analysisPollTimer = null
  let analysisRunId = 0
  let historySelectId = 0

  function currentSymbol() {
    const primary = toValue(stockSymbol)
    return primary && primary !== '-' ? primary : toValue(directSymbol)
  }

  function clearAnalysisPolling() {
    analysisRunId += 1
    historySelectId += 1
    if (analysisPollTimer) {
      clearInterval(analysisPollTimer)
      analysisPollTimer = null
    }
    analysisSubmitting.value = false
  }

  async function selectAnalysisHistory(item) {
    if (!item?.id) return
    const selectId = ++historySelectId
    try {
      const body = await request.get(`/analysis-history/${item.id}`)
      if (selectId !== historySelectId) return
      const full = body?.data || item
      payload.value = {
        ...(payload.value || {}),
        deep_analysis: full,
      }
    } catch {
      if (selectId !== historySelectId) return
      payload.value = {
        ...(payload.value || {}),
        deep_analysis: item,
      }
    }
  }

  async function submitDeepAnalysis() {
    const symbol = currentSymbol()
    if (!symbol) return
    clearAnalysisPolling()
    const runId = analysisRunId
    analysisSubmitting.value = true
    analysisSubmitError.value = ''
    analysisSubmitStatus.value = ''
    try {
      const body = await request.post(
        '/analyze/deep-analysis',
        { symbol, priority: 30, analysis_mode: analysisMode.value },
      )
      if (runId !== analysisRunId) return
      if (!body?.success) {
        analysisSubmitError.value = body?.message || '提交失败'
        analysisSubmitting.value = false
        return
      }
      const taskId = body.task_id
      analysisSubmitStatus.value = `已提交，前方 ${body.queue_ahead ?? '?'} 个任务。${body.wait_hint || '分析中…'}`
      let tries = 0
      analysisPollTimer = setInterval(async () => {
        if (runId !== analysisRunId) {
          clearInterval(analysisPollTimer)
          analysisPollTimer = null
          return
        }
        tries += 1
        if (tries > 120) {
          if (runId !== analysisRunId) return
          clearAnalysisPolling()
          analysisSubmitStatus.value = '等待超时，请稍后刷新工作台或在个股深度分析历史中查看。'
          return
        }
        try {
          const poll = await request.get(`/analyze/task/${taskId}`)
          if (runId !== analysisRunId) return
          if (!isCurrentWorkbenchSymbol(symbol)) {
            clearAnalysisPolling()
            return
          }
          const status = poll?.status
          if (status === 'completed') {
            clearAnalysisPolling()
            analysisSubmitStatus.value = '分析完成，已更新当前工作台。'
            const analysis = poll?.analysis || {}
            const nextDeepAnalysis = {
              id: taskId,
              symbol,
              stock_name: analysis.stock_name || toValue(stockName) || '',
              analysis_mode: poll?.analysis_mode || analysis.analysis_mode || analysisMode.value,
              analysis,
              model: poll?.model,
              created_at: new Date().toISOString(),
            }
            payload.value = {
              ...(payload.value || {}),
              deep_analysis: nextDeepAnalysis,
              analysis_history: [
                nextDeepAnalysis,
                ...toValue(analysisHistory).filter((item) => item.id !== nextDeepAnalysis.id),
              ],
              data_status: {
                ...(payload.value?.data_status || {}),
                deep_analysis_found: true,
                analysis_created_at: nextDeepAnalysis.created_at,
              },
            }
          } else if (status === 'failed' || status === 'completed_with_parse_error') {
            clearAnalysisPolling()
            analysisSubmitStatus.value = ''
            analysisSubmitError.value = poll?.error || '分析失败'
          } else if (status === 'pending') {
            analysisSubmitStatus.value = `排队中，前方 ${poll?.queue_ahead ?? '?'} 个任务。${poll?.wait_hint || '预计等待时间计算中'}`
          } else if (status === 'processing') {
            analysisSubmitStatus.value = poll?.wait_hint || '正在分析，LLM 响应时间可能有波动'
          }
        } catch {
          // Keep polling through transient network/server hiccups.
        }
      }, 3000)
    } catch (error) {
      if (runId !== analysisRunId) return
      analysisSubmitError.value = error.response?.data?.detail || error.message || '提交失败'
      analysisSubmitting.value = false
    }
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(clearAnalysisPolling)
  }

  return {
    analysisMode,
    analysisSubmitting,
    analysisSubmitStatus,
    analysisSubmitError,
    clearAnalysisPolling,
    selectAnalysisHistory,
    submitDeepAnalysis,
  }
}
