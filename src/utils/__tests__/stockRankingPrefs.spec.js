import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadStockRankingPrefs,
  saveStockRankingPrefs,
  getStockRankingPrefsUsername,
  getStockRankingPrefsStorageKey,
  STOCK_RANKING_PREFS_MAX_SYMBOLS,
} from '../stockRankingPrefs.js'

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
})

describe('stockRankingPrefs', () => {
  it('getStockRankingPrefsUsername returns anon without user_info', () => {
    expect(getStockRankingPrefsUsername()).toBe('anon')
    expect(getStockRankingPrefsStorageKey()).toMatch(/^stockRanking_prefs_v1__anon$/)
  })

  it('scopes storage key by username from user_info', () => {
    mem.user_info = JSON.stringify({ username: 'alice' })
    expect(getStockRankingPrefsUsername()).toBe('alice')
    expect(getStockRankingPrefsStorageKey()).toBe('stockRanking_prefs_v1__alice')
  })

  it('save then load round-trips sanitized prefs', () => {
    mem.user_info = JSON.stringify({ username: 'bob' })
    saveStockRankingPrefs({
      viewMode: 'selected',
      displayLimit: 50,
      rankingStrategy: 'aggressive',
      sortBy: 'money_flow',
      selectedDate: '2026-04-01',
      selectedDates: ['20260401', 'bad', '20260402'],
      selectedStocks: ['000001', 'notacode', '600519'],
      perStockStrategies: { '000001': 'conservative', 'bad': 'balanced' },
    })
    const p = loadStockRankingPrefs()
    expect(p).not.toBeNull()
    expect(p.viewMode).toBe('selected')
    expect(p.displayLimit).toBe(50)
    expect(p.rankingStrategy).toBe('aggressive')
    expect(p.sortBy).toBe('money_flow')
    expect(p.selectedDate).toBe('2026-04-01')
    expect(p.selectedDates).toEqual(['20260401', '20260402'])
    expect(p.selectedStocks).toEqual(['000001', '600519'])
    expect(p.perStockStrategies).toEqual({ '000001': 'conservative' })
  })

  it('round-trips all index view modes', () => {
    mem.user_info = JSON.stringify({ username: 'index-user' })
    for (const viewMode of ['hs300', 'csi500', 'csi1000', 'csi2000', 'a500', 'star50']) {
      saveStockRankingPrefs({
        viewMode,
        displayLimit: 30,
        rankingStrategy: 'balanced',
        sortBy: 'composite',
        selectedDate: '',
        selectedDates: [],
        selectedStocks: [],
        perStockStrategies: {},
      })
      expect(loadStockRankingPrefs()?.viewMode).toBe(viewMode)
    }
  })

  it('returns null when stored payload has no usable fields', () => {
    mem.user_info = JSON.stringify({ username: 'u' })
    mem[getStockRankingPrefsStorageKey()] = JSON.stringify({
      version: 1,
      viewMode: 'nope',
      rankingStrategy: 'nope2',
      sortBy: 'bad',
      displayLimit: 999,
      selectedDate: 'not-a-date',
      selectedDates: [],
      selectedStocks: [],
      perStockStrategies: {},
    })
    expect(loadStockRankingPrefs()).toBeNull()
  })

  it('falls back to defaults when one field is valid', () => {
    mem.user_info = JSON.stringify({ username: 'u' })
    mem[getStockRankingPrefsStorageKey()] = JSON.stringify({
      version: 1,
      viewMode: 'nope',
      rankingStrategy: 'aggressive',
      sortBy: 'growth',
      displayLimit: 999,
      selectedDate: '',
      selectedDates: [],
      selectedStocks: [],
      perStockStrategies: {},
    })
    const p = loadStockRankingPrefs()
    expect(p).not.toBeNull()
    expect(p.viewMode).toBe('ranking')
    expect(p.rankingStrategy).toBe('aggressive')
    expect(p.sortBy).toBe('growth')
    expect(p.displayLimit).toBe(30)
  })

  it('truncates symbol list at STOCK_RANKING_PREFS_MAX_SYMBOLS', () => {
    mem.user_info = JSON.stringify({ username: 'u' })
    const many = Array.from({ length: STOCK_RANKING_PREFS_MAX_SYMBOLS + 50 }, (_, i) =>
      String(600000 + (i % 1000)).padStart(6, '0')
    )
    saveStockRankingPrefs({
      viewMode: 'ranking',
      displayLimit: 30,
      rankingStrategy: 'balanced',
      sortBy: 'composite',
      selectedDate: '',
      selectedDates: [],
      selectedStocks: many,
      perStockStrategies: {},
    })
    const raw = JSON.parse(mem[getStockRankingPrefsStorageKey()])
    expect(raw.selectedStocks.length).toBe(STOCK_RANKING_PREFS_MAX_SYMBOLS)
  })
})
