import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockAdapter = vi.fn()

vi.mock('axios', async () => {
  const actual = await vi.importActual('axios')
  return {
    default: {
      ...actual.default,
      create: (config) => {
        const instance = actual.default.create(config)
        instance.defaults.adapter = (...args) => mockAdapter(...args)
        return instance
      },
    },
  }
})

describe('request', () => {
  beforeEach(() => {
    vi.resetModules()
    mockAdapter.mockReset()
    vi.stubGlobal('localStorage', {
      store: {},
      getItem(key) {
        return this.store[key] ?? null
      },
      setItem(key, value) {
        this.store[key] = String(value)
      },
      removeItem(key) {
        delete this.store[key]
      },
    })
    vi.stubGlobal('sessionStorage', {
      store: {},
      getItem(key) {
        return this.store[key] ?? null
      },
      setItem(key, value) {
        this.store[key] = String(value)
      },
      removeItem(key) {
        delete this.store[key]
      },
    })
    vi.stubGlobal('window', {
      ...window,
      location: { href: '' },
      currentSourceInfo: {},
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('injects Bearer token on requests', async () => {
    localStorage.setItem('access_token', 'token-abc')
    mockAdapter.mockResolvedValue({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {},
    })

    const request = (await import('../request.js')).default
    await request({ url: '/user/profile', method: 'get' })

    const config = mockAdapter.mock.calls[0][0]
    expect(config.headers.Authorization).toBe('Bearer token-abc')
  })

  it('clears session caches and redirects on 401', async () => {
    localStorage.setItem('access_token', 'token-abc')
    localStorage.setItem('user_info', '{"username":"alice"}')
    localStorage.setItem('activeTab', 'watchlist')
    sessionStorage.setItem('nav_visible_tab_ids_v2', '["watchlist"]')

    const clearAuthSpy = vi.spyOn(
      (await import('../../services/auth.js')).authService,
      'clearAuth',
    )

    mockAdapter.mockRejectedValue({
      config: { metadata: { startTime: Date.now() } },
      response: { status: 401 },
      message: 'Unauthorized',
    })

    const request = (await import('../request.js')).default
    await expect(request({ url: '/user/profile', method: 'get' })).rejects.toBeTruthy()

    expect(clearAuthSpy).toHaveBeenCalled()
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('user_info')).toBeNull()
    expect(localStorage.getItem('activeTab')).toBeNull()
    expect(sessionStorage.getItem('nav_visible_tab_ids_v2')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('requestOrNull returns null on 404', async () => {
    mockAdapter.mockRejectedValue({
      config: { metadata: { startTime: Date.now() } },
      response: { status: 404 },
      message: 'Not Found',
    })

    const { requestOrNull } = await import('../request.js')
    const result = await requestOrNull({ url: '/market-regime/latest', method: 'get' })
    expect(result).toBeNull()
  })

  it('requestOrNull rethrows non-404 errors', async () => {
    mockAdapter.mockRejectedValue({
      config: { metadata: { startTime: Date.now() } },
      response: { status: 500 },
      message: 'Server Error',
    })

    const { requestOrNull } = await import('../request.js')
    await expect(
      requestOrNull({ url: '/market-regime/latest', method: 'get' }),
    ).rejects.toBeTruthy()
  })

  it('does not log canceled requests as response errors', async () => {
    mockAdapter.mockRejectedValue({
      config: {
        metadata: { startTime: Date.now() },
        method: 'get',
        url: '/stock-rankings/by-index/hs300',
        baseURL: '/api',
      },
      code: 'ERR_CANCELED',
      name: 'CanceledError',
      message: 'canceled',
    })

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = (await import('../request.js')).default
    await expect(request({ url: '/stock-rankings/by-index/hs300', method: 'get' })).rejects.toBeTruthy()

    const canceledLogs = consoleError.mock.calls.filter(
      ([label, diagnostic]) => label === 'Response error:' && diagnostic?.code === 'ERR_CANCELED',
    )
    expect(canceledLogs).toHaveLength(0)
    consoleError.mockRestore()
  })
})
