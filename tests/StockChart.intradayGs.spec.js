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

const gsBars = [
  {
    trade_date: '202609071030',
    open: 10,
    high: 11,
    low: 9.5,
    close: 10.2,
    mj20: 10.1,
    mj30: 10.0,
    gs_is_bull: true,
    gs_signal: 'g',
    gs_formula_id: 'decision_gs_v1',
  },
  {
    trade_date: '202609071130',
    open: 10.2,
    high: 11.2,
    low: 10,
    close: 10.8,
    mj20: 10.2,
    mj30: 10.05,
    gs_is_bull: true,
    gs_signal: null,
    gs_formula_id: 'decision_gs_v1',
  },
]

describe('StockChart 30m/60m G/S', () => {
  beforeEach(() => {
    stubResizeObserver()
    request.mockReset()
    request.mockResolvedValue({ data: gsBars, tf: '30m', success: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exposes 30分/60分 and loads resampled bars with G/S summary', async () => {
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: {
        symbol: '000001.SZ',
        stockName: '平安银行',
        records: [{ trade_date: '20260907', open: 10, high: 11, low: 9, close: 10.5, volume: 1000, mj20: 10.1, mj30: 10.0 }],
      },
    })

    expect(buttonByText(wrapper.element, '30分')).toBeTruthy()
    expect(buttonByText(wrapper.element, '60分')).toBeTruthy()
    expect(buttonByText(wrapper.element, '决策线 GS')).toBeTruthy()

    await buttonByText(wrapper.element, '30分').click()
    await flushPromises()

    expect(request).toHaveBeenCalled()
    const minuteCall = request.mock.calls.find((args) => args[0]?.url === '/minute-bars/')
    expect(minuteCall[0].params.tf).toBe('30m')
    expect(minuteCall[0].params.symbol).toBe('000001.SZ')
    expect(wrapper.text()).toContain('2 根30分钟')
    expect(wrapper.text()).toContain('G×1')
    expect(wrapper.text()).toContain('最近 G 09-07 10:30')
    expect(buttonByText(wrapper.element, '前复权')).toBeFalsy()
    expect(buttonByText(wrapper.element, '再往前')).toBeFalsy()

    wrapper.unmount()
  })

  it('requests 60m bars when switching to 60分', async () => {
    request.mockResolvedValue({ data: gsBars.map((row) => ({ ...row, gs_signal: 's' })), tf: '60m', success: true })
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: {
        symbol: '000001.SZ',
        records: [{ trade_date: '20260907', open: 10, high: 11, low: 9, close: 10.5 }],
      },
    })

    await buttonByText(wrapper.element, '60分').click()
    await flushPromises()

    const minuteCall = request.mock.calls.find((args) => args[0]?.url === '/minute-bars/')
    expect(minuteCall[0].params.tf).toBe('60m')
    expect(wrapper.text()).toContain('最近 S 09-07 11:30')

    wrapper.unmount()
  })
})
