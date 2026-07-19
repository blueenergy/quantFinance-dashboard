import { computed } from 'vue'
import { useHoldingsBenchOps } from './useHoldingsBenchOps'
import { useHoldingsFastActions } from './useHoldingsFastActions'
import { useHoldingsManualOps } from './useHoldingsManualOps'
import { useHoldingsRiskOps } from './useHoldingsRiskOps'

export function useHoldingsOps({
  selectedPortfolio,
  selectedLatestPlanId,
  benchPlanId,
  isLivePortfolio,
  positionRows,
  tradeRows,
  pollGenerationTask,
  onRefresh,
  onMessage,
  getMessage = () => '',
}) {
  const openBuyDateBySymbol = computed(() => {
    const map = {}
    for (const t of tradeRows.value) {
      if (t.status !== 'open' || !t.buy_date) continue
      const keys = [t.symbol, String(t.symbol || '').split('.')[0]]
      for (const key of keys) {
        if (!key) continue
        if (!map[key] || t.buy_date < map[key]) map[key] = t.buy_date
      }
    }
    return map
  })

  const latestHoldingRows = computed(() => (
    positionRows.value
      .filter((row) => Number(row.shares) > 0)
      .map((row) => ({
        ...row,
        buy_date:
          openBuyDateBySymbol.value[row.symbol]
          || openBuyDateBySymbol.value[String(row.symbol || '').split('.')[0]]
          || row.buy_date
          || '',
      }))
      .sort((a, b) => Number(b.market_value || 0) - Number(a.market_value || 0))
  ))

  const riskOps = useHoldingsRiskOps({
    selectedLatestPlanId,
    isLivePortfolio,
    pollGenerationTask,
    onMessage,
  })

  const manualOps = useHoldingsManualOps({
    selectedPortfolio,
    selectedLatestPlanId,
    isLivePortfolio,
    latestHoldingRows,
    holdingsRiskBySymbol: riskOps.holdingsRiskBySymbol,
    onRefresh,
    onMessage,
  })

  const benchOps = useHoldingsBenchOps({
    benchPlanId,
    pollGenerationTask,
    onMessage,
  })

  const fastActions = useHoldingsFastActions({
    benchData: benchOps.benchData,
    benchRiskBySymbol: benchOps.benchRiskBySymbol,
    effectiveTarget: manualOps.effectiveTarget,
    submitRebalance: manualOps.submitRebalance,
    onMessage,
    getMessage,
  })

  const holdingNameBySymbol = computed(() => {
    const map = {}
    for (const row of latestHoldingRows.value) map[row.symbol] = row.name || ''
    return map
  })

  const holdingSharesBySymbol = computed(() => {
    const map = {}
    for (const row of latestHoldingRows.value) map[row.symbol] = Number(row.shares || 0)
    return map
  })

  function resetHoldingsOpsState() {
    riskOps.resetRiskOpsState()
    manualOps.resetManualOpsState()
    benchOps.resetBenchOpsState()
    fastActions.resetFastActionsState()
  }

  return {
    holdingsRisk: riskOps.holdingsRisk,
    excludeAfter: manualOps.excludeAfter,
    showManualModal: manualOps.showManualModal,
    manualSubmitting: manualOps.manualSubmitting,
    riskLoading: riskOps.riskLoading,
    showLiquidateModal: manualOps.showLiquidateModal,
    liquidateSubmitting: manualOps.liquidateSubmitting,
    liquidateExcludeAfter: manualOps.liquidateExcludeAfter,
    liquidateTargets: manualOps.liquidateTargets,
    showExternalManualModal: manualOps.showExternalManualModal,
    externalManualSubmitting: manualOps.externalManualSubmitting,
    externalManualRows: manualOps.externalManualRows,
    externalManualExcludeAfter: manualOps.externalManualExcludeAfter,
    externalManualPauseLineage: manualOps.externalManualPauseLineage,
    benchData: benchOps.benchData,
    benchLoading: benchOps.benchLoading,
    benchRisk: benchOps.benchRisk,
    benchRiskLoading: benchOps.benchRiskLoading,
    benchLlmRiskLoading: benchOps.benchLlmRiskLoading,
    benchExpanded: benchOps.benchExpanded,
    reconcileData: riskOps.reconcileData,
    showSwapModal: fastActions.showSwapModal,
    swapStarter: fastActions.swapStarter,
    swapError: fastActions.swapError,
    showFastActionModal: fastActions.showFastActionModal,
    fastActionSubmitting: fastActions.fastActionSubmitting,
    fastActionPreview: fastActions.fastActionPreview,
    latestHoldingRows,
    holdingsRiskBySymbol: riskOps.holdingsRiskBySymbol,
    holdingsRiskBySymbolHigh: riskOps.holdingsRiskBySymbolHigh,
    benchRiskBySymbol: benchOps.benchRiskBySymbol,
    holdingNameBySymbol,
    holdingSharesBySymbol,
    manualChangeRows: manualOps.manualChangeRows,
    willPauseAfterManual: manualOps.willPauseAfterManual,
    externalManualReady: manualOps.externalManualReady,
    holdingsOutOfSync: riskOps.holdingsOutOfSync,
    syncManualTargets: manualOps.syncManualTargets,
    manualDelta: manualOps.manualDelta,
    riskRowClass: riskOps.riskRowClass,
    formatRiskTime: riskOps.formatRiskTime,
    openManualModal: manualOps.openManualModal,
    loadHoldingsRisk: riskOps.loadHoldingsRisk,
    submitManualRebalance: manualOps.submitManualRebalance,
    halfTargetShares: fastActions.halfTargetShares,
    openSwapModal: fastActions.openSwapModal,
    openQuickReduceModal: fastActions.openQuickReduceModal,
    previewSwap: fastActions.previewSwap,
    confirmFastAction: fastActions.confirmFastAction,
    loadBench: benchOps.loadBench,
    loadBenchRisk: benchOps.loadBenchRisk,
    loadBenchLlmRisk: benchOps.loadBenchLlmRisk,
    loadReconcile: riskOps.loadReconcile,
    openLiquidateModal: manualOps.openLiquidateModal,
    submitLiveLiquidate: manualOps.submitLiveLiquidate,
    openExternalManualModal: manualOps.openExternalManualModal,
    addExternalManualRow: manualOps.addExternalManualRow,
    removeExternalManualRow: manualOps.removeExternalManualRow,
    updateExternalManualRow: manualOps.updateExternalManualRow,
    submitExternalManual: manualOps.submitExternalManual,
    effectiveTarget: manualOps.effectiveTarget,
    setManualTarget: manualOps.setManualTarget,
    resetHoldingsOpsState,
  }
}
