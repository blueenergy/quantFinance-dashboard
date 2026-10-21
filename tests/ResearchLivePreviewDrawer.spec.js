import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const apiMocks = vi.hoisted(() => ({
  createPortfolioResearchLivePreview: vi.fn(),
  getPortfolioResearchLivePreview: vi.fn(),
  activatePortfolioResearchLivePreview: vi.fn(),
  cancelPortfolioResearchActivation: vi.fn(),
}))

vi.mock('../src/api/portfolioResearch', () => apiMocks)

import ResearchLivePreviewDrawer from '../src/components/portfolio/ResearchLivePreviewDrawer.vue'

function previewResult(parityStatus, unsupportedFeatures = []) {
  return {
    data: {
      task_id: 'task-1',
      status: 'completed',
      result: {
        plan: {
          plan_id: 'preview-plan',
          status: 'needs_review',
          summary: { target_top_n: 20, target_amount_per_position: 48500, equity: 1000000 },
          next_rebalance_date: '20261118',
          regime_cash: { action: 'invest' },
        },
        items: [],
        suggested_effective_date: '20261118',
        parity: {
          status: parityStatus,
          checked_dates: 2,
          matched_dates: parityStatus === 'clean' ? 2 : 0,
          backfilled_dates: 0,
          unexplained_dates: parityStatus === 'clean' ? 0 : 2,
          dates: [
            {
              score_date: '20261001',
              status: parityStatus === 'clean' ? 'match' : 'selection_diff',
              research_symbols: ['600000.SH'],
              live_symbols: ['600000.SH'],
              research_only: parityStatus === 'clean' ? [] : ['000001.SZ'],
              live_only: [],
              overlap: 1,
            },
          ],
        },
      },
      unsupported_features: unsupportedFeatures,
    },
  }
}

async function mountDrawer() {
  apiMocks.createPortfolioResearchLivePreview.mockResolvedValue({ data: { task_id: 'task-1' } })
  const wrapper = mount(ResearchLivePreviewDrawer, {
    props: {
      open: true,
      resultId: 'result-1',
      row: { combo_key: 'combo-1' },
      num: (value) => String(value ?? '-'),
    },
  })
  await flushPromises()
  await vi.advanceTimersByTimeAsync(1300)
  await flushPromises()
  return wrapper
}

describe('ResearchLivePreviewDrawer activation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.values(apiMocks).forEach((mock) => mock.mockReset())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('blocks activation on unexplained parity differences until override', async () => {
    apiMocks.getPortfolioResearchLivePreview.mockResolvedValue(previewResult('diff'))
    apiMocks.activatePortfolioResearchLivePreview.mockResolvedValue({
      data: {
        activation: { activation_id: 'act-1', status: 'scheduled', effective_date: '20261118' },
        preset: { preset_id: 'preset-1' },
        parity: { status: 'diff' },
        applied_now: false,
      },
    })
    const wrapper = await mountDrawer()

    expect(wrapper.text()).toContain('有未解释差异')
    const button = wrapper.get('.activate-btn')
    expect(button.attributes('disabled')).toBeDefined()

    await wrapper.get('.override input').setValue(true)
    expect(wrapper.get('.activate-btn').attributes('disabled')).toBeUndefined()
    await wrapper.get('.activate-btn').trigger('click')
    await flushPromises()

    expect(apiMocks.activatePortfolioResearchLivePreview).toHaveBeenCalledWith('task-1', {
      execution_venue: 'paper',
      effective_date: '20261118',
      admin_override: true,
      comment: '',
    })
    expect(wrapper.text()).toContain('act-1')
  })

  it('blocks unsupported research features even when parity is clean', async () => {
    apiMocks.getPortfolioResearchLivePreview.mockResolvedValue(
      previewResult('clean', ['intra_period_cash']),
    )
    const wrapper = await mountDrawer()

    expect(wrapper.text()).toContain('实盘未实现的功能')
    expect(wrapper.text()).toContain('intra_period_cash')
    expect(wrapper.get('.activate-btn').attributes('disabled')).toBeDefined()
  })

  it('hydrates an existing scheduled activation when the drawer reopens', async () => {
    const response = previewResult('clean')
    response.data.activation = {
      activation_id: 'act-existing',
      status: 'scheduled',
      effective_date: '20261118',
      preset_id: 'preset-x',
      parity: { status: 'clean' },
      advisory_plan_id: 'preview-plan',
    }
    apiMocks.getPortfolioResearchLivePreview.mockResolvedValue(response)
    const wrapper = await mountDrawer()

    expect(wrapper.text()).toContain('act-existing')
    expect(wrapper.text()).toContain('取消激活')
    expect(wrapper.find('.activate-btn').exists()).toBe(false)
  })

  it('cancels a scheduled activation from the drawer', async () => {
    apiMocks.getPortfolioResearchLivePreview.mockResolvedValue(previewResult('clean'))
    apiMocks.activatePortfolioResearchLivePreview.mockResolvedValue({
      data: {
        activation: { activation_id: 'act-2', status: 'scheduled', effective_date: '20261118' },
        preset: { preset_id: 'preset-1' },
        parity: { status: 'clean' },
        applied_now: false,
      },
    })
    apiMocks.cancelPortfolioResearchActivation.mockResolvedValue({ data: { status: 'cancelled' } })
    const wrapper = await mountDrawer()

    await wrapper.get('.activate-btn').trigger('click')
    await flushPromises()
    await wrapper.get('.cancel-btn').trigger('click')
    await flushPromises()

    expect(apiMocks.cancelPortfolioResearchActivation).toHaveBeenCalledWith('act-2')
    expect(wrapper.text()).toContain('cancelled')
  })
})
