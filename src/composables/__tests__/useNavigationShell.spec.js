import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import { useNavigationShell } from '../useNavigationShell.js'

describe('useNavigationShell loadNavigationTabs', () => {
  /** @type {Record<string, string>} */
  let localMem
  /** @type {Record<string, string>} */
  let sessionMem

  beforeEach(() => {
    requestMock.mockReset()
    localMem = {}
    sessionMem = {}
    vi.stubGlobal('localStorage', {
      getItem: (k) => (k in localMem ? localMem[k] : null),
      setItem: (k, v) => {
        localMem[k] = String(v)
      },
      removeItem: (k) => {
        delete localMem[k]
      },
    })
    vi.stubGlobal('sessionStorage', {
      getItem: (k) => (k in sessionMem ? sessionMem[k] : null),
      setItem: (k, v) => {
        sessionMem[k] = String(v)
      },
      removeItem: (k) => {
        delete sessionMem[k]
      },
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reads visible_tab_ids from request body (not AxiosResponse.data)', async () => {
    localMem.access_token = 'tok'
    localMem.user_info = JSON.stringify({ username: 'alice' })

    requestMock.mockResolvedValue({
      success: true,
      data: { visible_tab_ids: ['watchlist', 'chart', 'ranking'] },
    })

    const user = ref({ username: 'alice' })
    const isAuthenticated = ref(true)
    const shell = useNavigationShell({ user, isAuthenticated })

    await shell.loadNavigationTabs()

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/navigation-tabs',
      method: 'get',
    })
    expect(shell.serverVisibleTabIds.value).toEqual(['watchlist', 'chart', 'ranking'])
    expect(shell.navPolicyResolved.value).toBe(true)
    expect(sessionMem.nav_visible_tab_ids_v6).toBe(
      JSON.stringify(['watchlist', 'chart', 'ranking']),
    )
  })

  it('skips request when unauthenticated', async () => {
    const user = ref(null)
    const isAuthenticated = ref(false)
    const shell = useNavigationShell({ user, isAuthenticated })

    await shell.loadNavigationTabs()

    expect(requestMock).not.toHaveBeenCalled()
    expect(shell.serverVisibleTabIds.value).toBeNull()
    expect(shell.navPolicyResolved.value).toBe(false)
  })

  it('sets ids to null when body shape is unexpected', async () => {
    localMem.access_token = 'tok'
    localMem.user_info = JSON.stringify({ username: 'alice' })
    requestMock.mockResolvedValue({ success: true, data: {} })

    const user = ref({ username: 'alice' })
    const isAuthenticated = ref(true)
    const shell = useNavigationShell({ user, isAuthenticated })

    await shell.loadNavigationTabs()

    expect(shell.serverVisibleTabIds.value).toBeNull()
    expect(shell.navPolicyResolved.value).toBe(true)
  })
})
