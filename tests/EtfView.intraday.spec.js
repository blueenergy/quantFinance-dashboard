import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { requestMock } = vi.hoisted(() => ({
  requestMock: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../src/utils/request', () => ({
  default: requestMock,
}))

const chartApi = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
}))

const echartsApi = vi.hoisted(() => ({
  init: vi.fn(() => chartApi),
  graphic: { LinearGradient: vi.fn(() => ({})) },
}))

vi.mock('../src/utils/echarts/loadEcharts.js', () => ({
  loadEcharts: vi.fn(async () => echartsApi),
  prefetchEcharts: vi.fn(),
  prefetchEchartsForTab: vi.fn(),
  resetEchartsLoader: vi.fn(),
}))

import EtfView from '../src/views/EtfView.vue'

const intradayPayload = {
  success: true,
  symbol: '510300.SH',
  name: '沪深300ETF',
  session_date: '20261116',
  pre_close: 4.083,
  times: ['09:30', '09:31', '09:32'],
  bars: [
    { time: '09:30', price: 4.09, avg: 4.09, pct: 0.17, volume: 100, amount: 409000 },
    { time: '09:31', price: 4.1, avg: 4.095, pct: 0.42, volume: 200, amount: 820000 },
    { time: '09:32', price: null, avg: null, pct: null, volume: 0, amount: 0 },
  ],
  summary: {
    last: 4.1,
    pct: 0.42,
    avg: 4.095,
    high: 4.1,
    low: 4.09,
    volume: 300,
    amount: 1229000,
    count: 2,
  },
}

function mockGet() {
  requestMock.get.mockImplementation(async (url) => {
    if (url === '/etf/list') {
      return {
        success: true,
        data: [{ ts_code: '510300.SH', name: '沪深300ETF' }],
        count: 1,
        total: 1,
        trade_date: '20261116',
      }
    }
    if (String(url).includes('/analysis')) return { success: false }
    if (String(url).includes('/intraday-line/')) return intradayPayload
    if (String(url).includes('/kline')) return { success: true, data: [] }
    return { success: true }
  })
}

describe('EtfView 分时', () => {
  beforeEach(() => {
    requestMock.get.mockReset()
    requestMock.post.mockReset()
    chartApi.setOption.mockReset()
    chartApi.clear.mockReset()
    mockGet()
  })

  it('loads /intraday-line/ and renders the price + avg lines', async () => {
    const wrapper = mount(EtfView)
    await flushPromises()

    await wrapper.vm.selectEtf({ ts_code: '510300.SH', name: '沪深300ETF' })
    await flushPromises()

    wrapper.vm.klineTf = 'intraday'
    await flushPromises()

    const call = requestMock.get.mock.calls.find((args) => args[0] === '/intraday-line/')
    expect(call).toBeTruthy()
    expect(call[1].params).toEqual({ symbol: '510300.SH' })

    const option = chartApi.setOption.mock.calls.at(-1)?.[0]
    expect(option.series.map((series) => series.name)).toEqual(['价格', '均价', '成交量'])
    expect(option.series[0].markLine.data).toEqual([{ yAxis: 4.083 }])

    wrapper.unmount()
  })
})
