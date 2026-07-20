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
      top_n_values: [10, 30],
      active_caps: [0.2, 0.35],
      trailing_stop_pcts: [0, 0.12],
      force: true,
      horizon: 15,
      rebalance_interval_days: [15],
      cash_buffer: 0.05,
      initial_capital: 500000,
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
      horizon: 10,
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
