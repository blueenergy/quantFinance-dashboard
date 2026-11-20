import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import { VDatePicker, VMenu } from 'vuetify/components'

vi.mock('../../api/nationalTeam', () => ({
  getNationalTeamDates: vi.fn(async () => ({
    success: true,
    dates: ['20260901', '20260902', '20260903', '20261029', '20261030', '20261102', '20261103', '20261104'],
  })),
  getNationalTeamSnapshot: vi.fn(async () => ({
    success: true,
    trade_date: '20261104',
    as_of: '1500',
    level: 'calm',
    level_label: '平静',
    first_signal: { watch: null, suspect: null },
    pool: {},
    breadth: { ratio2: 0, ratio25: 0, pool_size: 16 },
    tail: {},
    share: {
      direction: 'inflow',
      direction_label: '净申购',
      pool_flow: 1.5,
      rotation: 1.1,
    },
    index_moves: [],
    etfs: [],
  })),
  getNationalTeamCurve: vi.fn(async () => ({ times: [], as_of: '1500' })),
  getNationalTeamEntryLadder: vi.fn(async () => ({
    success: true,
    trade_date: '20261119',
    flow_date: '20261119',
    index: { ts_code: '000300.SH', name: '沪深300', close: 3954.6, date: '20261120' },
    episode: {
      active: true,
      start: '20260916',
      start_close: 4480.3,
      days: 41,
      ended: false,
      end: null,
      flow20: 55.0,
      flow60: 86.6,
      flow: 1.2,
      drawdown: -11.7,
      regime: 'shallow',
    },
    tiers: [
      { id: 'T1', label: '-10%', price: 4032.3, weight: 0.25, status: 'triggered', status_label: '已触发', distance_pct: null, hist_reach: '4/6', hist_f60: 7.2, hist_f120: -8.6, hist_post_dd: -13.0 },
      { id: 'T2', label: '-15%', price: 3808.3, weight: 0.25, status: 'pending', status_label: '待触发', distance_pct: -3.7, hist_reach: '3/6', hist_f60: 7.4, hist_f120: -10.9, hist_post_dd: -12.9 },
      { id: 'T3', label: '-20%', price: 3584.2, weight: 0.25, status: 'pending', status_label: '待触发', distance_pct: -9.4, hist_reach: '3/6', hist_f60: 11.1, hist_f120: -4.8, hist_post_dd: -6.2 },
      { id: 'T4', label: '增仓结束', price: null, weight: 0.25, status: 'pending', status_label: '待触发', distance_pct: null, hist_reach: '6/6', hist_f60: 0.4, hist_f120: -3.1, hist_f250: 3.3, hist_post_dd: null, condition: 'flow60 < 5%' },
    ],
    suggested_position: 0.25,
    next_tier: { id: 'T2', label: '-15%', price: 3808.3 },
    invalidation: { active: false, flow60: 86.6, negative_days: 0, rule: 'flow60 < 0 连续 20 个交易日' },
    history: { episodes: 6, regime_a: 3, regime_b: 3, median_low: -17.9, median_days: 74, median_f60_onset: -3.6, median_f120_onset: -5.2, note: '6 个已完成 episode；频数不是精确概率' },
  })),
  getNationalTeamHistory: vi.fn(async () => ({
    success: true,
    as_of: '1500',
    dates: ['20261103', '20261104'],
    rows: [
      {
        trade_date: '20261103',
        level: 'high',
        level_label: '高置信',
        pool_ratio: 2.95,
        breadth_2x: 9,
        breadth_25x: 7,
        tail_ratio: 1.51,
        share_chg_1d: 5.59,
        share_chg_5d: 10.1,
        pool_share_flow: 9.62,
        share_rotation: 1.01,
        direction: 'inflow',
        direction_label: '净申购',
        baseline_days: 20,
        partial: false,
      },
      {
        trade_date: '20261104',
        level: 'suspect',
        level_label: '疑似',
        pool_ratio: 2.18,
        breadth_2x: 9,
        breadth_25x: 4,
        tail_ratio: 0.67,
        share_chg_1d: 5.59,
        share_chg_5d: 10.1,
        pool_share_flow: -2.27,
        share_rotation: 1.02,
        direction: 'outflow',
        direction_label: '净赎回',
        baseline_days: 20,
        partial: false,
      },
    ],
  })),
}))

