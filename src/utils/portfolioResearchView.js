/** Display helpers for Portfolio Research (no network, no Vue refs). */

import { compositeScorePreset, scoreWeightSummary } from './scoreUtils'
import { formatIndexRegimeLabel, formatRegimeModes, formatRegimeRule } from './regimeCash'

export const UNIVERSE_OPTIONS = [
  { value: 'hs300', label: 'hs300 - 沪深300' },
  { value: 'a500', label: 'a500 - 中证A500' },
  { value: 'csi500', label: 'csi500 - 中证500' },
  { value: 'csi1000', label: 'csi1000 - 中证1000' },
  { value: 'csi2000', label: 'csi2000 - 中证2000' },
  { value: 'star50', label: 'star50 - 科创50' },
]

// Official index launch dates (发布日). Data before an index existed is at best a
// retroactive proxy from current constituents, so research spanning earlier dates
// must be flagged.
export const INDEX_INCEPTION_DATES = {
  hs300: '20050408',
  csi500: '20070115',
  csi1000: '20141017',
  csi2000: '20230811',
  a500: '20240923',
  star50: '20200723',
}

/**
 * Returns notice info when the actual earliest score date is later than the
 * requested research start date, otherwise null.
 */
export function actualDataStartNotice(startDate, minScoreDate) {
  const start = String(startDate || '').replace(/\D/g, '').slice(0, 8)
  const min = String(minScoreDate || '').replace(/\D/g, '').slice(0, 8)
  if (start.length !== 8 || min.length !== 8) return null
  if (min <= start) return null
  return {
    requestedStart: compactDate(start),
    actualStart: compactDate(min),
  }
}

export function indexInceptionDate(universeIndex) {
  const key = String(universeIndex || '').toLowerCase()
  return INDEX_INCEPTION_DATES[key] || null
}

/**
 * Returns warning info when a research window starts before the index existed,
 * otherwise null.
 */
export function researchStartBeforeInception(universeIndex, startDate) {
  const inception = indexInceptionDate(universeIndex)
  if (!inception) return null
  const start = String(startDate || '').replace(/\D/g, '').slice(0, 8)
  if (start.length !== 8) return null
  if (start >= inception) return null
  return {
    universeIndex: String(universeIndex || '').toLowerCase(),
    startDate: compactDate(start),
    inceptionDate: compactDate(inception),
  }
}

export const PROGRESS_STAGE_LABELS = {
  loading_scores: '加载评分',
  building_dataset: '构建数据集',
  running_sweep: '参数扫描',
  rendering_report: '生成报告',
  generating_combo_details: '生成组合明细',
  writing_result: '写入结果',
}

export function universeName(value, options = UNIVERSE_OPTIONS) {
  const option = options.find((item) => item.value === value)
  return option?.label || value || 'universe'
}

