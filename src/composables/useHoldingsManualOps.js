import { computed, ref } from 'vue'
import {
  liveRebalancePortfolio,
  paperRebalancePortfolio,
  recordExternalManualRecord,
} from '../api/portfolioPlans'
import {
  buildTargetsFromRows,
  compactDateTimeForBatch,
  formatApiDetail,
} from './holdingsOpsShared'

export function useHoldingsManualOps({
  selectedPortfolio,
  selectedLatestPlanId,
  isLivePortfolio,
  latestHoldingRows,
  holdingsRiskBySymbol,
  onRefresh,
  onMessage,
}) {
  const manualTargets = ref({})
  const excludeAfter = ref(false)
  const showManualModal = ref(false)
  const manualSubmitting = ref(false)
  const showLiquidateModal = ref(false)
  const liquidateSubmitting = ref(false)
  const liquidateExcludeAfter = ref(true)
  const liquidateTargets = ref([])
  const showExternalManualModal = ref(false)
  const externalManualSubmitting = ref(false)
  const externalManualRows = ref([])
  const externalManualExcludeAfter = ref(true)
  const externalManualPauseLineage = ref(true)
  const externalManualReason = ref('miniQMT manual operation')
  const externalManualBatchId = ref('')
  let externalManualRowSeq = 0

  function defaultTarget(symbol) {
    const current = Number(latestHoldingRows.value.find((h) => h.symbol === symbol)?.shares || 0)
    if (holdingsRiskBySymbol.value[symbol]?.severity === 'high') return 0
    return current
  }

  function effectiveTarget(symbol) {
    const override = manualTargets.value[symbol]
    if (override == null || override === '') return defaultTarget(symbol)
    return Number(override)
  }

  function setManualTarget(symbol, value) {
    const next = { ...manualTargets.value }
    next[symbol] = value === '' || value == null ? null : Number(value)
    manualTargets.value = next
  }

  const manualChangeRows = computed(() => (
    latestHoldingRows.value
      .map((row) => {
        const current = Number(row.shares || 0)
        const target = effectiveTarget(row.symbol)
        return { ...row, target, delta: target - current }
      })
      .filter((row) => row.delta !== 0)
  ))

  const willPauseAfterManual = computed(() => {
    if (!latestHoldingRows.value.length) return false
    return latestHoldingRows.value.every((row) => effectiveTarget(row.symbol) === 0)
  })

  const externalManualReady = computed(() => (
    isLivePortfolio.value
      && externalManualRows.value.length > 0
      && externalManualRows.value.every((row) => (
        String(row.symbol || '').trim().length > 0
        && Number(row.filled_size) > 0
        && Number(row.filled_price) > 0
      ))
  ))

  function syncManualTargets() {
    manualTargets.value = {}
  }

  function manualDelta(row) {
    return effectiveTarget(row.symbol) - Number(row.shares || 0)
  }

  function openManualModal() {
    if (!manualChangeRows.value.length) return
    showManualModal.value = true
  }

  async function submitManualRebalance() {
    const planId = selectedLatestPlanId.value
    if (!planId || !manualChangeRows.value.length) return
    await submitRebalance(buildTargetsFromRows(manualChangeRows.value), { excludeAfter: excludeAfter.value })
    excludeAfter.value = false
  }

  async function submitRebalance(targets, { excludeAfter: shouldExcludeAfter = false, dryRun = false } = {}) {
    if (isLivePortfolio.value) {
      return submitLiveRebalance(targets, { excludeAfter: shouldExcludeAfter, dryRun })
    }
    return submitPaperRebalance(targets, { excludeAfter: shouldExcludeAfter, dryRun })
  }

  function refreshPortfolioInBackground() {
    void Promise.resolve(onRefresh()).catch((error) => {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '刷新组合详情失败，请手动刷新。', true)
    })
  }

  async function submitPaperRebalance(targets, { excludeAfter: shouldExcludeAfter = false, dryRun = false } = {}) {
    const planId = selectedLatestPlanId.value
    if (!planId || !Object.keys(targets || {}).length) return null
    if (!dryRun) {
      manualSubmitting.value = true
      liquidateSubmitting.value = true
    }
    onMessage('', false)
    try {
      const res = await paperRebalancePortfolio(planId, {
        targets,
        exclude_after: shouldExcludeAfter,
        dry_run: dryRun,
      })
      const data = res.data || {}
      if (dryRun) return data
      showManualModal.value = false
      showLiquidateModal.value = false
      const count = data.changed_symbols?.length || 0
      const label = data.manual_action === 'liquidate' ? '纸面清仓' : '纸面调仓'
      onMessage(`已完成${label}：${count} 只标的按实时价即时成交（${data.status === 'partially_executed' ? '部分成交' : '全部成交'}）。`, data.status === 'partially_executed')
      await onRefresh()
      return data
    } catch (error) {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '纸面调仓提交失败', true)
      throw error
    } finally {
      if (!dryRun) {
        manualSubmitting.value = false
        liquidateSubmitting.value = false
      }
    }
  }

  async function submitLiveRebalance(targets, { excludeAfter: shouldExcludeAfter = false, dryRun = false } = {}) {
    const planId = selectedLatestPlanId.value
    const accountId = selectedPortfolio.value?.securities_account_id
    if (!planId || !Object.keys(targets || {}).length) return null
    if (!accountId) {
      onMessage('该组合未绑定券商账户，无法实盘下单。', true)
      showManualModal.value = false
      showLiquidateModal.value = false
      return null
    }
    if (!dryRun) {
      manualSubmitting.value = true
      liquidateSubmitting.value = true
    }
    onMessage('', false)
    try {
      const res = await liveRebalancePortfolio(planId, {
        securities_account_id: accountId,
        targets,
        exclude_after: shouldExcludeAfter,
        dry_run: dryRun,
      })
      const data = res.data || {}
      if (dryRun) return data
      showManualModal.value = false
      showLiquidateModal.value = false
      const count = data.changed_symbols?.length || 0
      const inserted = data.inserted_count ?? (data.new_signals?.length || 0)
      const label = data.manual_action === 'liquidate' ? '实盘清仓' : '实盘调仓'
      onMessage(`已提交${label}：${count} 只标的、${inserted} 笔委托已下发，交易器盘中执行。`, false)
      refreshPortfolioInBackground()
      return data
    } catch (error) {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '实盘下单提交失败', true)
      throw error
    } finally {
      if (!dryRun) {
        manualSubmitting.value = false
        liquidateSubmitting.value = false
      }
    }
  }

  function openLiquidateModal() {
    const zeroed = latestHoldingRows.value
      .filter((row) => Number(row.shares || 0) > 0 && effectiveTarget(row.symbol) === 0)
      .map((row) => row.symbol)
    const fallbackAll = latestHoldingRows.value
      .filter((row) => Number(row.shares || 0) > 0)
      .map((row) => row.symbol)
    liquidateTargets.value = zeroed.length ? zeroed : fallbackAll
    liquidateExcludeAfter.value = true
    showLiquidateModal.value = true
  }

  async function submitLiveLiquidate() {
    if (!liquidateTargets.value.length) return
    const targets = {}
    for (const symbol of liquidateTargets.value) targets[symbol] = 0
    await submitRebalance(targets, { excludeAfter: liquidateExcludeAfter.value })
  }

  function openExternalManualModal() {
    if (!isLivePortfolio.value) return
    const now = new Date()
    externalManualRowSeq = 0
    externalManualRows.value = latestHoldingRows.value.map((row) => ({
      key: `row-${externalManualRowSeq += 1}`,
      symbol: row.symbol,
      name: row.name || '',
      action: 'sell',
      filled_size: Number(row.shares || 0),
      filled_price: Number(row.last_price || row.avg_cost || 0),
      editableSymbol: false,
    }))
    externalManualExcludeAfter.value = false
    externalManualPauseLineage.value = false
    externalManualReason.value = 'miniQMT manual operation'
    externalManualBatchId.value = `miniqmt-manual-${compactDateTimeForBatch(now)}`
    showExternalManualModal.value = true
  }

  function addExternalManualRow() {
    externalManualRows.value = [
      ...externalManualRows.value,
      {
        key: `row-${externalManualRowSeq += 1}`,
        symbol: '',
        name: '',
        action: 'buy',
        filled_size: 100,
        filled_price: 0,
        editableSymbol: true,
      },
    ]
  }

  function removeExternalManualRow(index) {
    externalManualRows.value = externalManualRows.value.filter((_, idx) => idx !== index)
  }

  function updateExternalManualRow(index, field, value) {
    const rows = externalManualRows.value.map((row) => ({ ...row }))
    if (!rows[index]) return
    if (['filled_size', 'filled_price'].includes(field)) {
      rows[index][field] = value === '' ? '' : Number(value)
    } else if (field === 'symbol') {
      rows[index][field] = String(value || '').trim().toUpperCase()
    } else {
      rows[index][field] = value
    }
    externalManualRows.value = rows
  }

  function externalFillPayload(row) {
    return {
      symbol: String(row.symbol || '').trim(),
      action: row.action === 'buy' ? 'buy' : 'sell',
      filled_size: Number(row.filled_size),
      filled_price: Number(row.filled_price),
      commission: 0,
      name: row.name || '',
    }
  }

  async function submitExternalManual() {
    const planId = selectedLatestPlanId.value
    const accountId = selectedPortfolio.value?.securities_account_id
    if (!planId || !accountId || !externalManualReady.value) return
    externalManualSubmitting.value = true
    onMessage('', false)
    try {
      const res = await recordExternalManualRecord(planId, {
        securities_account_id: accountId,
        external_batch_id: externalManualBatchId.value || undefined,
        reason: externalManualReason.value || 'miniQMT manual operation',
        pause_lineage: externalManualPauseLineage.value,
        exclude_after: externalManualExcludeAfter.value,
        fills: externalManualRows.value.map(externalFillPayload),
      })
      const data = res.data || {}
      showExternalManualModal.value = false
      if (data.already_recorded) {
        onMessage(`该批次已补录过：${data.external_batch_id || externalManualBatchId.value}`, false)
      } else {
        const count = data.inserted_execution_count || externalManualRows.value.length
        onMessage(
          data.is_liquidation
            ? `已补录 miniQMT 手工操作：${count} 笔，组合账本已校准为空仓。`
            : `已补录 miniQMT 手工操作：${count} 笔，组合实盘账本已更新。`,
          false,
        )
      }
      await onRefresh()
    } catch (error) {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '补录手工操作失败', true)
    } finally {
      externalManualSubmitting.value = false
    }
  }

  function resetManualOpsState() {
    manualTargets.value = {}
    showManualModal.value = false
    manualSubmitting.value = false
    showLiquidateModal.value = false
    liquidateSubmitting.value = false
    liquidateTargets.value = []
    showExternalManualModal.value = false
    externalManualSubmitting.value = false
    externalManualRows.value = []
  }

  return {
    excludeAfter,
    showManualModal,
    manualSubmitting,
    showLiquidateModal,
    liquidateSubmitting,
    liquidateExcludeAfter,
    liquidateTargets,
    showExternalManualModal,
    externalManualSubmitting,
    externalManualRows,
    externalManualExcludeAfter,
    externalManualPauseLineage,
    manualChangeRows,
    willPauseAfterManual,
    externalManualReady,
    syncManualTargets,
    manualDelta,
    openManualModal,
    submitManualRebalance,
    openLiquidateModal,
    submitLiveLiquidate,
    openExternalManualModal,
    addExternalManualRow,
    removeExternalManualRow,
    updateExternalManualRow,
    submitExternalManual,
    effectiveTarget,
    setManualTarget,
    submitRebalance,
    resetManualOpsState,
  }
}
