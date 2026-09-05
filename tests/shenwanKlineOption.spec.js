import { describe, expect, it } from 'vitest'
import { buildDecisionGsChartSeries, buildShenwanKlineOption, collectDecisionGsMarkers, formatKlinePriceLabel, padKlinePriceAxis } from '../src/utils/echarts/shenwanKlineOption.js'

function fmtAxis(value) {
  const s = String(value || '')
  if (s.length === 8 && /^\d+$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s.slice(0, 10)
}

function formatters(markers = []) {
  return {
    fmtAxis,
    formatNum2: (value) => Number(value).toFixed(2),
    toNumOrNull: (value) => {
      const n = Number(value)
      return Number.isFinite(n) ? n : null
    },
    formatVolShow: (value) => String(value),
    formatAmount: (value) => String(value),
    formatMvWan: (value) => String(value),
    markers,
  }
}

const bars = [
  { trade_date: '20260108', open: 10, high: 11, low: 9.5, close: 10.2, volume: 1000 },
  { trade_date: '20260109', open: 10.2, high: 11.5, low: 10, close: 11, volume: 1200 },
  { trade_date: '20260112', open: 11, high: 11.2, low: 10.8, close: 11.1, volume: 800 },
]

describe('buildShenwanKlineOption markers', () => {
  it('keeps nine-turn numeric markers', () => {
    const option = buildShenwanKlineOption(bars, formatters([
      { trade_date: '20260109', direction: 'up', high: 11.5, low: 10, label: 9, grade: 'perfect' },
    ]))
    const points = option.series[0].markPoint.data
    expect(points).toHaveLength(1)
    expect(points[0].label).toBe('9')
    expect(points[0].name).toBe('完美九转')
    expect(option.series.some((s) => String(s.name).startsWith('MA'))).toBe(true)
  })

  it('draws buy/sell pins, hides MA, and focuses the signal date', () => {
    const option = buildShenwanKlineOption(
      bars,
      formatters([
        { kind: 'buy', trade_date: '20260109', price: 10.5, highlighted: true },
        { kind: 'sell', trade_date: '20260112', price: 11.1, highlighted: false },
      ]),
      {
        showMa: false,
        focusDate: '20260109',
        markLineDate: '20260109',
        focusBarsBefore: 1,
        focusBarsAfter: 1,
      },
    )
    const candle = option.series[0]
    expect(option.series.some((s) => String(s.name).startsWith('MA'))).toBe(false)
    expect(candle.markPoint.data.map((p) => p.label)).toEqual(['买', '卖'])
    expect(candle.markPoint.data.map((p) => p.itemStyle.color)).toEqual(['#ef4444', '#22c55e'])
    expect(candle.markPoint.data[0].symbol).toBe('pin')
    expect(candle.markLine.data[0].xAxis).toBe('2026-01-09')
    expect(option.dataZoom[0].start).toBeLessThan(option.dataZoom[0].end)
  })

  it('draws G/S scatter (not pins) and decision overlays, hiding default MA', () => {
    const option = buildShenwanKlineOption(
      [
        { trade_date: '20260108', open: 10, high: 11, low: 9.5, close: 10.2, volume: 1000, mj20: 10.1, mj30: 10.0, gs_is_bull: true },
        { trade_date: '20260109', open: 10.2, high: 11.5, low: 10, close: 11, volume: 1200, mj20: 10.2, mj30: 10.05, gs_is_bull: true, gs_signal: 'g' },
        { trade_date: '20260112', open: 11, high: 11.2, low: 10.8, close: 10.9, volume: 800, mj20: 10.3, mj30: 10.4, gs_is_bull: false, gs_signal: 's' },
      ],
      formatters([
        { kind: 'g', trade_date: '20260109', low: 10, high: 11.5 },
        { kind: 's', trade_date: '20260112', low: 10.8, high: 11.2 },
      ]),
    )
    const candle = option.series[0]
    expect(candle.markPoint).toBeUndefined()
    expect(option.series.some((s) => s.name === '决策线')).toBe(true)
    expect(option.series.some((s) => s.name === '牛线')).toBe(true)
    expect(option.series.some((s) => s.name === '熊线')).toBe(true)
    const g = option.series.find((s) => s.name === 'G')
    const s = option.series.find((s) => s.name === 'S')
    expect(g.data).toEqual([{ value: ['2026-01-09', 10 * 0.988], price: 10 }])
    expect(s.data).toEqual([{ value: ['2026-01-12', 11.2 * 1.012], price: 11.2 }])
    expect(g.symbolSize).toBeGreaterThanOrEqual(22)
    expect(g.clip).toBe(false)
    expect(g.itemStyle.color).toBe('#fde047')
    expect(s.itemStyle.color).toBe('#fb923c')
    expect(typeof option.yAxis.min === 'function' || typeof option.yAxis[0]?.min === 'function').toBe(true)
    expect(option.series.some((s) => String(s.name).startsWith('MA'))).toBe(false)
  })
})

describe('buildDecisionGsChartSeries', () => {
  it('returns overlay and G/S scatter from record fields', () => {
    const series = buildDecisionGsChartSeries(
      [
        { trade_date: '20260108', mj20: 10.1, mj30: 10.0, gs_is_bull: true },
        { trade_date: '20260109', mj20: 10.2, mj30: 10.05, gs_is_bull: true, gs_signal: 'g', low: 10, high: 11.5 },
        { trade_date: '20260112', mj20: 10.3, mj30: 10.4, gs_is_bull: false, gs_signal: 's', low: 10.8, high: 11.2 },
      ],
      fmtAxis,
    )
    expect(series.map((s) => s.name)).toEqual(['决策线', '牛线', '熊线', 'G', 'S'])
    expect(series.find((s) => s.name === 'G').data).toEqual([{ value: ['2026-01-09', 10 * 0.988], price: 10 }])
    expect(series.find((s) => s.name === 'S').data).toEqual([{ value: ['2026-01-12', 11.2 * 1.012], price: 11.2 }])
    expect(series.find((s) => s.name === 'G').itemStyle.color).toBe('#fde047')
    expect(series.find((s) => s.name === 'S').itemStyle.color).toBe('#fb923c')
    expect(series.find((s) => s.name === 'G').label.color).toBe('#fffbeb')
    expect(series.find((s) => s.name === 'S').label.color).toBe('#fffbeb')
    expect(series.find((s) => s.name === 'G').clip).toBe(false)
    expect(series.find((s) => s.name === 'G').symbolSize).toBeGreaterThanOrEqual(22)
    expect(series.find((s) => s.name === 'G').label.textBorderWidth).toBeGreaterThanOrEqual(2)
    const decision = series.find((s) => s.name === '决策线')
    const bull = series.find((s) => s.name === '牛线')
    const bear = series.find((s) => s.name === '熊线')
    expect(decision.color).toBe('#facc15')
    expect(decision.itemStyle.color).toBe('#facc15')
    expect(decision.symbol).toBe('none')
    expect(decision.lineStyle.width).toBeGreaterThanOrEqual(2)
    expect(bull.color).toBe('#ef4444')
    expect(bull.itemStyle.color).toBe('#ef4444')
    expect(bear.color).toBe('#22c55e')
    expect(bear.itemStyle.color).toBe('#22c55e')
    expect(series.find((s) => s.name === 'G').legendHoverLink).toBe(false)
    expect(series.find((s) => s.name === 'S').legendHoverLink).toBe(false)
  })

  it('draws a weaker S? marker on the first s_watch bar only', () => {
    const series = buildDecisionGsChartSeries(
      [
        { trade_date: '20260108', mj20: 10.4, mj30: 10.0, gs_is_bull: true, low: 10.5, high: 11 },
        { trade_date: '20260109', mj20: 10.3, mj30: 10.0, gs_is_bull: true, gs_watch: 's', low: 9.8, high: 10.2 },
        { trade_date: '20260112', mj20: 10.2, mj30: 10.0, gs_is_bull: true, gs_watch: 's', low: 9.6, high: 10.0 },
        { trade_date: '20260113', mj20: 10.1, mj30: 10.05, gs_is_bull: false, gs_signal: 's', low: 9.4, high: 9.8 },
      ],
      fmtAxis,
    )
    const watch = series.find((s) => s.name === 'S?')
    expect(series.map((s) => s.name)).toEqual(['决策线', '牛线', '熊线', 'S', 'S?'])
    expect(watch.data).toEqual([{ value: ['2026-01-09', 10.2 * 1.012], price: 10.2 }])
    expect(watch.symbolSize).toBe(14)
    expect(watch.itemStyle.color).toBe('rgba(251, 146, 60, 0.12)')
    expect(watch.itemStyle.borderColor).toBe('#fb923c')
    expect(watch.label.formatter).toBe('S?')
  })

  it('returns empty when mj20 is missing', () => {
    expect(buildDecisionGsChartSeries(bars, fmtAxis)).toEqual([])
  })
})

describe('collectDecisionGsMarkers', () => {
  it('emits s_watch only on the first consecutive watch bar, newest-first input included', () => {
    const markers = collectDecisionGsMarkers([
      { trade_date: '20260113', gs_signal: 's', gs_watch: null, low: 9.4, high: 9.8 },
      { trade_date: '20260112', gs_watch: 's', low: 9.6, high: 10.0 },
      { trade_date: '20260109', gs_watch: 's', low: 9.8, high: 10.2 },
      { trade_date: '20260108', gs_signal: 'g', low: 10, high: 11.5 },
    ])
    expect(markers.map((item) => [item.kind, item.trade_date])).toEqual([
      ['g', '20260108'],
      ['s_watch', '20260109'],
      ['s', '20260113'],
    ])
  })
})

describe('padKlinePriceAxis', () => {
  it('adds min/max padding on the price axis', () => {
    const axis = padKlinePriceAxis({ type: 'value', scale: true })
    expect(axis.min({ min: 10, max: 20 })).toBe(9.4)
    expect(axis.max({ min: 10, max: 20 })).toBe(20.6)
  })

  it('formats price-axis labels and crosshair to two decimals', () => {
    const axis = padKlinePriceAxis({ type: 'value', scale: true })
    expect(axis.axisLabel.formatter(10.51 * 0.988)).toBe('10.38')
    expect(axis.axisPointer.label.formatter({ value: 11.2 * 1.012 })).toBe('11.33')
    expect(formatKlinePriceLabel(10.51 * 0.988)).toBe('10.38')
    expect(formatKlinePriceLabel(1.234, 3)).toBe('1.234')
  })
})

describe('kline tooltip price digits', () => {
  const gsBars = [
    { trade_date: '20260108', open: 10, high: 11, low: 9.5, close: 10.2, volume: 1000, mj20: 10.1, mj30: 10.0, gs_is_bull: true },
    { trade_date: '20260109', open: 10.2, high: 11.5, low: 10.51, close: 11, volume: 1200, mj20: 10.2, mj30: 10.05, gs_is_bull: true, gs_signal: 'g' },
    { trade_date: '20260112', open: 11, high: 11.2, low: 10.8, close: 10.9, volume: 800, mj20: 10.3, mj30: 10.4, gs_is_bull: false, gs_signal: 's' },
  ]

  it('shows G/S at the real high/low with two decimals, not the padded scatter Y', () => {
    const option = buildShenwanKlineOption(gsBars, formatters([
      { kind: 'g', trade_date: '20260109', low: 10.51, high: 11.5 },
      { kind: 's', trade_date: '20260112', low: 10.8, high: 11.2 },
    ]))
    const html = option.tooltip.formatter([
      {
        seriesName: 'G',
        dataIndex: 0,
        axisValue: '2026-01-09',
        data: option.series.find((s) => s.name === 'G').data[0],
      },
      {
        seriesName: 'K线',
        dataIndex: 1,
        data: [10.2, 11, 10.51, 11.5],
      },
    ])
    expect(html).toContain('G 10.51')
    expect(html).not.toContain(String(10.51 * 0.988))
    expect(html).toContain('开 10.20')
    expect(html).toContain('低 10.51')
  })

  it('shows S? at the real high with two decimals', () => {
    const option = buildShenwanKlineOption([
      { trade_date: '20260108', open: 10, high: 11, low: 9.5, close: 10.2, volume: 1000, mj20: 10.4, mj30: 10.0, gs_is_bull: true },
      { trade_date: '20260109', open: 10.2, high: 10.2, low: 9.8, close: 9.9, volume: 1200, mj20: 10.3, mj30: 10.0, gs_is_bull: true, gs_watch: 's' },
    ], formatters([
      { kind: 's_watch', trade_date: '20260109', low: 9.8, high: 10.2 },
    ]))
    const html = option.tooltip.formatter([
      {
        seriesName: 'S?',
        dataIndex: 0,
        axisValue: '2026-01-09',
        data: option.series.find((s) => s.name === 'S?').data[0],
      },
      {
        seriesName: 'K线',
        dataIndex: 1,
        data: [10.2, 9.9, 9.8, 10.2],
      },
    ])
    expect(html).toContain('S? 10.20')
    expect(html).not.toContain(String(10.2 * 1.012))
  })

  it('formats the price-axis crosshair to two decimals', () => {
    const option = buildShenwanKlineOption(gsBars, formatters([
      { kind: 'g', trade_date: '20260109', low: 10.51, high: 11.5 },
    ]))
    const yAxis = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis
    expect(yAxis.axisPointer.label.formatter({ value: 10.51 * 0.988 })).toBe('10.38')
    expect(yAxis.axisLabel.formatter(10.51)).toBe('10.51')
  })

  it('uses light palette when tone is on-light', () => {
    const option = buildShenwanKlineOption(bars, formatters(), { tone: 'on-light' })
    expect(option.backgroundColor).toBe('#ffffff')
    expect(option.textStyle.color).toBe('#475569')
    expect(option.tooltip.backgroundColor).toBe('#ffffff')
    const yAxis = Array.isArray(option.yAxis) ? option.yAxis[0] : option.yAxis
    expect(yAxis.splitLine.lineStyle.color).toBe('#e2e8f0')
  })
})