export function compactDate(value) {
  if (!value) return '-'
  const text = String(value)
  if (text.length === 8) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

export function parseJobDate(value) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  const normalized = /[zZ]|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatJobDateTime(value) {
  const date = parseJobDate(value)
  if (!date) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

export function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '-'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds} 秒`
  const totalMinutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (totalMinutes < 60) {
    return seconds ? `${totalMinutes} 分 ${seconds} 秒` : `${totalMinutes} 分`
  }
  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (totalHours < 24) {
    return minutes ? `${totalHours} 小时 ${minutes} 分` : `${totalHours} 小时`
  }
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours ? `${days} 天 ${hours} 小时` : `${days} 天`
}

export function jobWeightLabel(job) {
  const scoreSpecs = job?.params?.score_specs
  if (Array.isArray(scoreSpecs) && scoreSpecs.length) {
    return scoreSpecs
      .map((spec) => {
        if (spec?.mode === 'column') {
          const preset = compositeScorePreset(spec.column)
          return preset
            ? `${preset.label}（${scoreWeightSummary(preset.weights)}）`
            : spec.column || ''
        }
        if (spec?.mode === 'weighted' && spec.weights) {
          return scoreWeightSummary(spec.weights)
        }
        return ''
      })
      .filter(Boolean)
      .join(' | ')
  }
  const weights = job?.params?.growth_cycle_weights
  if (Array.isArray(weights) && weights.length) {
    return weights.join(', ')
  }
  if (typeof weights === 'string' && weights.trim()) {
    return weights.trim()
  }
  return ''
}

/**
 * @param {object|null|undefined} job
 * @param {number} nowMs wall-clock ms for running/pending elapsed labels
 */
export function jobElapsedLabel(job, nowMs) {
  if (!job) return ''
  const status = job.status
  if (status === 'completed') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    const end = parseJobDate(job.completed_at)
    if (!start || !end) return ''
    return `用时 ${formatDurationMs(end.getTime() - start.getTime())}`
  }
  if (status === 'running') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    if (!start) return ''
    return `已运行 ${formatDurationMs(nowMs - start.getTime())}`
  }
  if (status === 'pending') {
    const start = parseJobDate(job.created_at)
    if (!start) return ''
    return `排队 ${formatDurationMs(nowMs - start.getTime())}`
  }
  if (status === 'failed') {
    const start = parseJobDate(job.started_at) || parseJobDate(job.created_at)
    const end = parseJobDate(job.completed_at) || parseJobDate(job.updated_at)
    if (!start || !end) return ''
    return `失败前运行 ${formatDurationMs(end.getTime() - start.getTime())}`
  }
  return ''
}

export function jobProgressStageLabel(job) {
  if (!job || job.status !== 'running' || !job.progress_stage) return ''
  return PROGRESS_STAGE_LABELS[job.progress_stage] || job.progress_stage
}

export function pct(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${(number * 100).toFixed(2)}%`
}

/** Trailing-stop ratio: decimal (0.15) or legacy percent points (15). */
export function pctTrailingStop(value) {
  if (value == null || value === '' || value === 0 || value === 0.0) return '关闭'
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return '关闭'
  const ratio = number > 1 ? number / 100 : number
  if (ratio <= 0 || ratio > 1) return '-'
  return `${(ratio * 100).toFixed(2)}%`
}

export function num(value, digits = 2) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toFixed(digits)
}

export function money(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function formatList(value, formatter = (item) => item) {
  if (Array.isArray(value)) {
    return value.map(formatter).join(', ')
  }
  if (value === undefined || value === null || value === '') return '-'
  return formatter(value)
}

export function formatBool(value) {
  if (value === undefined || value === null) return '-'
  return value ? 'true' : 'false'
}

export function formatTrailingStopParamValue(params) {
  if (Array.isArray(params?.trailing_stop_pcts) && params.trailing_stop_pcts.length) {
    return params.trailing_stop_pcts.map((value) => pctTrailingStop(value)).join(', ')
  }
  if (params?.trailing_stop_pct == null) return '-'
  return pctTrailingStop(params.trailing_stop_pct)
}

export function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return 'mut'
  return number > 0 ? 'pos' : 'neg'
}

export function buildComboSummaryCards(summary = {}) {
  const values = summary || {}
  return [
    { k: '累计收益(净)', v: pct(values.cumulative_return), cls: signClass(values.cumulative_return) },
    { k: '年化收益', v: pct(values.annualized_return), cls: signClass(values.annualized_return) },
    { k: 'Sharpe', v: num(values.sharpe), cls: '' },
    { k: '最大回撤', v: pct(values.max_drawdown), cls: 'neg' },
    {
      k: '超额(对指数)',
      v: pct(values.index_excess_cumulative_return),
      cls: signClass(values.index_excess_cumulative_return),
    },
    { k: '平均换手', v: pct(values.average_turnover), cls: '' },
    { k: '平均暴露', v: pct(values.average_exposure), cls: '' },
    { k: '调仓期数', v: num(values.periods, 0), cls: '' },
  ]
}

