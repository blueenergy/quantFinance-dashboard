import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const api = vi.hoisted(() => ({
  approvePortfolioPlan: vi.fn(),
  cancelPortfolioPlan: vi.fn(),
  executePortfolioPlanPaper: vi.fn(),
  publishPortfolioPlanLiveSignals: vi.fn(),
  rejectPortfolioPlan: vi.fn(),
  replanPortfolioPlanRemainder: vi.fn(),
}))

vi.mock('../../api/portfolioPlans', () => api)

import { usePlanOps } from '../usePlanOps'

function createPlanOps() {
  const onRefresh = vi.fn().mockResolvedValue(undefined)
  const onMessage = vi.fn()
  const ops = usePlanOps({
    selectedOperationPlanId: ref('plan-1'),
    selectedLiveAccountId: ref('account-1'),
    canPublishLiveSignals: ref(true),
    canExecutePaperNow: ref(true),
    canCancelCurrentPlan: ref(true),
    reviewPlanId: ref('plan-1'),
    onRefresh,
    onMessage,
  })
  return { ops, onRefresh, onMessage }
}

describe('usePlanOps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approves the review plan and refreshes the page state', async () => {
    api.approvePortfolioPlan.mockResolvedValue({ data: {} })
    const { ops, onRefresh, onMessage } = createPlanOps()

    await ops.approvePendingPlan()

    expect(api.approvePortfolioPlan).toHaveBeenCalledWith('plan-1', {
      comment: 'approved from portfolio overview',
    })
    expect(onMessage).toHaveBeenCalledWith('计划 plan-1 已批准。', false)
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(ops.approveSubmitting.value).toBe(false)
  })

  it('publishes live signals and refreshes the page state', async () => {
    api.publishPortfolioPlanLiveSignals.mockResolvedValue({
      data: { inserted_count: 2, existing_count: 1, skipped_by_risk: [] },
    })
    const { ops, onRefresh, onMessage } = createPlanOps()

    await ops.publishLiveSignals()

    expect(api.publishPortfolioPlanLiveSignals).toHaveBeenCalledWith('plan-1', {
      securities_account_id: 'account-1',
      dry_run: false,
      allow_partial: false,
    })
    expect(onMessage).toHaveBeenCalledWith(
      '已发布 2 条 live signals，已有 1 条。',
      false,
    )
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(ops.showPublishModal.value).toBe(false)
    expect(ops.livePublishLoading.value).toBe(false)
  })
})
