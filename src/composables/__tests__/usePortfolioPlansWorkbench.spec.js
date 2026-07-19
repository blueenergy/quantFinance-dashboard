import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  enqueuePortfolioLlmRisk: vi.fn(),
  generatePortfolioPlan: vi.fn(),
  getPortfolioLlmRiskRun: vi.fn(),
  getPortfolioPlan: vi.fn(),
  getPortfolioPlanExecutions: vi.fn(),
  getPortfolioPlanGenerationTask: vi.fn(),
  getPortfolioPlanGenerationWatermark: vi.fn(),
  getPortfolioPlanLineageEquity: vi.fn(),
  getPortfolioPlanLiveEquity: vi.fn(),
  getPortfolioPlanLiveExecutions: vi.fn(),
  getPortfolioPlanLiveRealtimeEquity: vi.fn(),
  getPortfolioPlanOperationLogs: vi.fn(),
  listLiveTradeExecutions: vi.fn(),
  listLiveTradeSignals: vi.fn(),
  listPortfolioParameterPresets: vi.fn(),
  listPortfolioPlanGenerationTasks: vi.fn(),
  listPortfolioPlans: vi.fn(),
  listPortfolioStrategies: vi.fn(),
  listPortfolioWorkerStatus: vi.fn(),
  listTraderHeartbeats: vi.fn(),
  rerunPortfolioPlanAiRisk: vi.fn(),
}))

const traderApi = vi.hoisted(() => ({
  getSecuritiesAccounts: vi.fn(),
}))

vi.mock('../../api/portfolioPlans', () => api)
vi.mock('../../api/trader', () => traderApi)

import { usePortfolioPlansWorkbench } from '../usePortfolioPlansWorkbench'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function mountWorkbench() {
  let workbench
  const Host = defineComponent({
    setup() {
      workbench = usePortfolioPlansWorkbench()
      return () => null
    },
  })
  const wrapper = mount(Host)
  return { wrapper, get workbench() { return workbench } }
}

describe('usePortfolioPlansWorkbench', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getPortfolioPlanGenerationWatermark.mockResolvedValue({ data: null })
    api.getPortfolioPlanGenerationTask.mockResolvedValue({ data: { status: 'pending' } })
    api.getPortfolioPlanLiveExecutions.mockResolvedValue({ data: { signals: [], executions: [] } })
    api.getPortfolioPlanOperationLogs.mockResolvedValue({ data: [] })
    api.listLiveTradeExecutions.mockResolvedValue({ data: [] })
    api.listLiveTradeSignals.mockResolvedValue({ data: [] })
    api.listPortfolioParameterPresets.mockResolvedValue({ data: [] })
    api.listPortfolioPlanGenerationTasks.mockResolvedValue({ data: [] })
    api.listPortfolioPlans.mockResolvedValue({ data: [] })
    api.listPortfolioStrategies.mockResolvedValue({ data: [] })
    api.listPortfolioWorkerStatus.mockResolvedValue({ data: [] })
    api.listTraderHeartbeats.mockResolvedValue({ data: [] })
    traderApi.getSecuritiesAccounts.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ignores a slow plan response after switching to another plan', async () => {
    const planA = deferred()
    const planB = deferred()
    api.getPortfolioPlan.mockImplementation((planId) => (
      planId === 'plan-a' ? planA.promise : planB.promise
    ))
    const host = mountWorkbench()
    await flushPromises()

    const loadingA = host.workbench.selectPlan('plan-a')
    const loadingB = host.workbench.selectPlan('plan-b')
    planB.resolve({
      data: {
        plan: { plan_id: 'plan-b', status: 'needs_review' },
        execution_mode: 'not_executed',
      },
    })
    await loadingB

    planA.resolve({
      data: {
        plan: { plan_id: 'plan-a', status: 'needs_review' },
        execution_mode: 'not_executed',
      },
    })
    await loadingA

    expect(host.workbench.selectedPlanId.value).toBe('plan-b')
    expect(host.workbench.selectedDetail.value.plan.plan_id).toBe('plan-b')
    host.wrapper.unmount()
  })

  it('clears active polling timers on unmount', async () => {
    vi.useFakeTimers()
    const clearInterval = vi.spyOn(window, 'clearInterval')
    const host = mountWorkbench()
    await flushPromises()

    host.workbench.startGenerationTaskPolling('task-1')
    await flushPromises()
    host.wrapper.unmount()

    expect(clearInterval).toHaveBeenCalledTimes(2)
  })

  it('keeps monitor and operation account selections independent', async () => {
    traderApi.getSecuritiesAccounts.mockResolvedValue([{ id: 'account-1' }])
    const host = mountWorkbench()
    await flushPromises()

    expect(host.workbench.monitorAccountId.value).toBe('')
    expect(host.workbench.operationAccountId.value).toBe('account-1')

    api.listLiveTradeSignals.mockClear()
    host.workbench.monitorAccountId.value = 'account-monitor'
    await host.workbench.loadLiveOps('')

    expect(api.listLiveTradeSignals).toHaveBeenCalledWith({
      limit: 20,
      securities_account_id: 'account-monitor',
    })
    expect(host.workbench.operationAccountId.value).toBe('account-1')
    host.wrapper.unmount()
  })
})
