import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const fetchMarketEvents = vi.fn()
const fetchMarketEventsStatus = vi.fn()
const enqueueMarketEventBriefs = vi.fn()

vi.mock('../src/api/marketEvents.js', () => ({
  fetchMarketEvents: (...args) => fetchMarketEvents(...args),
  fetchMarketEventsStatus: (...args) => fetchMarketEventsStatus(...args),
  enqueueMarketEventBriefs: (...args) => enqueueMarketEventBriefs(...args),
}))

import MarketEvents from '../src/components/MarketEvents.vue'

const T = '2026-11-06T13:30:00Z' // 21:30 北京时间

function ev(overrides) {
  return {
    id: overrides.title,
    identity_key: overrides.title,
    event_time: T,
    region: 'US',
    category: 'macro_data',
    importance: 3,
    ref_period: '2026-10',
    metrics: {},
    sources: [{ name: 'wallstreetcn', url: '' }],
    ...overrides,
  }
}

const EVENTS = [
  ev({ title: '10月失业率', metrics: { forecast: 4.2, previous: 4.2 } }),
  ev({
    title: '10月非农就业人口变动(万人)',
    importance: 4,
    metrics: { forecast: 6.5, previous: 2.9 },
  }),
  ev({ title: '美国10月U6失业率(%)', metrics: { previous: 7.6 } }),
  ev({ title: '美国10月劳动参与率(%)', metrics: { previous: 61.8 } }),
  ev({ title: '美国10月失业率(%)', metrics: { previous: 4.2 } }),
  ev({ title: '美国10月平均每周工时(小时)', metrics: { previous: 34.4 } }),
  // 同一分钟但没有 ref_period —— 不参与折叠
  ev({ title: '无期间事件', ref_period: null }),
  // 公司事件 —— 不参与折叠
  ev({
    title: '南网数字(301638.SZ) 限售解禁',
    category: 'corporate',
    symbol: '301638.SZ',
    ref_period: null,
  }),
]

function mountEvents() {
  return mount(MarketEvents, {
    global: {
      stubs: {
        'v-btn': true,
        'v-chip': true,
        'v-alert': true,
        'v-progress-circular': true,
      },
    },
  })
}

describe('MarketEvents 同批发布折叠', () => {
  beforeEach(() => {
    fetchMarketEvents.mockReset().mockResolvedValue({ events: EVENTS })
    fetchMarketEventsStatus.mockReset().mockResolvedValue({})
    enqueueMarketEventBriefs.mockReset().mockResolvedValue({})
  })

  it('同地区/同分钟/同期间的宏观事件折叠成一行，公司事件与无期间事件不合并', async () => {
    const wrapper = mountEvents()
    await flushPromises()

    expect(wrapper.findAll('.event-item')).toHaveLength(3)
    expect(wrapper.find('.day-count').text()).toBe('8 条')

    const cluster = wrapper.findAll('.event-item')[0]
    expect(cluster.text()).toContain('非农就业人口变动')
    expect(cluster.text()).toContain('同批发布 6 项')
    expect(cluster.text()).toContain('展开其余 5 项')
    expect(cluster.find('.cluster-members').exists()).toBe(false)
  })

  it('展开后列出组内其余指标（含预期/前值）', async () => {
    const wrapper = mountEvents()
    await flushPromises()

    await wrapper.find('.cluster-toggle').trigger('click')

    const members = wrapper.find('.cluster-members')
    expect(members.exists()).toBe(true)
    expect(members.findAll('.cluster-member')).toHaveLength(5)
    expect(members.text()).toContain('10月失业率')
    expect(members.text()).toContain('前值 7.6')
    expect(members.text()).toContain('劳动参与率')
  })

  it('再次点击收起', async () => {
    const wrapper = mountEvents()
    await flushPromises()

    await wrapper.find('.cluster-toggle').trigger('click')
    expect(wrapper.find('.cluster-members').exists()).toBe(true)

    await wrapper.find('.cluster-toggle').trigger('click')
    expect(wrapper.find('.cluster-members').exists()).toBe(false)
  })
})
