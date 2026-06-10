// Pure helper to compute display rows from rankings and selectedDates
// Exports a single function: computeDisplayRows({rankings, viewMode, selectedDates, rankingStrategy, perStockStrategies, getCompositeScore})

export function computeDisplayRows({ rankings = [], viewMode = 'ranking', selectedDates = [], rankingStrategy = 'balanced', perStockStrategies = {}, getCompositeScore }) {
  const rv = Array.isArray(rankings) ? rankings : []
  const sDates = Array.isArray(selectedDates) ? selectedDates.filter(d => !!d) : []

  if (viewMode !== 'selected' || sDates.length === 0) {
    const strategyKey = rankingStrategy
    return rv.map(r => ({
      ...r,
      display_composite_score: getCompositeScore(r, strategyKey),
      display_return_since_score_pct: r.return_since_score_pct ?? null,
      display_price_base_trade_date: r.price_base_trade_date ?? null,
      display_price_latest_trade_date: r.price_latest_trade_date ?? null,
      display_prior_3m_return_pct: r.prior_3m_return_pct ?? null,
      display_prior_3m_base_trade_date: r.prior_3m_base_trade_date ?? null,
      display_prior_3m_end_trade_date: r.prior_3m_end_trade_date ?? null,
    }))
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
      const pr = r.per_date_return_since && r.per_date_return_since[d]
      copy.display_return_since_score_pct =
        pr != null && pr.return_since_score_pct != null ? pr.return_since_score_pct : null
      copy.display_price_base_trade_date = pr?.price_base_trade_date ?? null
      copy.display_price_latest_trade_date = pr?.price_latest_trade_date ?? null
      const p3 = r.per_date_prior_3m_return && r.per_date_prior_3m_return[d]
      copy.display_prior_3m_return_pct =
        p3 != null && p3.prior_3m_return_pct != null ? p3.prior_3m_return_pct : null
      copy.display_prior_3m_base_trade_date = p3?.prior_3m_base_trade_date ?? null
      copy.display_prior_3m_end_trade_date = p3?.prior_3m_end_trade_date ?? null
      if (r.per_date_fields && r.per_date_fields[d]) {
        const f = r.per_date_fields[d]
        copy.cycle_score = f.cycle_score ?? copy.cycle_score
        copy.growth_score = f.growth_score ?? copy.growth_score
        copy.fundamental_score = f.fundamental_score ?? copy.fundamental_score
        copy.value_score = f.value_score ?? copy.value_score
        copy.technical_score = f.technical_score ?? copy.technical_score
        copy.money_flow_score = f.money_flow_score ?? copy.money_flow_score
        copy.industry_rs_score = f.industry_rs_score ?? copy.industry_rs_score
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
