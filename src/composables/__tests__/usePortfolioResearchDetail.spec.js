import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  deletePortfolioResearchJob: vi.fn(),
  getPortfolioResearchJob: vi.fn(),
  getPortfolioResearchResults: vi.fn(),
  getPortfolioResearchResultRows: vi.fn(),
  publishPortfolioResearchResult: vi.fn(),
}))

vi.mock('../../api/portfolioResearch', () => api)

import { usePortfolioResearchDetail } from '../usePortfolioResearchDetail'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function mountDetail(options = {}) {
  let detailApi
  const Host = defineComponent({
    setup() {
      detailApi = usePortfolioResearchDetail(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get detailApi() { return detailApi } }
}

describe('usePortfolioResearchDetail', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.clearAllMocks()
    api.getPortfolioResearchResultRows.mockResolvedValue({ data: { rows: [] } })
  })

  it('discards a slow result response after selecting another job', async () => {
    const slowA = deferred()
    api.getPortfolioResearchJob.mockImplementation((jobId) => Promise.resolve({
      data: { job_id: jobId, status: 'completed', result_id: `result-${jobId}` },
    }))
    api.getPortfolioResearchResults.mockImplementation((jobId) => Promise.resolve({
      data: {
        result_id: `result-${jobId}`,
        rows: [{ combo_key: `preview-${jobId}` }],
        best_row: { combo_key: `best-${jobId}` },
      },
    }))
    api.getPortfolioResearchResultRows.mockImplementation((jobId) => {
      if (jobId === 'job-a') return slowA.promise
      return Promise.resolve({
        data: { rows: [{ combo_key: 'full-b' }], total: 1 },
      })
    })
    const host = mountDetail()

    const selectA = host.detailApi.selectJob('job-a', { scrollDetail: true })
    await vi.waitFor(() => {
      expect(api.getPortfolioResearchResultRows).toHaveBeenCalledWith(
        'job-a',
        { page: 1, page_size: 500 },
      )
    })
    await host.detailApi.selectJob('job-b', { scrollDetail: true })

    slowA.resolve({
      data: { rows: [{ combo_key: 'full-a' }], total: 1 },
    })
    await selectA

    expect(host.detailApi.selectedJobId.value).toBe('job-b')
    expect(host.detailApi.selectedJob.value.job_id).toBe('job-b')
    expect(host.detailApi.resultDetail.value).toMatchObject({
      result_id: 'result-job-b',
      rows: [{ combo_key: 'full-b' }],
      row_count_total: 1,
    })
    expect(api.getPortfolioResearchResultRows).toHaveBeenCalledTimes(2)
    host.wrapper.unmount()
  })

  it('discards a result response after shared selection is cleared externally', async () => {
    const slowRows = deferred()
    api.getPortfolioResearchJob.mockResolvedValue({
      data: { job_id: 'job-a', status: 'completed', result_id: 'result-a' },
    })
    api.getPortfolioResearchResults.mockResolvedValue({
      data: { result_id: 'result-a', rows: [{ combo_key: 'preview-a' }] },
    })
    api.getPortfolioResearchResultRows.mockReturnValue(slowRows.promise)
    const host = mountDetail()

    const selecting = host.detailApi.selectJob('job-a', { scrollDetail: true })
    await vi.waitFor(() => {
      expect(api.getPortfolioResearchResultRows).toHaveBeenCalled()
    })
    host.detailApi.selectedJobId.value = ''
    host.detailApi.selectedJob.value = null
    host.detailApi.resultDetail.value = null

    slowRows.resolve({
      data: { rows: [{ combo_key: 'full-a' }], total: 1 },
    })
    await selecting

    expect(host.detailApi.selectedJob.value).toBeNull()
    expect(host.detailApi.resultDetail.value).toBeNull()
    expect(host.detailApi.selectedResultRow.value).toBeNull()
    host.wrapper.unmount()
  })

  it('reports a result loading error for a completed job without results', async () => {
    const setErrorMessage = vi.fn()
    api.getPortfolioResearchJob.mockResolvedValue({
      data: { job_id: 'job-completed', status: 'completed', result_id: null },
    })
    api.getPortfolioResearchResults.mockRejectedValue({})
    const host = mountDetail({ setErrorMessage })

    await host.detailApi.selectJob('job-completed')

    expect(setErrorMessage).toHaveBeenCalledWith('加载研究结果失败')
    expect(host.detailApi.resultDetail.value).toBeNull()
    host.wrapper.unmount()
  })

  it('marks an already published result as unavailable for re-publish', async () => {
    const host = mountDetail()

    host.detailApi.resultDetail.value = {
      result_id: 'result-1',
      published_preset_id: 'preset-1',
      published_status: 'enabled',
    }
    await flushPromises()

    expect(host.detailApi.hasPublishedPreset.value).toBe(true)
    expect(host.detailApi.publishedPresetLabel.value).toBe('preset-1 (enabled)')
    host.wrapper.unmount()
  })

  it('refreshes the selected detail and jobs after publishing', async () => {
    const loadJobs = vi.fn()
    const setMessage = vi.fn()
    api.publishPortfolioResearchResult.mockResolvedValue({
      data: { attached_to_existing: false, preset: { preset_id: 'preset-1' } },
    })
    api.getPortfolioResearchJob.mockResolvedValue({
      data: { job_id: 'job-1', status: 'completed', result_id: 'result-1' },
    })
    api.getPortfolioResearchResults.mockResolvedValue({
      data: { result_id: 'result-1', published_preset_id: 'preset-1' },
    })
    const host = mountDetail({ loadJobs, setMessage })
    const selectedRow = { combo_key: 'combo-1' }
    host.detailApi.selectedJobId.value = 'job-1'
    host.detailApi.selectedJob.value = { job_id: 'job-1', status: 'completed' }
    host.detailApi.resultDetail.value = { result_id: 'result-1' }
    host.detailApi.selectedResultRow.value = selectedRow

    await host.detailApi.publish('enabled')

    expect(api.publishPortfolioResearchResult).toHaveBeenCalledWith('result-1', {
      status: 'enabled',
      selected_row: selectedRow,
    })
    expect(api.getPortfolioResearchJob).toHaveBeenCalledWith('job-1')
    expect(loadJobs).toHaveBeenCalledOnce()
    expect(setMessage).toHaveBeenCalledWith('已保存参数预设 preset-1')
    host.wrapper.unmount()
  })

  it('keeps a newer selection when deletion finishes and refreshes jobs', async () => {
    const deleting = deferred()
    const loadJobs = vi.fn()
    const setMessage = vi.fn()
    vi.stubGlobal('confirm', vi.fn(() => true))
    api.deletePortfolioResearchJob.mockReturnValue(deleting.promise)
    const host = mountDetail({ loadJobs, setMessage })
    host.detailApi.selectedJobId.value = 'job-a'
    host.detailApi.selectedJob.value = { job_id: 'job-a', name: 'Job A' }
    host.detailApi.resultDetail.value = { result_id: 'result-a' }
    host.detailApi.selectedResultRow.value = { combo_key: 'combo-a' }

    const deletePromise = host.detailApi.deleteJob()
    host.detailApi.selectedJobId.value = 'job-b'
    host.detailApi.selectedJob.value = { job_id: 'job-b', name: 'Job B' }
    host.detailApi.resultDetail.value = { result_id: 'result-b' }
    host.detailApi.selectedResultRow.value = { combo_key: 'combo-b' }
    deleting.resolve({ data: {} })
    await deletePromise

    expect(api.deletePortfolioResearchJob).toHaveBeenCalledWith('job-a')
    expect(host.detailApi.selectedJobId.value).toBe('job-b')
    expect(host.detailApi.resultDetail.value).toEqual({ result_id: 'result-b' })
    expect(host.detailApi.selectedResultRow.value).toEqual({ combo_key: 'combo-b' })
    expect(loadJobs).toHaveBeenCalledOnce()
    expect(setMessage).toHaveBeenCalledWith('已删除研究报告 job-a')
    host.wrapper.unmount()
  })
})