export function buildYearlyReturnRows(summary = {}) {
  const yearlyReturns = summary?.yearly_returns || {}
  const yearlyExcess = summary?.yearly_index_excess || {}
  return Object.keys(yearlyReturns)
    .sort()
    .map((year) => ({
      year,
      portfolioReturn: yearlyReturns[year],
      indexExcess: yearlyExcess[year],
    }))
}

export function filterAndSortTrades(
  trades = [],
  {
    dateFilter = '',
    symFilter = '',
    sortKey = 'score_date',
    sortDir = 1,
  } = {},
) {
  const df = dateFilter
  const sf = String(symFilter || '').trim()
  let rows = trades.slice()
  if (df) rows = rows.filter((row) => String(row.score_date) === df)
  if (sf) {
    rows = rows.filter((row) =>
      String(row.symbol || '').includes(sf) || String(row.name || '').includes(sf))
  }
  rows.sort((a, b) => {
    let x = a[sortKey]
    let y = b[sortKey]
    if (typeof x === 'string' || typeof y === 'string') {
      x = String(x)
      y = String(y)
      return sortDir * (x < y ? -1 : x > y ? 1 : 0)
    }
    x = x == null || Number.isNaN(Number(x)) ? -Infinity : Number(x)
    y = y == null || Number.isNaN(Number(y)) ? -Infinity : Number(y)
    return sortDir * (x - y)
  })
  return rows
}

function parseEquityDate(value) {
  const compact = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (compact.length !== 8) return null
  const year = Number(compact.slice(0, 4))
  const month = Number(compact.slice(4, 6))
  const day = Number(compact.slice(6, 8))
  const ms = Date.UTC(year, month - 1, day)
  const date = new Date(ms)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null
  return { compact, year, month, day, ms }
}

function equityDateLabel(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function calendarYearPosition(date) {
  const start = Date.UTC(date.year, 0, 1)
  const end = Date.UTC(date.year + 1, 0, 1)
  const lastDay = end - 24 * 60 * 60 * 1000
  return date.year + (date.ms - start) / (lastDay - start)
}

function calendarPositionLabel(position) {
  const year = Math.floor(position)
  const fraction = position - year
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  const lastDay = end - 24 * 60 * 60 * 1000
  const date = new Date(start + fraction * (lastDay - start))
  return equityDateLabel(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
}

function smoothCurveTangents(points) {
  if (points.length < 2) return []
  const slopes = points.slice(1).map((point, index) => (
    (point.y - points[index].y) / (point.x - points[index].x)
  ))
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0]
    if (index === points.length - 1) return slopes[slopes.length - 1]
    if (slopes[index - 1] * slopes[index] <= 0) return 0
    return (slopes[index - 1] + slopes[index]) / 2
  })

  // Fritsch-Carlson limiting prevents cubic overshoot between neighboring
  // equity observations while keeping the line visually smooth.
  for (let index = 0; index < slopes.length; index++) {
    const slope = slopes[index]
    if (slope === 0) {
      tangents[index] = 0
      tangents[index + 1] = 0
      continue
    }
    const alpha = tangents[index] / slope
    const beta = tangents[index + 1] / slope
    const magnitude = alpha * alpha + beta * beta
    if (magnitude <= 9) continue
    const scale = 3 / Math.sqrt(magnitude)
    tangents[index] = scale * alpha * slope
    tangents[index + 1] = scale * beta * slope
  }
  return tangents
}

function smoothSvgPath(points) {
  if (!points.length) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  const tangents = smoothCurveTangents(points)
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]
    const end = points[index + 1]
    const width = end.x - start.x
    const control1X = start.x + width / 3
    const control2X = end.x - width / 3
    const control1Y = start.y + tangents[index] * width / 3
    const control2Y = end.y - tangents[index + 1] * width / 3
    path += ` C ${control1X.toFixed(1)} ${control1Y.toFixed(1)},`
    path += ` ${control2X.toFixed(1)} ${control2Y.toFixed(1)},`
    path += ` ${end.x.toFixed(1)} ${end.y.toFixed(1)}`
  }
  return path
}

