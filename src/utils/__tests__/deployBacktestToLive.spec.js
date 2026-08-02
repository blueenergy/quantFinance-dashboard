import { describe, expect, it, vi } from 'vitest'
import {
  confirmAndDeployBacktestToLive,
  deployBacktestToLive,
  getDeployBacktestBlockReason,
} from '../deployBacktestToLive.js'

describe('deployBacktestToLive', () => {
  it('blocks ETF and missing fields', () => {
    expect(getDeployBacktestBlockReason({})).toContain('标的')
    expect(
      getDeployBacktestBlockReason({ symbol: '510300.SH', strategy_key: 'grid', asset_type: 'etf' }),
    ).toContain('ETF')
  })

  it('posts watchlist strategy payload', async () => {
    const requestFn = vi.fn().mockResolvedValue({})
    await deployBacktestToLive(
      {
        symbol: '000001.SZ',
        strategy_key: 'hidden_dragon',
        strategy_params: { p: 1 },
      },
      { requestFn },
    )
    expect(requestFn).toHaveBeenCalledWith({
      method: 'post',
      url: '/user/watchlist/strategy',
      data: {
        symbol: '000001.SZ',
        strategy: 'hidden_dragon',
        enabled: true,
        params: { p: 1 },
      },
    })
  })

  it('confirm helper respects cancel and success', async () => {
    const requestFn = vi.fn().mockResolvedValue({})
    const cancelled = await confirmAndDeployBacktestToLive(
      { symbol: '000001.SZ', strategy_key: 'hidden_dragon', strategy_params: {} },
      { requestFn, confirmFn: () => false, alertFn: () => {} },
    )
    expect(cancelled.ok).toBe(false)
    expect(requestFn).not.toHaveBeenCalled()

    const ok = await confirmAndDeployBacktestToLive(
      { symbol: '000001.SZ', strategy_key: 'hidden_dragon', strategy_params: {} },
      { requestFn, confirmFn: () => true, alertFn: () => {} },
    )
    expect(ok.ok).toBe(true)
    expect(requestFn).toHaveBeenCalledOnce()
  })
})
