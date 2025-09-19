// dashboard/src/utils/scoreUtils.js
// Small collection of pure helper utilities used by the dashboard components.

export function getCompositeScore(stock, strategyKey) {
  if (!stock) return 0
  const cs = stock.composite_score
  if (cs == null) return 0
  if (typeof cs === 'object') return cs[strategyKey] ?? 0
  return cs
}

export function formatDateDisplay(isoOrYyyyMmDd) {
  if (!isoOrYyyyMmDd) return ''
  const s = String(isoOrYyyyMmDd)
  if (s.includes('-')) {
    const d = new Date(s)
    return d.toISOString().split('T')[0]
  }
  return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`
}

export function escapeCSV(cell) {
  if (cell === null || cell === undefined) return ''
  const s = String(cell)
  return '"' + s.replace(/"/g, '""') + '"'
}

export function generateCSV(data, selectedDates, getEffectiveStrategyFor, getCompositeScoreFn) {
  // data: array of stock records
  // selectedDates: array of yyyyMMdd strings
  // getEffectiveStrategyFor: function(symbol) -> strategyKey
  // getCompositeScoreFn: function(stock, strategyKey) -> number

  let headers = ['排名', '股票代码', '股票名称']
  const includePerDate = Array.isArray(selectedDates) && selectedDates.length > 0
  if (includePerDate) selectedDates.forEach(d => headers.push(`总分(${formatDateDisplay(d)})`))
  else headers = headers.concat(['总分', '周期评分', '成长评分', '基本面评分', '价值评分', '技术面评分', '资金流评分'])

  const rows = data.map((stock, index) => {
    const base = [index + 1, stock.symbol, stock.name || '']
    if (includePerDate) {
      selectedDates.forEach(d => {
        const stockStrat = getEffectiveStrategyFor(stock.symbol)
        const score = stock.per_date_scores?.[d]?.[stockStrat] ?? ''
        base.push(score)
      })
      return base
    }
    const stockStrat = getEffectiveStrategyFor(stock.symbol)
    return base.concat([
      getCompositeScoreFn(stock, stockStrat),
      stock.cycle_score,
      stock.growth_score,
      stock.fundamental_score,
      stock.value_score,
      stock.technical_score,
      stock.money_flow_score
    ])
  })

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => escapeCSV(cell)).join(','))
    .join('\n')

  return csvContent
}

export function deduplicateStocksByLatestDate(stocks) {
  if (!stocks || stocks.length === 0) return []

  const stockGroups = {}
  stocks.forEach(stock => {
    const symbol = stock.symbol
    if (!stockGroups[symbol]) stockGroups[symbol] = []
    stockGroups[symbol].push(stock)
  })

  const deduplicatedStocks = []
  Object.keys(stockGroups).forEach(symbol => {
    const group = stockGroups[symbol]
    if (group.length === 1) {
      deduplicatedStocks.push(group[0])
    } else {
      const latest = group.reduce((latest, current) => {
        const latestDate = latest.score_date || '19700101'
        const currentDate = current.score_date || '19700101'
        return currentDate > latestDate ? current : latest
      })
      deduplicatedStocks.push(latest)
    }
  })

  return deduplicatedStocks
}
