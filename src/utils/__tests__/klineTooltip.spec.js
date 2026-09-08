import { describe, expect, it } from 'vitest'
import {
  changePct,
  compactYmd,
  dayChangePctForBar,
  formatChartNum2,
  formatPctChange,
  prevCloseForCompactDay,
} from '../klineTooltip.js'

const daily = [
  { trade_date: '20260907', close: 64.00 },
  { trade_date: '20260908', close: 66.48 },
]

describe('klineTooltip', () => {
  it('compacts minute timestamps to the session day', () => {
    expect(compactYmd('202609081400')).toBe('20260908')
    expect(compactYmd('2026-09-08')).toBe('20260908')
  })

  it('uses the previous trading day close, not the axis time', () => {
    expect(prevCloseForCompactDay('202609081400', daily)).toBe(64)
    expect(changePct(66.48, 64)).toBeCloseTo(3.875, 3)
  })

  it('does not treat the ECharts category as open', () => {
    expect(formatChartNum2('14:00')).toBe('-')
    expect(formatChartNum2(66.48)).toBe('66.48')
  })

  it('formats signed percent labels', () => {
    expect(formatPctChange(3.875)).toBe('+3.88%')
    expect(formatPctChange(-1.2)).toBe('-1.20%')
    expect(formatPctChange(0)).toBe('0.00%')
  })

  it('computes 当天涨跌幅 from daily 昨收 for a 60m bar', () => {
    const series = [
      { trade_date: '202609071500', open: 63.5, close: 64.0, low: 63.4, high: 64.2 },
      { trade_date: '202609081400', open: 65.1, close: 66.48, low: 64.9, high: 66.6 },
    ]
    const pct = dayChangePctForBar(series[1], 1, series, daily)
    expect(pct).toBeCloseTo(3.875, 3)
  })
})
