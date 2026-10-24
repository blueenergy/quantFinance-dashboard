import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import {
  buildRankingRequestContext,
  useStockRanking,
} from '../useStockRanking.js'

function deferred() {
  let resolve
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function mountComposable(requestClient) {
  return mount(defineComponent({
    setup() {
      return useStockRanking({
        requestClient,
        dlog: vi.fn(),
        notify: vi.fn(),
      })
    },
    template: '<div />',
  }))
}

describe('useStockRanking', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('drops a stale response after a newer ranking request wins', async () => {
    const first = deferred()
    const second = deferred()
    const requestClient = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
    const wrapper = mountComposable(requestClient)

    const firstRequest = wrapper.vm.fetchRankings()
    await Promise.resolve()
    const firstSignal = requestClient.mock.calls[0][0].signal

    wrapper.vm.viewMode = 'selected'
    wrapper.vm.selectedStocks = ['600519']
    const secondRequest = wrapper.vm.fetchRankings()
    await Promise.resolve()

    expect(firstSignal.aborted).toBe(true)

    second.resolve({
      success: true,
      data: [{ symbol: '600519', name: '贵州茅台', composite_score: 92 }],
    })
    await secondRequest

    first.resolve({
      success: true,
      data: [{ symbol: '000001', name: '平安银行', composite_score: 11 }],
    })
    await firstRequest

    expect(wrapper.vm.rankingDataViewMode).toBe('selected')
    expect(wrapper.vm.rankings).toEqual([
      expect.objectContaining({ symbol: '600519', composite_score: 92 }),
    ])
    wrapper.unmount()
  })

  it('appends SW industry params to ranking requests', async () => {
    const requestClient = vi.fn().mockResolvedValue({ success: true, data: [] })
    const wrapper = mountComposable(requestClient)

    wrapper.vm.industryL1 = '801080.SI'
    await wrapper.vm.fetchRankings()
    const l1Url = requestClient.mock.calls[0][0].url
    expect(l1Url).toContain('industry_level=l1')
    expect(l1Url).toContain('industry=801080.SI')

    wrapper.vm.industryL2 = '801081.SI'
    await wrapper.vm.fetchRankings()
    const l2Url = requestClient.mock.calls[1][0].url
    expect(l2Url).toContain('industry_level=l2')
    expect(l2Url).toContain('industry=801081.SI')

    wrapper.unmount()
  })

  it('builds an immutable request context snapshot', () => {
    const source = {
      viewMode: 'selected',
      displayLimit: 30,
      rankingStrategy: 'balanced',
      sortBy: 'weighted',
      rankingWeights: { growth: 60, cycle: 40 },
      selectedDate: '2026-07-20',
      selectedDates: ['20260720'],
      selectedStocks: ['600519'],
      watchlistSymbols: ['000001'],
      indexSymbols: ['600000.SH'],
      perStockStrategies: { 600519: 'growth_oriented' },
      pageOffset: 30,
      usePagedRankingsFetch: true,
    }

    const snapshot = buildRankingRequestContext(source)
    source.rankingWeights.growth = 1
    source.selectedDates.push('20260719')
    source.selectedStocks.push('000001')
    source.watchlistSymbols.length = 0
    source.indexSymbols[0] = '000001.SZ'
    source.perStockStrategies[600519] = 'balanced'

    expect(snapshot).toMatchObject({
      rankingWeights: { growth: 60, cycle: 40 },
      selectedDates: ['20260720'],
      selectedStocks: ['600519'],
      watchlistSymbols: ['000001'],
      indexSymbols: ['600000.SH'],
      perStockStrategies: { 600519: 'growth_oriented' },
      pageOffset: 30,
      usePagedRankingsFetch: true,
    })
  })
})
