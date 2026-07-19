import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  enqueuePortfolioLlmRisk: vi.fn(),
  forceRebalanceLineage: vi.fn(),
  getLineagePaperExecutions: vi.fn(),
  getLineagePaperPositions: vi.fn(),
  getPortfolioLlmRiskRun: vi.fn(),
  getPortfolioPlan: vi.fn(),
  getPortfolioPlanGenerationTask: vi.fn(),
  getPortfolioPlanLineageEquity: vi.fn(),
  getPortfolioPlanLineageTimeline: vi.fn(),
  getPortfolioPlanLiveSummary: vi.fn(),
  getPortfolioPlanSummary: vi.fn(),
  listPortfolios: vi.fn(),
  rerunPortfolioPlanAiRisk: vi.fn(),
  resumePortfolioLineage: vi.fn(),
}))

const traderApi = vi.hoisted(() => ({
  getSecuritiesAccounts: vi.fn(),
}))

vi.mock('../../api/portfolioPlans', () => api)
vi.mock('../../api/trader', () => traderApi)

import { usePortfolioOverviewWorkbench } from '../usePortfolioOverviewWorkbench'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function portfolio(suffix) {
  return {
    strategy_template_id: `strategy-${suffix}`,
    params_hash: `hash-${suffix}`,
    latest_plan_id: `plan-${suffix}`,
    execution_venue: 'paper',
  }
}

