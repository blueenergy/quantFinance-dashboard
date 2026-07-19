import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAllTradeActivities } from './tradeExecution'

const requestMock = vi.fn()

vi.mock('../utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

describe('tradeExecution API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    requestMock.mockReset()
  })

  it('includes activity_type in trade-activities query params', async () => {
    requestMock.mockResolvedValue({ success: true, data: [] })

    await getAllTradeActivities({
      limit: 200,
      activity_type: 'signals',
      status_filter: 'pending',
      days: 7,
    })

    expect(requestMock).toHaveBeenCalledTimes(1)
    const config = requestMock.mock.calls[0][0]
    expect(config.url).toBe('/trade-activities/')
    expect(config.method).toBe('get')
    expect(config.params).toEqual({
      limit: 200,
      days: 7,
      status_filter: 'pending',
      activity_type: 'signals',
    })
  })

  it('omits activity_type when not provided', async () => {
    requestMock.mockResolvedValue({ success: true, data: [] })

    await getAllTradeActivities({ limit: 50 })

    const config = requestMock.mock.calls[0][0]
    expect(config.params).toEqual({ limit: 50 })
    expect(config.params).not.toHaveProperty('activity_type')
  })
})
