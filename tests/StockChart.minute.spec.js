import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../src/utils/chartDom', () => ({
  waitForChartDom: vi.fn(async () => false),
}))

const request = vi.fn(async () => ({ data: [] }))
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

function minuteCalls() {
  return request.mock.calls.filter((args) => args[0]?.url === '/minute-bars/')
}

const todayBars = [
  {
    trade_date: '202609081031',
    open: 10,
    high: 10.2,
    low: 9.9,
    close: 10.1,
    volume: 100,
  },
  {
    trade_date: '202609081032',
    open: 10.1,
    high: 10.3,
    low: 10.0,
    close: 10.2,
    volume: 120,
  },
]

describe('StockChart 分时', () => {
  beforeEach(() => {
    stubResizeObserver()
    request.mockReset()
    request.mockResolvedValue({ data: todayBars, tf: '1m', day: '20260908', success: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the latest 1m session instead of the daily kline date', async () => {
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: {
        symbol: '000001.SZ',
        stockName: '平安银行',
        records: [{ trade_date: '20260907', open: 10, high: 11, low: 9, close: 10.5, volume: 1000 }],
      },
    })

    await buttonByText(wrapper.element, '分时').click()
    await flushPromises()

    const calls = minuteCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0][0].params).toEqual({
      symbol: '000001.SZ',
      tf: '1m',
      limit: 1000,
    })
    expect(request.mock.calls.some((args) => args[0]?.url === '/trade-signals/')).toBe(false)
    expect(wrapper.text()).toContain('2 条分时')
    expect(wrapper.find('input[type="date"]').element.value).toBe('2026-09-08')

    wrapper.unmount()
  })

  it('keeps fetching after flipping symbols on 分时', async () => {
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: {
        symbol: '000001.SZ',
        records: [{ trade_date: '20260907', open: 10, high: 11, low: 9, close: 10.5 }],
      },
    })

    await buttonByText(wrapper.element, '分时').click()
    await flushPromises()

    await wrapper.setProps({ symbol: '000002.SZ' })
    await flushPromises()

    const calls = minuteCalls()
    expect(calls.length).toBe(2)
    expect(calls[1][0].params.symbol).toBe('000002.SZ')
    expect(calls[1][0].params.start_date).toBe('20260908')
    expect(calls[1][0].params.end_date).toBe('20260908')

    wrapper.unmount()
  })

  it('falls back to the latest session when the picked day is empty', async () => {
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: {
        symbol: '000001.SZ',
        records: [{ trade_date: '20260907', open: 10, high: 11, low: 9, close: 10.5 }],
      },
    })

    await buttonByText(wrapper.element, '分时').click()
    await flushPromises()

    request.mockResolvedValueOnce({ data: [], tf: '1m', day: '', success: true })
    const dateInput = wrapper.find('input[type="date"]')
    await dateInput.setValue('2026-09-01')
    await dateInput.trigger('change')
    await flushPromises()

    const calls = minuteCalls()
    const datedIndex = calls.findIndex((args) => args[0].params.start_date === '20260901')
    expect(datedIndex).toBeGreaterThanOrEqual(0)
    expect(calls.slice(datedIndex + 1).some((args) => !args[0].params.start_date)).toBe(true)
    expect(wrapper.text()).toContain('2 条分时')
    expect(dateInput.element.value).toBe('2026-09-08')

    wrapper.unmount()
  })
})
