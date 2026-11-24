import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import MarketStatsPanel from '../../views/MarketStatsPanel.vue'

const setOption = vi.fn()
const init = vi.fn(() => ({ setOption, resize: vi.fn(), dispose: vi.fn(), on: vi.fn() }))

vi.mock('../../utils/echarts/loadEcharts.js', () => ({
  loadEcharts: vi.fn(async () => ({ init: (...args) => init(...args) })),
}))

const penetrationPayload = {
  success: true,
  index: { key: 'hs300', name: '沪深300', index_code: '000300.SH', funds: [] },
  available_indices: [
    { key: 'hs300', name: '沪深300', index_code: '000300.SH', fund_count: 4 },
    { key: 'sse50', name: '上证50', index_code: '000016.SH', fund_count: 1 },
  ],
  days: 2500,
  series: [
    { trade_date: '20260102', aum_yi: 5000, float_mv_yi: 400000, ratio_pct: 1.25, index_close: 3900 },
    { trade_date: '20260105', aum_yi: 5100, float_mv_yi: 402000, ratio_pct: 1.27, index_close: 3920 },
  ],
  latest: { trade_date: '20260105', aum_yi: 5100, float_mv_yi: 402000, ratio_pct: 1.27, index_close: 3920 },
  summary: {
    ratio_pct: 1.27,
    chg_1d: 1.6,
    chg_5d: 4.2,
    chg_20d: 18.0,
    pctile_1y: 72.2,
    pctile_all: 84.2,
    phase: 'inflow',
    phase_label: '持续流入',
    recent_phases: ['inflow'],
    peaks: { max_ratio_pct: 2.38, max_date: '20241008', min_ratio_pct: 0.36, min_date: '20260706' },
  },
  coverage: { fund_count: 4, first_full_date: '20130325', last_date: '20260105', series_start: '20160803', total_points: 3139 },
}

const getEtfPenetration = vi.fn(async () => penetrationPayload)

vi.mock('../../api/marketStats.js', () => ({
  getEtfPenetration: (...args) => getEtfPenetration(...args),
  getMarketStatsOverview: vi.fn(async () => ({
    success: true,
    margin: { trade_date: '20260105', rzrqye: 1.9e12 },
    pe: { trade_date: '20260105', indices: [] },
  })),
}))

function mountPanel() {
  return mount(MarketStatsPanel, {
    global: {
      plugins: [createVuetify({ components, directives })],
      stubs: { RouterLink: true },
    },
  })
}

describe('MarketStatsPanel 渗透率首屏渲染', () => {
  beforeEach(() => {
    setOption.mockClear()
    init.mockClear()
    getEtfPenetration.mockClear()
    getEtfPenetration.mockResolvedValue(penetrationPayload)
  })

  it('首次进入页面就直接把图表画出来，不需要先切指数', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    await flushPromises()

    expect(getEtfPenetration).toHaveBeenCalled()
    // 容器必须挂上并被 ECharts 初始化，且真的画了一次
    expect(init).toHaveBeenCalled()
    expect(setOption).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('首次加载时图表容器不被卸载（ref 不为 null）', async () => {
    // 让请求挂起，停在「加载中」这一刻——bug 就发生在这一瞬间。
    let release
    getEtfPenetration.mockImplementationOnce(
      () => new Promise((resolve) => { release = () => resolve(penetrationPayload) }),
    )

    const wrapper = mountPanel()
    await flushPromises()

    // 加载态下容器必须仍然存在。曾经它被放在 v-if/v-else 分支里，
    // penLoading 置 true 会把整个分支卸掉，ref 变 null，首屏就画不出来。
    expect(wrapper.find('.stat-chart').exists()).toBe(true)

    release()
    await flushPromises()
    await flushPromises()
    expect(init).toHaveBeenCalled()

    wrapper.unmount()
  })
})
