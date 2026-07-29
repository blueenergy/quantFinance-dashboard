import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  createFactorBacktestJob: vi.fn(),
  deleteFactorBacktestJob: vi.fn(),
  getFactorBacktestJob: vi.fn(),
  getFactorBacktestResults: vi.fn(),
  listFactorBacktestJobs: vi.fn(),
  listFactorCatalog: vi.fn(),
}))

vi.mock('../src/api/factorBacktest', () => api)

import FactorBacktest from '../src/views/FactorBacktest.vue'

const RUNNING_JOB = {
  job_id: 'job-1',
  name: '中证1000 alpha8',
  status: 'running',
  factor_set: 'alpha8',
  index_code: 'csi1000',
  start_date: '20230101',
  end_date: '20231231',
  progress_stage: 'screening_ic',
  progress_message: 'rank IC screen at 20d over 158 factors',
  created_at: '2026-01-02T00:00:00',
  started_at: '2026-01-02T00:00:00',
  params: {
    index_code: 'csi1000',
    start_date: '20230101',
    end_date: '20231231',
    factor_set: 'alpha8',
    horizons: [1, 5],
    top_k: [20],
    quantiles: 5,
    min_names: 30,
    screen_top: 20,
    turnover: 1,
    slippage_bps: 10,
  },
}

describe('FactorBacktest view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listFactorBacktestJobs.mockResolvedValue({ data: [] })
    api.listFactorCatalog.mockResolvedValue({
      data: [{ factor_set: 'alpha8', factors: [{ name: 'alpha1', family: 'K线形态', description: '实体涨跌幅' }] }],
    })
  })

  it('loads the job list on mount and prompts for a selection', async () => {
    const wrapper = mount(FactorBacktest)
    await flushPromises()

    expect(api.listFactorBacktestJobs).toHaveBeenCalled()
    expect(wrapper.text()).toContain('因子回测')
    expect(wrapper.text()).toContain('请选择一个因子回测任务')
    wrapper.unmount()
  })

  it('shows the stage bar and the worker message for the running job it opens', async () => {
    api.listFactorBacktestJobs.mockResolvedValue({ data: [RUNNING_JOB] })
    api.getFactorBacktestJob.mockResolvedValue({ data: RUNNING_JOB })
    const wrapper = mount(FactorBacktest)
    await flushPromises()

    await wrapper.find('.job-row').trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('阶段 4/6 · IC 初筛')
    expect(text).toContain('rank IC screen at 20d over 158 factors')
    expect(text).toContain('中证1000')
    expect(api.getFactorBacktestResults).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('renders the report of a completed job', async () => {
    const completed = { ...RUNNING_JOB, status: 'completed', result_id: 'res-1', progress_stage: 'cost_adjustment' }
    api.listFactorBacktestJobs.mockResolvedValue({ data: [completed] })
    api.getFactorBacktestJob.mockResolvedValue({ data: completed })
    api.getFactorBacktestResults.mockResolvedValue({
      data: {
        report: {
          rows: 72000,
          distinct_dates: 240,
          symbols: 300,
          evaluated_columns: 1,
          score_date_range: ['20230103', '20231229'],
          factors: { alpha1: { 5: { ic: { ic_mean: -0.11 }, quantiles: {} } } },
          screen: { horizon: 5, ranked: [{ factor: 'alpha1', ic_mean: -0.11 }] },
          source: { point_in_time_universe: true },
          net_returns: [],
          factor_meta: [{ name: 'alpha1', family: 'K线形态', description: '实体涨跌幅' }],
        },
      },
    })
    const wrapper = mount(FactorBacktest)
    await flushPromises()

    await wrapper.find('.job-row').trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('因子 IC 排行')
    expect(text).toContain('alpha1 · 5d 诊断')
    expect(text).toContain('72,000')
    expect(text).toContain('Point-in-time（当时成分股）')
    wrapper.unmount()
  })

  it('explains a failed job and blocks deleting one that is still running', async () => {
    const failed = {
      ...RUNNING_JOB,
      status: 'failed',
      error_kind: 'invalid_request',
      error_message: 'min_names 4 cannot fill 5 quantile buckets',
    }
    api.listFactorBacktestJobs.mockResolvedValue({ data: [failed, RUNNING_JOB] })
    api.getFactorBacktestJob.mockResolvedValue({ data: failed })
    const wrapper = mount(FactorBacktest)
    await flushPromises()

    await wrapper.findAll('.job-row')[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('min_names 4 cannot fill 5 quantile buckets')
    expect(wrapper.text()).toContain('参数被 worker 拒绝')
    expect(wrapper.find('.danger-btn').attributes('disabled')).toBeUndefined()

    api.getFactorBacktestJob.mockResolvedValue({ data: RUNNING_JOB })
    await wrapper.findAll('.job-row')[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('.danger-btn').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('opens the drawer with the catalog and submits a new job', async () => {
    api.createFactorBacktestJob.mockResolvedValue({ data: { job_id: 'job-9' } })
    api.getFactorBacktestJob.mockResolvedValue({ data: { ...RUNNING_JOB, job_id: 'job-9', status: 'pending' } })
    const wrapper = mount(FactorBacktest)
    await flushPromises()

    await wrapper.findAll('.header-actions button')[0].trigger('click')
    await flushPromises()

    expect(api.listFactorCatalog).toHaveBeenCalledWith({ factor_set: 'alpha8' })
    expect(wrapper.find('.drawer-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('实体涨跌幅')

    await wrapper.findAll('.factor-option input')[0].trigger('change')
    await wrapper.findAll('.drawer-footer button')[1].trigger('click')
    await flushPromises()

    expect(api.createFactorBacktestJob).toHaveBeenCalledWith(
      expect.objectContaining({ factors: ['alpha1'], factor_set: 'alpha8', index_code: 'csi1000' }),
    )
    expect(wrapper.find('.drawer-panel').exists()).toBe(false)
    expect(wrapper.text()).toContain('已提交因子回测 job-9')
    wrapper.unmount()
  })

  it('prefills the drawer from the open job for a rerun', async () => {
    api.listFactorBacktestJobs.mockResolvedValue({ data: [RUNNING_JOB] })
    api.getFactorBacktestJob.mockResolvedValue({ data: RUNNING_JOB })
    const wrapper = mount(FactorBacktest)
    await flushPromises()
    await wrapper.find('.job-row').trigger('click')
    await flushPromises()

    await wrapper.findAll('.detail-actions button')[0].trigger('click')
    await flushPromises()

    const dates = wrapper.findAll('.drawer-panel input[type="date"]')
    expect(dates[0].element.value).toBe('2023-01-01')
    expect(dates[1].element.value).toBe('2023-12-31')
    const nameInput = wrapper.find('.drawer-panel .form-grid input')
    expect(nameInput.element.value).toBe('中证1000 alpha8 重跑')
    wrapper.unmount()
  })
})
