import { describe, expect, it } from 'vitest'
import { buildShenwanKlineOption } from '../src/utils/echarts/shenwanKlineOption.js'

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
    expect(candle.markPoint.data[0].symbol).toBe('pin')
    expect(candle.markLine.data[0].xAxis).toBe('2026-01-09')
    expect(option.dataZoom[0].start).toBeLessThan(option.dataZoom[0].end)
  })
})
