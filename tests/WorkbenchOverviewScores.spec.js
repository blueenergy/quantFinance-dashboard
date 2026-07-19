import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const chartApi = vi.hoisted(() => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  clear: vi.fn(),
  dispose: vi.fn(),
}))

const echartsApi = vi.hoisted(() => ({
  init: vi.fn(() => chartApi),
}))

vi.mock('echarts', () => ({
  default: echartsApi,
  init: echartsApi.init,
}))

import WorkbenchOverviewPanel from '../src/components/stock/WorkbenchOverviewPanel.vue'
import WorkbenchScoresPanel from '../src/components/stock/WorkbenchScoresPanel.vue'

const scoreItems = [
  { key: 'technical', label: '技术面', score: 82.5, details: { trend: 'up' } },
  { key: 'fundamental', label: '基本面', score: 76, details: { quality: 'good' } },
]

describe('WorkbenchOverviewPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 640,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 360,
    })
  })

  it('emits goto-panel with quote from the detail action', async () => {
    const wrapper = mount(WorkbenchOverviewPanel, {
      props: {
        active: false,
        overviewQuoteMetrics: [],
        statusItems: [],
      },
    })

    await wrapper.get('.text-link-button').trigger('click')

    expect(wrapper.emitted('goto-panel')?.[0]).toEqual(['quote'])
  })

  it('initializes radar when active with score items, updates, and disposes on unmount', async () => {
    const wrapper = mount(WorkbenchOverviewPanel, {
      props: {
        active: true,
        scoreItems,
        overviewQuoteMetrics: [],
        statusItems: [],
      },
    })
    await flushPromises()
    await nextTick()

    expect(echartsApi.init).toHaveBeenCalledOnce()
    expect(chartApi.setOption).toHaveBeenCalled()
    expect(chartApi.resize).toHaveBeenCalled()

    await wrapper.setProps({
      scoreItems: [
        ...scoreItems,
        { key: 'value', label: '价值', score: 70, details: {} },
      ],
    })
    await flushPromises()
    await nextTick()
    expect(chartApi.setOption.mock.calls.length).toBeGreaterThan(1)

    wrapper.unmount()
    expect(chartApi.dispose).toHaveBeenCalledOnce()
  })

  it('skips radar init while inactive, then renders after becoming active', async () => {
    const wrapper = mount(WorkbenchOverviewPanel, {
      props: {
        active: false,
        scoreItems,
        overviewQuoteMetrics: [],
        statusItems: [],
      },
    })
    await flushPromises()
    expect(echartsApi.init).not.toHaveBeenCalled()

    await wrapper.setProps({ active: true })
    await flushPromises()
    await nextTick()
    expect(echartsApi.init).toHaveBeenCalledOnce()
    expect(chartApi.setOption).toHaveBeenCalled()
  })
})

describe('WorkbenchScoresPanel', () => {
  it('renders score cards from props', () => {
    const wrapper = mount(WorkbenchScoresPanel, {
      props: { scoreItems },
    })

    const cards = wrapper.findAll('.score-card')
    expect(cards).toHaveLength(2)
    expect(cards[0].text()).toContain('技术面')
    expect(cards[0].text()).toContain('82.50')
    expect(cards[1].text()).toContain('基本面')
    expect(cards[1].text()).toContain('76.00')
  })
})
