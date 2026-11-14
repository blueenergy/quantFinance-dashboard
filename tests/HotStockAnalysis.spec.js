import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const requestMock = vi.hoisted(() => vi.fn())

vi.mock('../src/utils/request', () => ({
  default: requestMock,
}))

import HotStockAnalysis from '../src/components/HotStockAnalysis.vue'

const RAW_STATUS = {
  success: true,
  data: {
    source: 'ths',
    has_data: true,
    trade_date: '20261113',
    rank_time: '2026-11-13 22:30:41',
    stock_count: 99,
    fetched_at: '2026-11-13T22:50:01',
    freshness_minutes: 1200,
    is_fresh: false,
  },
}

const ANALYSIS = {
  market_sentiment: '偏强',
  sentiment_reason: '高位股分化',
  thinking_process: '推理',
  hot_themes: [],
  opportunities: [],
  risk_warnings: [],
  summary: '总结',
}

function mockResponses({ latest = null, history = [] } = {}) {
  requestMock.mockImplementation((config) => {
    if (config.url.endsWith('/hot-stock/latest')) {
      return Promise.resolve({
        success: true,
        source: 'ths',
        source_name: '同花顺(THS)',
        rank_time: '2026-11-13 22:30:41',
        trade_date: '20261113',
        analysis: ANALYSIS,
        model: 'test-model',
        stock_count: 99,
        created_at: '2026-11-13T23:05:16',
      })
    }
    if (config.url.endsWith('/hot-stock/history')) {
      return Promise.resolve({ success: true, source: 'ths', trade_date: '20261113', count: history.length, records: history })
    }
    if (config.url.endsWith('/hot-stock/data-status')) {
      return Promise.resolve(RAW_STATUS)
    }
    return Promise.resolve({ success: true })
  })
}

async function mountPanel() {
  const wrapper = mount(HotStockAnalysis, { global: { stubs: {} } })
  await flushPromises()
  return wrapper
}

describe('HotStockAnalysis', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('renders no manual trigger buttons', async () => {
    mockResponses()
    const wrapper = await mountPanel()
    const text = wrapper.text()

    expect(text).not.toContain('分析最新')
    expect(text).not.toContain('强制刷新')
    // The automatic schedule is stated instead.
    expect(text).toContain('22:50')
    expect(text).toContain('23:05')
  })

  it('marks the shown analysis as up to date when it matches the newest snapshot', async () => {
    mockResponses()
    const wrapper = await mountPanel()

    expect(wrapper.text()).toContain('数据最新')
  })

  it('warns that the conclusion is outdated when the hot list moved on', async () => {
    requestMock.mockImplementation((config) => {
      if (config.url.endsWith('/hot-stock/latest')) {
        return Promise.resolve({
          success: true,
          source: 'ths',
          source_name: '同花顺(THS)',
          rank_time: '2026-11-12 22:30:33',
          trade_date: '20261112',
          analysis: ANALYSIS,
          model: 'test-model',
          stock_count: 99,
          created_at: '2026-11-12T23:05:16',
        })
      }
      if (config.url.endsWith('/hot-stock/history')) {
        return Promise.resolve({ success: true, trade_date: '20261112', count: 0, records: [] })
      }
      return Promise.resolve(RAW_STATUS)
    })
    const wrapper = await mountPanel()

    expect(wrapper.text()).toContain('结论已过时')
  })
})
