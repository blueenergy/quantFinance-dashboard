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

import WorkbenchShareholdersPanel from '../src/components/stock/WorkbenchShareholdersPanel.vue'

const holderNumbers = [
  { end_date: '2026-06-30', holder_num: 9000 },
  { end_date: '2026-03-31', holder_num: 10000 },
]

function findButton(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text() === text)
}

describe('WorkbenchShareholdersPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('toggles the holder-number detail table', async () => {
    const wrapper = mount(WorkbenchShareholdersPanel, {
      props: { active: false, holderNumbers },
    })

    expect(wrapper.text()).toContain('明细表默认收起')
    expect(wrapper.find('table').exists()).toBe(false)

    await findButton(wrapper, '展开明细').trigger('click')

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('2026-06-30')
    expect(findButton(wrapper, '收起明细')).toBeTruthy()
  })

  it('renders empty states for missing shareholder data', () => {
    const wrapper = mount(WorkbenchShareholdersPanel, {
      props: { active: false },
    })

    expect(wrapper.text()).toContain('暂无股东户数数据')
    expect(wrapper.text()).toContain('暂无北向持股数据')
    expect(wrapper.text()).toContain('暂无前十大流通股东变化数据')
    expect(wrapper.text()).toContain('暂无股票回购数据')
  })

  it('initializes the holder-number chart when active with data', async () => {
    mount(WorkbenchShareholdersPanel, {
      props: { active: true, holderNumbers },
    })
    await flushPromises()
    await nextTick()

    expect(echartsApi.init).toHaveBeenCalledOnce()
    expect(chartApi.setOption).toHaveBeenCalled()
    expect(chartApi.resize).toHaveBeenCalled()
  })

  it('disposes initialized charts on unmount', async () => {
    const wrapper = mount(WorkbenchShareholdersPanel, {
      props: { active: true, holderNumbers },
    })
    await flushPromises()
    await nextTick()

    wrapper.unmount()

    expect(chartApi.dispose).toHaveBeenCalledOnce()
  })

  it('re-inits charts after data clears then reloads (v-if DOM swap)', async () => {
    const wrapper = mount(WorkbenchShareholdersPanel, {
      props: { active: true, holderNumbers },
    })
    await flushPromises()
    await nextTick()
    expect(echartsApi.init).toHaveBeenCalledOnce()

    await wrapper.setProps({ holderNumbers: [] })
    await flushPromises()
    await nextTick()
    expect(chartApi.dispose).toHaveBeenCalled()

    echartsApi.init.mockClear()
    chartApi.setOption.mockClear()
    chartApi.resize.mockClear()

    await wrapper.setProps({ holderNumbers })
    await flushPromises()
    await nextTick()

    expect(echartsApi.init).toHaveBeenCalledOnce()
    expect(chartApi.setOption).toHaveBeenCalled()
    expect(chartApi.resize).toHaveBeenCalled()
  })

  it('renders charts when becoming active after data is already loaded', async () => {
    const wrapper = mount(WorkbenchShareholdersPanel, {
      props: { active: false, holderNumbers },
    })
    await flushPromises()
    expect(echartsApi.init).not.toHaveBeenCalled()

    await wrapper.setProps({ active: true })
    await flushPromises()
    await nextTick()

    expect(echartsApi.init).toHaveBeenCalledOnce()
  })

  it('resets all expanded sections when symbol changes', async () => {
    const wrapper = mount(WorkbenchShareholdersPanel, {
      props: {
        active: false,
        symbol: '000001.SZ',
        holderNumbers,
        holderTrades: [{ ann_date: '2026-07-01', holder_name: '股东甲' }],
        shareFloats: [{ float_date: '2026-08-01', share_type: '首发原股东限售股份' }],
      },
    })

    await findButton(wrapper, '展开明细').trigger('click')
    for (const button of wrapper.findAll('button').filter((item) => item.text() === '展开')) {
      await button.trigger('click')
    }
    expect(wrapper.findAll('table')).toHaveLength(3)

    await wrapper.setProps({ symbol: '600000.SH' })
    await nextTick()

    expect(wrapper.findAll('table')).toHaveLength(0)
    expect(findButton(wrapper, '展开明细')).toBeTruthy()
    expect(wrapper.findAll('button').filter((button) => button.text() === '展开')).toHaveLength(2)
  })

  it('resets expanded sections when resetKey bumps for the same symbol', async () => {
    const wrapper = mount(WorkbenchShareholdersPanel, {
      props: {
        active: false,
        symbol: '000001.SZ',
        resetKey: 0,
        holderNumbers,
      },
    })

    await findButton(wrapper, '展开明细').trigger('click')
    expect(wrapper.find('table').exists()).toBe(true)

    await wrapper.setProps({ resetKey: 1 })
    await nextTick()

    expect(wrapper.find('table').exists()).toBe(false)
    expect(findButton(wrapper, '展开明细')).toBeTruthy()
  })
})