function mountWorkbench(options) {
  let workbench
  const Host = defineComponent({
    setup() {
      workbench = usePortfolioOverviewWorkbench(options)
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get workbench() { return workbench } }
}

describe('usePortfolioOverviewWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listPortfolios.mockResolvedValue({ data: { portfolios: [portfolio('a'), portfolio('b')] } })
    api.getPortfolioPlan.mockImplementation((planId) => Promise.resolve({
      data: { plan: { plan_id: planId, status: 'needs_review' }, items: [] },
    }))
    api.getPortfolioPlanLineageTimeline.mockImplementation((planId) => Promise.resolve({
      data: { operation_plan: { plan_id: planId }, marker: planId },
    }))
    api.getPortfolioPlanSummary.mockImplementation((planId) => Promise.resolve({
      data: { marker: planId },
    }))
    api.getPortfolioPlanLineageEquity.mockResolvedValue({ data: { rows: [] } })
    api.getLineagePaperPositions.mockResolvedValue({ data: { positions: [], summary: {} } })
    api.getLineagePaperExecutions.mockResolvedValue({ data: { trades: [] } })
    api.getPortfolioPlanGenerationTask.mockResolvedValue({ data: { status: 'pending' } })
    api.getPortfolioLlmRiskRun.mockResolvedValue({ data: { status: 'pending' } })
    traderApi.getSecuritiesAccounts.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not let a slow portfolio A response overwrite portfolio B', async () => {
    const timelineA = deferred()
    api.getPortfolioPlanLineageTimeline.mockImplementation((planId) => (
      planId === 'plan-a'
        ? timelineA.promise
        : Promise.resolve({
            data: { operation_plan: { plan_id: planId }, marker: planId },
          })
    ))
    const host = mountWorkbench()
    await flushPromises()

    host.workbench.selectedPortfolioKey.value = 'strategy-a:hash-a'
    await nextTick()
    host.workbench.selectedPortfolioKey.value = 'strategy-b:hash-b'
    await nextTick()
    await flushPromises()

    expect(host.workbench.timelineData.value.marker).toBe('plan-b')
    expect(host.workbench.latestPlanDetail.value.plan.plan_id).toBe('plan-b')
    expect(host.workbench.portfolioSummary.value.marker).toBe('plan-b')

    timelineA.resolve({
      data: { operation_plan: { plan_id: 'plan-a' }, marker: 'plan-a' },
    })
    await flushPromises()

    expect(host.workbench.selectedPortfolioKey.value).toBe('strategy-b:hash-b')
    expect(host.workbench.timelineData.value.marker).toBe('plan-b')
    expect(host.workbench.latestPlanDetail.value.plan.plan_id).toBe('plan-b')
    expect(host.workbench.portfolioSummary.value.marker).toBe('plan-b')
    host.wrapper.unmount()
  })

  it('does not let an older refresh overwrite a newer refresh for one lineage', async () => {
    const olderTimeline = deferred()
    api.getPortfolioPlanLineageTimeline
      .mockReturnValueOnce(olderTimeline.promise)
      .mockResolvedValue({
        data: { operation_plan: { plan_id: 'plan-a' }, marker: 'newer' },
      })
    const host = mountWorkbench()
    await flushPromises()

    host.workbench.selectedPortfolioKey.value = 'strategy-a:hash-a'
    await nextTick()
    await vi.waitFor(() => {
      expect(api.getPortfolioPlanLineageTimeline).toHaveBeenCalledTimes(1)
    })

    await host.workbench.refreshDetail()
    expect(host.workbench.timelineData.value.marker).toBe('newer')

    olderTimeline.resolve({
      data: { operation_plan: { plan_id: 'plan-a' }, marker: 'older' },
    })
    await flushPromises()

    expect(host.workbench.timelineData.value.marker).toBe('newer')
    host.wrapper.unmount()
  })

  it('ignores an older portfolio list response and post-unmount detail work', async () => {
    const olderList = deferred()
    const newerList = deferred()
    const timeline = deferred()
    const onDetailLoaded = vi.fn()
    const host = mountWorkbench({ onDetailLoaded })
    await flushPromises()

    api.listPortfolios
      .mockImplementationOnce(() => olderList.promise)
      .mockImplementationOnce(() => newerList.promise)
    const olderRequest = host.workbench.loadPortfolios()
    const newerRequest = host.workbench.loadPortfolios()
    newerList.resolve({ data: { portfolios: [portfolio('b')] } })
    await newerRequest

    expect(host.workbench.portfolios.value).toEqual([portfolio('b')])
    expect(host.workbench.loadingList.value).toBe(false)

    olderList.resolve({ data: { portfolios: [portfolio('a')] } })
    await olderRequest
    expect(host.workbench.portfolios.value).toEqual([portfolio('b')])

    api.getPortfolioPlanLineageTimeline.mockReturnValueOnce(timeline.promise)
    host.workbench.selectedPortfolioKey.value = 'strategy-b:hash-b'
    await nextTick()
    host.wrapper.unmount()

    timeline.resolve({
      data: { operation_plan: { plan_id: 'plan-b' }, marker: 'plan-b' },
    })
    await flushPromises()

    expect(onDetailLoaded).not.toHaveBeenCalled()
    expect(host.workbench.timelineData.value).toBeNull()
  })

  it('stops active polling and clears timers on switch and unmount', async () => {
    vi.useFakeTimers()
    const host = mountWorkbench()
    await flushPromises()
    host.workbench.selectedPortfolioKey.value = 'strategy-a:hash-a'
    await nextTick()
    await flushPromises()

    const portfolioAPolling = host.workbench.pollLlmRiskRun(
      'plan-a',
      'run-a',
      { intervalMs: 60_000 },
    )
    await flushPromises()
    expect(vi.getTimerCount()).toBe(1)

    host.workbench.selectedPortfolioKey.value = 'strategy-b:hash-b'
    await nextTick()
    await flushPromises()

    expect(vi.getTimerCount()).toBe(0)
    await expect(portfolioAPolling).resolves.toEqual({ cancelled: true })

    const portfolioBPolling = host.workbench.pollLlmRiskRun(
      'plan-b',
      'run-b',
      { intervalMs: 60_000 },
    )
    await flushPromises()
    expect(vi.getTimerCount()).toBe(1)

    host.wrapper.unmount()

    expect(vi.getTimerCount()).toBe(0)
    await expect(portfolioBPolling).resolves.toEqual({ cancelled: true })
  })
})
