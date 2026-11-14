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

  it('renders recent momentum on the opportunity card', async () => {
    requestMock.mockImplementation((config) => {
      if (config.url.endsWith('/hot-stock/latest')) {
        return Promise.resolve({
          success: true,
          source: 'ths',
          source_name: '同花顺(THS)',
          rank_time: '2026-11-13 22:30:41',
          trade_date: '20261113',
          analysis: {
            ...ANALYSIS,
            opportunities: [
              {
                ts_code: '603366.SH',
                name: '日出东方',
                rank: 3,
                pct_change: 5.54,
                opportunity_type: '高位分歧',
                confidence: 50,
                pct_5d: 54.62,
                pct_20d: 90.93,
                limit_up_5d: 4,
                limit_up_streak: 0,
                vol_ratio: 4.58,
                reason: '近5日涨停 4 次',
              },
            ],
          },
          model: 'test-model',
          stock_count: 99,
          created_at: '2026-11-13T23:05:16',
        })
      }
      if (config.url.endsWith('/hot-stock/history')) {
        return Promise.resolve({ success: true, trade_date: '20261113', count: 0, records: [] })
      }
      return Promise.resolve(RAW_STATUS)
    })
    const wrapper = await mountPanel()
    const text = wrapper.text()

    expect(text).toContain('历史位置')
    expect(text).toContain('近5日 +54.62%')
    expect(text).toContain('近20日 +90.93%')
    expect(text).toContain('5日涨停 4 次')
    expect(text).toContain('量比 4.58')
    expect(text).toContain('高位分歧')
  })

  it('hides the momentum strip for analyses generated before it existed', async () => {
    mockResponses()
    const wrapper = await mountPanel()
    const text = wrapper.text()

    expect(text).not.toContain('历史位置')
    expect(text).not.toContain('undefined%')
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
