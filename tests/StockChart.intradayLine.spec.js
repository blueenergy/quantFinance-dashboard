import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../src/utils/chartDom', () => ({
  waitForChartDom: vi.fn(async () => false),
}))

const request = vi.fn(async () => ({}))
vi.mock('../src/utils/request', () => ({
  default: (...args) => request(...args),
}))

import StockChart from '../src/components/StockChart.vue'

function stubResizeObserver() {
  class ResizeObserverStub {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}

function buttonByText(root, text) {
  return Array.from(root.querySelectorAll('button')).find((button) => button.textContent.trim() === text)
}

const payload = {
  success: true,
  symbol: '600114.SH',
  name: '东睦股份',
  session_date: '20261116',
  pre_close: 20.11,
  times: ['09:30', '09:31', '09:32'],
  bars: [
    { time: '09:30', price: 19.92, avg: 19.92, pct: -0.94, volume: 278, amount: 553776 },
    { time: '09:31', price: 19.7, avg: 19.769, pct: -2.04, volume: 3656, amount: 7223477 },
    { time: '09:32', price: null, avg: null, pct: null, volume: 0, amount: 0 },
  ],
  summary: { last: 19.7, pct: -2.04, count: 2 },
}

describe('StockChart 分时线', () => {
  beforeEach(() => {
    stubResizeObserver()
    request.mockReset()
    request.mockResolvedValue(payload)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests /intraday-line/ instead of 1m bars and shows count + pct', async () => {
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: {
        symbol: '600114.SH',
        stockName: '东睦股份',
        records: [],
      },
    })

    await buttonByText(wrapper.element, '分时').click()
    await flushPromises()

    const calls = request.mock.calls.filter((args) => args[0]?.url === '/intraday-line/')
    expect(calls).toHaveLength(1)
    expect(calls[0][0].params).toEqual({ symbol: '600114.SH' })
    expect(request.mock.calls.some((args) => args[0]?.url === '/minute-bars/')).toBe(false)

    expect(wrapper.text()).toContain('2 点分时')
    expect(wrapper.text()).toContain('20261116')
    expect(wrapper.text()).toContain('-2.04%')
  })

  it('keeps 1分 as a separate 1-minute candlestick mode', async () => {
    request.mockResolvedValue({ success: true, data: [], day: '20260908' })
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: { symbol: '000001.SZ', records: [] },
    })

    await buttonByText(wrapper.element, '1分').click()
    await flushPromises()

    const calls = request.mock.calls.filter((args) => args[0]?.url === '/minute-bars/')
    expect(calls).toHaveLength(1)
    expect(calls[0][0].params).toEqual({ symbol: '000001.SZ', tf: '1m', limit: 1000 })
  })
})
