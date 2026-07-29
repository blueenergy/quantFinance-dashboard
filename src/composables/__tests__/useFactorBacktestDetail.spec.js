import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  deleteFactorBacktestJob: vi.fn(),
  getFactorBacktestJob: vi.fn(),
  getFactorBacktestResults: vi.fn(),
}))

vi.mock('../../api/factorBacktest', () => api)

import { useFactorBacktestDetail } from '../useFactorBacktestDetail'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function mountDetail(options = {}) {
  let detail
  const Host = defineComponent({
    setup() {
      detail = useFactorBacktestDetail(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get detail() { return detail } }
}

function completedJob(jobId = 'job-1') {
  return { job_id: jobId, status: 'completed', result_id: `res-${jobId}` }
}

function report(overrides = {}) {
  return {
    factors: {
      alpha1: { 5: { ic: { ic_mean: -0.1 }, quantiles: {} } },
      alpha2: { 5: { ic: { ic_mean: 0.4 }, quantiles: {} } },
    },
    screen: { horizon: 5, ranked: [{ factor: 'alpha2' }, { factor: 'alpha1' }] },
    source: {},
    ...overrides,
  }
}

describe('useFactorBacktestDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads the report and defaults the drill-down to the top screened factor', async () => {
    api.getFactorBacktestJob.mockResolvedValue({ data: completedJob() })
    api.getFactorBacktestResults.mockResolvedValue({ data: { report: report() } })
    const host = mountDetail()

    await host.detail.selectJob('job-1')

    expect(host.detail.selectedFactor.value).toBe('alpha2')
    expect(host.detail.selectedHorizon.value).toBe('5')
    expect(host.detail.icRows.value.map((row) => row.factor)).toEqual(['alpha2', 'alpha1'])
    expect(host.detail.resultLoading.value).toBe(false)
    host.wrapper.unmount()
  })

  it('does not fetch a report for a job that has not produced one', async () => {
    api.getFactorBacktestJob.mockResolvedValue({ data: { job_id: 'job-1', status: 'running' } })
    const host = mountDetail()

    await host.detail.selectJob('job-1')

    expect(api.getFactorBacktestResults).not.toHaveBeenCalled()
    expect(host.detail.report.value).toBeNull()
    host.wrapper.unmount()
  })

  it('ignores a slow response for a job the user already navigated away from', async () => {
    const first = deferred()
    api.getFactorBacktestJob
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ data: completedJob('job-2') })
    api.getFactorBacktestResults.mockResolvedValue({ data: { report: report() } })
    const host = mountDetail()

    const firstSelect = host.detail.selectJob('job-1')
    await host.detail.selectJob('job-2')
    first.resolve({ data: completedJob('job-1') })
    await firstSelect

    expect(host.detail.selectedJobId.value).toBe('job-2')
    expect(host.detail.selectedJob.value.job_id).toBe('job-2')
    host.wrapper.unmount()
  })

  it('reports a failed result load only for a job that claims to be complete', async () => {
    const setErrorMessage = vi.fn()
    api.getFactorBacktestJob.mockResolvedValue({ data: completedJob() })
    api.getFactorBacktestResults.mockRejectedValue({ response: { data: { detail: '结果丢失' } } })
    const host = mountDetail({ setErrorMessage })

    await host.detail.selectJob('job-1')

    expect(setErrorMessage).toHaveBeenCalledWith('结果丢失')
    expect(host.detail.resultLoading.value).toBe(false)
    host.wrapper.unmount()
  })

  it('keeps the drill-down on a factor the refreshed report still has', async () => {
    api.getFactorBacktestJob.mockResolvedValue({ data: completedJob() })
    api.getFactorBacktestResults.mockResolvedValue({ data: { report: report() } })
    const host = mountDetail()

    await host.detail.selectJob('job-1')
    host.detail.selectFactor('alpha1')
    await host.detail.selectJob('job-1')

    expect(host.detail.selectedFactor.value).toBe('alpha1')
    host.wrapper.unmount()
  })

  it('moves the drill-down off a horizon the report does not have', async () => {
    api.getFactorBacktestJob.mockResolvedValue({ data: completedJob() })
    api.getFactorBacktestResults.mockResolvedValue({ data: { report: report() } })
    const host = mountDetail()

    await host.detail.selectJob('job-1')
    host.detail.selectHorizon(99)
    host.detail.syncSelection()

    expect(host.detail.selectedHorizon.value).toBe('5')
    host.wrapper.unmount()
  })

  it('refuses to delete a job the worker may still be holding', async () => {
    api.getFactorBacktestJob.mockResolvedValue({ data: { job_id: 'job-1', status: 'running' } })
    const host = mountDetail()
    await host.detail.selectJob('job-1')

    expect(host.detail.deleteDisabledReason.value).toBe('任务仍在排队或运行中，完成后可删除')
    host.wrapper.unmount()
  })

  it('clears the selection and reloads the list after a delete', async () => {
    const loadJobs = vi.fn().mockResolvedValue(undefined)
    const setMessage = vi.fn()
    api.getFactorBacktestJob.mockResolvedValue({ data: completedJob() })
    api.getFactorBacktestResults.mockResolvedValue({ data: { report: report() } })
    api.deleteFactorBacktestJob.mockResolvedValue({ data: { deleted_jobs: 1 } })
    vi.stubGlobal('confirm', vi.fn(() => true))
    const host = mountDetail({ loadJobs, setMessage })

    await host.detail.selectJob('job-1')
    await host.detail.deleteJob()

    expect(api.deleteFactorBacktestJob).toHaveBeenCalledWith('job-1')
    expect(setMessage).toHaveBeenCalledWith('已删除因子回测 job-1')
    expect(host.detail.selectedJobId.value).toBe('')
    expect(host.detail.report.value).toBeNull()
    expect(loadJobs).toHaveBeenCalled()
    host.wrapper.unmount()
  })

  it('does not call the API when the delete confirm is dismissed', async () => {
    api.getFactorBacktestJob.mockResolvedValue({ data: completedJob() })
    api.getFactorBacktestResults.mockResolvedValue({ data: { report: report() } })
    vi.stubGlobal('confirm', vi.fn(() => false))
    const host = mountDetail()

    await host.detail.selectJob('job-1')
    await host.detail.deleteJob()

    expect(api.deleteFactorBacktestJob).not.toHaveBeenCalled()
    expect(host.detail.selectedJobId.value).toBe('job-1')
    host.wrapper.unmount()
  })
})
