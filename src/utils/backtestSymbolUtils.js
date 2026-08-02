/**
 * Infer stock vs ETF for A-share symbols (tushare-style ts_code).
 * Stocks use 000/300/600/688 etc.; ETFs commonly use 51/56/58 on SH and 15/16 on SZ.
 */
export function inferAssetTypeFromSymbol(symbol, preferred = 'stock') {
  const sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return preferred === 'etf' ? 'etf' : 'stock'

  const [code, suffix] = sym.includes('.') ? sym.split('.', 2) : [sym, '']
  if (!suffix) {
    return preferred === 'etf' ? 'etf' : 'stock'
  }

  if (suffix === 'SZ') {
    if (code.startsWith('15') || code.startsWith('16')) return 'etf'
    if (
      code.startsWith('000') ||
      code.startsWith('001') ||
      code.startsWith('002') ||
      code.startsWith('003') ||
      code.startsWith('300') ||
      code.startsWith('301')
    ) {
      return 'stock'
    }
  }

  if (suffix === 'SH') {
    if (code.startsWith('51') || code.startsWith('56') || code.startsWith('58')) return 'etf'
    if (
      code.startsWith('600') ||
      code.startsWith('601') ||
      code.startsWith('603') ||
      code.startsWith('605') ||
      code.startsWith('688') ||
      code.startsWith('689')
    ) {
      return 'stock'
    }
  }

  if (suffix === 'BJ' && (code.startsWith('4') || code.startsWith('8') || code.startsWith('9'))) {
    return 'stock'
  }

  return preferred === 'etf' ? 'etf' : 'stock'
}

export function normalizeBacktestSymbol(symbol, assetType = 'stock') {
  let sym = String(symbol || '').trim().toUpperCase()
  if (!sym) return ''

  if (sym.includes('.')) {
    return sym
  }

  const type = inferAssetTypeFromSymbol(sym, assetType)
  if (type === 'etf') {
    if (sym.startsWith('15') || sym.startsWith('16')) return `${sym}.SZ`
    if (sym.startsWith('5')) return `${sym}.SH`
    return sym
  }

  if (sym.startsWith('6')) return `${sym}.SH`
  if (sym.startsWith('0') || sym.startsWith('3')) return `${sym}.SZ`
  if (sym.startsWith('8') || sym.startsWith('4')) return `${sym}.BJ`
  return sym
}

export function formatBacktestDateYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function defaultBacktestDateRange() {
  const end = new Date()
  const start = new Date()
  start.setFullYear(start.getFullYear() - 1)
  return {
    start: formatBacktestDateYmd(start),
    end: formatBacktestDateYmd(end),
  }
}
