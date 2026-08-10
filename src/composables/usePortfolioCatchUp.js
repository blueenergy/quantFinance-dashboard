import { computed, ref, unref, watch } from 'vue'
import { getPortfolioPlanLiveExecutions } from '../api/portfolioPlans'
import {
  confirmTraderSignalReprice,
  previewTraderSignalReprice,
} from '../api/tradeExecution'

const CATCH_UP_STATUSES = new Set(['cancelled', 'canceled', 'partial_cancelled'])

function normalizeStatus(value) {
  return String(value || '').toLowerCase()
}

function remainingShares(signal) {
  const explicit = Number(signal.remaining_size)
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit)
  const size = Number(signal.size || 0)
  const filled = Number(signal.filled_qty || signal.filled_size || 0)
  if (!Number.isFinite(size)) return 0
  return Math.max(0, Math.floor(size - (Number.isFinite(filled) ? filled : 0)))
}

function isCatchUpBuy(signal) {
  const action = String(signal.action || '').toLowerCase()
  if (action !== 'buy') return false
  return CATCH_UP_STATUSES.has(normalizeStatus(signal.status))
}

function toCatchUpRow(signal) {
  const size = Number(signal.size || 0)
  const filled = Number(signal.filled_qty || signal.filled_size || 0)
  const remaining = remainingShares(signal)
  return {
    order_id: signal.order_id,
    symbol: signal.symbol,
    name: signal.name || signal.stock_name || '',
    status: normalizeStatus(signal.status),
    size: Number.isFinite(size) ? size : 0,
    filled_qty: Number.isFinite(filled) ? filled : 0,
    remaining_size: remaining,
    effective_limit_price: signal.effective_limit_price ?? signal.price ?? null,
    price: signal.price ?? null,
    plan_id: signal.plan_id,
  }
}

/** Pure helper for tests and list building. */
export function buildCatchUpRows(signals = []) {
  const replacedIds = new Set(
    signals
      .map((signal) => signal.replaces_order_id)
      .filter(Boolean)
      .map((orderId) => String(orderId)),
  )
  return signals
    .filter(isCatchUpBuy)
    .filter((signal) => !replacedIds.has(String(signal.order_id || '')))
    .map(toCatchUpRow)
}

/**
 * Personal-investor catch-up for cancelled / partial_cancelled buys on the
 * current operation plan. Uses live-executions + trader reprice APIs.
 *
 * @param {{ planId: import('vue').Ref|import('vue').ComputedRef|string,
 *           enabled: import('vue').Ref|import('vue').ComputedRef|boolean,
 *           onAfterConfirm?: () => Promise<void>|void }} options
 */
export function usePortfolioCatchUp({
  planId,
  enabled,
  onAfterConfirm,
} = {}) {
  const loading = ref(false)
  const error = ref('')
  const rows = ref([])
  const dialogOpen = ref(false)
  const dialogLoading = ref(false)
  const dialogSubmitting = ref(false)
  const dialogError = ref('')
  const activeOrderId = ref('')
  const preview = ref(null)
  const limitPrice = ref(null)
  const size = ref(null)
  const reason = ref('')

  const catchUpCount = computed(() => rows.value.length)
  const hasCatchUp = computed(() => catchUpCount.value > 0)

  async function loadCatchUp() {
    const id = unref(planId)
    const on = unref(enabled)
    error.value = ''
    rows.value = []
    if (!on || !id) return
    loading.value = true
    try {
      const response = await getPortfolioPlanLiveExecutions(id)
      const signals = response?.data?.signals || response?.signals || []
      rows.value = buildCatchUpRows(signals)
    } catch (err) {
      error.value = err?.message || String(err)
      rows.value = []
    } finally {
      loading.value = false
    }
  }

  async function openCatchUp(row) {
    dialogError.value = ''
    reason.value = ''
    activeOrderId.value = row.order_id || ''
    preview.value = null
    limitPrice.value = null
    size.value = row.remaining_size > 0 ? row.remaining_size : row.size || null
    dialogOpen.value = true
    dialogLoading.value = true
    try {
      const data = await previewTraderSignalReprice(activeOrderId.value)
      preview.value = data
      limitPrice.value =
        data.suggested_effective_limit_price
        ?? data.market_reference_price
        ?? row.effective_limit_price
        ?? null
      if (row.status === 'partial_cancelled' && row.remaining_size > 0) {
        size.value = row.remaining_size
      } else if (data.size != null && Number(data.size) > 0) {
        size.value = data.size
      }
    } catch (err) {
      dialogError.value = err?.message || String(err)
      preview.value = {
        success: false,
        symbol: row.symbol,
        size: row.remaining_size || row.size,
        original_effective_limit_price: row.effective_limit_price,
      }
    } finally {
      dialogLoading.value = false
    }
  }

  function closeCatchUp() {
    dialogOpen.value = false
    preview.value = null
    dialogSubmitting.value = false
    dialogError.value = ''
  }

  async function confirmCatchUp() {
    dialogError.value = ''
    const lim = Number(limitPrice.value)
    if (!Number.isFinite(lim) || lim <= 0) {
      dialogError.value = '请输入有效限价'
      return
    }
    const body = {
      effective_limit_price: lim,
      reason: reason.value || 'overview_catch_up',
    }
    const sz = Number(size.value)
    if (Number.isFinite(sz) && sz > 0) {
      body.size = Math.floor(sz)
    }
    dialogSubmitting.value = true
    try {
      await confirmTraderSignalReprice(activeOrderId.value, body)
      closeCatchUp()
      await loadCatchUp()
      if (typeof onAfterConfirm === 'function') {
        await onAfterConfirm()
      }
    } catch (err) {
      dialogError.value = err?.message || String(err)
    } finally {
      dialogSubmitting.value = false
    }
  }

  watch(
    () => [unref(planId), unref(enabled)],
    () => {
      loadCatchUp()
    },
    { immediate: true },
  )

  return {
    loading,
    error,
    rows,
    catchUpCount,
    hasCatchUp,
    dialogOpen,
    dialogLoading,
    dialogSubmitting,
    dialogError,
    activeOrderId,
    preview,
    limitPrice,
    size,
    reason,
    loadCatchUp,
    openCatchUp,
    closeCatchUp,
    confirmCatchUp,
  }
}

export const CATCH_UP_BUY_STATUSES = CATCH_UP_STATUSES
