import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../api/user', () => ({
  setWatchlistStrategy: vi.fn(),
}))

import { setWatchlistStrategy } from '../../api/user'
import { useStrategyPositionGuard } from '../strategyPositionGuard'

const guardPayload = {
  symbol: '600000.SH',
  strategy_name: 'Demo Strategy',
  account: { bound: true, account_id: 'A-0001', broker: 'BrokerA' },
  position: {
    source: 'state_file',
    broker_qty: 1200,
    can_use_volume: 1200,
    managed_qty: 1200,
    core_qty: null,
  },
  pending: { buy: { count: 0, qty: 0 }, sell: { count: 0, qty: 0 } },
  session: { is_open: false, next_open_at: '2026-11-10T09:25:00+08:00' },
  can_auto_clear: true,
  clear_qty: 1200,
  warnings: [],
}

function guardError() {
  const error = new Error('position guard required')
  error.code = 'STRATEGY_POSITION_GUARD'
  error.guard = guardPayload
  return error
}

function payload() {
  return { symbol: '600000.SH', strategy: 'demo_strategy', enabled: false }
}

const api = useStrategyPositionGuard()

beforeEach(() => {
  setWatchlistStrategy.mockReset()
  api.decide(null)
  api.visible.value = false
  api.guard.value = null
  api.busy.value = false
})

describe('saveStrategyWithGuard', () => {
  it('passes through when no guard is required', async () => {
    setWatchlistStrategy.mockResolvedValue({ success: true })

    const result = await api.saveStrategyWithGuard(payload())

    expect(result).toEqual({ success: true })
    expect(setWatchlistStrategy).toHaveBeenCalledTimes(1)
    expect(setWatchlistStrategy).toHaveBeenCalledWith(payload())
  })

  it('asks and retries with keep when the API returns a guard', async () => {
    setWatchlistStrategy
      .mockRejectedValueOnce(guardError())
      .mockResolvedValueOnce({ success: true })

    const promise = api.saveStrategyWithGuard(payload())
    await vi.waitFor(() => expect(api.visible.value).toBe(true))
    api.decide('keep')

    await promise

    expect(setWatchlistStrategy).toHaveBeenCalledTimes(2)
    expect(setWatchlistStrategy).toHaveBeenLastCalledWith({
      ...payload(),
      position_action: 'keep',
      cancel_pending_buys: false,
    })
  })

  it('retries with clear and the pending-buy choice', async () => {
    setWatchlistStrategy
      .mockRejectedValueOnce(guardError())
      .mockResolvedValueOnce({ success: true, flatten_order_id: 'strategy-disable-1' })

    const promise = api.saveStrategyWithGuard(payload())
    await vi.waitFor(() => expect(api.visible.value).toBe(true))
    api.decide('clear', { cancelPendingBuys: true })

    const result = await promise

    expect(result.flatten_order_id).toBe('strategy-disable-1')
    expect(setWatchlistStrategy).toHaveBeenLastCalledWith({
      ...payload(),
      position_action: 'clear',
      cancel_pending_buys: true,
    })
  })

  it('returns cancelled without a second call when the dialog is dismissed', async () => {
    setWatchlistStrategy.mockRejectedValueOnce(guardError())

    const promise = api.saveStrategyWithGuard(payload())
    await vi.waitFor(() => expect(api.visible.value).toBe(true))
    api.decide(null)

    const result = await promise

    expect(result).toEqual({ cancelled: true })
    expect(setWatchlistStrategy).toHaveBeenCalledTimes(1)
  })

  it('does not swallow non-guard errors', async () => {
    setWatchlistStrategy.mockRejectedValueOnce(new Error('VIP required'))

    await expect(api.saveStrategyWithGuard(payload())).rejects.toThrow('VIP required')
    expect(api.visible.value).toBe(false)
  })
})
