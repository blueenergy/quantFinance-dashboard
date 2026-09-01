import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const api = vi.hoisted(() => ({
  enqueuePortfolioBenchRisk: vi.fn(),
  enqueuePortfolioHoldingsRisk: vi.fn(),
  enqueuePortfolioLlmRisk: vi.fn(),
  getPortfolioLlmRiskRun: vi.fn(),
  getPortfolioPlanBench: vi.fn(),
  liveRebalancePortfolio: vi.fn(),
  paperRebalancePortfolio: vi.fn(),
  reconcilePortfolioHoldings: vi.fn(),
  recordExternalManualRecord: vi.fn(),
}))

vi.mock('../../api/portfolioPlans', () => api)

import { useHoldingsOps } from '../useHoldingsOps'

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function setupHarness(overrides = {}) {
  const selectedLatestPlanId = ref('plan-a')
  const benchPlanId = ref('plan-a')
  const messages = []
  const pollGenerationTask = vi.fn().mockResolvedValue({ cancelled: true })
  const holdingsOps = useHoldingsOps({
    selectedPortfolio: ref({ latest_plan_id: 'plan-a' }),
    selectedLatestPlanId,
    benchPlanId,
    isLivePortfolio: ref(false),
    positionRows: ref([]),
    tradeRows: ref([]),
    pollGenerationTask,
    onRefresh: vi.fn(),
    onMessage: (text, isError) => messages.push({ text, isError }),
    ...overrides,
  })
  return {
    selectedLatestPlanId,
    benchPlanId,
    messages,
    pollGenerationTask,
    ...holdingsOps,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.enqueuePortfolioHoldingsRisk.mockResolvedValue({
    data: { task_id: 'holdings-task', paused: false },
  })
  api.enqueuePortfolioBenchRisk.mockResolvedValue({
    data: { task_id: 'bench-task' },
  })
})

describe('useHoldingsOps race handling', () => {
  it('ignores cancelled holdings and bench risk polls without crashing', async () => {
    const harness = setupHarness()

    await expect(harness.loadHoldingsRisk()).resolves.toBeUndefined()
    await expect(harness.loadBenchRisk()).resolves.toBeUndefined()

    expect(harness.holdingsRisk.value).toBeNull()
    expect(harness.benchRisk.value).toBeNull()
    expect(harness.riskLoading.value).toBe(false)
    expect(harness.benchRiskLoading.value).toBe(false)
    expect(harness.messages).toEqual([
      { text: '', isError: false },
    ])
  })

  it('does not let a stale loadBench response overwrite the new plan', async () => {
    const planAResponse = deferred()
    api.getPortfolioPlanBench.mockImplementation((planId) => (
      planId === 'plan-a'
        ? planAResponse.promise
        : Promise.resolve({ data: { marker: planId } })
    ))
    const harness = setupHarness()

    const loadPlanA = harness.loadBench()
    harness.benchPlanId.value = 'plan-b'
    await harness.loadBench()

    expect(harness.benchData.value).toEqual({ marker: 'plan-b' })

    planAResponse.resolve({ data: { marker: 'plan-a' } })
    await loadPlanA

    expect(harness.benchData.value).toEqual({ marker: 'plan-b' })
    expect(harness.benchLoading.value).toBe(false)
  })

  it('clears visible bench loading after a silent refresh supersedes it', async () => {
    const visibleResponse = deferred()
    const silentResponse = deferred()
    api.getPortfolioPlanBench
      .mockReturnValueOnce(visibleResponse.promise)
      .mockReturnValueOnce(silentResponse.promise)
    const harness = setupHarness()

    const visibleLoad = harness.loadBench()
    expect(harness.benchLoading.value).toBe(true)
    const silentLoad = harness.loadBench({ resetRisk: false, silent: true })

    silentResponse.resolve({ data: { marker: 'silent-newer' } })
    await silentLoad
    visibleResponse.resolve({ data: { marker: 'visible-older' } })
    await visibleLoad

    expect(harness.benchData.value).toEqual({ marker: 'silent-newer' })
    expect(harness.benchLoading.value).toBe(false)
  })

  it('clears visible bench loading when the parent refresh is superseded', async () => {
    const response = deferred()
    let parentCurrent = true
    api.getPortfolioPlanBench.mockReturnValueOnce(response.promise)
    const harness = setupHarness()

    const load = harness.loadBench({ isCurrent: () => parentCurrent })
    expect(harness.benchLoading.value).toBe(true)
    parentCurrent = false
    response.resolve({ data: { marker: 'stale' } })
    await load

    expect(harness.benchData.value).toBeNull()
    expect(harness.benchLoading.value).toBe(false)
  })

  it('surfaces dropped reductions in the live rebalance toast', async () => {
    api.liveRebalancePortfolio.mockResolvedValue({
      data: {
        manual_action: 'liquidate',
        changed_symbols: ['600000.SH'],
        inserted_count: 1,
        dropped_targets: [
          {
            symbol: '000001.SZ',
            reason_code: 'account_position_not_sellable',
            current_shares: 300,
            requested_target_shares: 0,
            account_available_shares: 0,
          },
        ],
        capped_symbols: ['600000.SH'],
      },
    })
    const harness = setupHarness({
      selectedPortfolio: ref({ latest_plan_id: 'plan-a', securities_account_id: 'acct-1' }),
      isLivePortfolio: ref(true),
    })
    harness.liquidateTargets.value = ['600000.SH', '000001.SZ']

    await harness.submitLiveLiquidate()

    const toast = harness.messages.at(-1)
    // A reduction the broker refused must not read as a clean success.
    expect(toast.isError).toBe(true)
    expect(toast.text).toContain('000001.SZ(account_position_not_sellable)')
    expect(toast.text).toContain('按账户可卖量缩量')
  })

  it('carries dropped targets into the fast action preview', async () => {
    api.liveRebalancePortfolio.mockResolvedValue({
      data: {
        items: [],
        signals: [],
        dropped_targets: [
          {
            symbol: '000001.SZ',
            reason_code: 'sell_capped_to_zero',
            current_shares: 300,
            requested_target_shares: 0,
            account_available_shares: 0,
          },
        ],
        capped_symbols: [],
      },
    })
    const harness = setupHarness({
      selectedPortfolio: ref({ latest_plan_id: 'plan-a', securities_account_id: 'acct-1' }),
      isLivePortfolio: ref(true),
    })

    harness.openQuickReduceModal({ symbol: '000001.SZ', name: '平安银行', shares: 300 }, 0)

    await vi.waitFor(() => expect(harness.fastActionPreview.value.droppedTargets).toHaveLength(1))
    expect(harness.fastActionPreview.value.droppedTargets[0].reason_code).toBe('sell_capped_to_zero')
    expect(harness.fastActionPreview.value.items).toEqual([])
  })

  it('ignores stale bench risk results after the plan changes', async () => {
    let resolvePoll
    const pollGenerationTask = vi.fn(() => new Promise((resolve) => {
      resolvePoll = resolve
    }))
    const harness = setupHarness({ pollGenerationTask })

    const loadRisk = harness.loadBenchRisk()
    await vi.waitFor(() => expect(pollGenerationTask).toHaveBeenCalledWith('bench-task'))

    harness.benchPlanId.value = 'plan-b'
    harness.resetHoldingsOpsState()
    resolvePoll({ status: 'completed', result: { marker: 'plan-a' } })
    await loadRisk

    expect(harness.benchRisk.value).toBeNull()
    expect(harness.benchRiskLoading.value).toBe(false)
    expect(harness.messages.some(({ isError }) => isError)).toBe(false)
  })
})
