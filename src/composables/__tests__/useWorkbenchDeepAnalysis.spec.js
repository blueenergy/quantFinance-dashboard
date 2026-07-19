import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('../../utils/request', () => ({ default: request }))

import { useWorkbenchDeepAnalysis } from '../useWorkbenchDeepAnalysis'

describe('useWorkbenchDeepAnalysis', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T12:00:00.000Z'))
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls a submitted analysis to completion and updates the workbench payload', async () => {
    request.post.mockResolvedValue({
      success: true,
      task_id: 'analysis-2',
      queue_ahead: 0,
      wait_hint: '即将开始',
    })
    request.get.mockResolvedValue({
      status: 'completed',
      analysis_mode: 'multi_expert_v1',
      model: 'test-model',
      analysis: {
        stock_name: '平安银行',
        final_conclusion: '维持关注',
      },
    })
    const payload = ref({
      symbol: '000001.SZ',
      analysis_history: [{ id: 'analysis-1' }],
      data_status: {},
    })
    const analysisHistory = computed(() => payload.value.analysis_history)
    const deepAnalysis = useWorkbenchDeepAnalysis({
      payload,
      stockSymbol: ref('000001.SZ'),
      directSymbol: ref(''),
      stockName: ref('平安银行'),
      analysisHistory,
    })

    await deepAnalysis.submitDeepAnalysis()

    expect(request.post).toHaveBeenCalledWith('/analyze/deep-analysis', {
      symbol: '000001.SZ',
      priority: 30,
      analysis_mode: 'multi_expert_v1',
    })
    expect(deepAnalysis.analysisSubmitting.value).toBe(true)

    await vi.advanceTimersByTimeAsync(3000)

    expect(request.get).toHaveBeenCalledWith('/analyze/task/analysis-2')
    expect(deepAnalysis.analysisSubmitting.value).toBe(false)
    expect(deepAnalysis.analysisSubmitStatus.value).toBe('分析完成，已更新当前工作台。')
    expect(payload.value.deep_analysis).toMatchObject({
      id: 'analysis-2',
      symbol: '000001.SZ',
      stock_name: '平安银行',
      analysis_mode: 'multi_expert_v1',
      model: 'test-model',
      analysis: { final_conclusion: '维持关注' },
      created_at: '2026-07-19T12:00:03.000Z',
    })
    expect(payload.value.analysis_history.map((item) => item.id)).toEqual([
      'analysis-2',
      'analysis-1',
    ])
    expect(payload.value.data_status).toMatchObject({
      deep_analysis_found: true,
      analysis_created_at: '2026-07-19T12:00:03.000Z',
    })
  })

  it('ignores a completed poll after the symbol has changed', async () => {
    let resolvePoll
    request.post.mockResolvedValue({
      success: true,
      task_id: 'analysis-stale',
      queue_ahead: 0,
    })
    request.get.mockImplementation(() => new Promise((resolve) => {
      resolvePoll = resolve
    }))
    const currentSymbol = ref('000001.SZ')
    const payload = ref({ analysis_history: [], data_status: {} })
    const deepAnalysis = useWorkbenchDeepAnalysis({
      payload,
      stockSymbol: currentSymbol,
      directSymbol: ref(''),
      stockName: ref('平安银行'),
      analysisHistory: computed(() => payload.value.analysis_history),
      isCurrentWorkbenchSymbol: (symbol) => symbol === currentSymbol.value,
    })

    await deepAnalysis.submitDeepAnalysis()
    await vi.advanceTimersByTimeAsync(3000)
    currentSymbol.value = '600000.SH'
    deepAnalysis.clearAnalysisPolling()
    resolvePoll({
      status: 'completed',
      analysis: { final_conclusion: '过期结果' },
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(payload.value.deep_analysis).toBeUndefined()
    expect(deepAnalysis.analysisSubmitting.value).toBe(false)
  })

  it('ignores a late history response after clearAnalysisPolling', async () => {
    let resolveHistory
    request.get.mockImplementation(() => new Promise((resolve) => {
      resolveHistory = resolve
    }))
    const payload = ref({ deep_analysis: null })
    const deepAnalysis = useWorkbenchDeepAnalysis({
      payload,
      stockSymbol: ref('000001.SZ'),
      directSymbol: ref(''),
      stockName: ref(''),
      analysisHistory: ref([]),
    })
    const pending = deepAnalysis.selectAnalysisHistory({
      id: 'history-stale',
      analysis: { final_conclusion: '过期' },
    })
    deepAnalysis.clearAnalysisPolling()
    resolveHistory({ data: { id: 'history-stale', analysis: { final_conclusion: '完整过期' } } })
    await pending

    expect(payload.value.deep_analysis).toBeNull()
  })
})
