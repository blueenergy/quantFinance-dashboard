const PREFS_KEY_PREFIX = 'stockRanking_prefs_v1__'

const VIEW_MODES = new Set(['ranking', 'selected', 'watchlist', 'hs300', 'csi500', 'a500', 'star50'])

const STRATEGIES = new Set([
  'balanced',
  'aggressive',
  'conservative',
  'defensive',
  'value_oriented',
  'trading_oriented',
  'growth_oriented',
  'cycle_oriented',
])

const DISPLAY_LIMITS = new Set([10, 30, 50, 100, 200])

/** Max symbols persisted to avoid blowing localStorage quota */
export const STOCK_RANKING_PREFS_MAX_SYMBOLS = 200

export function getStockRankingPrefsUsername() {
  try {
    const raw = localStorage.getItem('user_info')
    if (!raw) return 'anon'
    const u = JSON.parse(raw).username
    return typeof u === 'string' && u.trim() ? u.trim() : 'anon'
  } catch {
    return 'anon'
  }
}

export function getStockRankingPrefsStorageKey() {
  return `${PREFS_KEY_PREFIX}${getStockRankingPrefsUsername()}`
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function normalizeSymbol(v) {
  if (typeof v !== 'string') return null
  const s = v.trim().toUpperCase()
  if (!/^\d{6}$/.test(s)) return null
  return s
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string>}
 */
function sanitizePerStockStrategies(raw) {
  if (!raw || typeof raw !== 'object') return {}
  /** @type {Record<string, string>} */
  const out = {}
  for (const [k, val] of Object.entries(raw)) {
    const sym = normalizeSymbol(k)
    if (!sym) continue
    if (typeof val === 'string' && STRATEGIES.has(val)) out[sym] = val
  }
  return out
}

/**
 * @returns {{
 *   viewMode: string,
 *   displayLimit: number,
 *   rankingStrategy: string,
 *   selectedDate: string,
 *   selectedDates: string[],
 *   selectedStocks: string[],
 *   perStockStrategies: Record<string, string>
 * } | null}
 */
export function loadStockRankingPrefs() {
  try {
    const raw = localStorage.getItem(getStockRankingPrefsStorageKey())
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null

    const viewMode = typeof data.viewMode === 'string' && VIEW_MODES.has(data.viewMode) ? data.viewMode : null
    const displayLimit = typeof data.displayLimit === 'number' && DISPLAY_LIMITS.has(data.displayLimit) ? data.displayLimit : null
    const rankingStrategy =
      typeof data.rankingStrategy === 'string' && STRATEGIES.has(data.rankingStrategy) ? data.rankingStrategy : null

    let selectedDate = ''
    if (typeof data.selectedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.selectedDate)) {
      selectedDate = data.selectedDate
    }

    /** @type {string[]} */
    const selectedDates = []
    if (Array.isArray(data.selectedDates)) {
      for (const d of data.selectedDates) {
        if (typeof d === 'string' && /^\d{8}$/.test(d) && !selectedDates.includes(d)) selectedDates.push(d)
      }
    }

    /** @type {string[]} */
    const selectedStocks = []
    if (Array.isArray(data.selectedStocks)) {
      for (const s of data.selectedStocks) {
        const sym = normalizeSymbol(s)
        if (sym && !selectedStocks.includes(sym)) {
          selectedStocks.push(sym)
          if (selectedStocks.length >= STOCK_RANKING_PREFS_MAX_SYMBOLS) break
        }
      }
    }

    const perStockStrategies = sanitizePerStockStrategies(data.perStockStrategies)

    if (!viewMode && !displayLimit && !rankingStrategy && !selectedDate && selectedDates.length === 0 && selectedStocks.length === 0) {
      return null
    }

    return {
      viewMode: viewMode || 'ranking',
      displayLimit: displayLimit ?? 30,
      rankingStrategy: rankingStrategy || 'balanced',
      selectedDate,
      selectedDates,
      selectedStocks,
      perStockStrategies,
    }
  } catch {
    return null
  }
}

/** @param {Record<string, unknown>} prefs */
export function saveStockRankingPrefs(prefs) {
  try {
    const payload = {
      version: 1,
      viewMode: prefs.viewMode,
      displayLimit: prefs.displayLimit,
      rankingStrategy: prefs.rankingStrategy,
      selectedDate: prefs.selectedDate ?? '',
      selectedDates: Array.isArray(prefs.selectedDates) ? prefs.selectedDates : [],
      selectedStocks: Array.isArray(prefs.selectedStocks)
        ? prefs.selectedStocks.slice(0, STOCK_RANKING_PREFS_MAX_SYMBOLS)
        : [],
      perStockStrategies: prefs.perStockStrategies && typeof prefs.perStockStrategies === 'object' ? prefs.perStockStrategies : {},
    }
    if (!VIEW_MODES.has(payload.viewMode)) payload.viewMode = 'ranking'
    if (!DISPLAY_LIMITS.has(payload.displayLimit)) payload.displayLimit = 30
    if (!STRATEGIES.has(payload.rankingStrategy)) payload.rankingStrategy = 'balanced'
    localStorage.setItem(getStockRankingPrefsStorageKey(), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}