function smoothSvgSamples(points, samplesPerSegment = 12) {
  if (points.length < 2) {
    return [...points]
  }
  const tangents = smoothCurveTangents(points)
  const samples = [points[0]]
  for (let index = 0; index < points.length - 1; index++) {
    const start = points[index]
    const end = points[index + 1]
    const width = end.x - start.x
    for (let step = 1; step <= samplesPerSegment; step++) {
      const t = step / samplesPerSegment
      const t2 = t * t
      const t3 = t2 * t
      const h00 = 2 * t3 - 3 * t2 + 1
      const h10 = t3 - 2 * t2 + t
      const h01 = -2 * t3 + 3 * t2
      const h11 = t3 - t2
      samples.push({
        x: start.x + width * t,
        y: h00 * start.y +
          h10 * width * tangents[index] +
          h01 * end.y +
          h11 * width * tangents[index + 1],
      })
    }
  }
  return samples
}

function smoothSvgPoints(samples) {
  return samples.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
}

export function buildEquityChart(periods = [], trades = [], initialCapital = 1_000_000) {
  if (!Array.isArray(periods) || !periods.length) return null
  const w = 1100
  const h = 300
  const padL = 52
  const padR = 16
  const padT = 14
  const padB = 36

  const periodEndByScoreDate = new Map()
  for (const trade of Array.isArray(trades) ? trades : []) {
    const scoreDate = parseEquityDate(trade?.score_date)
    const sellDate = parseEquityDate(trade?.sell_date)
    if (!scoreDate || !sellDate) continue
    const previous = periodEndByScoreDate.get(scoreDate.compact)
    if (!previous || sellDate.ms > previous.ms) {
      periodEndByScoreDate.set(scoreDate.compact, sellDate)
    }
  }

  const events = periods
    .map((period) => {
      const scoreDate = parseEquityDate(period?.score_date)
      if (!scoreDate) return null
      const explicitEndDate = parseEquityDate(
        period?.period_end_date || period?.end_date || period?.exit_date,
      )
      const resolvedEndDate = explicitEndDate || periodEndByScoreDate.get(scoreDate.compact)
      const endDate = resolvedEndDate?.ms >= scoreDate.ms ? resolvedEndDate : scoreDate
      const portfolioReturn = Number(period.portfolio_return_net ?? period.portfolio_return ?? 0)
      const indexReturn = period.index_benchmark_return == null
        ? null
        : Number(period.index_benchmark_return)
      return {
        scoreDate,
        endDate,
        portfolioReturn: Number.isFinite(portfolioReturn) ? portfolioReturn : 0,
        indexReturn: Number.isFinite(indexReturn) ? indexReturn : null,
        regimeLabel: period?.regime_label || '',
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.endDate.ms - right.endDate.ms || left.scoreDate.ms - right.scoreDate.ms)
  if (!events.length) return null

  // Flat stretches with no rebalance mean the account value cannot move; surface
  // them so a long gap is not mistaken for a broken curve.
  const DAY_MS = 24 * 60 * 60 * 1000
  const gapThresholdDays = 60
  const dataGaps = []
  for (let index = 1; index < events.length; index++) {
    const previousEnd = events[index - 1].endDate
    const currentStart = events[index].scoreDate
    const days = Math.round((currentStart.ms - previousEnd.ms) / DAY_MS)
    if (days >= gapThresholdDays) {
      dataGaps.push({
        fromDate: equityDateLabel(previousEnd.year, previousEnd.month, previousEnd.day),
        toDate: equityDateLabel(currentStart.year, currentStart.month, currentStart.day),
        days,
      })
    }
  }

  const hasIdx = events.some((event) => event.indexReturn != null)
  const firstYear = Math.min(...events.map((event) => event.scoreDate.year))
  const lastYear = Math.max(...events.flatMap((event) => [
    event.scoreDate.year,
    event.endDate.year,
  ]))
  const actualEndDate = events.reduce((latest, event) => (
    event.endDate.ms > latest.ms ? event.endDate : latest
  ), events[0].endDate)
  const yearCount = lastYear - firstYear + 1
  const domainStart = firstYear
  const actualEndPosition = calendarYearPosition(actualEndDate)
  const domainEnd = Math.max(actualEndPosition, domainStart + 1 / 366)
  const X = (position) => (
    padL + (w - padL - padR) * ((position - domainStart) / (domainEnd - domainStart))
  )

  let stratEquity = 1
  let idxEquity = 1
  const equityEvents = []
  for (const event of events) {
    const position = calendarYearPosition(event.endDate)
    stratEquity *= 1 + event.portfolioReturn
    idxEquity *= 1 + (event.indexReturn ?? 0)
    equityEvents.push({
      scoreDate: equityDateLabel(
        event.scoreDate.year,
        event.scoreDate.month,
        event.scoreDate.day,
      ),
      endDate: equityDateLabel(event.endDate.year, event.endDate.month, event.endDate.day),
      endYear: event.endDate.year,
      position,
      stratEquity,
      idxEquity,
      regimeLabel: event.regimeLabel,
      startX: X(calendarYearPosition(event.scoreDate)),
      endX: X(position),
    })
  }

  const regimeBands = []
  for (const event of equityEvents) {
    if (!event.regimeLabel) continue
    const x = Math.min(event.startX, event.endX)
    const width = Math.max(Math.abs(event.endX - event.startX), 1)
    const previous = regimeBands[regimeBands.length - 1]
    if (previous && previous.label === event.regimeLabel) {
      previous.width = Math.max(previous.width, (x + width) - previous.x)
      continue
    }
    regimeBands.push({
      label: event.regimeLabel,
      displayLabel: formatIndexRegimeLabel(event.regimeLabel),
      x,
      width,
      y: padT,
      height: h - padT - padB,
    })
  }

  const yearBoundaries = []
  for (let year = firstYear; year <= lastYear; year++) {
    const isLastYear = year === lastYear
    const boundaryEndPosition = isLastYear ? actualEndPosition : year + 1
    const beforeYear = equityEvents.filter((event) => event.endYear < year)
    const throughYear = equityEvents.filter((event) => event.endYear <= year)
    const startEvent = beforeYear[beforeYear.length - 1]
    const endEvent = throughYear[throughYear.length - 1]
    yearBoundaries.push({
      year,
      startDate: `${year}-01-01`,
      endDate: isLastYear
        ? equityDateLabel(actualEndDate.year, actualEndDate.month, actualEndDate.day)
        : `${year}-12-31`,
      startStratEquity: startEvent?.stratEquity ?? 1,
      endStratEquity: endEvent?.stratEquity ?? 1,
      startIdxEquity: startEvent?.idxEquity ?? 1,
      endIdxEquity: endEvent?.idxEquity ?? 1,
      startX: X(year),
      endX: X(boundaryEndPosition),
      endPosition: boundaryEndPosition,
    })
  }

  const curveStateByPosition = new Map()
  for (const boundary of yearBoundaries) {
    curveStateByPosition.set(boundary.year, {
      position: boundary.year,
      date: boundary.startDate,
      stratEquity: boundary.startStratEquity,
      idxEquity: boundary.startIdxEquity,
    })
    curveStateByPosition.set(boundary.endPosition, {
      position: boundary.endPosition,
      date: boundary.endDate,
      stratEquity: boundary.endStratEquity,
      idxEquity: boundary.endIdxEquity,
    })
  }
  for (const event of equityEvents) {
    curveStateByPosition.set(event.position, {
      position: event.position,
      date: event.endDate,
      stratEquity: event.stratEquity,
      idxEquity: event.idxEquity,
    })
  }
  const curveStates = Array.from(curveStateByPosition.values())
    .sort((left, right) => left.position - right.position)

  const all = curveStates.flatMap((state) => (
    hasIdx ? [state.stratEquity, state.idxEquity] : [state.stratEquity]
  ))
  const mn = Math.min(...all)
  const mx = Math.max(...all)
  const Y = (value) => (
    padT + (h - padT - padB) * (1 - (value - mn) / ((mx - mn) || 1))
  )
  const chartPoints = (key) => curveStates.map((state) => ({
    x: X(state.position),
    y: Y(state[key]),
    position: state.position,
    equity: state[key],
    date: state.date,
  }))
  const stratCurvePoints = chartPoints('stratEquity')
  const idxCurvePoints = chartPoints('idxEquity')
  const stratCurveSamples = smoothSvgSamples(stratCurvePoints)
  const idxCurveSamples = smoothSvgSamples(idxCurvePoints)
  const capital = Number(initialCapital)
  const normalizedCapital = Number.isFinite(capital) && capital > 0 ? capital : 1_000_000
  const plotHeight = h - padT - padB
  const equityRange = mx - mn
  const sourceDateByX = new Map(
    stratCurvePoints.map((point) => [point.x.toFixed(1), point.date]),
  )
  const hoverPoints = stratCurveSamples.map((point) => {
    const position = domainStart +
      ((point.x - padL) / (w - padL - padR)) * (domainEnd - domainStart)
    const equity = equityRange
      ? mn + (1 - (point.y - padT) / plotHeight) * equityRange
      : mn
    const band = regimeBands.find((item) => point.x >= item.x && point.x <= item.x + item.width)
    return {
      x: point.x,
      y: point.y,
      date: sourceDateByX.get(point.x.toFixed(1)) || calendarPositionLabel(position),
      equity,
      accountValue: equity * normalizedCapital,
      regimeLabel: band?.displayLabel || '',
    }
  })

  const grid = []
  const gridTicks = 4
  for (let i = 0; i <= gridTicks; i++) {
    const value = mn + ((mx - mn) * i) / gridTicks
    grid.push({ y: Y(value), label: `${value.toFixed(2)}x` })
  }

  const axisTicks = []
  const xAxisGranularity = yearCount === 1 ? 'quarter' : 'year'
  if (yearCount === 1) {
    const quarterStarts = [
      { month: 1, label: `${firstYear}-01-01` },
      { month: 4, label: `${firstYear} Q2` },
      { month: 7, label: `${firstYear} Q3` },
      { month: 10, label: `${firstYear} Q4` },
    ]
    for (const tick of quarterStarts) {
      const date = parseEquityDate(`${firstYear}${String(tick.month).padStart(2, '0')}01`)
      const position = calendarYearPosition(date)
      if (position < actualEndPosition) {
        axisTicks.push({ label: tick.label, x: X(position) })
      }
    }
  } else {
    axisTicks.push({ label: `${firstYear}-01-01`, x: X(firstYear) })
    for (let year = firstYear + 1; year <= lastYear; year++) {
      if (year < actualEndPosition) axisTicks.push({ label: String(year), x: X(year) })
    }
  }
  const actualEndLabel = equityDateLabel(
    actualEndDate.year,
    actualEndDate.month,
    actualEndDate.day,
  )
  const lastAxisTick = axisTicks[axisTicks.length - 1]
  if (lastAxisTick && Math.abs(lastAxisTick.x - X(actualEndPosition)) < 0.1) {
    lastAxisTick.label = actualEndLabel
  } else {
    axisTicks.push({ label: actualEndLabel, x: X(actualEndPosition) })
  }
  const gaps = axisTicks.slice(1).map((tick, index) => tick.x - axisTicks[index].x)
  const rotate = gaps.some((gap) => gap < 60) ? -35 : 0
  axisTicks.forEach((tick, index) => {
    tick.rotate = rotate
    tick.anchor = index === 0 ? 'start' : index === axisTicks.length - 1 ? 'end' : 'middle'
  })

  return {
    w,
    h,
    padL,
    padR,
    padT,
    padB,
    grid,
    axisTicks,
    xAxisGranularity,
    yearBoundaries,
    equityEvents,
    curvePoints: curveStates,
    hoverPoints,
    dataGaps,
    regimeBands,
    hasIdx,
    stratPath: smoothSvgPath(stratCurvePoints),
    idxPath: smoothSvgPath(idxCurvePoints),
    stratSmoothPoints: smoothSvgPoints(stratCurveSamples),
    idxSmoothPoints: smoothSvgPoints(idxCurveSamples),
    firstDate: `${firstYear}-01-01`,
    lastDate: actualEndLabel,
  }
}

export function buildResearchParamRows(job, options = UNIVERSE_OPTIONS) {
  if (!job) return []
  const params = job.params || {}
  const rows = [
    { key: 'start_date', label: 'start_date', value: compactDate(params.start_date || job.start_date) },
    { key: 'end_date', label: 'end_date', value: compactDate(params.end_date || job.end_date) },
    { key: 'universe_index', label: 'universe', value: universeName(params.universe_index || job.universe_index, options) },
    { key: 'industry_l1', label: '申万 L1', value: params.industry_l1 || '-' },
    { key: 'score_column', label: 'score_column', value: params.score_column || '-' },
    { key: 'score_specs', label: '评分规格', value: jobWeightLabel(job) || params.score_column || '-' },
    { key: 'growth_cycle_weights', label: 'growth:cycle 权重', value: formatList(params.growth_cycle_weights) },
    {
      key: 'selection_mode',
      label: '选股方式',
      value: params.selection_mode === 'dynamic_score_threshold' ? '动态评分阈值' : '固定 Top N',
    },
    { key: 'top_n_values', label: 'Top N', value: formatList(params.top_n_values) },
    { key: 'threshold_lookback_days', label: '阈值回看天数', value: params.threshold_lookback_days ?? '-' },
    { key: 'max_positions', label: '最大持仓数', value: params.max_positions ?? '-' },
    { key: 'horizon', label: 'horizon', value: params.horizon ?? '-' },
    { key: 'rebalance_interval_days', label: 'rebalance intervals', value: formatList(params.rebalance_interval_days, (item) => `${item}d`) },
    { key: 'active_caps', label: 'active caps', value: formatList(params.active_caps, pct) },
    { key: 'transaction_cost', label: 'legacy transaction_cost', value: pct(params.transaction_cost) },
    { key: 'buy_commission_rate', label: 'buy commission', value: pct(params.buy_commission_rate) },
    { key: 'sell_commission_rate', label: 'sell commission', value: pct(params.sell_commission_rate) },
    { key: 'stamp_tax_rate', label: 'stamp tax', value: pct(params.stamp_tax_rate) },
    { key: 'index_benchmark_symbol', label: 'benchmark', value: params.index_benchmark_symbol || '-' },
    { key: 'cash_buffer', label: 'cash_buffer', value: pct(params.cash_buffer) },
    { key: 'initial_capital', label: 'initial_capital', value: money(params.initial_capital) },
    { key: 'trailing_stop_pcts', label: 'trailing_stop', value: formatTrailingStopParamValue(params) },
    { key: 'regime_modes', label: '仓位模式', value: formatRegimeModes(params) },
    { key: 'regime_rule', label: '择时规则', value: formatRegimeRule(params.regime_rule) },
    { key: 'force', label: 'force', value: formatBool(params.force) },
  ]
  return rows.map((row) => ({ ...row, value: row.value || '-' }))
}
