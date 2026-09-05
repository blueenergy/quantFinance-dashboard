import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.fn()

vi.mock('../../utils/request', () => ({
  default: (...args) => requestMock(...args),
}))

import {
  watchlistService,
  WATCHLIST_SESSION_SNAPSHOT_KEY,
  mapRealtimeWatchlistRows,
  mapHistoryWatchlistRows,
  symbolsFromWatchlistRows,
} from '../watchlist.js'

describe('watchlistService return contracts', () => {
  beforeEach(() => {
    requestMock.mockReset()
    sessionStorage.clear()
    localStorage.removeItem('watchList')
    localStorage.removeItem('watchlist_session_snapshot_v1')
    watchlistService.clearSessionSnapshot()
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

  it('session snapshot is per-user and ignored when username mismatches', () => {
    sessionStorage.clear()
    watchlistService.setSessionSnapshot('alice', {
      symbols: ['000001.SZ'],
      stocks: [{ symbol: '000001.SZ', name: '平安银行' }],
    })

    expect(watchlistService.getSessionSnapshot('alice')).toEqual({
      symbols: ['000001.SZ'],
      stocks: [{ symbol: '000001.SZ', name: '平安银行' }],
    })
    expect(watchlistService.getSessionSnapshot('bob')).toBeNull()

    expect(localStorage.getItem(WATCHLIST_SESSION_SNAPSHOT_KEY)).toContain('alice')

    watchlistService.clearSessionSnapshot()
    expect(sessionStorage.getItem(WATCHLIST_SESSION_SNAPSHOT_KEY)).toBeNull()
    expect(localStorage.getItem(WATCHLIST_SESSION_SNAPSHOT_KEY)).toBeNull()
    expect(watchlistService.getSessionSnapshot('alice')).toBeNull()
  })

  it('hydrates snapshot from localStorage when sessionStorage is empty', () => {
    localStorage.setItem(WATCHLIST_SESSION_SNAPSHOT_KEY, JSON.stringify({
      username: 'alice',
      symbols: ['510300.SH'],
      stocks: [{ symbol: '510300.SH', name: '沪深300ETF' }],
    }))

    expect(watchlistService.getSessionSnapshot('alice')).toEqual({
      symbols: ['510300.SH'],
      stocks: [{ symbol: '510300.SH', name: '沪深300ETF' }],
    })
  })

  it('coalesces in-flight realtime fetches and reuses the short cache', async () => {
    let resolve
    const pending = new Promise((r) => {
      resolve = r
    })
    requestMock.mockReturnValue(pending)

    const first = watchlistService.getUserWatchlistRealtime()
    const second = watchlistService.getUserWatchlistRealtime()
    expect(requestMock).toHaveBeenCalledTimes(1)

    resolve({ success: true, data: [{ symbol: '000001.SZ', price: 10.5 }] })
    await expect(first).resolves.toEqual([{ symbol: '000001.SZ', price: 10.5 }])
    await expect(second).resolves.toEqual([{ symbol: '000001.SZ', price: 10.5 }])

    await expect(watchlistService.getUserWatchlistRealtime()).resolves.toEqual([
      { symbol: '000001.SZ', price: 10.5 },
    ])
    expect(requestMock).toHaveBeenCalledTimes(1)

    await watchlistService.getUserWatchlistRealtime({ force: true })
    expect(requestMock).toHaveBeenCalledTimes(2)
  })

  it('maps realtime and history rows for the watchlist table', () => {
    expect(mapRealtimeWatchlistRows([
      { symbol: '000001.SZ', name: '平安银行', price: 10.5, change_pct: 1.2 },
    ])).toEqual([
      expect.objectContaining({
        symbol: '000001.SZ',
        name: '平安银行',
        price: 10.5,
        close: 10.5,
        change_pct: 1.2,
      }),
    ])
    expect(mapHistoryWatchlistRows([
      { symbol: '510300.SH', name: '沪深300ETF', close: 4.2, trade_date: '20260701' },
    ])).toEqual([
      expect.objectContaining({
        symbol: '510300.SH',
        close: 4.2,
        date: '20260701',
      }),
    ])
    expect(symbolsFromWatchlistRows([{ symbol: '000001.SZ' }, {}])).toEqual(['000001.SZ'])
  })
})
