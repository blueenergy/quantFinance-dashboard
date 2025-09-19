// Pure helper to compute display rows from rankings and selectedDates
// Exports a single function: computeDisplayRows({rankings, viewMode, selectedDates, rankingStrategy, perStockStrategies, getCompositeScore})

export function computeDisplayRows({ rankings = [], viewMode = 'ranking', selectedDates = [], rankingStrategy = 'balanced', perStockStrategies = {}, getCompositeScore }) {
  const rv = Array.isArray(rankings) ? rankings : []
  const sDates = Array.isArray(selectedDates) ? selectedDates.filter(d => !!d) : []

  if (viewMode !== 'selected' || sDates.length === 0) {
    const strategyKey = rankingStrategy
    return rv.map(r => ({ ...r, display_composite_score: getCompositeScore(r, strategyKey) }))
  }

  const rows = []
  const sortedDates = [...sDates].sort((a, b) => b.localeCompare(a))
  rv.forEach(r => {
    sortedDates.forEach(d => {
      const perDate = r.per_date_scores?.[d]
      const stockStrat = (perStockStrategies && perStockStrategies[r.symbol]) || rankingStrategy
      let score = ''
      if (perDate) {
        score = perDate?.[stockStrat] ?? ''
      } else if (r.score_date === d) {
        score = (typeof r.composite_score === 'object' ? r.composite_score?.[stockStrat] : r.composite_score)
      }
      const copy = { ...r }
      copy.display_date = d
      copy.display_composite_score = score
      if (r.per_date_fields && r.per_date_fields[d]) {
        const f = r.per_date_fields[d]
        copy.cycle_score = f.cycle_score ?? copy.cycle_score
        copy.growth_score = f.growth_score ?? copy.growth_score
        copy.fundamental_score = f.fundamental_score ?? copy.fundamental_score
        copy.value_score = f.value_score ?? copy.value_score
        copy.technical_score = f.technical_score ?? copy.technical_score
        copy.money_flow_score = f.money_flow_score ?? copy.money_flow_score
      }
      rows.push(copy)
    })
  })

  rows.sort((x, y) => {
    const dx = (x.display_date || x.score_date || '')
    const dy = (y.display_date || y.score_date || '')
    if (dx !== dy) return dy.localeCompare(dx)
    const sx = Number(x.display_composite_score || 0)
    const sy = Number(y.display_composite_score || 0)
    return sy - sx
  })

  return rows
}
