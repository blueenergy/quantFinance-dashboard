import { afterEach, describe, expect, it, vi } from 'vitest'

import { isChartDomReady, waitForChartDom } from '../chartDom'

describe('chartDom', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reports ready only when both dimensions are usable', () => {
    expect(isChartDomReady(null)).toBe(false)
    expect(isChartDomReady({ clientWidth: 0, clientHeight: 100 })).toBe(false)
    expect(isChartDomReady({ clientWidth: 120, clientHeight: 80 })).toBe(true)
  })

  it('resolves immediately when the host already has a layout box', async () => {
    await expect(waitForChartDom({ clientWidth: 240, clientHeight: 160 })).resolves.toBe(true)
  })

  it('returns false when the host never gains a layout box', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      cb(0)
      return 0
    })
    vi.useFakeTimers()
    const pending = waitForChartDom({ clientWidth: 0, clientHeight: 0 }, { tries: 2, delayMs: 10 })
    await vi.runAllTimersAsync()
    await expect(pending).resolves.toBe(false)
  })
})
