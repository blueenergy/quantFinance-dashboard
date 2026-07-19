import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import { watchlistService } from '../watchlist.js'

describe('watchlistService return contracts', () => {
  beforeEach(() => {
    requestMock.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getUserWatchlist returns symbols array (not envelope)', async () => {
    requestMock.mockResolvedValue({
      success: true,
      data: { symbols: ['000001.SZ', '600000.SH'] },
    })

    const symbols = await watchlistService.getUserWatchlist()

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/watchlist',
      method: 'get',
    })
    expect(symbols).toEqual(['000001.SZ', '600000.SH'])
  })

  it('getUserWatchlist returns [] when symbols missing', async () => {
    requestMock.mockResolvedValue({ success: true, data: {} })
    await expect(watchlistService.getUserWatchlist()).resolves.toEqual([])
  })

  it('getUserWatchlist throws when success is false', async () => {
    requestMock.mockResolvedValue({ success: false, message: 'denied' })
    await expect(watchlistService.getUserWatchlist()).rejects.toThrow('denied')
  })

  it('getUserWatchlistStocks returns data array', async () => {
    requestMock.mockResolvedValue({
      success: true,
      data: [{ symbol: '000001.SZ', name: '平安银行' }],
    })

    const stocks = await watchlistService.getUserWatchlistStocks()
    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/watchlist-stocks',
      method: 'get',
    })
    expect(stocks).toEqual([{ symbol: '000001.SZ', name: '平安银行' }])
  })

  it('getUserWatchlistRealtime returns data array', async () => {
    requestMock.mockResolvedValue({
      success: true,
      data: [{ symbol: '000001.SZ', price: 10.5 }],
    })

    const rows = await watchlistService.getUserWatchlistRealtime()
    expect(rows).toEqual([{ symbol: '000001.SZ', price: 10.5 }])
  })

  it('addToWatchlist returns full envelope body', async () => {
    requestMock.mockResolvedValue({ success: true, message: 'ok' })

    const body = await watchlistService.addToWatchlist('000001.SZ')

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/watchlist/add',
      method: 'post',
      data: { symbol: '000001.SZ' },
    })
    expect(body).toEqual({ success: true, message: 'ok' })
  })

  it('removeFromWatchlist returns full envelope body', async () => {
    requestMock.mockResolvedValue({ success: true })

    const body = await watchlistService.removeFromWatchlist('000001.SZ')

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/watchlist/remove/000001.SZ',
      method: 'delete',
    })
    expect(body.success).toBe(true)
  })

  it('updateWatchlist returns full envelope body', async () => {
    requestMock.mockResolvedValue({ success: true, data: { symbols: ['a'] } })

    const body = await watchlistService.updateWatchlist(['a'])

    expect(requestMock).toHaveBeenCalledWith({
      url: '/user/watchlist',
      method: 'put',
      data: { symbols: ['a'] },
    })
    expect(body).toEqual({ success: true, data: { symbols: ['a'] } })
  })
})
