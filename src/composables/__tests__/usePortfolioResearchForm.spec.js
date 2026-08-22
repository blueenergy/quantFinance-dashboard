import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const api = vi.hoisted(() => ({
  createPortfolioResearchJob: vi.fn(),
  rerunPortfolioResearchJob: vi.fn(),
}))

vi.mock('../../api/portfolioResearch', () => api)

import { usePortfolioResearchForm } from '../usePortfolioResearchForm'

function createForm(options = {}) {
  const selectedJob = options.selectedJob || ref(null)
  const selectedJobId = options.selectedJobId || ref('')
  const message = options.message || ref('')
  const errorMessage = options.errorMessage || ref('')
  const loadJobs = options.loadJobs || vi.fn()
  const selectJob = options.selectJob || vi.fn()
  const formApi = usePortfolioResearchForm({
    selectedJob,
    selectedJobId,
    message,
    errorMessage,
    loadJobs,
    selectJob,
  })
  return {
    ...formApi,
    selectedJobId,
    message,
    errorMessage,
    loadJobs,
    selectJob,
  }
}

describe('usePortfolioResearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    api.createPortfolioResearchJob.mockResolvedValue({ data: { job_id: 'job-new' } })
    api.rerunPortfolioResearchJob.mockResolvedValue({ data: { job_id: 'job-rerun' } })
  })

  it('defaults new research to fixed Top N selection', () => {
    const formApi = createForm()
    expect(formApi.form.value).toMatchObject({
      selection_mode: 'fixed_top_n',
      threshold_lookback_days: 10,
      max_positions: 20,
      regime_always_invest: true,
      regime_cash: false,
    })
  })

  it('names new research from the selected score strategy', () => {
    const formApi = createForm()
    expect(formApi.form.value.name).toContain('成长30-动量70加权研究')

    formApi.onDrawerFormUpdate({
      ...formApi.form.value,
      score_mode: 'column',
      score_column: 'fundamental_score',
      score_columns: ['fundamental_score'],
    })
    expect(formApi.form.value.name).toContain('基本面单维研究')

    formApi.onDrawerFormUpdate({
      ...formApi.form.value,
      score_mode: 'column',
      score_columns: ['fundamental_score', 'value_score'],
    })
    expect(formApi.form.value.name).toContain('基本面等2个单维研究')

    formApi.onDrawerFormUpdate({
      ...formApi.form.value,
      score_mode: 'preset',
      score_column: 'composite_conservative_score',
      score_columns: ['composite_conservative_score'],
    })
    expect(formApi.form.value.name).toContain('保守多维组合研究')
  })

  it('does not overwrite a manually edited research name', () => {
    const formApi = createForm()
    formApi.nameTouched.value = true
    formApi.onDrawerFormUpdate({
      ...formApi.form.value,
      name: '我的组合研究',
      score_mode: 'column',
      score_column: 'value_score',
    })
    expect(formApi.form.value.name).toBe('我的组合研究')
  })

  it('builds and submits a create payload through createPortfolioResearchJob', async () => {
    const formApi = createForm()
    formApi.form.value = {
      name: 'Create research',
      universe_index: 'csi500',
      start_date: '2024-01-01',
      end_date: '2025-01-31',
      score_column: 'growth_score',
      growth_cycle_weights: '20:80,40:60',
      top_n_values: '10, 30',
      horizon: '15',
      active_caps: '0.2,0.35',
      trailing_stop_pcts: '0,0.12',
      initial_capital: '500000',
      cash_buffer: '0.05',
    }
    const expectedPayload = {
      name: 'Create research',
      universe_index: 'csi500',
      start_date: '2024-01-01',
      end_date: '2025-01-31',
      score_column: 'growth_score',
      growth_cycle_weights: ['20:80', '40:60'],
      selection_mode: 'fixed_top_n',
      threshold_lookback_days: 10,
      max_positions: 20,
      top_n_values: [10, 30],
      active_caps: [0.2, 0.35],
      trailing_stop_pcts: [0, 0.12],
      force: true,
      horizon: 15,
      rebalance_interval_days: [15],
      cash_buffer: 0.05,
      initial_capital: 500000,
      regime_modes: ['off'],
      regime_cash: false,
    }

    expect(formApi.buildFormPayload()).toEqual(expectedPayload)

    await formApi.submitJobForm()

    expect(api.createPortfolioResearchJob).toHaveBeenCalledWith(expectedPayload)
    expect(api.rerunPortfolioResearchJob).not.toHaveBeenCalled()
    expect(formApi.selectedJobId.value).toBe('job-new')
    expect(formApi.loadJobs).toHaveBeenCalledOnce()
    expect(formApi.selectJob).toHaveBeenCalledWith('job-new', { scrollDetail: true })
  })

  it('selects the created job after a list refresh clears the previous selection', async () => {
    const selectedJobId = ref('job-old')
    const loadJobs = vi.fn(() => {
      selectedJobId.value = ''
    })
    const selectJob = vi.fn()
    const formApi = createForm({ selectedJobId, loadJobs, selectJob })

    await formApi.submitJobForm()

    expect(loadJobs).toHaveBeenCalledOnce()
    expect(selectedJobId.value).toBe('job-new')
    expect(selectJob).toHaveBeenCalledWith('job-new', { scrollDetail: true })
    expect(loadJobs.mock.invocationCallOrder[0]).toBeLessThan(selectJob.mock.invocationCallOrder[0])
  })

  it('submits reruns with formSourceJobId through rerunPortfolioResearchJob', async () => {
    const formApi = createForm()
    formApi.formSourceJobId.value = 'job-source'

    await formApi.submitJobForm()

    expect(api.rerunPortfolioResearchJob).toHaveBeenCalledWith(
      'job-source',
      formApi.buildFormPayload(),
    )
    expect(api.createPortfolioResearchJob).not.toHaveBeenCalled()
    expect(formApi.selectedJobId.value).toBe('job-rerun')
    expect(formApi.selectJob).toHaveBeenCalledWith('job-rerun', { scrollDetail: true })
  })

  it('loads trailing stops and growth-cycle weights from the selected job', () => {
    const selectedJob = ref({
      job_id: 'job-source',
      name: 'Original research',
      params: {
        universe_index: 'a500',
        start_date: '20240102',
        end_date: '2025-02-03T12:00:00Z',
        growth_cycle_weights: ['30:70', '50:50'],
        trailing_stop_pcts: [0, 0.1, 0.2],
        rebalance_interval_days: [10],
        regime_modes: ['bull_g60_else_cash'],
      },
    })
    const formApi = createForm({ selectedJob })

    formApi.loadParamsFromSelectedJob()

    expect(formApi.form.value).toMatchObject({
      name: 'Original research (rerun)',
      universe_index: 'a500',
      start_date: '2024-01-02',
      end_date: '2025-02-03',
      growth_cycle_weights: '30:70,50:50',
      trailing_stop_pcts: '0,0.1,0.2',
      horizon: '10',
      regime_always_invest: false,
      regime_cash: true,
    })
    expect(formApi.formSourceJobId.value).toBe('job-source')
    expect(formApi.drawerMode.value).toBe('rerun')
    expect(formApi.drawerOpen.value).toBe(true)
  })

  it('loads legacy trailing stop and string weights from the selected job', () => {
    const selectedJob = ref({
      job_id: 'job-legacy',
      params: {
        growth_cycle_weights: '40:60',
        trailing_stop_pct: 0.15,
      },
    })
    const formApi = createForm({ selectedJob })

    formApi.form.value.growth_cycle_weights = 'stale'
    formApi.form.value.top_n_values = 'stale'
    formApi.loadParamsFromSelectedJob()

    expect(formApi.form.value.growth_cycle_weights).toBe('40:60')
    expect(formApi.form.value.trailing_stop_pcts).toBe('0.15')
    expect(formApi.form.value.top_n_values).toBe('10,20,50')
    expect(formApi.form.value.selection_mode).toBe('fixed_top_n')
    expect(formApi.form.value.threshold_lookback_days).toBe(10)
    expect(formApi.form.value.max_positions).toBe(20)
  })

  it('hydrates dynamic-threshold parameters for reruns', () => {
    const selectedJob = ref({
      job_id: 'job-dynamic',
      params: {
        selection_mode: 'dynamic_score_threshold',
        threshold_lookback_days: 15,
        max_positions: 30,
        top_n_values: [20],
      },
    })
    const formApi = createForm({ selectedJob })

    formApi.loadParamsFromSelectedJob()

    expect(formApi.form.value).toMatchObject({
      selection_mode: 'dynamic_score_threshold',
      threshold_lookback_days: 15,
      max_positions: 30,
      top_n_values: '20',
    })
  })

  it('loads composite score columns as predefined multi-dimension presets', () => {
    const selectedJob = ref({
      job_id: 'job-preset',
      params: {
        score_specs: [
          { mode: 'column', column: 'composite_defensive_score' },
        ],
      },
    })
    const formApi = createForm({ selectedJob })

    formApi.loadParamsFromSelectedJob()

    expect(formApi.form.value.score_mode).toBe('preset')
    expect(formApi.form.value.score_column).toBe('composite_defensive_score')
    expect(formApi.form.value.score_columns).toEqual(['composite_defensive_score'])
  })

  it('loads multiple column score specs into multi-select form state', () => {
    const selectedJob = ref({
      job_id: 'job-multi-column',
      params: {
        score_specs: [
          { mode: 'column', column: 'fundamental_score' },
          { mode: 'column', column: 'value_score' },
        ],
      },
    })
    const formApi = createForm({ selectedJob })

    formApi.loadParamsFromSelectedJob()

    expect(formApi.form.value.score_mode).toBe('column')
    expect(formApi.form.value.score_columns).toEqual(['fundamental_score', 'value_score'])
  })

  it('loads multiple rebalance intervals into the comma-separated form field', () => {
    const selectedJob = ref({
      job_id: 'job-rebalance',
      params: {
        rebalance_interval_days: [10, 20, 30, 40],
        growth_cycle_weights: ['30:70'],
      },
    })
    const formApi = createForm({ selectedJob })

    formApi.loadParamsFromSelectedJob()

    expect(formApi.form.value.horizon).toBe('10,20,30,40')
  })

  it('focuses the drawer and restores focus when Escape closes it', async () => {
    document.body.innerHTML = `
      <button id="open-drawer">Open</button>
      <div class="drawer-panel"><input id="drawer-input"></div>
    `
    const trigger = document.querySelector('#open-drawer')
    const drawerInput = document.querySelector('#drawer-input')
    trigger.focus()
    const formApi = createForm()
    window.addEventListener('keydown', formApi.onDrawerEscape, true)

    try {
      formApi.openCreateDrawer()
      await nextTick()
      expect(document.activeElement).toBe(drawerInput)

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await nextTick()

      expect(formApi.drawerOpen.value).toBe(false)
      expect(document.activeElement).toBe(trigger)
    } finally {
      window.removeEventListener('keydown', formApi.onDrawerEscape, true)
    }
  })
})
