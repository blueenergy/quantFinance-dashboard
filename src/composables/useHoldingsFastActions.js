import { ref } from 'vue'
import { aiRiskTitle, riskDisplaySeverity } from './usePortfolioPlanFormat'
import { formatApiDetail, roundToLot } from './holdingsOpsShared'

const emptyFastActionPreview = () => ({
  title: '',
  description: '',
  targets: {},
  items: [],
  blocked: false,
})

export function useHoldingsFastActions({
  benchData,
  benchRiskBySymbol,
  effectiveTarget,
  submitRebalance,
  onMessage,
  getMessage,
}) {
  const showSwapModal = ref(false)
  const swapStarter = ref(null)
  const swapError = ref('')
  const showFastActionModal = ref(false)
  const fastActionSubmitting = ref(false)
  const fastActionPreview = ref(emptyFastActionPreview())

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
        `规则风控提示：替补 ${benchPlayer.symbol}（${benchPlayer.name || '-'}）为高风险——${reasons}。仍要换上吗？`,
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
    const signalsBySymbol = Object.fromEntries(
      (data?.signals || [])
        .filter((signal) => signal?.symbol)
        .map((signal) => [signal.symbol, signal]),
    )
    return (data?.items || []).map((item) => {
      const signal = signalsBySymbol[item.symbol] || null
      return {
        symbol: item.symbol,
        name: item.name || '',
        current_shares: Number(item.current_shares || 0),
        target_shares: Number(item.target_shares || 0),
        delta_shares: Number(item.delta_shares || 0),
        blockers: item.blockers || [],
        reference_price: signal?.reference_price ?? item.estimated_price ?? null,
        effective_limit_price: signal?.effective_limit_price ?? null,
        max_slippage_bps: signal?.max_slippage_bps ?? null,
        action: signal?.action || (Number(item.delta_shares || 0) > 0 ? 'buy' : 'sell'),
      }
    })
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
      fastActionPreview.value = emptyFastActionPreview()
    } finally {
      fastActionSubmitting.value = false
    }
  }

  function resetFastActionsState() {
    showSwapModal.value = false
    swapStarter.value = null
    swapError.value = ''
    showFastActionModal.value = false
    fastActionSubmitting.value = false
    fastActionPreview.value = emptyFastActionPreview()
  }

  return {
    showSwapModal,
    swapStarter,
    swapError,
    showFastActionModal,
    fastActionSubmitting,
    fastActionPreview,
    halfTargetShares,
    openSwapModal,
    openQuickReduceModal,
    previewSwap,
    confirmFastAction,
    resetFastActionsState,
  }
}
