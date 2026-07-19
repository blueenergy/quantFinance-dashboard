import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.fn()
const requestOrNullMock = vi.fn()

vi.mock('../../utils/request', () => ({
  default: (...args) => requestMock(...args),
  requestOrNull: (...args) => requestOrNullMock(...args),
}))

import { searchStocks, getStockInfo, getStockWorkbenchSignalTask } from '../stock.js'
import { getTraderAccount, getSecuritiesAccounts } from '../trader.js'
import { getDailyLadder } from '../ladder.js'
import { getMarketRegimeLatest } from '../marketRegime.js'
import { earningsHunterApi } from '../earningsHunter.js'

describe('api module return contracts after request migration', () => {
  beforeEach(() => {
    requestMock.mockReset()
    requestOrNullMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('stock.searchStocks unwraps body.data to array', async () => {
    requestMock.mockResolvedValue({
      success: true,
      data: [{ symbol: '000001.SZ', name: '平安银行' }],
    })

    const rows = await searchStocks('平安')
    expect(requestMock).toHaveBeenCalledWith({
      url: '/stock/search',
      method: 'get',
      params: { q: '平安' },
    })
    expect(rows).toEqual([{ symbol: '000001.SZ', name: '平安银行' }])
  })

  it('stock.getStockInfo unwraps body.data', async () => {
    requestMock.mockResolvedValue({ success: true, data: { symbol: '000001.SZ' } })
    await expect(getStockInfo('000001.SZ')).resolves.toEqual({ symbol: '000001.SZ' })
  })

  it('stock.getStockWorkbenchSignalTask returns full body (no unwrap)', async () => {
    requestMock.mockResolvedValue({ task_meta: { status: 'running' }, success: true })
    const body = await getStockWorkbenchSignalTask('t1')
    expect(body.task_meta.status).toBe('running')
  })

  it('trader.getTraderAccount unwraps body.data', async () => {
    requestMock.mockResolvedValue({ success: true, data: { cash: 100 } })
    await expect(getTraderAccount()).resolves.toEqual({ cash: 100 })
  })

  it('trader.getSecuritiesAccounts returns full body', async () => {
    requestMock.mockResolvedValue([{ id: 'acc1' }])
    await expect(getSecuritiesAccounts()).resolves.toEqual([{ id: 'acc1' }])
  })

  it('ladder.getDailyLadder returns full body envelope', async () => {
    requestMock.mockResolvedValue({ success: true, tiers: [{ board: 2 }] })
    const body = await getDailyLadder('20260101')
    expect(requestMock).toHaveBeenCalledWith({
      url: '/ladder/daily',
      method: 'get',
      params: { date: '20260101' },
    })
    expect(body.success).toBe(true)
    expect(body.tiers).toHaveLength(1)
  })

  it('marketRegime.getMarketRegimeLatest uses requestOrNull', async () => {
    requestOrNullMock.mockResolvedValue(null)
    await expect(getMarketRegimeLatest()).resolves.toBeNull()
    expect(requestOrNullMock).toHaveBeenCalledWith({
      url: '/market-regime/latest',
      method: 'get',
    })
  })

  it('earningsHunterApi returns body (not AxiosResponse)', async () => {
    requestMock.mockResolvedValue({
      success: true,
      data: [{ id: 1 }],
      task_id: undefined,
    })

    const body = await earningsHunterApi.getSignals(7)
    expect(body.success).toBe(true)
    expect(body.data).toEqual([{ id: 1 }])
    // Callers must NOT use body.data.success (that was the AxiosResponse bug)
    expect(body.data.success).toBeUndefined()
  })
})
