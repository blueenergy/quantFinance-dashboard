import { describe, expect, it, vi } from 'vitest'
import { installPreloadErrorReload } from '../src/utils/preloadRecovery'

function createStorage() {
  const values = new Map()

  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, value)),
  }
}

function createWindowRef() {
  const listeners = new Map()

  return {
    addEventListener: vi.fn((eventName, listener) => {
      listeners.set(eventName, listener)
    }),
    dispatch(eventName, event) {
      listeners.get(eventName)?.(event)
    },
  }
}

describe('installPreloadErrorReload', () => {
  it('reloads once when a Vite preload chunk is stale', () => {
    const windowRef = createWindowRef()
    const storage = createStorage()
    const reload = vi.fn()
    const preventDefault = vi.fn()

    installPreloadErrorReload({
      windowRef,
      storage,
      now: () => 100000,
      reload,
    })

    windowRef.dispatch('vite:preloadError', { preventDefault })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(storage.setItem).toHaveBeenCalledWith(
      'quant-dashboard:preload-error-reload-at',
      '100000',
    )
    expect(reload).toHaveBeenCalledOnce()
  })

  it('throttles repeated preload errors to avoid reload loops', () => {
    const windowRef = createWindowRef()
    const storage = createStorage()
    const reload = vi.fn()

    storage.setItem('quant-dashboard:preload-error-reload-at', '100000')

    installPreloadErrorReload({
      windowRef,
      storage,
      now: () => 105000,
      reload,
    })

    windowRef.dispatch('vite:preloadError', { preventDefault: vi.fn() })

    expect(reload).not.toHaveBeenCalled()
  })
})
