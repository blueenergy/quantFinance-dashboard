// dashboard/src/utils/scoreUtils.js
// Small collection of pure helper utilities used by the dashboard components.

export function getCompositeScore(stock, strategyKey) {
  if (!stock) return 0
  const cs = stock.composite_score
  if (cs == null) return 0
  if (typeof cs === 'object') return cs[strategyKey] ?? 0
  return cs
}

export const SCORE_DIMENSION_FIELDS = {
  cycle: 'cycle_score',
  growth: 'growth_score',
  fundamental: 'fundamental_score',
  value: 'value_score',
  technical: 'technical_score',
  money_flow: 'money_flow_score',
}

export const SCORE_DIMENSION_LABELS = {
  cycle: '动量',
  growth: '成长',
  fundamental: '基本面',
  value: '价值',
  technical: '技术',
  money_flow: '资金',
}

export const ATOMIC_SCORE_OPTIONS = [
  { dimension: 'technical', value: 'technical_score', label: '技术' },
  { dimension: 'fundamental', value: 'fundamental_score', label: '基本面' },
  { dimension: 'value', value: 'value_score', label: '价值' },
  { dimension: 'growth', value: 'growth_score', label: '成长' },
  { dimension: 'money_flow', value: 'money_flow_score', label: '资金' },
  { dimension: 'cycle', value: 'cycle_score', label: '动量' },
]

// Mirrors StockAnalyzer.load_weight_strategies. Composite presets keep using
// their stored historical score columns; these weights explain their meaning.
export const COMPOSITE_SCORE_PRESETS = [
  {
    column: 'composite_balanced_score',
    label: '均衡',
    description: '质量与估值为基础，兼顾技术、成长、资金和动量',
    weights: { fundamental: 25, value: 20, technical: 20, growth: 15, money_flow: 10, cycle: 10 },
  },
  {
    column: 'composite_conservative_score',
    label: '保守',
    description: '偏重基本面、价值和成长，降低资金与动量权重',
    weights: { fundamental: 30, value: 25, growth: 20, technical: 15, money_flow: 5, cycle: 5 },
  },
  {
    column: 'composite_defensive_score',
    label: '防御',
    description: '基本面与价值合计 70%，强调质量和安全边际',
    weights: { fundamental: 35, value: 35, growth: 10, technical: 10, money_flow: 5, cycle: 5 },
  },
  {
    column: 'composite_aggressive_score',
    label: '激进',
    description: '技术与资金合计 60%，偏向高敏感度交易信号',
    weights: { technical: 35, money_flow: 25, fundamental: 15, growth: 10, value: 10, cycle: 5 },
  },
  {
    column: 'composite_value_oriented_score',
    label: '价值导向',
    description: '基本面与价值各 30%，寻找优质低估股票',
    weights: { fundamental: 30, value: 30, growth: 15, technical: 15, money_flow: 5, cycle: 5 },
  },
  {
    column: 'composite_growth_oriented_score',
    label: '成长导向',
    description: '成长 35%、基本面 25%，兼顾技术确认',
    weights: { growth: 35, fundamental: 25, technical: 20, money_flow: 10, value: 5, cycle: 5 },
  },
  {
    column: 'composite_trading_oriented_score',
    label: '交易导向',
    description: '技术 40%、资金 25%，强调短期趋势与资金行为',
    weights: { technical: 40, money_flow: 25, fundamental: 15, growth: 10, value: 5, cycle: 5 },
  },
  {
    column: 'composite_cycle_oriented_score',
    label: '动量导向',
    description: '动量 40%，搭配基本面与价值确认中期趋势',
    weights: { cycle: 40, fundamental: 20, value: 15, technical: 10, growth: 10, money_flow: 5 },
  },
  {
    column: 'composite_growth_cycle_score',
    label: '成长×动量 60:40',
    description: '研究层兼容组合：成长 60%、动量 40%',
    weights: { growth: 60, cycle: 40 },
  },
]

export function compositeScorePreset(column) {
  return COMPOSITE_SCORE_PRESETS.find((preset) => preset.column === column) || null
}

export function scoreWeightSummary(weights) {
  if (!weights || typeof weights !== 'object') return ''
  return Object.entries(weights)
    .filter(([, weight]) => Number.isFinite(Number(weight)) && Number(weight) > 0)
    .map(([dimension, weight]) => {
      const numeric = Number(weight)
      const pct = numeric <= 1 ? numeric * 100 : numeric
      const display = Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/\.?0+$/, '')
      return `${SCORE_DIMENSION_LABELS[dimension] || dimension} ${display}%`
    })
    .join(' · ')
}