vi.mock('../../utils/echarts/loadEcharts.js', () => ({
  loadEcharts: vi.fn(async () => ({
    init: () => ({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
      on: vi.fn(),
    }),
  })),
}))

import NationalTeamPanel from '../NationalTeamPanel.vue'
import {
  getNationalTeamEntryLadder,
  getNationalTeamSnapshot,
} from '../../api/nationalTeam'

if (!globalThis.visualViewport) {
  globalThis.visualViewport = {
    width: 1024,
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    scale: 1,
    addEventListener() {},
    removeEventListener() {},
  }
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

function buildVuetify() {
  return createVuetify({ components: { VMenu, VDatePicker } })
}

describe('NationalTeamPanel date picker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens a calendar and only enables dates returned by /dates', async () => {
    const wrapper = mount(NationalTeamPanel, {
      global: { plugins: [buildVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()

    const trigger = wrapper.find('.date-trigger')
    expect(trigger.exists()).toBe(true)
    expect(trigger.text()).toContain('最新')
    expect(wrapper.find('.direction-chip').text()).toBe('净申购')

    await trigger.trigger('click')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 300))
    await flushPromises()

    const picker = document.querySelector('.v-date-picker')
    expect(picker).not.toBeNull()

    const dayButtons = [...document.querySelectorAll('.v-date-picker-month__day')]
      .map((cell) => cell.querySelector('button'))
      .filter(Boolean)
    const enabled = dayButtons.filter((btn) => !btn.disabled).map((btn) => btn.textContent.trim())
    const disabled = dayButtons.filter((btn) => btn.disabled).map((btn) => btn.textContent.trim())

    // November 2026 grid: 2/3/4 have data and must be clickable; 5+ must not.
    expect(enabled).toEqual(expect.arrayContaining(['2', '3', '4']))
    expect(disabled).toEqual(expect.arrayContaining(['5', '6']))
    // Dates outside /dates are disabled, so the enabled set must be smaller.
    expect(enabled.length).toBeLessThan(dayButtons.length)

    // Clicking an allowed day loads that trade date.
    getNationalTeamSnapshot.mockClear()
    document.querySelector('[data-v-date="2026-11-03"] button').click()
    await flushPromises()
    expect(getNationalTeamSnapshot).toHaveBeenCalledWith({ trade_date: '20261103' })

    wrapper.unmount()
  })

  it('renders the entry ladder with four tiers', async () => {
    const wrapper = mount(NationalTeamPanel, {
      global: { plugins: [buildVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()

    const card = wrapper.find('.ladder-card')
    expect(card.exists()).toBe(true)
    const tiers = wrapper.findAll('.ladder-tier')
    expect(tiers).toHaveLength(4)
    expect(tiers[0].text()).toContain('T1')
    expect(tiers[0].text()).toContain('已触发')
    expect(tiers[1].text()).toContain('3808')
    expect(tiers[3].text()).toContain('flow60 < 5%')
    expect(card.text()).toContain('回测无独立 alpha')

    wrapper.unmount()
  })

  it('keeps the last ladder when a refresh fails', async () => {
    const wrapper = mount(NationalTeamPanel, {
      global: { plugins: [buildVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()
    expect(wrapper.find('.ladder-card').exists()).toBe(true)

    getNationalTeamEntryLadder.mockRejectedValueOnce(new Error('boom'))
    await wrapper.find('.refresh-btn').trigger('click')
    await flushPromises()

    expect(wrapper.find('.ladder-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('更新失败，显示上次数据')
    wrapper.unmount()
  })

  it('renders the signal-history strip and loads a day on click', async () => {
    const wrapper = mount(NationalTeamPanel, {
      global: { plugins: [buildVuetify()] },
      attachTo: document.body,
    })
    await flushPromises()

    const days = wrapper.findAll('.history-day')
    expect(days).toHaveLength(2)
    expect(days[0].classes()).toContain('level-high')
    expect(days[1].classes()).toContain('level-suspect')

    const flows = wrapper.findAll('.history-flow')
    expect(flows).toHaveLength(2)
    expect(flows[0].classes()).toContain('flow-inflow')
    expect(flows[1].classes()).toContain('flow-outflow')

    getNationalTeamSnapshot.mockClear()
    await days[0].trigger('click')
    await flushPromises()
    expect(getNationalTeamSnapshot).toHaveBeenCalledWith({
      as_of: '1500',
      trade_date: '20261103',
    })

    wrapper.unmount()
  })
})
