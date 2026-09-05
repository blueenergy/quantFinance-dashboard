import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../src/utils/chartDom', () => ({
  waitForChartDom: vi.fn(async () => false),
}))

vi.mock('../src/utils/request', () => ({
  default: vi.fn(async () => ({})),
}))

import StockChart from '../src/components/StockChart.vue'
import StockKLineChart from '../src/components/StockKLineChart.vue'

function stubResizeObserver() {
  class ResizeObserverStub {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
}

function buttonByText(root, text) {
  return Array.from(root.querySelectorAll('button')).find((button) => button.textContent.trim() === text)
}

describe('K-line fullscreen', () => {
  beforeEach(() => {
    stubResizeObserver()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    document.body.style.overflow = ''
    vi.unstubAllGlobals()
  })

  it('expands StockKLineChart over the viewport and exits from the backdrop', async () => {
    const wrapper = mount(StockKLineChart, {
      attachTo: document.body,
      props: {
        records: [{ trade_date: '20260905', open: 10, high: 11, low: 9, close: 10.5, volume: 1000 }],
      },
    })

    expect(wrapper.get('.kline-fullscreen-btn').text()).toBe('全屏')
    expect(wrapper.find('.stock-kline-chart--fullscreen').exists()).toBe(false)

    await wrapper.get('.kline-fullscreen-btn').trigger('click')
    await flushPromises()

    expect(document.body.querySelector('.stock-kline-chart--fullscreen')).not.toBeNull()
    expect(document.body.querySelector('.kline-fullscreen-btn').textContent.trim()).toBe('退出全屏')
    expect(document.body.style.overflow).toBe('hidden')

    document.body.querySelector('.kline-fullscreen-backdrop').click()
    await flushPromises()

    expect(document.body.querySelector('.stock-kline-chart--fullscreen')).toBeNull()
    expect(wrapper.get('.kline-fullscreen-btn').text()).toBe('全屏')
    expect(document.body.style.overflow).toBe('')

    await wrapper.get('.kline-fullscreen-btn').trigger('click')
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('.stock-kline-chart--fullscreen')).toBeNull()

    wrapper.unmount()
  })

  it('expands StockChart to fill the viewport', async () => {
    const wrapper = mount(StockChart, {
      attachTo: document.body,
      props: {
        symbol: '600519.SH',
        stockName: '贵州茅台',
        records: [{ trade_date: '20260905', open: 10, high: 11, low: 9, close: 10.5, volume: 1000 }],
      },
    })

    expect(buttonByText(wrapper.element, '全屏')).toBeTruthy()
    await buttonByText(wrapper.element, '全屏').click()
    await flushPromises()

    expect(document.body.querySelector('.unified-chart-container.is-fullscreen')).not.toBeNull()
    expect(buttonByText(document.body, '退出全屏')).toBeTruthy()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
  })
})
