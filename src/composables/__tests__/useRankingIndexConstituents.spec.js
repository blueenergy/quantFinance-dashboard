import { describe, expect, it, vi } from 'vitest'
import { useRankingIndexConstituents } from '../useRankingIndexConstituents.js'

describe('useRankingIndexConstituents', () => {
  it('uses the local fallback when the API returns an empty list', async () => {
    const requestClient = vi.fn().mockResolvedValue({ success: true, data: [] })
    const warn = vi.fn()
    const composable = useRankingIndexConstituents({ requestClient, warn })

    const rows = await composable.fetchIndexConstituents('hs300')

    expect(requestClient).toHaveBeenCalledWith({
      method: 'get',
      url: '/index/hs300/constituents',
    })
    expect(rows).toEqual(composable.indexStateMap.hs300.fallback)
    expect(rows).not.toBe(composable.indexStateMap.hs300.fallback)
    expect(composable.hs300Loading.value).toBe(false)
    expect(warn).toHaveBeenCalledWith(
      '获取 hs300 成分股返回空列表，使用本地 fallback'
    )
  })

  it('rejects an unknown index key without making a request', async () => {
    const requestClient = vi.fn()
    const composable = useRankingIndexConstituents({ requestClient })

    await expect(composable.fetchIndexConstituents('unknown')).rejects.toThrow(
      '未知指数: unknown'
    )
    expect(requestClient).not.toHaveBeenCalled()
    expect(composable.getIndexSymbols('unknown')).toEqual([])
  })
})
