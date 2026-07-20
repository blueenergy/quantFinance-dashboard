import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  listPortfolioResearchJobs: vi.fn(),
}))

vi.mock('../../api/portfolioResearch', () => api)

import { usePortfolioResearchJobs } from '../usePortfolioResearchJobs'

function mountJobs(options = {}) {
  let jobsApi
  const Host = defineComponent({
    setup() {
      jobsApi = usePortfolioResearchJobs(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get jobsApi() { return jobsApi } }
}

describe('usePortfolioResearchJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listPortfolioResearchJobs.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('passes active filters to listPortfolioResearchJobs', async () => {
    const host = mountJobs()
    host.jobsApi.statusFilter.value = 'running'
    host.jobsApi.universeFilter.value = 'csi1000'
    host.jobsApi.growthCycleWeightFilter.value = ' 30:70 '

    await host.jobsApi.loadJobs()

    expect(api.listPortfolioResearchJobs).toHaveBeenCalledWith({
      status: 'running',
      universe_index: 'csi1000',
      growth_cycle_weight: '30:70',
    })
    host.wrapper.unmount()
  })

  it('clears polling and clock timers when jobs become inactive', async () => {
    vi.useFakeTimers()
    const host = mountJobs()

    host.jobsApi.jobs.value = [{ job_id: 'job-1', status: 'running' }]
    await nextTick()
    expect(vi.getTimerCount()).toBe(2)

    host.jobsApi.jobs.value = [{ job_id: 'job-1', status: 'completed' }]
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)
    host.wrapper.unmount()
  })

  it('keeps timers active while the selected job is active', async () => {
    vi.useFakeTimers()
    const selectedJob = ref({ job_id: 'job-1', status: 'pending' })
    const host = mountJobs({ selectedJob })

    await nextTick()
    expect(host.jobsApi.hasActiveJobs.value).toBe(true)
    expect(vi.getTimerCount()).toBe(2)

    selectedJob.value = { job_id: 'job-1', status: 'completed' }
    await nextTick()
    expect(host.jobsApi.hasActiveJobs.value).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    host.wrapper.unmount()
  })

  it('clears timers when stopped and when the host unmounts', () => {
    vi.useFakeTimers()
    const host = mountJobs()

    host.jobsApi.startActiveJobTimers()
    expect(vi.getTimerCount()).toBe(2)
    host.jobsApi.stopActiveJobTimers()
    expect(vi.getTimerCount()).toBe(0)

    host.jobsApi.startActiveJobTimers()
    expect(vi.getTimerCount()).toBe(2)
    host.wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears selection when the selected job is missing from the list', async () => {
    const selectedJobId = ref('job-missing')
    const selectedJob = ref({ job_id: 'job-missing', status: 'completed' })
    const resultDetail = ref({ result_id: 'result-1' })
    api.listPortfolioResearchJobs.mockResolvedValue({
      data: [{ job_id: 'job-1', status: 'completed' }],
    })
    const host = mountJobs({
      selectedJobId,
      selectedJob,
      resultDetail,
    })

    await host.jobsApi.loadJobs()

    expect(selectedJobId.value).toBe('')
    expect(selectedJob.value).toBeNull()
    expect(resultDetail.value).toBeNull()
    host.wrapper.unmount()
  })

  it('refreshes the selected job after loading the list', async () => {
    const selectedJobId = ref('job-1')
    const selectedJob = ref(null)
    const resultDetail = ref(null)
    const refreshSelected = vi.fn()
    const row = { job_id: 'job-1', status: 'completed' }
    api.listPortfolioResearchJobs.mockResolvedValue({ data: [row] })
    const host = mountJobs({
      selectedJobId,
      selectedJob,
      resultDetail,
      refreshSelected,
    })

    await host.jobsApi.refreshAll()

    expect(selectedJob.value).toEqual(row)
    expect(refreshSelected).toHaveBeenCalledWith('job-1')
    host.wrapper.unmount()
  })
})
