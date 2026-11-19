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

  it('approves the review plan, auto-previews the publish and opens the confirm modal', async () => {
    api.approvePortfolioPlan.mockResolvedValue({ data: {} })
    api.publishPortfolioPlanLiveSignals.mockResolvedValue({ data: { publishable_count: 3 } })
    const { ops, onRefresh, onMessage } = createPlanOps()

    await ops.approvePendingPlan()

    expect(api.approvePortfolioPlan).toHaveBeenCalledWith('plan-1', {
      comment: 'approved from portfolio overview',
    })
    expect(onRefresh).toHaveBeenCalledOnce()
    // Approval chains into a dry-run preview: one click to approve, one to
    // confirm, and the repriced order sheet is always seen before publishing.
    expect(api.publishPortfolioPlanLiveSignals).toHaveBeenCalledWith('plan-1', {
      securities_account_id: 'account-1',
      dry_run: true,
      allow_partial: false,
    })
    expect(ops.showPublishModal.value).toBe(true)
    expect(onMessage).toHaveBeenCalledWith(
      '计划 plan-1 已批准，已按最新价预检，请核对后确认发布。',
      false,
    )
    expect(ops.approveSubmitting.value).toBe(false)
  })

  it('approves without previewing when no live account is selected', async () => {
    api.approvePortfolioPlan.mockResolvedValue({ data: {} })
    const selectedLiveAccountId = ref('')
    const onMessage = vi.fn()
    const ops = usePlanOps({
      selectedOperationPlanId: ref('plan-1'),
      selectedLiveAccountId,
      canPublishLiveSignals: ref(true),
      canExecutePaperNow: ref(true),
      canCancelCurrentPlan: ref(true),
      reviewPlanId: ref('plan-1'),
      onRefresh: vi.fn().mockResolvedValue(undefined),
      onMessage,
    })

    await ops.approvePendingPlan()

    expect(api.publishPortfolioPlanLiveSignals).not.toHaveBeenCalled()
    expect(ops.showPublishModal.value).toBe(false)
    expect(onMessage).toHaveBeenCalledWith(
      '计划 plan-1 已批准。请选择实盘账户后点「发布实盘信号」完成下单。',
      false,
    )
  })

  it('publishes the plan the open preview belongs to, not the selected one', async () => {
    api.publishPortfolioPlanLiveSignals.mockResolvedValue({ data: { publishable_count: 1 } })
    const ops = usePlanOps({
      selectedOperationPlanId: ref('plan-selected'),
      selectedLiveAccountId: ref('account-1'),
      canPublishLiveSignals: ref(true),
      canExecutePaperNow: ref(true),
      canCancelCurrentPlan: ref(true),
      reviewPlanId: ref('plan-approved'),
      onRefresh: vi.fn().mockResolvedValue(undefined),
      onMessage: vi.fn(),
    })

    await ops.previewLivePublish('plan-approved')
    api.publishPortfolioPlanLiveSignals.mockResolvedValue({
      data: { inserted_count: 1, existing_count: 0, skipped_by_risk: [] },
    })
    await ops.publishLiveSignals()

    expect(api.publishPortfolioPlanLiveSignals).toHaveBeenLastCalledWith('plan-approved', {
      securities_account_id: 'account-1',
      dry_run: false,
      allow_partial: false,
    })
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
