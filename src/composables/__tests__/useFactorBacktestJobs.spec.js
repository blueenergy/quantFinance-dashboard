import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  listFactorBacktestJobs: vi.fn(),
}))

vi.mock('../../api/factorBacktest', () => api)

import { useFactorBacktestJobs } from '../useFactorBacktestJobs'

function mountJobs(options = {}) {
  let jobsApi
  const Host = defineComponent({
    setup() {
      jobsApi = useFactorBacktestJobs(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get jobsApi() { return jobsApi } }
}

describe('useFactorBacktestJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFactorBacktestJobs.mockResolvedValue({ data: [] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends only the filters that are set', async () => {
    const host = mountJobs()

    await host.jobsApi.loadJobs()
    expect(api.listFactorBacktestJobs).toHaveBeenCalledWith({})

    host.jobsApi.statusFilter.value = 'running'
    host.jobsApi.factorSetFilter.value = 'alpha158'
    host.jobsApi.indexFilter.value = 'hs300'
    await host.jobsApi.loadJobs()

    expect(api.listFactorBacktestJobs).toHaveBeenLastCalledWith({
      status: 'running',
      factor_set: 'alpha158',
      index_code: 'hs300',
    })
    host.wrapper.unmount()
  })

  it('polls while a job is pending or running and stops once none are', async () => {
    vi.useFakeTimers()
    const host = mountJobs()

    host.jobsApi.jobs.value = [{ job_id: 'job-1', status: 'pending' }]
    await nextTick()
    expect(vi.getTimerCount()).toBe(2)

    host.jobsApi.jobs.value = [{ job_id: 'job-1', status: 'completed' }]
    await nextTick()
    expect(vi.getTimerCount()).toBe(0)

    host.wrapper.unmount()
  })

  it('refreshes the list and the open job on each poll tick', async () => {
    vi.useFakeTimers()
    const refreshSelected = vi.fn().mockResolvedValue(undefined)
    const selectedJobId = ref('job-1')
    const selectedJob = ref({ job_id: 'job-1', status: 'running' })
    api.listFactorBacktestJobs.mockResolvedValue({ data: [{ job_id: 'job-1', status: 'running' }] })
    const host = mountJobs({ selectedJobId, selectedJob, refreshSelected })

    await nextTick()
    await vi.advanceTimersByTimeAsync(30000)

    expect(api.listFactorBacktestJobs).toHaveBeenCalled()
    expect(refreshSelected).toHaveBeenCalledWith('job-1')
    host.wrapper.unmount()
  })

  it('keeps polling for a running job that a filter hid from the list', async () => {
    vi.useFakeTimers()
    const selectedJob = ref({ job_id: 'job-1', status: 'running' })
    const host = mountJobs({ selectedJob })

    await nextTick()
    expect(vi.getTimerCount()).toBe(2)
    host.wrapper.unmount()
  })

  it('drops a selection that the reloaded list no longer holds', async () => {
    const selectedJobId = ref('job-1')
    const selectedJob = ref({ job_id: 'job-1', status: 'completed' })
    const report = ref({ rows: 1 })
    api.listFactorBacktestJobs.mockResolvedValue({ data: [{ job_id: 'job-2', status: 'completed' }] })
    const host = mountJobs({ selectedJobId, selectedJob, report })

    await host.jobsApi.loadJobs()

    expect(selectedJobId.value).toBe('')
    expect(selectedJob.value).toBeNull()
    expect(report.value).toBeNull()
    host.wrapper.unmount()
  })

  it('keeps a selection that is still listed and refreshes it in place', async () => {
    const selectedJobId = ref('job-1')
    const selectedJob = ref({ job_id: 'job-1', status: 'running' })
    api.listFactorBacktestJobs.mockResolvedValue({
      data: [{ job_id: 'job-1', status: 'completed', result_id: 'res-1' }],
    })
    const host = mountJobs({ selectedJobId, selectedJob })

    await host.jobsApi.loadJobs()

    expect(selectedJobId.value).toBe('job-1')
    expect(selectedJob.value.status).toBe('completed')
    host.wrapper.unmount()
  })

  it('surfaces the API detail when the list fails', async () => {
    api.listFactorBacktestJobs.mockRejectedValue({ response: { data: { detail: '数据库不可用' } } })
    const host = mountJobs()

    await host.jobsApi.loadJobs()

    expect(host.jobsApi.errorMessage.value).toBe('数据库不可用')
    expect(host.jobsApi.loading.value).toBe(false)
    host.wrapper.unmount()
  })

  it('stops the timers when the page unmounts', async () => {
    vi.useFakeTimers()
    const host = mountJobs()
    host.jobsApi.jobs.value = [{ job_id: 'job-1', status: 'running' }]
    await nextTick()
    expect(vi.getTimerCount()).toBe(2)

    host.wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
