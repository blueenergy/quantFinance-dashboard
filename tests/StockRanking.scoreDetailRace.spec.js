import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'

const requestMock = vi.fn()

vi.mock('../src/utils/request', () => ({
  default: config => requestMock(config),
}))

import StockRanking from '../src/components/StockRanking.vue'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('StockRanking score detail requests', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    requestMock.mockReset()
  })

  it('keeps the newest row detail when an older request resolves last', async () => {
    requestMock.mockResolvedValue({ success: true, data: [] })
    const wrapper = shallowMount(StockRanking)
    await flushPromises()
    requestMock.mockReset()

    const firstResponse = deferred()
    const secondResponse = deferred()
    requestMock
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)

    const firstStock = { symbol: '000001.SZ', name: '平安银行' }
    const secondStock = { symbol: '600519.SH', name: '贵州茅台' }

    const firstRequest = wrapper.vm.fetchScoreDetails(firstStock, 'cycle')
    await Promise.resolve()
    const firstSignal = requestMock.mock.calls[0][0].signal

    const secondRequest = wrapper.vm.fetchScoreDetails(secondStock, 'growth')
    await Promise.resolve()

    expect(firstSignal.aborted).toBe(true)

    secondResponse.resolve({
      success: true,
      data: {
        details: { 总分: 92, 来源: 'newest' },
        weights: { 成长: 1 },
        dimensions: [{ key: 'growth', score: 92 }],
      },
    })
    await secondRequest

    expect(wrapper.vm.selectedStock).toEqual(secondStock)
    expect(wrapper.vm.scoreDetailCategory).toBe('growth')
    expect(wrapper.vm.scoreDetailData).toEqual({ 总分: 92, 来源: 'newest' })
    expect(wrapper.vm.loadingDetail).toBe(false)

    firstResponse.resolve({
      success: true,
      data: {
        details: { 总分: 11, 来源: 'stale' },
        weights: { 动量: 1 },
        dimensions: [{ key: 'cycle', score: 11 }],
      },
    })
    await firstRequest

    expect(wrapper.vm.selectedStock).toEqual(secondStock)
    expect(wrapper.vm.scoreDetailData).toEqual({ 总分: 92, 来源: 'newest' })
    expect(wrapper.vm.scoreDetailWeights).toEqual({ 成长: 1 })
  })
})
