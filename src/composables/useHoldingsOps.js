import { computed, ref } from 'vue'
import {
  enqueuePortfolioBenchRisk,
  enqueuePortfolioHoldingsRisk,
  enqueuePortfolioLlmRisk,
  getPortfolioLlmRiskRun,
  getPortfolioPlanBench,
  liveRebalancePortfolio,
  paperRebalancePortfolio,
  reconcilePortfolioHoldings,
  recordExternalManualRecord,
} from '../api/portfolioPlans'
import { aiRiskTitle, riskDisplaySeverity } from './usePortfolioPlanFormat'

function formatApiDetail(detail) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

function buildTargetsFromRows(rows) {
  const targets = {}
  for (const row of rows) targets[row.symbol] = Number(row.target)
  return targets
}

function roundToLot(shares, lotSize = 100) {
  const lot = Math.max(1, Number(lotSize) || 100)
  const raw = Math.max(0, Math.floor(Number(shares) || 0))
  if (raw === 0) return 0
  return Math.floor(raw / lot) * lot
}

function compactDateTimeForBatch(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

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
  const holdingsRisk = ref(null)
  const manualTargets = ref({})
  const excludeAfter = ref(false)
  const showManualModal = ref(false)
  const manualSubmitting = ref(false)
  const riskLoading = ref(false)
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

  const benchData = ref(null)
  const benchLoading = ref(false)
  const benchRisk = ref(null)
  const benchRiskLoading = ref(false)
  const benchLlmRiskLoading = ref(false)
  const benchExpanded = ref(false)
  const reconcileData = ref(null)

  const showSwapModal = ref(false)
  const swapStarter = ref(null)
  const swapError = ref('')
  const showFastActionModal = ref(false)
  const fastActionSubmitting = ref(false)
  const fastActionPreview = ref({ title: '', description: '', targets: {}, items: [], blocked: false })

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
          openBuyDateBySymbol.value[row.symbol] ||
          openBuyDateBySymbol.value[String(row.symbol || '').split('.')[0]] ||
          row.buy_date ||
          '',
      }))
      .sort((a, b) => Number(b.market_value || 0) - Number(a.market_value || 0))
  ))

  const holdingsRiskBySymbol = computed(() => {
    const map = {}
    for (const row of holdingsRisk.value?.holdings || []) {
      if (row?.symbol) map[row.symbol] = row.ai_risk || {}
    }
    return map
  })

  const holdingsRiskBySymbolHigh = computed(() => (
    (holdingsRisk.value?.holdings || []).filter((row) => row?.ai_risk?.severity === 'high')
  ))

  const benchRiskBySymbol = computed(() => {
    const map = {}
    for (const row of benchData.value?.bench || []) {
      if (row?.symbol && row.ai_risk) map[row.symbol] = row.ai_risk
    }
    for (const row of benchRisk.value?.symbols || []) {
      if (row?.symbol) map[row.symbol] = { ...(map[row.symbol] || {}), ...(row.ai_risk || {}) }
    }
    return map
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

  const holdingsOutOfSync = computed(() => (
    Boolean(reconcileData.value?.applicable) && reconcileData.value?.in_sync === false
  ))

  function syncManualTargets() {
    manualTargets.value = {}
  }

  function manualDelta(row) {
    return effectiveTarget(row.symbol) - Number(row.shares || 0)
  }

  function riskRowClass(symbol) {
    const severity = holdingsRiskBySymbol.value[symbol]?.severity
    return severity === 'high' ? 'risk-row-high' : ''
  }

  function formatRiskTime(value) {
    if (!value) return ''
    const text = String(value)
    return text.length >= 19 ? text.slice(0, 19).replace('T', ' ') : text
  }

  function openManualModal() {
    if (!manualChangeRows.value.length) return
    showManualModal.value = true
  }

  async function loadHoldingsRisk(force = false) {
    const planId = selectedLatestPlanId.value
    if (!planId) return
    if (!force && holdingsRisk.value) return
    riskLoading.value = true
    try {
      const res = await enqueuePortfolioHoldingsRisk(planId)
      const meta = res.data || {}
      const task = await pollGenerationTask(meta.task_id)
      holdingsRisk.value = {
        ...(task.result || {}),
        paused: meta.paused,
        excluded_symbols: meta.excluded_symbols || [],
        anchor_plan_id: meta.anchor_plan_id,
      }
    } catch (error) {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '持仓风控加载失败', true)
    } finally {
      riskLoading.value = false
    }
  }

  async function submitManualRebalance() {
    const planId = selectedLatestPlanId.value
    if (!planId || !manualChangeRows.value.length) return
    await submitRebalance(buildTargetsFromRows(manualChangeRows.value), { excludeAfter: excludeAfter.value })
    excludeAfter.value = false
  }

  function estimateSwapBenchShares(starter, benchPlayer) {
    const lot = Number(benchData.value?.lot_size || 100)
    const aPrice = Number(starter?.estimated_price || 0)
    const bPrice = Number(benchPlayer?.latest_close || 0)
    const aShares = Number(starter?.target_shares || starter?.current_shares || 0)
    if (!aPrice || !bPrice || !aShares) return 0
    const amount = aShares * aPrice
    return roundToLot(amount / bPrice, lot)
  }

  function halfTargetShares(row) {
    const lot = Number(benchData.value?.lot_size || 100)
    const current = Number(row?.shares || 0)
    return roundToLot(current / 2, lot)
  }

  function openSwapModal(starter) {
    swapStarter.value = {
      ...starter,
      current_shares: starter?.current_shares ?? starter?.shares ?? 0,
      target_shares: effectiveTarget(starter?.symbol),
      estimated_price: starter?.estimated_price ?? starter?.last_price ?? starter?.price ?? 0,
    }
    swapError.value = ''
    showSwapModal.value = true
  }

  function openQuickReduceModal(row, targetShares) {
    const targets = { [row.symbol]: Math.max(0, Number(targetShares) || 0) }
    previewFastAction({
      title: targetShares === 0 ? '确认快思考清仓' : '确认快思考减仓',
      description: `${row.symbol} ${row.name || ''}：${row.shares} → ${targets[row.symbol]}（预览确认后立即下单）`,
      targets,
    })
  }

  async function previewSwap(benchPlayer) {
    const starter = swapStarter.value
    if (!starter || !benchPlayer) return
    swapError.value = ''
    const benchRiskInfo = benchRiskBySymbol.value[benchPlayer.symbol]
    if (riskDisplaySeverity(benchRiskInfo) === 'high') {
      const reasons = aiRiskTitle(benchRiskInfo) || '高风险信号'
      const proceed = window.confirm(
        `AI 风控提示：替补 ${benchPlayer.symbol}（${benchPlayer.name || '-'}）为高风险——${reasons}。仍要换上吗？`
      )
      if (!proceed) return
    }
    const aPrice = Number(starter?.estimated_price || 0)
    const bPrice = Number(benchPlayer?.latest_close || 0)
    const aShares = Number(starter?.target_shares || starter?.current_shares || 0)
    if (!aPrice || !aShares) {
      swapError.value = `无法估算：首发 ${starter.symbol} 缺少目标股数或参考价。`
      return
    }
    if (!bPrice) {
      swapError.value = `无法估算：替补 ${benchPlayer.symbol} 暂无参考价（行情未同步）。`
      return
    }
    const benchShares = estimateSwapBenchShares(starter, benchPlayer)
    if (!benchShares) {
      swapError.value = `按 ${starter.symbol} 仓位金额估算 ${benchPlayer.symbol} 不足 1 手，无法换股。`
      return
    }
    const targets = {
      [starter.symbol]: 0,
      [benchPlayer.symbol]: benchShares,
    }
    const ok = await previewFastAction({
      title: '确认替补换股',
      description: `换下 ${starter.symbol}，换上 ${benchPlayer.symbol}（约 ${benchShares} 股）；仅本次生效。`,
      targets,
    })
    if (ok) showSwapModal.value = false
    else swapError.value = getMessage() || '预览失败，请重试。'
  }

  function normalizeFastPreviewItems(data) {
    return (data?.items || []).map((item) => ({
      symbol: item.symbol,
      name: item.name || '',
      current_shares: Number(item.current_shares || 0),
      target_shares: Number(item.target_shares || 0),
      delta_shares: Number(item.delta_shares || 0),
      blockers: item.blockers || [],
    }))
  }

  async function previewFastAction({ title, description, targets }) {
    fastActionSubmitting.value = true
    onMessage('', false)
    try {
      const data = await submitRebalance(targets, { excludeAfter: false, dryRun: true })
      fastActionPreview.value = {
        title,
        description,
        targets,
        items: normalizeFastPreviewItems(data),
        blocked: Boolean(data?.blocked),
      }
      showFastActionModal.value = true
      return true
    } catch (error) {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '预览失败', true)
      return false
    } finally {
      fastActionSubmitting.value = false
    }
  }

  async function confirmFastAction() {
    const targets = fastActionPreview.value.targets || {}
    if (!Object.keys(targets).length) return
    fastActionSubmitting.value = true
    try {
      await submitRebalance(targets, { excludeAfter: false, dryRun: false })
      showFastActionModal.value = false
      fastActionPreview.value = { title: '', description: '', targets: {}, items: [], blocked: false }
    } finally {
      fastActionSubmitting.value = false
    }
  }

  async function loadBench({ resetRisk = true } = {}) {
    const planId = benchPlanId.value
    if (!planId) {
      benchData.value = null
      return
    }
    benchLoading.value = true
    if (resetRisk) benchRisk.value = null
    try {
      const res = await getPortfolioPlanBench(planId, { bench_multiplier: 1.5 })
      benchData.value = res.data || null
    } catch (error) {
      benchData.value = null
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '加载阵容失败', true)
    } finally {
      benchLoading.value = false
    }
  }

  async function loadBenchRisk() {
    const planId = benchPlanId.value
    if (!planId) return
    benchRiskLoading.value = true
    onMessage('', false)
    try {
      const res = await enqueuePortfolioBenchRisk(planId, { bench_multiplier: 1.5 })
      const task = await pollGenerationTask(res.data?.task_id)
      benchRisk.value = task.result || {}
    } catch (error) {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '替补风控加载失败', true)
    } finally {
      benchRiskLoading.value = false
    }
  }

  async function pollBenchLlmRiskRun(planId, runId, { attempts = 90, intervalMs = 2000 } = {}) {
    for (let i = 0; i < attempts; i += 1) {
      const res = await getPortfolioLlmRiskRun(planId, runId, { target_scope: 'bench' })
      const run = res.data || {}
      if (['completed', 'completed_with_failures', 'failed'].includes(run.status)) return run
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error('LLM 风控任务处理超时，请稍后刷新查看结果')
  }

  async function loadBenchLlmRisk() {
    const planId = benchPlanId.value
    if (!planId) return
    benchLlmRiskLoading.value = true
    onMessage('', false)
    try {
      const res = await enqueuePortfolioLlmRisk(planId, {
        target_scope: 'bench',
        bench_multiplier: 1.5,
      })
      const runId = res.data?.run_id
      if (runId) {
        const run = await pollBenchLlmRiskRun(planId, runId)
        if (run.status === 'failed') throw new Error('替补 LLM 风控任务失败')
        onMessage(
          run.status === 'completed_with_failures'
            ? `替补 LLM 风控部分完成：${run.partial_summary || ''}`
            : '替补 LLM 风控已完成，候选事件风险已刷新。',
          run.status === 'completed_with_failures',
        )
      }
      await loadBench({ resetRisk: false })
    } catch (error) {
      onMessage(formatApiDetail(error.response?.data?.detail) || error.message || '替补 LLM 风控加载失败', true)
    } finally {
      benchLlmRiskLoading.value = false
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

  async function submitRebalance(targets, { excludeAfter: shouldExcludeAfter = false, dryRun = false } = {}) {
    if (isLivePortfolio.value) {
      return submitLiveRebalance(targets, { excludeAfter: shouldExcludeAfter, dryRun })
    }
    return submitPaperRebalance(targets, { excludeAfter: shouldExcludeAfter, dryRun })
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
      await onRefresh()
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

  function resetHoldingsOpsState() {
    holdingsRisk.value = null
    manualTargets.value = {}
    showLiquidateModal.value = false
    liquidateTargets.value = []
    showExternalManualModal.value = false
    externalManualRows.value = []
    showSwapModal.value = false
    showFastActionModal.value = false
    benchData.value = null
    benchRisk.value = null
    reconcileData.value = null
  }

  return {
    holdingsRisk,
    excludeAfter,
    showManualModal,
    manualSubmitting,
    riskLoading,
    showLiquidateModal,
    liquidateSubmitting,
    liquidateExcludeAfter,
    liquidateTargets,
    showExternalManualModal,
    externalManualSubmitting,
    externalManualRows,
    externalManualExcludeAfter,
    externalManualPauseLineage,
    benchData,
    benchLoading,
    benchRisk,
    benchRiskLoading,
    benchLlmRiskLoading,
    benchExpanded,
    reconcileData,
    showSwapModal,
    swapStarter,
    swapError,
    showFastActionModal,
    fastActionSubmitting,
    fastActionPreview,
    latestHoldingRows,
    holdingsRiskBySymbol,
    holdingsRiskBySymbolHigh,
    benchRiskBySymbol,
    holdingNameBySymbol,
    holdingSharesBySymbol,
    manualChangeRows,
    willPauseAfterManual,
    externalManualReady,
    holdingsOutOfSync,
    syncManualTargets,
    manualDelta,
    riskRowClass,
    formatRiskTime,
    openManualModal,
    loadHoldingsRisk,
    submitManualRebalance,
    halfTargetShares,
    openSwapModal,
    openQuickReduceModal,
    previewSwap,
    confirmFastAction,
    loadBench,
    loadBenchRisk,
    loadBenchLlmRisk,
    loadReconcile,
    openLiquidateModal,
    submitLiveLiquidate,
    openExternalManualModal,
    addExternalManualRow,
    removeExternalManualRow,
    updateExternalManualRow,
    submitExternalManual,
    effectiveTarget,
    setManualTarget,
    resetHoldingsOpsState,
  }
}
