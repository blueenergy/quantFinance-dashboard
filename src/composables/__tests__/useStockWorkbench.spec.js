import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getStockWorkbench: vi.fn(),
  getStockWorkbenchAi: vi.fn(),
  getStockWorkbenchFinancials: vi.fn(),
  getStockWorkbenchKline: vi.fn(),
  getStockWorkbenchMoneyFlow: vi.fn(),
  getStockWorkbenchNineTurn: vi.fn(),
  getStockWorkbenchQuote: vi.fn(),
  getStockWorkbenchScores: vi.fn(),
  getStockWorkbenchShareholders: vi.fn(),
  getStockWorkbenchSignals: vi.fn(),
  getStockWorkbenchTrading: vi.fn(),
  getStockWorkbenchValuation: vi.fn(),
}))

vi.mock('../../api/stock', () => api)

import { useStockWorkbench } from '../useStockWorkbench.js'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('useStockWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    window.requestIdleCallback = vi.fn()
  })

  it('creates an optimistic shell and merges the shell response', async () => {
    const response = deferred()
    api.getStockWorkbench.mockReturnValue(response.promise)
    const onAfterShellReady = vi.fn()
    const workbench = useStockWorkbench({ onAfterShellReady })

    const loading = workbench.loadSymbol(' 000001.sz ')

    expect(workbench.loading.value).toBe(true)
    expect(workbench.payload.value).toMatchObject({
      symbol: '000001.SZ',
      stock: { symbol: '000001.SZ' },
      quote: null,
      data_status: { stock_found: true, sections: {} },
    })

    response.resolve({
      stock: { symbol: '000001.SZ', name: '平安银行' },
      quote: { close: 12.3 },
      custom_field: 'kept',
      data_status: {
        quote_found: true,
        sections: { quote: { found: true, as_of: '20260717' } },
      },
    })
    await loading

    expect(workbench.loading.value).toBe(false)
    expect(workbench.payload.value).toMatchObject({
      symbol: '000001.SZ',
      stock: { symbol: '000001.SZ', name: '平安银行' },
      quote: { close: 12.3 },
      custom_field: 'kept',
      data_status: {
        stock_found: true,
        quote_found: true,
        sections: { quote: { found: true, as_of: '20260717' } },
      },
    })
    expect(workbench.sectionLoaded.value.quote).toBe(true)
    expect(onAfterShellReady).toHaveBeenCalledOnce()
  })

  it('ignores stale shell responses after the symbol changes', async () => {
    const first = deferred()
    const second = deferred()
    api.getStockWorkbench
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const workbench = useStockWorkbench()

    const firstLoad = workbench.loadSymbol('000001.SZ')
    const secondLoad = workbench.loadSymbol('600000.SH')

    first.resolve({
      stock: { symbol: '000001.SZ', name: '旧股票' },
      marker: 'stale',
    })
    await firstLoad

    expect(workbench.loading.value).toBe(true)
    expect(workbench.payload.value.symbol).toBe('600000.SH')
    expect(workbench.payload.value.marker).toBeUndefined()

    second.resolve({
      stock: { symbol: '600000.SH', name: '浦发银行' },
      marker: 'current',
    })
    await secondLoad

    expect(workbench.loading.value).toBe(false)
    expect(workbench.payload.value.marker).toBe('current')
  })

  it('remembers, normalizes, and de-duplicates recent stocks', () => {
    const workbench = useStockWorkbench()

    workbench.rememberRecentStock({ symbol: '000001.sz', name: '平安银行' })
    workbench.rememberRecentStock({ ts_code: '600000.sh', stock_name: '浦发银行' })
    workbench.rememberRecentStock({ symbol: '000001.SZ', name: '平安银行新名' })

    expect(workbench.recentStocks.value).toEqual([
      { symbol: '000001.SZ', name: '平安银行新名' },
      { symbol: '600000.SH', name: '浦发银行' },
    ])
    expect(JSON.parse(localStorage.getItem('stock-workbench:recent-symbols'))).toEqual(
      workbench.recentStocks.value,
    )
  })

  it('merges quote section data and status into the current shell', async () => {
    api.getStockWorkbenchQuote.mockResolvedValue({
      quote: { close: 10.5 },
      daily_quotes: [{ trade_date: '20260717', close: 10.5 }],
      daily_basic: { trade_date: '20260717', pe_ttm: 8.2 },
      money_flow: { net_mf_amount: 1200 },
      money_flow_history: [{ trade_date: '20260717', net_mf_amount: 1200 }],
      money_flow_summary: { main_net_today: 1200 },
      entry_risk: { severity: 'low' },
      data_status: { found: true, as_of: '20260717', source: 'test' },
    })
    const workbench = useStockWorkbench()
    workbench.payload.value = {
      ...workbench.createWorkbenchShell('000001.SZ'),
      preserved: true,
    }

    await workbench.loadWorkbenchSection('quote')

    expect(workbench.payload.value).toMatchObject({
      preserved: true,
      quote: { close: 10.5 },
      daily_quotes: [{ trade_date: '20260717', close: 10.5 }],
      daily_basic: { trade_date: '20260717', pe_ttm: 8.2 },
      money_flow_summary: { main_net_today: 1200 },
      entry_risk: { severity: 'low' },
      data_status: {
        quote_found: true,
        quote_date: '20260717',
        sections: {
          quote: { found: true, as_of: '20260717', source: 'test' },
        },
      },
    })
    expect(workbench.payload.value.money_flow_history_by_tf['1d']).toEqual(
      workbench.payload.value.money_flow_history,
    )
    expect(workbench.sectionLoaded.value.quote).toBe(true)
    expect(workbench.sectionLoading.value.quote).toBe(false)
  })

  it('invokes section hooks and ignores stale section responses', async () => {
    const onBeforeLoadSymbol = vi.fn()
    const onScoresLoaded = vi.fn()
    const onShareholdersLoaded = vi.fn()
    const onDisposeShareholderCharts = vi.fn()
    const quote = deferred()
    api.getStockWorkbench.mockResolvedValue({
      stock: { symbol: '000001.SZ', name: '平安银行' },
      score: { composite_score: 70 },
    })
    api.getStockWorkbenchScores.mockResolvedValue({
      score: { composite_score: 80 },
      score_history: [],
      data_status: { found: true, as_of: '20260717' },
    })
    api.getStockWorkbenchShareholders.mockResolvedValue({
      summary: { holder_num: 1 },
      data_status: { found: true },
    })
    api.getStockWorkbenchQuote.mockReturnValue(quote.promise)

    const workbench = useStockWorkbench({
      onBeforeLoadSymbol,
      onScoresLoaded,
      onShareholdersLoaded,
      onDisposeShareholderCharts,
    })

    await workbench.loadSymbol('000001.SZ')
    expect(onBeforeLoadSymbol).toHaveBeenCalledOnce()
    expect(onDisposeShareholderCharts).toHaveBeenCalledOnce()

    await workbench.loadWorkbenchSection('scores', { force: true })
    expect(onScoresLoaded).toHaveBeenCalledOnce()

    await workbench.loadWorkbenchSection('shareholders', { force: true })
    expect(onShareholdersLoaded).toHaveBeenCalledOnce()

    const staleQuoteLoad = workbench.loadWorkbenchSection('quote', { force: true })
    workbench.directSymbol.value = '600000.SH'
    workbench.payload.value = workbench.createWorkbenchShell('600000.SH')
    quote.resolve({
      quote: { close: 1 },
      daily_quotes: [],
      money_flow_history: [],
      data_status: { found: true, as_of: '20260717' },
    })
    await staleQuoteLoad
    expect(workbench.payload.value.quote).toBeNull()
    expect(workbench.sectionLoaded.value.quote).toBe(false)
  })

  it('wires panel/navigation watches, window event, and unmount cleanup', async () => {
    const { defineComponent, nextTick, ref } = await import('vue')
    const { mount, flushPromises } = await import('@vue/test-utils')

    api.getStockWorkbench.mockResolvedValue({
      stock: { symbol: '000001.SZ', name: '平安银行' },
    })
    api.getStockWorkbenchNineTurn.mockResolvedValue({
      daily_quotes: [],
      nine_turn_rows: [],
      signals: [],
      latest_signal: null,
      data_status: { found: false },
    })
    api.getStockWorkbenchKline.mockResolvedValue({ rows: [{ trade_date: '20260717' }], data_status: {} })
    api.getStockWorkbenchMoneyFlow.mockResolvedValue({ history: [{ trade_date: '20260717' }], data_status: {} })

    localStorage.setItem(
      'stock-workbench:recent-symbols',
      JSON.stringify([{ symbol: '600519.SH', name: '贵州茅台' }]),
    )

    const pendingNavigation = ref(null)
    const onDisposeShareholderCharts = vi.fn()
    let apiHandle = null

    const Host = defineComponent({
      setup() {
        apiHandle = useStockWorkbench({
          pendingNavigation,
          onDisposeShareholderCharts,
        })
        return () => null
      },
    })
    const wrapper = mount(Host)
    await flushPromises()

    expect(apiHandle.recentStocks.value).toEqual([{ symbol: '600519.SH', name: '贵州茅台' }])

    apiHandle.payload.value = apiHandle.createWorkbenchShell('000001.SZ')
    apiHandle.activePanel.value = 'nine-turn'
    await flushPromises()
    expect(api.getStockWorkbenchNineTurn).toHaveBeenCalledWith('000001.SZ')

    apiHandle.quoteKlineTf.value = '1w'
    await flushPromises()
    expect(api.getStockWorkbenchKline).toHaveBeenCalledWith('000001.SZ', '1w')
    expect(api.getStockWorkbenchMoneyFlow).toHaveBeenCalledWith('000001.SZ', '1w')

    pendingNavigation.value = { symbol: '000001.SZ', panel: 'swot' }
    await flushPromises()
    expect(apiHandle.activePanel.value).toBe('swot')
    expect(api.getStockWorkbench).toHaveBeenCalled()

    window.dispatchEvent(new CustomEvent('stock-workbench:set-symbol', {
      detail: { symbol: '000002.SZ' },
    }))
    await flushPromises()
    expect(apiHandle.directSymbol.value.toUpperCase()).toContain('000002')

    wrapper.unmount()
    expect(onDisposeShareholderCharts).toHaveBeenCalled()
    // listener removed: a later event should not change symbol after unmount
    const before = apiHandle.directSymbol.value
    window.dispatchEvent(new CustomEvent('stock-workbench:set-symbol', {
      detail: { symbol: '000003.SZ' },
    }))
    await nextTick()
    expect(apiHandle.directSymbol.value).toBe(before)
  })
})
