import { ref } from 'vue'
import { getStrategyPositionGuard, setWatchlistStrategy } from '../api/user'

// Module-level state: one dialog covers every page (the watchlist config table
// and the strategy-run page) without prop drilling.
const visible = ref(false)
const guard = ref(null)
const busy = ref(false)
const mode = ref('stop')
let resolver = null

function ask(nextGuard, nextMode = 'stop') {
  guard.value = nextGuard
  mode.value = nextMode
  visible.value = true
  busy.value = false
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function decide(action, options = {}) {
  if (!resolver) return
  const resolveIt = resolver
  resolver = null
  visible.value = false
  if (action) {
    busy.value = true
    resolveIt({ action, ...options })
  } else {
    resolveIt(null)
  }
}

async function saveStrategyWithGuard(payload) {
  try {
    return await setWatchlistStrategy(payload)
  } catch (error) {
    // Non-guard errors (403 VIP, 400 clear-unavailable, network) bubble up.
    if (!error?.guard) throw error

    const decision = await ask(error.guard, 'stop')
    if (!decision) return { cancelled: true }

    try {
      return await setWatchlistStrategy({
        ...payload,
        position_action: decision.action,
        cancel_pending_buys: !!decision.cancelPendingBuys,
      })
    } finally {
      busy.value = false
      guard.value = null
    }
  }
}

function needsStartPrompt(preview) {
  if (!preview) return false
  const position = preview.position || {}
  const managed = position.managed_qty
  const pendingSell = Number(preview.pending?.sell?.qty || 0)
  const brokerQty = Number(position.broker_qty || 0)
  if (managed === null || managed === undefined) return true
  if (Number(managed) > 0) return true
  if (pendingSell > 0) return true
  // A state-file strategy starts flat even when the broker still holds shares;
  // surface that discrepancy before enabling it.
  if (brokerQty > 0 && position.source === 'state_file') return true
  return false
}

async function startStrategyWithGuard(payload) {
  let preview = null
  try {
    preview = await getStrategyPositionGuard(payload.symbol, payload.strategy)
  } catch (error) {
    preview = null
  }

  if (needsStartPrompt(preview)) {
    const decision = await ask(preview, 'start')
    if (!decision) return { cancelled: true }
  } else if (!preview) {
    // Manager unavailable. The enabled flag can still be written; the manager
    // will start the worker when it comes back, but we cannot preview the
    // takeover. Ask once before doing that.
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm('无法读取当前持仓，仍要启动策略吗？')) {
        return { cancelled: true }
      }
    }
  }

  try {
    return await setWatchlistStrategy({ ...payload, enabled: true })
  } finally {
    busy.value = false
    guard.value = null
  }
}

export function useStrategyPositionGuard() {
  return {
    visible,
    guard,
    busy,
    mode,
    decide,
    saveStrategyWithGuard,
    startStrategyWithGuard,
  }
}

export default useStrategyPositionGuard
