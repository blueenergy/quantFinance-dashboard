import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchStrategyPoolChartContext } from '../src/api/strategyPool'
import { useStrategyPoolChart } from '../src/composables/useStrategyPoolChart'

vi.mock('../src/api/strategyPool', () => ({
  fetchStrategyPoolChartContext: vi.fn(),
}))

describe('useStrategyPoolChart', () => {
  beforeEach(() => {
    fetchStrategyPoolChartContext.mockReset()
  })

  it('loads chart context for the selected stock', async () => {
    fetchStrategyPoolChartContext.mockResolvedValue({
      success: true,
      signal_date: '20260109',
      disclaimer: '含信号日之后走势，仅供事后验证。',
      kline: { records: [{ trade_date: '20260109', close: 10 }] },
      markers: [{ kind: 'buy', trade_date: '20260109', highlighted: true }],
      rounds: [],
      forward_returns: { horizons: [{ days: 1, available: true, return: 0.02 }] },
    })

    const chart = useStrategyPoolChart()
    await chart.selectStock(
      { symbol: '000001.SZ', strategy: 'hidden_dragon', preset: 'dragon_default', date: '20260109' },
    )

    expect(fetchStrategyPoolChartContext).toHaveBeenCalledWith({
      symbol: '000001.SZ',
      strategy: 'hidden_dragon',
      preset: 'dragon_default',
      signalDate: '20260109',
    })
    expect(chart.records.value).toHaveLength(1)
    expect(chart.markers.value[0].kind).toBe('buy')
    expect(chart.chartMeta.value.showMa).toBe(false)
    expect(chart.chartMeta.value.markLineDate).toBe('20260109')
    expect(chart.disclaimer.value).toContain('事后验证')
  })

  it('ignores a stale response after a newer selection', async () => {
    let resolveFirst
    fetchStrategyPoolChartContext
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve }))
      .mockResolvedValueOnce({
        kline: { records: [{ trade_date: '20260110', close: 12 }] },
        markers: [{ kind: 'buy', trade_date: '20260110' }],
      })

    const chart = useStrategyPoolChart()
    const first = chart.selectStock({ symbol: '000001.SZ', strategy: 'hidden_dragon', date: '20260109' })
    const second = chart.selectStock({ symbol: '000002.SZ', strategy: 'hidden_dragon', date: '20260110' })
    resolveFirst({
      kline: { records: [{ trade_date: '20260109', close: 10 }] },
      markers: [{ kind: 'buy', trade_date: '20260109' }],
    })
    await Promise.all([first, second])

    expect(chart.selectedStock.value.symbol).toBe('000002.SZ')
    expect(chart.records.value[0].trade_date).toBe('20260110')
  })
})