export const DEFAULT_RANKING_WEIGHTS = {
  growth: 60,
  cycle: 40,
}

export function normalizeRankingWeights(weights) {
  const src = weights && typeof weights === 'object' ? weights : DEFAULT_RANKING_WEIGHTS
  const out = {}
  Object.keys(SCORE_DIMENSION_FIELDS).forEach((key) => {
    const n = Number(src[key])
    if (Number.isFinite(n) && n > 0) out[key] = n
  })
  if (Object.keys(out).length === 0) return { ...DEFAULT_RANKING_WEIGHTS }
  return out
}

export function serializeRankingWeights(weights) {
  return Object.entries(normalizeRankingWeights(weights))
    .map(([key, value]) => `${key}:${Number(value)}`)
    .join(',')
}

export function normalizedRankingWeightPercents(weights) {
  const w = normalizeRankingWeights(weights)
  const total = Object.values(w).reduce((sum, v) => sum + Number(v || 0), 0)
  if (total <= 0) return {}
  return Object.fromEntries(
    Object.entries(w).map(([key, value]) => [key, (Number(value || 0) / total) * 100])
  )
}

export function weightedDimensionScore(row, weights) {
  if (!row) return 0
  const w = normalizeRankingWeights(weights)
  const total = Object.values(w).reduce((sum, v) => sum + Number(v || 0), 0)
  if (total <= 0) return 0
  return Object.entries(w).reduce((sum, [key, value]) => {
    const field = SCORE_DIMENSION_FIELDS[key]
    return sum + Number(row[field] || 0) * (Number(value || 0) / total)
  }, 0)
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

function formatCsvReturnSincePct(v) {
  if (v == null || Number.isNaN(Number(v))) return ''
  const n = Number(v)
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

export function generateCSV(data, selectedDates, getEffectiveStrategyFor, getCompositeScoreFn, returnAsOf = '') {
  // data: array of stock records
  // selectedDates: array of yyyyMMdd strings
  // getEffectiveStrategyFor: function(symbol) -> strategyKey
  // getCompositeScoreFn: function(stock, strategyKey) -> number
  // returnAsOf: optional ISO/YYYYMMDD end date for「至选中日涨跌」column label

  const asOfLabel = (() => {
    const raw = String(returnAsOf || '').trim()
    if (raw) return formatDateDisplay(raw)
    const fromRow = data?.find((s) => s?.price_latest_trade_date)?.price_latest_trade_date
    return fromRow ? formatDateDisplay(fromRow) : '最新'
  })()
  const returnSinceHeader = `至选中日涨跌(${asOfLabel})`

  let headers = ['排名', '股票代码', '股票名称']
  const includePerDate = Array.isArray(selectedDates) && selectedDates.length > 0
  if (includePerDate) {
    selectedDates.forEach(d => {
      headers.push(`总分(${formatDateDisplay(d)})`)
      headers.push(`评分日后10日涨跌(${formatDateDisplay(d)})`)
      headers.push(`评分日后20日涨跌(${formatDateDisplay(d)})`)
      headers.push(`至选中日涨跌(${asOfLabel}|评分日${formatDateDisplay(d)})`)
    })
  } else {
    headers = headers.concat([
      '总分', '动量评分', '成长评分', '基本面评分', '价值评分', '技术面评分', '资金流评分',
      '评分日后10日涨跌', '评分日后20日涨跌', returnSinceHeader,
    ])
  }

  const rows = data.map((stock, index) => {
    const base = [index + 1, stock.symbol, stock.name || '']
    if (includePerDate) {
      selectedDates.forEach(d => {
        const stockStrat = getEffectiveStrategyFor(stock.symbol)
        const score = stock.per_date_scores?.[d]?.[stockStrat] ?? ''
        base.push(score)
        const fr = stock.per_date_future_return?.[d]
        base.push(formatCsvReturnSincePct(fr?.future_return_10d_pct))
        base.push(formatCsvReturnSincePct(fr?.future_return_20d_pct))
        const pr = stock.per_date_return_since?.[d]
        base.push(formatCsvReturnSincePct(pr?.return_since_score_pct))
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
      stock.money_flow_score,
      formatCsvReturnSincePct(stock.future_return_10d_pct),
      formatCsvReturnSincePct(stock.future_return_20d_pct),
      formatCsvReturnSincePct(stock.return_since_score_pct),
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
