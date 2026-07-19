import { computed, ref } from 'vue'
import {
  enqueuePortfolioBenchRisk,
  enqueuePortfolioLlmRisk,
  getPortfolioLlmRiskRun,
  getPortfolioPlanBench,
} from '../api/portfolioPlans'
import { formatApiDetail } from './holdingsOpsShared'

export function useHoldingsBenchOps({
  benchPlanId,
  pollGenerationTask,
  onMessage,
}) {
  const benchData = ref(null)
  const benchLoading = ref(false)
  const benchRisk = ref(null)
  const benchRiskLoading = ref(false)
  const benchLlmRiskLoading = ref(false)
  const benchExpanded = ref(false)
  let benchRequestEpoch = 0
  let benchLoadingRequestEpoch = 0
  let benchRiskRequestEpoch = 0
  let benchLlmRiskRequestEpoch = 0

  const benchRiskBySymbol = computed(() => {
    const map = {}
    for (const row of benchData.value?.bench || []) {
      if (!row?.symbol || !row.ai_risk) continue
      map[row.symbol] = row.ai_risk
      const bareSymbol = String(row.symbol).split('.')[0]
      if (bareSymbol) map[bareSymbol] = row.ai_risk
    }
    for (const row of benchRisk.value?.symbols || []) {
      if (!row?.symbol) continue
      const merged = { ...(map[row.symbol] || {}), ...(row.ai_risk || {}) }
      map[row.symbol] = merged
      const bareSymbol = String(row.symbol).split('.')[0]
      if (bareSymbol) map[bareSymbol] = { ...(map[bareSymbol] || {}), ...merged }
    }
    return map
  })

  async function loadBench({
    resetRisk = true,
    silent = false,
    planId = benchPlanId.value,
    isCurrent: isExternalCurrent = () => true,
  } = {}) {
    const requestEpoch = ++benchRequestEpoch
    const loadingEpoch = silent ? null : ++benchLoadingRequestEpoch
    const isCurrent = () => (
      benchRequestEpoch === requestEpoch
      && benchPlanId.value === planId
      && isExternalCurrent()
    )
    const isCurrentLoading = () => (
      benchLoadingRequestEpoch === loadingEpoch
      && benchPlanId.value === planId
    )
    if (!planId) {
      if (
        benchRequestEpoch === requestEpoch
        && !benchPlanId.value
        && isExternalCurrent()
      ) {
        benchData.value = null
        if (!silent && isCurrentLoading()) benchLoading.value = false
      }
      return
    }
    if (!silent && isCurrent()) benchLoading.value = true
    if (resetRisk && isCurrent()) benchRisk.value = null
    try {
      const res = await getPortfolioPlanBench(planId, { bench_multiplier: 1.5 })
      if (isCurrent()) benchData.value = res.data || null
    } catch (error) {
      if (!silent && isCurrent()) {
        benchData.value = null
        onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '加载阵容失败', true)
      }
    } finally {
      if (!silent && isCurrentLoading()) benchLoading.value = false
    }
  }

  async function loadBenchRisk() {
    const planId = benchPlanId.value
    if (!planId) return
    const requestEpoch = ++benchRiskRequestEpoch
    const isCurrent = () => (
      benchRiskRequestEpoch === requestEpoch
      && benchPlanId.value === planId
    )
    benchRiskLoading.value = true
    onMessage('', false)
    try {
      const res = await enqueuePortfolioBenchRisk(planId, { bench_multiplier: 1.5 })
      if (!isCurrent()) return
      const task = await pollGenerationTask(res.data?.task_id)
      if (!task || task.cancelled || !isCurrent()) return
      benchRisk.value = task.result || {}
    } catch (error) {
      if (isCurrent()) {
        onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '替补风控加载失败', true)
      }
    } finally {
      if (isCurrent()) benchRiskLoading.value = false
    }
  }

  async function pollBenchLlmRiskRun(
    planId,
    runId,
    {
      attempts = 90,
      intervalMs = 2000,
      onProgress = null,
      isCurrent = () => true,
    } = {},
  ) {
    let lastCompleted = -1
    for (let i = 0; i < attempts; i += 1) {
      if (!isCurrent()) return { cancelled: true }
      const res = await getPortfolioLlmRiskRun(planId, runId, { target_scope: 'bench' })
      if (!isCurrent()) return { cancelled: true }
      const run = res.data || {}
      const completed = Number(run.completed || 0)
      if (completed > 0 && completed !== lastCompleted) {
        lastCompleted = completed
        if (onProgress) await onProgress(run)
      }
      if (['completed', 'completed_with_failures', 'failed'].includes(run.status)) return run
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error('AI 风险/机会分析任务处理超时，请稍后刷新查看结果')
  }

  async function loadBenchLlmRisk() {
    const planId = benchPlanId.value
    if (!planId) return
    const requestEpoch = ++benchLlmRiskRequestEpoch
    const isCurrent = () => (
      benchLlmRiskRequestEpoch === requestEpoch
      && benchPlanId.value === planId
    )
    benchLlmRiskLoading.value = true
    onMessage('', false)
    try {
      const res = await enqueuePortfolioLlmRisk(planId, {
        target_scope: 'bench',
        bench_multiplier: 1.5,
      })
      if (!isCurrent()) return
      const runId = res.data?.run_id
      if (runId) {
        const run = await pollBenchLlmRiskRun(planId, runId, {
          isCurrent,
          onProgress: async () => {
            await loadBench({
              resetRisk: false,
              silent: true,
              planId,
              isCurrent,
            })
          },
        })
        if (run.cancelled || !isCurrent()) return
        const summaryText = run.partial_summary || ''
        if (run.status === 'failed') {
          onMessage(
            `替补 AI 风险/机会分析失败：${summaryText || '所有行业任务均未完成，请稍后重试或检查 worker 日志'}`,
            true,
          )
          return
        }
        onMessage(
          run.status === 'completed_with_failures'
            ? `替补 AI 风险/机会分析部分完成：${summaryText || '部分行业任务失败，已刷新可用结果'}`
            : '替补 AI 风险/机会分析已完成，候选事件风险已刷新。',
          run.status === 'completed_with_failures',
        )
      } else if (isCurrent()) {
        onMessage('替补 AI 风险/机会分析已提交，但未返回 run_id；请稍后刷新查看任务状态。', true)
      }
      if (isCurrent()) {
        await loadBench({
          resetRisk: false,
          planId,
          isCurrent,
        })
      }
    } catch (error) {
      if (isCurrent()) {
        onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '替补 AI 风险/机会分析加载失败', true)
      }
    } finally {
      if (isCurrent()) benchLlmRiskLoading.value = false
    }
  }

  function resetBenchOpsState() {
    benchRequestEpoch += 1
    benchLoadingRequestEpoch += 1
    benchRiskRequestEpoch += 1
    benchLlmRiskRequestEpoch += 1
    benchLoading.value = false
    benchRiskLoading.value = false
    benchLlmRiskLoading.value = false
    benchData.value = null
    benchRisk.value = null
  }

  return {
    benchData,
    benchLoading,
    benchRisk,
    benchRiskLoading,
    benchLlmRiskLoading,
    benchExpanded,
    benchRiskBySymbol,
    loadBench,
    loadBenchRisk,
    loadBenchLlmRisk,
    resetBenchOpsState,
  }
}
