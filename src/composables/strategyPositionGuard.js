import { ref } from 'vue'
import { setWatchlistStrategy } from '../api/user'

// Module-level state: one dialog covers every page (the watchlist config table
// today, the strategy-run page later) without prop drilling.
const visible = ref(false)
const guard = ref(null)
const busy = ref(false)
let resolver = null

function ask(nextGuard) {
  guard.value = nextGuard
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

    const decision = await ask(error.guard)
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

export function useStrategyPositionGuard() {
  return { visible, guard, busy, decide, saveStrategyWithGuard }
}

export default useStrategyPositionGuard
