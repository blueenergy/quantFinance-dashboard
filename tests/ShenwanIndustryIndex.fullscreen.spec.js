import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../src/utils/request', () => ({
  default: {
    get: vi.fn(async () => ({ data: [] })),
  },
}))

vi.mock('../src/components/AnalysisDetailContent.vue', () => ({
  default: { name: 'AnalysisDetailContent', template: '<div />' },
}))

vi.mock('../src/components/MoneyFlowPanel.vue', () => ({
  default: { name: 'MoneyFlowPanel', template: '<div />' },
}))

import ShenwanIndustryIndex from '../src/views/ShenwanIndustryIndex.vue'

describe('Shenwan K-line fullscreen', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      disconnect() {}
      unobserve() {}
    })
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
    vi.unstubAllGlobals()
  })

  it('expands the industry K-line over the viewport', async () => {
    const wrapper = mount(ShenwanIndustryIndex, { attachTo: document.body })
    await flushPromises()

    const btn = wrapper.get('.kline-fullscreen-btn')
    expect(btn.text()).toBe('全屏')
    expect(wrapper.find('.kline-stage--fullscreen').exists()).toBe(false)

    await btn.trigger('click')
    await flushPromises()

    expect(document.body.querySelector('.kline-stage--fullscreen')).not.toBeNull()
    expect(document.body.querySelector('.kline-fullscreen-btn').textContent.trim()).toBe('退出全屏')
    expect(document.body.style.overflow).toBe('hidden')

    document.body.querySelector('.kline-fullscreen-backdrop').click()
    await flushPromises()

    expect(document.body.querySelector('.kline-stage--fullscreen')).toBeNull()
    expect(wrapper.get('.kline-fullscreen-btn').text()).toBe('全屏')
    expect(document.body.style.overflow).toBe('')

    wrapper.unmount()
  })
})
