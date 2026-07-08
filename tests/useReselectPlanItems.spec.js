import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useReselectPlanItems } from '../src/composables/useReselectPlanItems'

const rejectMock = vi.fn()
const bulkRejectMock = vi.fn()
const restoreMock = vi.fn()

vi.mock('../src/api/portfolioPlans', () => ({
  rejectPortfolioPlanItem: (...args) => rejectMock(...args),
  bulkRejectPortfolioPlanItems: (...args) => bulkRejectMock(...args),
  restorePortfolioPlanItem: (...args) => restoreMock(...args),
}))

function setupHarness(overrides = {}) {
  const planId = ref('plan-1')
  const items = ref([
    { symbol: '600000.SH', name: '浦发银行', rank: 1, current_shares: 0, ai_risk: { severity: 'high' } },
    { symbol: '600001.SH', name: '邯郸钢铁', rank: 2, current_shares: 100, ai_risk: { severity: 'low' } },
  ])
  const excluded = ref([])
  const messages = []
  const runTask = vi.fn(async () => {
    items.value = [
      { symbol: '600002.SH', name: '补位股', rank: 1, current_shares: 0 },
      { symbol: '600001.SH', name: '邯郸钢铁', rank: 2, current_shares: 100 },
    ]
    return { status: 'completed', plan_id: 'plan-2' }
  })

  const api = useReselectPlanItems({
    getPlanId: () => planId.value,
    getItems: () => items.value,
    getExcluded: () => excluded.value,
    runTask,
    setMessage: (text, isError) => messages.push({ text, isError }),
    ...overrides,
  })

  return { planId, items, excluded, messages, runTask, ...api }
}

beforeEach(() => {
  rejectMock.mockReset()
  bulkRejectMock.mockReset()
  restoreMock.mockReset()
  rejectMock.mockResolvedValue({ data: { task: { task_id: 'task-1' } } })
  bulkRejectMock.mockResolvedValue({ data: { task: { task_id: 'task-bulk' } } })
  restoreMock.mockResolvedValue({ data: { task: { task_id: 'task-restore' } } })
})

describe('useReselectPlanItems', () => {
  it('merges toggle selection and toggles high-risk items on/off', () => {
    const { toggleReselectSelection, selectHighRiskReselectItems, selectedReselectSymbols } = setupHarness()

    toggleReselectSelection('600001.SH', true)
    expect(selectedReselectSymbols.value.has('600001.SH')).toBe(true)

    selectHighRiskReselectItems()
    expect(selectedReselectSymbols.value.has('600000.SH')).toBe(true)
    expect(selectedReselectSymbols.value.has('600001.SH')).toBe(true)

    selectHighRiskReselectItems()
    expect(selectedReselectSymbols.value.has('600000.SH')).toBe(false)
    expect(selectedReselectSymbols.value.has('600001.SH')).toBe(true)
  })

  it('does not call bulk reject when nothing is selected', async () => {
    const { bulkReselectItems } = setupHarness()
    await bulkReselectItems()
    expect(bulkRejectMock).not.toHaveBeenCalled()
  })

  it('keeps success summary after task completion and clears only selection', async () => {
    const {
      reselectItem,
      lastReselectSummary,
      reselectStatus,
      selectedReselectSymbols,
      resetReselectSelection,
    } = setupHarness()

    await reselectItem('600000.SH', false)
    expect(lastReselectSummary.value).toContain('补位换为 600002.SH')
    expect(reselectStatus.value.state).toBe('success')

    selectedReselectSymbols.value = new Set(['600001.SH'])
    resetReselectSelection()
    expect(selectedReselectSymbols.value.size).toBe(0)
    expect(lastReselectSummary.value).toContain('补位换为 600002.SH')
    expect(reselectStatus.value.state).toBe('success')
  })

  it('describeReselectResult reports replacement symbols after refresh', async () => {
    const { reselectItem, describeReselectResult, pendingReselect } = setupHarness()
    const before = { type: 'reject', symbol: '600000.SH', beforeTargets: ['600000.SH', '600001.SH'] }
    pendingReselect.value = before
    await reselectItem('600000.SH', false)
    expect(describeReselectResult(before)).toContain('补位换为 600002.SH(补位股)')
  })
})
