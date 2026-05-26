import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  buildStockRankingCacheKey,
  djb2Hash,
  readStockRankingCache,
  writeStockRankingCache,
  scoreDateMatchesRequest,
  RANKING_CACHE_MAX_ENTRIES,
  RANKING_CACHE_TTL_MS,
} from '../stockRankingCache.js'

/** @type {Record<string, string>} */
let mem = {}

beforeEach(() => {
  mem = {}
  vi.stubGlobal('localStorage', {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => {
      mem[k] = String(v)
    },
    removeItem: (k) => {
      delete mem[k]
    },
  })
  mem.user_info = JSON.stringify({ username: 'cacheuser' })
})

describe('buildStockRankingCacheKey', () => {
  it('builds ranking key', () => {
    expect(
      buildStockRankingCacheKey({
        viewMode: 'ranking',
        displayLimit: 30,
        rankingStrategy: 'balanced',
        sortBy: 'composite',
        dateParam: '',
        selectedDates: [],
        selectedStocks: [],
        watchlistSymbols: [],
        indexSymbols: [],
      })
    ).toBe('ranking|30|balanced|composite|latest')
  })

  it('returns null when required symbols missing', () => {
    expect(
      buildStockRankingCacheKey({
        viewMode: 'selected',
        displayLimit: 30,
        rankingStrategy: 'balanced',
        sortBy: 'composite',
        dateParam: '',
        selectedDates: [],
        selectedStocks: [],
        watchlistSymbols: [],
        indexSymbols: [],
      })
    ).toBeNull()
  })

  it('index modes include date in cache key when calendar date is set', () => {
    const k = buildStockRankingCacheKey({
      viewMode: 'hs300',
      displayLimit: 30,
      rankingStrategy: 'balanced',
        sortBy: 'money_flow',
      dateParam: '20200101',
      selectedDates: [],
      selectedStocks: [],
      watchlistSymbols: [],
      indexSymbols: [],
    })
    expect(k).toBe('hs300|balanced|money_flow|20200101')
  })

  it('index mode csi1000 uses latest when no date', () => {
    const k = buildStockRankingCacheKey({
      viewMode: 'csi1000',
      displayLimit: 30,
      rankingStrategy: 'balanced',
        sortBy: 'composite',
      dateParam: '',
      selectedDates: [],
      selectedStocks: [],
      watchlistSymbols: [],
      indexSymbols: [],
    })
    expect(k).toBe('csi1000|balanced|composite|latest')
  })

  it('includes page offset and size when paginating', () => {
    const k = buildStockRankingCacheKey({
      viewMode: 'csi500',
      displayLimit: 30,
      rankingStrategy: 'balanced',
        sortBy: 'growth',
      dateParam: '',
      selectedDates: [],
      selectedStocks: [],
      watchlistSymbols: [],
      indexSymbols: [],
      pageOffset: 30,
      pageSize: 30,
    })
    expect(k).toBe('csi500|balanced|growth|latest|o:30|ps:30')
  })

  it('uses hash tail for very long symbol lists', () => {
    const stocks = Array.from({ length: 400 }, (_, i) => String(600000 + (i % 1000)).padStart(6, '0'))
    const k = buildStockRankingCacheKey({
      viewMode: 'selected',
      displayLimit: 30,
      rankingStrategy: 'balanced',
      sortBy: 'technical',
      dateParam: '20260101',
      selectedDates: [],
      selectedStocks: stocks,
      watchlistSymbols: [],
      indexSymbols: [],
    })
    expect(k).toContain('h:')
    expect(k).toContain(`|n:${stocks.length}`)
  })
})

describe('djb2Hash', () => {
  it('is deterministic', () => {
    expect(djb2Hash('abc')).toBe(djb2Hash('abc'))
  })
})

describe('scoreDateMatchesRequest', () => {
  it('allows any when no date filter', () => {
    expect(scoreDateMatchesRequest('', '20260101')).toBe(true)
  })

  it('requires equality when date filter set', () => {
    expect(scoreDateMatchesRequest('20260101', '20260101')).toBe(true)
    expect(scoreDateMatchesRequest('20260101', '20260102')).toBe(false)
  })
})

describe('readStockRankingCache / writeStockRankingCache', () => {
  it('round-trips entry', () => {
    const key = 'ranking|30|balanced|latest'
    writeStockRankingCache(key, {
      rankings: [{ symbol: '000001', score_date: '20260101' }],
      lastUpdateTime: '2026-01-01',
      primaryScoreDate: '20260101',
    })
    const e = readStockRankingCache(key)
    expect(e).not.toBeNull()
    expect(e.rankings).toHaveLength(1)
    expect(e.rankings[0].symbol).toBe('000001')
    expect(e.lastUpdateTime).toBe('2026-01-01')
  })

  it('expires after TTL', () => {
    vi.useFakeTimers()
    const key = 'ranking|10|balanced|latest'
    writeStockRankingCache(key, {
      rankings: [{ symbol: '000001', score_date: '20260101' }],
      lastUpdateTime: '2026-01-01',
    })
    vi.setSystemTime(Date.now() + RANKING_CACHE_TTL_MS + 1000)
    expect(readStockRankingCache(key)).toBeNull()
    vi.useRealTimers()
  })

  it('evicts LRU when over max entries', () => {
    for (let i = 0; i < RANKING_CACHE_MAX_ENTRIES + 3; i++) {
      writeStockRankingCache(`k${i}`, {
        rankings: [{ symbol: '000001', score_date: '20260101', i }],
        lastUpdateTime: '2026-01-01',
      })
    }
    expect(readStockRankingCache('k0')).toBeNull()
    expect(readStockRankingCache(`k${RANKING_CACHE_MAX_ENTRIES + 2}`)).not.toBeNull()
  })
})
