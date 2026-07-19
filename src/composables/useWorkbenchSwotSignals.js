import { getCurrentInstance, onBeforeUnmount, ref, toValue } from 'vue'
import {
  analyzeStockWorkbenchNewsUrl,
  collectStockWorkbenchSignals,
  getStockWorkbenchSignalTask,
  refreshStockWorkbenchInternalSignals,
} from '../api/stock'

export function useWorkbenchSwotSignals(options = {}) {
  const {
    stockSymbol,
    directSymbol,
    isCurrentWorkbenchSymbol = () => true,
    loadWorkbenchSection = async () => {},
  } = options

  const signalCollecting = ref(false)
  const signalCollectionMessage = ref('')
  const signalCollectionError = ref(false)
  const internalSignalRefreshing = ref(false)
  const internalSignalRefreshMessage = ref('')
  const internalSignalRefreshError = ref(false)
  const signalCollectionMode = ref('')
  let signalCollectionTimer = null
  let signalCollectionPollCount = 0
  let internalSignalTimer = null
  let internalSignalPollCount = 0
  let collectRunId = 0
  let internalRunId = 0

  function currentSymbol() {
    const primary = toValue(stockSymbol)
    return primary && primary !== '-' ? primary : toValue(directSymbol)
  }

  function clearCollectPolling() {
    collectRunId += 1
    if (signalCollectionTimer) {
      window.clearTimeout(signalCollectionTimer)
      signalCollectionTimer = null
    }
    signalCollectionPollCount = 0
    signalCollecting.value = false
    signalCollectionMode.value = ''
  }

  function clearInternalPolling() {
    internalRunId += 1
    if (internalSignalTimer) {
      window.clearTimeout(internalSignalTimer)
      internalSignalTimer = null
    }
    internalSignalPollCount = 0
    internalSignalRefreshing.value = false
  }

  // 机会/风险搜集与优势/劣势刷新是两条独立的轮询链路，
  // 该函数仅用于离开页面/切换标的等需要同时清理的场景。
  function clearSignalCollectionPolling() {
    clearCollectPolling()
    clearInternalPolling()
  }

  function activeRunId(track) {
    return track === 'internal' ? internalRunId : collectRunId
  }

  function friendlyNewsUrlError(rawError = '') {
    const text = String(rawError || '').toLowerCase()
    if (!text) return '新闻链接分析失败，请稍后重试'
    if (text.includes('too short') || text.includes('empty')) {
      return '无法从该链接提取正文（可能需要登录或由脚本动态渲染），请换一个正文可直接访问的新闻链接'
    }
    if (text.includes('unsupported content type')) {
      return '该链接不是网页文章（可能是 PDF 或其它类型），暂不支持分析'
    }
    if (text.includes('blocked') || text.includes('resolve') || text.includes('not allowed')) {
      return '该链接指向的地址不可访问或被拦截，请确认是公开可访问的新闻链接'
    }
    if (text.includes('too large')) {
      return '页面内容过大，无法分析，请更换链接'
    }
    if (text.includes('status') || text.includes('redirect') || text.includes('fetch')) {
      return '抓取新闻失败（目标站点返回错误或拒绝访问），请稍后重试或更换链接'
    }
    if (text.includes('json') || text.includes('parse')) {
      return '分析结果解析失败，请稍后重试'
    }
    return '新闻链接分析失败，请稍后重试'
  }

  function formatNewsUrlTaskMessage(summary = {}, status = 'completed') {
    if (summary.status === 'unrelated_to_tracked_risk') {
      return summary.relation_reason
        ? `该新闻与所跟踪风险无直接关联，未更新：${summary.relation_reason}`
        : '该新闻与所跟踪风险无直接关联，未更新。'
    }
    if (summary.status === 'follow_up_updated') {
      return '已更新所跟踪风险的最新进展，SWOT 已刷新。'
    }
    if (summary.status === 'no_material_impact') {
      return '未发现对该股票的实质影响。'
    }
    const riskCount = Number(summary.risk_finding_count || 0)
    const oppCount = Number(summary.opportunity_finding_count || 0)
    if (riskCount || oppCount) {
      const parts = []
      if (riskCount) parts.push(`${riskCount} 条风险`)
      if (oppCount) parts.push(`${oppCount} 条机会`)
      return `新闻分析完成，已写入 ${parts.join('、')}，SWOT 已刷新。`
    }
    if (status === 'completed_with_parse_error') {
      return '新闻分析已完成，但部分结果解析失败；已刷新可用信号。'
    }
    return '新闻分析完成，SWOT 已刷新。'
  }

  async function collectSwotSignals() {
    const symbol = currentSymbol()
    if (!symbol || signalCollecting.value) return
    clearCollectPolling()
    const runId = collectRunId
    signalCollecting.value = true
    signalCollectionMode.value = 'collect'
    signalCollectionError.value = false
    signalCollectionMessage.value = '已提交机会与风险证据搜集，等待分析任务处理…'
    try {
      const task = await collectStockWorkbenchSignals(symbol)
      if (runId !== collectRunId) return
      if (!task?.task_id) throw new Error('分析任务未返回 task_id')
      signalCollectionMessage.value = task.reused
        ? '已有该股票的搜集分析任务正在运行…'
        : '正在搜集公告、新闻等证据并分析机会与风险…'
      await pollSwotSignalTask(task.task_id, symbol, 'collect', runId)
    } catch (error) {
      if (runId !== collectRunId) return
      clearCollectPolling()
      signalCollectionError.value = true
      signalCollectionMessage.value = error?.message || '机会与风险搜集分析提交失败'
    }
  }

  async function refreshInternalSwotSignals() {
    const symbol = currentSymbol()
    if (!symbol || internalSignalRefreshing.value) return
    clearInternalPolling()
    const runId = internalRunId
    internalSignalRefreshing.value = true
    internalSignalRefreshError.value = false
    internalSignalRefreshMessage.value = '已提交优势与劣势规则评估，等待任务处理…'
    try {
      const task = await refreshStockWorkbenchInternalSignals(symbol)
      if (runId !== internalRunId) return
      if (!task?.task_id) throw new Error('分析任务未返回 task_id')
      internalSignalRefreshMessage.value = task.reused
        ? '已有该股票的优势与劣势评估任务正在运行…'
        : '正在读取财务指标并评估优势与劣势…'
      await pollSwotSignalTask(task.task_id, symbol, 'internal', runId)
    } catch (error) {
      if (runId !== internalRunId) return
      clearInternalPolling()
      internalSignalRefreshError.value = true
      internalSignalRefreshMessage.value = error?.message || '优势与劣势规则评估提交失败'
    }
  }

  async function analyzeSwotNewsUrl(payload) {
    const url = typeof payload === 'string' ? payload : payload?.url
    const findingKey = typeof payload === 'string' ? '' : (payload?.findingKey || '')
    const symbol = currentSymbol()
    if (!symbol || signalCollecting.value || !url) return
    clearCollectPolling()
    const runId = collectRunId
    signalCollecting.value = true
    signalCollectionMode.value = 'news-url'
    signalCollectionError.value = false
    signalCollectionMessage.value = findingKey
      ? '已提交后续新闻，正在核对与所跟踪风险的关联…'
      : '已提交新闻链接分析，正在抓取正文…'
    try {
      const task = await analyzeStockWorkbenchNewsUrl(symbol, { url, findingKey })
      if (runId !== collectRunId) return
      if (!task?.task_id) throw new Error('分析任务未返回 task_id')
      signalCollectionMessage.value = task.reused
        ? '已有该新闻链接分析任务正在运行…'
        : '正在抓取新闻正文并由 LLM 研判机会与风险…'
      await pollSwotSignalTask(task.task_id, symbol, 'collect', runId)
    } catch (error) {
      if (runId !== collectRunId) return
      clearCollectPolling()
      signalCollectionError.value = true
      signalCollectionMessage.value = error?.message || '新闻链接分析提交失败'
    }
  }

  async function pollSwotSignalTask(taskId, symbol, track = 'collect', runId = activeRunId(track)) {
    const isInternal = track === 'internal'
    const clearThis = isInternal ? clearInternalPolling : clearCollectPolling
    const isActiveRun = () => runId === activeRunId(track)
    try {
      const response = await getStockWorkbenchSignalTask(taskId)
      if (!isActiveRun()) return
      if (!isCurrentWorkbenchSymbol(symbol)) {
        clearThis()
        return
      }
      const status = response?.task_meta?.status || ''
      const resultStatus = response?.base_result?.summary?.status || response?.base_result?.status || ''
      const mode = signalCollectionMode.value
      if (status === 'failed') {
        clearThis()
        if (isInternal) {
          internalSignalRefreshError.value = true
          internalSignalRefreshMessage.value = response?.task_meta?.error || '优势与劣势规则评估失败'
        } else if (mode === 'news-url') {
          signalCollectionError.value = true
          signalCollectionMessage.value = friendlyNewsUrlError(response?.task_meta?.error)
        } else {
          signalCollectionError.value = true
          signalCollectionMessage.value = response?.task_meta?.error || '机会与风险搜集分析失败'
        }
        return
      }
      if (status === 'completed' || status === 'completed_with_parse_error') {
        clearThis()
        const summary = response?.base_result?.summary || {}
        if (isInternal) {
          const counts = response?.base_result?.result_counts || {}
          internalSignalRefreshMessage.value = resultStatus === 'skipped_unchanged'
            ? '内部财务证据没有变化，已保留当前优势与劣势判断。'
            : `优势与劣势评估完成：${Number(counts.strength || 0)} 条优势、${Number(counts.weakness || 0)} 条劣势。`
          internalSignalRefreshError.value = false
        } else {
          if (mode === 'news-url') {
            signalCollectionMessage.value = formatNewsUrlTaskMessage(summary, status)
          } else if (resultStatus === 'skipped_unchanged') {
            signalCollectionMessage.value = '证据没有变化，已保留当前机会与风险判断。'
          } else {
            signalCollectionMessage.value = status === 'completed_with_parse_error'
              ? '分析已完成，但部分结果解析失败；已刷新可用信号。'
              : '机会与风险分析完成，SWOT 已刷新。'
          }
          signalCollectionError.value = status === 'completed_with_parse_error'
        }
        await loadWorkbenchSection('signals', { force: true })
        return
      }
      if (isInternal) {
        internalSignalPollCount += 1
        if (internalSignalPollCount >= 90) {
          clearThis()
          internalSignalRefreshError.value = true
          internalSignalRefreshMessage.value = '规则评估任务处理时间较长，请稍后重新进入 SWOT 查看结果。'
          return
        }
        internalSignalTimer = window.setTimeout(
          () => pollSwotSignalTask(taskId, symbol, track, runId),
          2000,
        )
      } else {
        signalCollectionPollCount += 1
        if (signalCollectionPollCount >= 90) {
          clearThis()
          signalCollectionError.value = true
          signalCollectionMessage.value = '分析任务处理时间较长，请稍后重新进入 SWOT 查看结果。'
          return
        }
        signalCollectionTimer = window.setTimeout(
          () => pollSwotSignalTask(taskId, symbol, track, runId),
          2000,
        )
      }
    } catch (error) {
      if (!isActiveRun()) return
      clearThis()
      if (isInternal) {
        internalSignalRefreshError.value = true
        internalSignalRefreshMessage.value = error?.message || '优势与劣势任务查询失败'
      } else {
        signalCollectionError.value = true
        signalCollectionMessage.value = error?.message || '机会与风险分析任务查询失败'
      }
    }
  }

  if (getCurrentInstance()) {
    onBeforeUnmount(clearSignalCollectionPolling)
  }

  return {
    signalCollecting,
    signalCollectionMessage,
    signalCollectionError,
    internalSignalRefreshing,
    internalSignalRefreshMessage,
    internalSignalRefreshError,
    clearCollectPolling,
    clearInternalPolling,
    clearSignalCollectionPolling,
    friendlyNewsUrlError,
    formatNewsUrlTaskMessage,
    collectSwotSignals,
    refreshInternalSwotSignals,
    analyzeSwotNewsUrl,
    pollSwotSignalTask,
  }
}
