/**
 * Deep-link registry and helpers for SPA tabs (query-param based, no Vue Router).
 * URL shape: /?tab=stock-workbench&symbol=600519.SH or /?tab=chart&symbol=600519.SH
 */

/** @type {Record<string, string[]>} */
export const DEEP_LINK_TABS = {
  chart: ['symbol'],
  'stock-workbench': ['symbol', 'panel', 'dimension', 'findingKey'],
  // Future: 'etf': ['symbol'], 'history': ['symbol'], ...
}

function normalizeBasePath() {
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/') return ''
  return base.endsWith('/') ? base.slice(0, -1) : base
}

/**
 * @param {string} tab
 * @param {Record<string, string | number | boolean | undefined | null>} [params]
 * @returns {string}
 */
export function buildDeepLinkHref(tab, params = {}) {
  const allowed = DEEP_LINK_TABS[tab]
  if (!allowed) {
    return `${normalizeBasePath()}/?tab=${encodeURIComponent(tab)}`
  }

  const search = new URLSearchParams()
  search.set('tab', tab)
  for (const key of allowed) {
    const value = params[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value).trim())
    }
  }

  return `${normalizeBasePath()}/?${search.toString()}`
}

/**
 * @param {string} [search]
 * @returns {{ tab: string, params: Record<string, string> } | null}
 */
export function parseDeepLinkFromUrl(search = window.location.search) {
  const query = new URLSearchParams(search)
  const tab = query.get('tab')
  if (!tab) return null

  // Any tab id is accepted here; final permission gating happens at apply
  // time against the user's visible tabs. DEEP_LINK_TABS only declares
  // which extra params a tab understands.
  const allowed = DEEP_LINK_TABS[tab] || []
  /** @type {Record<string, string>} */
  const params = {}
  for (const key of allowed) {
    const value = query.get(key)
    if (value != null && String(value).trim() !== '') {
      params[key] = String(value).trim()
    }
  }

  // Stock-specific tabs require a target symbol.
  if ((tab === 'chart' || tab === 'stock-workbench') && !params.symbol) return null

  return { tab, params }
}

/**
 * True when the click should open href in a new tab/window (browser default).
 * @param {MouseEvent} event
 */
export function isModifiedClick(event) {
  return (
    event.button === 1
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  )
}
