import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAllTradeActivities } from './tradeExecution'

describe('tradeExecution API', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('includes activity_type in trade-activities query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', {
      getItem: () => 'token-1',
    })

    await getAllTradeActivities({
      limit: 200,
      activity_type: 'signals',
      status_filter: 'pending',
      days: 7,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('activity_type=signals')
    expect(url).toContain('status_filter=pending')
    expect(url).toContain('days=7')
    expect(url).toContain('limit=200')
  })

  it('omits activity_type when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('localStorage', {
      getItem: () => null,
    })

    await getAllTradeActivities({ limit: 50 })

    const url = fetchMock.mock.calls[0][0]
    expect(url).not.toContain('activity_type=')
    expect(url).toContain('limit=50')
  })
})
