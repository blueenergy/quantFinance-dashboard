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
import { getNationalTeamSnapshot } from '../../api/nationalTeam'

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
