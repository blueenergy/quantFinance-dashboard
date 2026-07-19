import { computed, ref } from 'vue'
import {
  enqueuePortfolioHoldingsRisk,
  reconcilePortfolioHoldings,
} from '../api/portfolioPlans'
import { formatApiDetail } from './holdingsOpsShared'

export function useHoldingsRiskOps({
  selectedLatestPlanId,
  isLivePortfolio,
  pollGenerationTask,
  onMessage,
}) {
  const holdingsRisk = ref(null)
  const riskLoading = ref(false)
  const reconcileData = ref(null)
  let holdingsRiskRequestEpoch = 0

  const holdingsRiskBySymbol = computed(() => {
    const map = {}
    for (const row of holdingsRisk.value?.holdings || []) {
      if (!row?.symbol) continue
      map[row.symbol] = row.ai_risk || {}
      const bareSymbol = String(row.symbol).split('.')[0]
      if (bareSymbol) map[bareSymbol] = row.ai_risk || {}
    }
    return map
  })

  const holdingsRiskBySymbolHigh = computed(() => (
    (holdingsRisk.value?.holdings || []).filter((row) => row?.ai_risk?.severity === 'high')
  ))

  const holdingsOutOfSync = computed(() => (
    Boolean(reconcileData.value?.applicable) && reconcileData.value?.in_sync === false
  ))

  function riskRowClass(symbol) {
    const severity = holdingsRiskBySymbol.value[symbol]?.severity
    return severity === 'high' ? 'risk-row-high' : ''
  }

  function formatRiskTime(value) {
    if (!value) return ''
    const text = String(value)
    return text.length >= 19 ? text.slice(0, 19).replace('T', ' ') : text
  }

  async function loadHoldingsRisk(force = false) {
    const planId = selectedLatestPlanId.value
    if (!planId) return
    if (!force && holdingsRisk.value) return
    const requestEpoch = ++holdingsRiskRequestEpoch
    const isCurrent = () => (
      holdingsRiskRequestEpoch === requestEpoch
      && selectedLatestPlanId.value === planId
    )
    riskLoading.value = true
    try {
      const res = await enqueuePortfolioHoldingsRisk(planId)
      if (!isCurrent()) return
      const meta = res.data || {}
      const task = await pollGenerationTask(meta.task_id)
      if (!task || task.cancelled || !isCurrent()) return
      holdingsRisk.value = {
        ...(task.result || {}),
        paused: meta.paused,
        excluded_symbols: meta.excluded_symbols || [],
        anchor_plan_id: meta.anchor_plan_id,
      }
    } catch (error) {
      if (isCurrent()) {
        onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '持仓风控加载失败', true)
      }
    } finally {
      if (isCurrent()) riskLoading.value = false
    }
  }

  async function loadReconcile() {
    reconcileData.value = null
    if (!isLivePortfolio.value) return
    const planId = selectedLatestPlanId.value
    if (!planId) return
    try {
      const res = await reconcilePortfolioHoldings(planId)
      reconcileData.value = res.data || null
    } catch {
      reconcileData.value = null
    }
  }

  function resetRiskOpsState() {
    holdingsRiskRequestEpoch += 1
    holdingsRisk.value = null
    riskLoading.value = false
    reconcileData.value = null
  }

  return {
    holdingsRisk,
    riskLoading,
    reconcileData,
    holdingsRiskBySymbol,
    holdingsRiskBySymbolHigh,
    holdingsOutOfSync,
    riskRowClass,
    formatRiskTime,
    loadHoldingsRisk,
    loadReconcile,
    resetRiskOpsState,
  }
}
