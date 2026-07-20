import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, shallowMount } from '@vue/test-utils'

const apiMocks = vi.hoisted(() => ({
  createPortfolioResearchJob: vi.fn(),
  deletePortfolioResearchJob: vi.fn(),
  getPortfolioResearchComboDetail: vi.fn(),
  getPortfolioResearchJob: vi.fn(),
  getPortfolioResearchResults: vi.fn(),
  getPortfolioResearchResultRows: vi.fn(),
  listPortfolioResearchJobs: vi.fn(),
  publishPortfolioResearchResult: vi.fn(),
  rerunPortfolioResearchJob: vi.fn(),
}))

vi.mock('../src/api/portfolioResearch', () => apiMocks)

import PortfolioResearch from '../src/views/PortfolioResearch.vue'

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('PortfolioResearch combo detail requests', () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
    apiMocks.listPortfolioResearchJobs.mockResolvedValue({ data: [] })
  })

  it('keeps the newest combo when an older request resolves last', async () => {
    const wrapper = shallowMount(PortfolioResearch)
    await flushPromises()
    wrapper.vm.selectedJobId = 'job-1'

    const firstResponse = deferred()
    const secondResponse = deferred()
    apiMocks.getPortfolioResearchComboDetail
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)

    const firstRequest = wrapper.vm.openComboDetail({ combo_key: 'combo-a' })
    const secondRequest = wrapper.vm.openComboDetail({ combo_key: 'combo-b' })

    const newestDetail = { meta: { combo_key: 'combo-b' }, summary: { sharpe: 2 } }
    secondResponse.resolve(newestDetail)
    await secondRequest

    expect(wrapper.vm.comboDetail).toEqual(newestDetail)
    expect(wrapper.vm.comboContextRow.combo_key).toBe('combo-b')
    expect(wrapper.vm.comboLoading).toBe(false)

    firstResponse.resolve({ meta: { combo_key: 'combo-a' }, summary: { sharpe: 1 } })
    await firstRequest

    expect(wrapper.vm.comboDetail).toEqual(newestDetail)
    expect(wrapper.vm.comboContextRow.combo_key).toBe('combo-b')
  })

  it('keeps loading while the current request is still pending', async () => {
    const wrapper = shallowMount(PortfolioResearch)
    await flushPromises()
    wrapper.vm.selectedJobId = 'job-1'

    const firstResponse = deferred()
    const secondResponse = deferred()
    apiMocks.getPortfolioResearchComboDetail
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)

    const firstRequest = wrapper.vm.openComboDetail({ combo_key: 'combo-a' })
    const secondRequest = wrapper.vm.openComboDetail({ combo_key: 'combo-b' })

    firstResponse.resolve({ meta: { combo_key: 'combo-a' } })
    await firstRequest

    expect(wrapper.vm.comboDetail).toBeNull()
    expect(wrapper.vm.comboLoading).toBe(true)

    const newestDetail = { meta: { combo_key: 'combo-b' } }
    secondResponse.resolve(newestDetail)
    await secondRequest

    expect(wrapper.vm.comboDetail).toEqual(newestDetail)
    expect(wrapper.vm.comboLoading).toBe(false)
  })

  it('invalidates an in-flight request when the modal closes', async () => {
    const wrapper = shallowMount(PortfolioResearch)
    await flushPromises()
    wrapper.vm.selectedJobId = 'job-1'

    const response = deferred()
    apiMocks.getPortfolioResearchComboDetail.mockImplementationOnce(() => response.promise)

    const request = wrapper.vm.openComboDetail({ combo_key: 'combo-a' })
    wrapper.vm.closeComboDetail()

    expect(wrapper.vm.comboModalOpen).toBe(false)
    expect(wrapper.vm.comboLoading).toBe(false)
    expect(wrapper.vm.comboDetail).toBeNull()
    expect(wrapper.vm.comboContextRow).toBeNull()

    response.resolve({ meta: { combo_key: 'combo-a' }, summary: { sharpe: 1 } })
    await request

    expect(wrapper.vm.comboLoading).toBe(false)
    expect(wrapper.vm.comboDetail).toBeNull()
    expect(wrapper.vm.comboContextRow).toBeNull()
  })
})
