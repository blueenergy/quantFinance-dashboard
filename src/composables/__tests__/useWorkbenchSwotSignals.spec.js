import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

const api = vi.hoisted(() => ({
  analyzeStockWorkbenchNewsUrl: vi.fn(),
  collectStockWorkbenchSignals: vi.fn(),
  getStockWorkbenchSignalTask: vi.fn(),
  refreshStockWorkbenchInternalSignals: vi.fn(),
}))

vi.mock('../../api/stock', () => api)

import { useWorkbenchSwotSignals } from '../useWorkbenchSwotSignals'

describe('useWorkbenchSwotSignals', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts polling after submitting signal collection', async () => {
    api.collectStockWorkbenchSignals.mockResolvedValue({ task_id: 'task-1' })
    api.getStockWorkbenchSignalTask.mockResolvedValue({
      task_meta: { status: 'processing' },
    })
    const signals = useWorkbenchSwotSignals({
      stockSymbol: ref('000001.SZ'),
      directSymbol: ref(''),
      isCurrentWorkbenchSymbol: () => true,
    })

    await signals.collectSwotSignals()

    expect(api.collectStockWorkbenchSignals).toHaveBeenCalledWith('000001.SZ')
    expect(api.getStockWorkbenchSignalTask).toHaveBeenCalledWith('task-1')
    expect(signals.signalCollecting.value).toBe(true)
    expect(vi.getTimerCount()).toBe(1)

    await vi.advanceTimersByTimeAsync(2000)
    expect(api.getStockWorkbenchSignalTask).toHaveBeenCalledTimes(2)
    signals.clearSignalCollectionPolling()
  })

  it('refreshes the signals section when collection completes', async () => {
    api.collectStockWorkbenchSignals.mockResolvedValue({ task_id: 'task-2' })
    api.getStockWorkbenchSignalTask
      .mockResolvedValueOnce({ task_meta: { status: 'processing' } })
      .mockResolvedValueOnce({
        task_meta: { status: 'completed' },
        base_result: { summary: { status: 'completed' } },
      })
    const loadWorkbenchSection = vi.fn().mockResolvedValue()
    const signals = useWorkbenchSwotSignals({
      stockSymbol: ref('000001.SZ'),
      directSymbol: ref(''),
      isCurrentWorkbenchSymbol: () => true,
      loadWorkbenchSection,
    })

    await signals.collectSwotSignals()
    await vi.advanceTimersByTimeAsync(2000)

    expect(loadWorkbenchSection).toHaveBeenCalledWith('signals', { force: true })
    expect(signals.signalCollecting.value).toBe(false)
    expect(signals.signalCollectionMessage.value).toContain('SWOT 已刷新')
  })

  it('clears a stale symbol task without applying its result', async () => {
    api.collectStockWorkbenchSignals.mockResolvedValue({ task_id: 'task-stale' })
    api.getStockWorkbenchSignalTask.mockResolvedValue({
      task_meta: { status: 'completed' },
      base_result: { summary: { status: 'completed' } },
    })
    const currentSymbol = ref('000001.SZ')
    const loadWorkbenchSection = vi.fn()
    const signals = useWorkbenchSwotSignals({
      stockSymbol: currentSymbol,
      directSymbol: ref(''),
      isCurrentWorkbenchSymbol: (symbol) => symbol === currentSymbol.value,
      loadWorkbenchSection,
    })

    const collecting = signals.collectSwotSignals()
    currentSymbol.value = '600000.SH'
    await collecting

    expect(signals.signalCollecting.value).toBe(false)
    expect(loadWorkbenchSection).not.toHaveBeenCalled()
    expect(signals.signalCollectionMessage.value).not.toContain('SWOT 已刷新')
  })

  it('does not clear a newer collect task when a stale poll returns', async () => {
    let resolveStale
    api.collectStockWorkbenchSignals
      .mockResolvedValueOnce({ task_id: 'task-old' })
      .mockResolvedValueOnce({ task_id: 'task-new' })
    api.getStockWorkbenchSignalTask.mockImplementation((taskId) => {
      if (taskId === 'task-old') {
        return new Promise((resolve) => {
          resolveStale = resolve
        })
      }
      return Promise.resolve({ task_meta: { status: 'processing' } })
    })
    const signals = useWorkbenchSwotSignals({
      stockSymbol: ref('000001.SZ'),
      directSymbol: ref(''),
      isCurrentWorkbenchSymbol: () => true,
    })

    const first = signals.collectSwotSignals()
    await Promise.resolve()
    signals.clearCollectPolling()
    await signals.collectSwotSignals()
    expect(signals.signalCollecting.value).toBe(true)

    resolveStale({
      task_meta: { status: 'completed' },
      base_result: { summary: { status: 'completed' } },
    })
    await first
    await Promise.resolve()

    expect(signals.signalCollecting.value).toBe(true)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    signals.clearSignalCollectionPolling()
  })

  it('clears polling when its host unmounts', async () => {
    api.collectStockWorkbenchSignals.mockResolvedValue({ task_id: 'task-unmount' })
    api.getStockWorkbenchSignalTask.mockResolvedValue({
      task_meta: { status: 'processing' },
    })
    let signals
    const Host = defineComponent({
      setup() {
        signals = useWorkbenchSwotSignals({
          stockSymbol: ref('000001.SZ'),
          directSymbol: ref(''),
          isCurrentWorkbenchSymbol: () => true,
        })
        return () => null
      },
    })
    const wrapper = mount(Host)
    const initialTimerCount = vi.getTimerCount()

    await signals.collectSwotSignals()
    expect(vi.getTimerCount()).toBe(initialTimerCount + 1)

    wrapper.unmount()
    await flushPromises()

    expect(vi.getTimerCount()).toBe(initialTimerCount)
    expect(signals.signalCollecting.value).toBe(false)
  })
})
