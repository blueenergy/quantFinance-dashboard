import { getStockRankingPrefsUsername } from './stockRankingPrefs.js'

export const RANKING_CACHE_MAX_ENTRIES = 25
export const RANKING_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function cacheBlobKey() {
  return `stockRanking_cache_blob_v2__${getStockRankingPrefsUsername()}`
}

/** @param {string} s */
export function djb2Hash(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = Math.imul(33, h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

/** Deep-clone ranking rows for localStorage. Avoid structuredClone: Vue refs may hold Proxies BigInt etc. */
function cloneRankings(arr) {
  return JSON.parse(JSON.stringify(arr))
}

/**
 * @param {{
 *   viewMode: string,
 *   displayLimit: number,
 *   rankingStrategy: string,
 *   dateParam: string,
 *   selectedDates: string[],
 *   selectedStocks: string[],
 *   watchlistSymbols: string[],
 *   indexSymbols: string[],
 * }} state
 * @returns {string | null}
 */
export function buildStockRankingCacheKey(state) {
  const {
    viewMode,
    displayLimit,
    rankingStrategy,
    dateParam,
    selectedDates = [],
    selectedStocks = [],
    watchlistSymbols = [],
    indexSymbols = [],
  } = state

  const dp = dateParam || ''

  switch (viewMode) {
    case 'ranking':
      return `ranking|${displayLimit}|${rankingStrategy}|${dp || 'latest'}`
    case 'selected': {
      if (!selectedStocks.length) return null
      const d = selectedDates.length ? [...selectedDates].sort().join(',') : ''
      const syms = [...selectedStocks].sort().join(',')
      const tail = syms.length > 1500 ? `h:${djb2Hash(syms)}|n:${selectedStocks.length}` : `s:${syms}`
      return `selected|${rankingStrategy}|${dp}|d:${d}|${tail}`
    }
    case 'watchlist': {
      if (!watchlistSymbols.length) return null
      const syms = [...watchlistSymbols].sort().join(',')
      const tail = syms.length > 1500 ? `h:${djb2Hash(syms)}|n:${watchlistSymbols.length}` : `s:${syms}`
      return `watchlist|${rankingStrategy}|${dp}|${tail}`
    }
    case 'hs300':
    case 'csi500':
    case 'a500':
    case 'star50': {
      if (!indexSymbols.length) return null
      const syms = [...indexSymbols].sort().join(',')
      const tail = syms.length > 1500 ? `h:${djb2Hash(syms)}|n:${indexSymbols.length}` : `s:${syms}`
      return `${viewMode}|${rankingStrategy}|${dp}|${tail}`
    }
    default:
      return null
  }
}

function readBlob() {
  try {
    const raw = localStorage.getItem(cacheBlobKey())
    if (!raw) return { entries: {}, order: [] }
    const p = JSON.parse(raw)
    if (!p || typeof p !== 'object') return { entries: {}, order: [] }
    return {
      entries: typeof p.entries === 'object' && p.entries ? p.entries : {},
      order: Array.isArray(p.order) ? p.order : [],
    }
  } catch {
    return { entries: {}, order: [] }
  }
}

function writeBlob(entries, order) {
  try {
    localStorage.setItem(cacheBlobKey(), JSON.stringify({ entries, order }))
  } catch {
    /* quota */
  }
}

/**
 * @param {string | null} requestKey
 * @returns {{ fetchedAt: number, rankings: unknown[], lastUpdateTime: string, primaryScoreDate: string } | null}
 */
export function readStockRankingCache(requestKey) {
  if (!requestKey) return null
  const { entries } = readBlob()
  const e = entries[requestKey]
  if (!e || typeof e.fetchedAt !== 'number') return null
  if (Date.now() - e.fetchedAt > RANKING_CACHE_TTL_MS) return null
  if (!Array.isArray(e.rankings)) return null
  return e
}

/**
 * @param {string | null} requestKey
 * @param {{ rankings: unknown[], lastUpdateTime: string, primaryScoreDate?: string }} payload
 */
export function writeStockRankingCache(requestKey, payload) {
  const { rankings, lastUpdateTime, primaryScoreDate } = payload
  if (!requestKey || !Array.isArray(rankings) || rankings.length === 0) return
  const blob = readBlob()
  const psd =
    primaryScoreDate ||
    (rankings[0] && typeof rankings[0] === 'object' && rankings[0].score_date) ||
    ''
  const entry = {
    fetchedAt: Date.now(),
    rankings: cloneRankings(rankings),
    lastUpdateTime: lastUpdateTime || '',
    primaryScoreDate: typeof psd === 'string' ? psd : '',
  }
  blob.entries[requestKey] = entry
  blob.order = [requestKey, ...blob.order.filter((k) => k !== requestKey)]
  while (blob.order.length > RANKING_CACHE_MAX_ENTRIES) {
    const drop = blob.order.pop()
    if (drop) delete blob.entries[drop]
  }
  writeBlob(blob.entries, blob.order)
}

/** When user fixed a calendar date, cache row must match that score_date (YYYYMMDD). */
export function scoreDateMatchesRequest(dateParam, primaryScoreDate) {
  if (!dateParam) return true
  return primaryScoreDate === dateParam
}
