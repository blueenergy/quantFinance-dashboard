import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const echartsMod = { init: vi.fn() }

vi.mock('echarts', () => ({
  default: echartsMod,
}))

describe('loadEcharts', () => {
  beforeEach(async () => {
    const { resetEchartsLoader } = await import('../loadEcharts.js')
    resetEchartsLoader()
  })

  afterEach(async () => {
    const { resetEchartsLoader } = await import('../loadEcharts.js')
    resetEchartsLoader()
  })

  it('reuses one dynamic import promise', async () => {
    const { loadEcharts } = await import('../loadEcharts.js')
    const first = loadEcharts()
    const second = loadEcharts()
    expect(first).toBe(second)
    expect(await first).toBe(echartsMod)
  })

  it('maps kline tabs for prefetch and skips admin', async () => {
    const { KLINE_PREFETCH_TABS } = await import('../loadEcharts.js')
    expect(KLINE_PREFETCH_TABS.has('watchlist')).toBe(true)
    expect(KLINE_PREFETCH_TABS.has('stock-workbench')).toBe(true)
    expect(KLINE_PREFETCH_TABS.has('chart')).toBe(true)
    expect(KLINE_PREFETCH_TABS.has('admin')).toBe(false)
  })
})
