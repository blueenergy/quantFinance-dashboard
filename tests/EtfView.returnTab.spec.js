import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const { requestMock } = vi.hoisted(() => ({
  requestMock: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../src/utils/request', () => ({
  default: requestMock,
}))

import EtfView from '../src/views/EtfView.vue'

function mockRequest() {
  requestMock.get.mockImplementation(async (url) => {
    if (url === '/etf/heatmap') {
      return { success: true, cells: [], trade_date: '20250410' }
    }
    if (url === '/etf/list') {
      return {
        success: true,
        data: [{ ts_code: '510300.SH', name: '沪深300ETF', total_share: 1, total_size: 1 }],
        count: 1,
        total: 1,
        trade_date: '20250410',
      }
    }
    if (String(url).includes('/analysis')) {
      return { success: false }
    }
    if (String(url).includes('/kline')) {
      return { success: true, data: [] }
    }
    return { success: true }
  })
}

describe('EtfView detail return tab', () => {
  beforeEach(() => {
    requestMock.get.mockReset()
    requestMock.post.mockReset()
    mockRequest()
  })

  it('returns to the list after a heatmap visit, then opening from the list', async () => {
    const wrapper = mount(EtfView)
    await flushPromises()

    await wrapper.vm.selectEtf({ ts_code: '512760.SH', name: '半导体ETF' })
    await flushPromises()
    expect(wrapper.vm.detailReturnTab).toBe('heatmap')

    wrapper.vm.leaveDetail()
    await wrapper.vm.switchToListTab()
    await flushPromises()

    await wrapper.vm.selectEtf({ ts_code: '510300.SH', name: '沪深300ETF' })
    await flushPromises()
    expect(wrapper.vm.detailReturnTab).toBe('list')

    wrapper.vm.leaveDetail()
    expect(wrapper.vm.mainTab).toBe('list')
    expect(wrapper.vm.detailReturnTab).toBe('list')

    wrapper.unmount()
  })

  it('returns to heatmap when the product was opened from that tab', async () => {
    const wrapper = mount(EtfView)
    await flushPromises()
    expect(wrapper.vm.mainTab).toBe('heatmap')

    await wrapper.vm.selectEtf({ ts_code: '512760.SH', name: '半导体ETF' })
    await flushPromises()
    wrapper.vm.leaveDetail()
    expect(wrapper.vm.mainTab).toBe('heatmap')

    wrapper.unmount()
  })
})
