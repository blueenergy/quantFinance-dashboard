import { describe, expect, it } from 'vitest'
import { buildDecisionGsChartSeries, buildShenwanKlineOption } from '../src/utils/echarts/shenwanKlineOption.js'

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

  it('draws G/S pins and decision overlays, hiding default MA', () => {
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
    expect(candle.markPoint.data.map((p) => p.label)).toEqual(['G', 'S'])
    expect(candle.markPoint.data.map((p) => p.itemStyle.color)).toEqual(['#ef4444', '#22c55e'])
    expect(option.series.some((s) => s.name === '决策线')).toBe(true)
    expect(option.series.some((s) => s.name === '牛线')).toBe(true)
    expect(option.series.some((s) => s.name === '熊线')).toBe(true)
    expect(option.series.find((s) => s.name === 'G').data).toEqual([['2026-01-09', 10]])
    expect(option.series.find((s) => s.name === 'S').data).toEqual([['2026-01-12', 11.2]])
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
    expect(series.find((s) => s.name === 'G').data).toEqual([['2026-01-09', 10]])
    expect(series.find((s) => s.name === 'S').data).toEqual([['2026-01-12', 11.2]])
    expect(series.find((s) => s.name === 'G').itemStyle.color).toBe('#ef4444')
    expect(series.find((s) => s.name === 'S').itemStyle.color).toBe('#22c55e')
    expect(series.find((s) => s.name === 'G').label.color).toBe('#fca5a5')
    expect(series.find((s) => s.name === 'S').label.color).toBe('#86efac')
  })

  it('returns empty when mj20 is missing', () => {
    expect(buildDecisionGsChartSeries(bars, fmtAxis)).toEqual([])
  })
})
