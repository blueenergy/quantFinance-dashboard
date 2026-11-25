import { describe, expect, it } from 'vitest'
import {
  buildFibLevels,
  buildFibMarkLineData,
  buildFibOverlay,
  compactYmd,
  findLastSwing,
  findNearestRowIndex,
  formatAnchorDate,
  toDateInput,
} from '../fibonacci.js'

const swingRows = [
  { trade_date: '20240101', low: 100, high: 101 },
  { trade_date: '20240102', low: 200, high: 201 },
  { trade_date: '20240103', low: 150, high: 151 },
  { trade_date: '20240104', low: 120, high: 121 },
  { trade_date: '20240105', low: 180, high: 181 },
  { trade_date: '20240106', low: 250, high: 251 },
  { trade_date: '20240107', low: 300, high: 301 },
  { trade_date: '20240108', low: 190, high: 191 },
  { trade_date: '20240109', low: 180, high: 181 },
]

describe('fibonacci', () => {
  it('normalizes date formats', () => {
    expect(compactYmd('2024-01-05')).toBe('20240105')
    expect(toDateInput('20240105')).toBe('2024-01-05')
    expect(formatAnchorDate('20240105')).toBe('2024-01-05')
    expect(toDateInput('')).toBe('')
  })

  it('finds the last confirmed up-swing using low/high anchors', () => {
    const swing = findLastSwing(swingRows)
    expect(swing).not.toBeNull()
    expect(swing.startIndex).toBe(3)
    expect(swing.endIndex).toBe(6)
    expect(swing.low).toBe(120)
    expect(swing.high).toBe(301)
    expect(swing.startDate).toBe('20240104')
    expect(swing.endDate).toBe('20240107')
    expect(swing.amplitude).toBeCloseTo(301 / 120 - 1, 6)
  })

  it('returns null when no swing is confirmed', () => {
    const rising = [
      { trade_date: '20240101', low: 100, high: 101 },
      { trade_date: '20240102', low: 150, high: 151 },
      { trade_date: '20240103', low: 200, high: 201 },
    ]
    expect(findLastSwing(rising)).toBeNull()
  })

  it('builds standard retracement levels from the high downward', () => {
    const levels = buildFibLevels(100, 200)
    expect(levels).toHaveLength(7)
    expect(levels[0]).toMatchObject({ ratio: 0, price: 200, isAnchor: true })
    expect(levels.at(-1)).toMatchObject({ ratio: 1, price: 100, isAnchor: true })
    const half = levels.find((level) => level.ratio === 0.5)
    expect(half.price).toBeCloseTo(150, 6)
    const fib236 = levels.find((level) => level.ratio === 0.236)
    expect(fib236.price).toBeCloseTo(176.4, 6)
  })

  it('builds markLine data with ratio and price labels', () => {
    const lines = buildFibMarkLineData(buildFibLevels(100, 200))
    expect(lines).toHaveLength(7)
    expect(lines[1].label.formatter).toBe('23.6%  176.40')
    expect(lines[1].lineStyle.type).toBe('dashed')
    expect(lines[0].lineStyle.type).toBe('solid')
    expect(buildFibMarkLineData([{ ratio: 0.5, price: NaN }])).toEqual([])
  })

  it('rejects invalid anchors', () => {
    expect(buildFibLevels(200, 100)).toEqual([])
    expect(buildFibLevels(null, 100)).toEqual([])
  })

  it('falls back to the window low -> high when no swing is confirmed', () => {
    const rising = [
      { trade_date: '20240101', low: 100, high: 101 },
      { trade_date: '20240102', low: 150, high: 151 },
      { trade_date: '20240103', low: 200, high: 201 },
    ]
    const overlay = buildFibOverlay(rising)
    expect(overlay).not.toBeNull()
    expect(overlay.auto).toBe(true)
    expect(overlay.low).toBe(100)
    expect(overlay.high).toBe(201)
  })

  it('uses the auto swing when anchors are empty', () => {
    const overlay = buildFibOverlay(swingRows)
    expect(overlay.auto).toBe(true)
    expect(overlay.low).toBe(120)
    expect(overlay.high).toBe(301)
    expect(overlay.levels).toHaveLength(7)
  })

  it('uses the explicit date range when both anchors are valid', () => {
    const overlay = buildFibOverlay(swingRows, {
      startDate: '2024-01-01',
      endDate: '2024-01-07',
    })
    expect(overlay.auto).toBe(false)
    expect(overlay.low).toBe(100)
    expect(overlay.high).toBe(301)
    expect(overlay.startDate).toBe('20240101')
    expect(overlay.endDate).toBe('20240107')
  })

  it('falls back to auto when the explicit dates are inverted', () => {
    const overlay = buildFibOverlay(swingRows, {
      startDate: '2024-01-07',
      endDate: '2024-01-01',
    })
    expect(overlay.auto).toBe(true)
    expect(overlay.low).toBe(120)
  })

  it('snaps dates to the nearest trading day', () => {
    expect(findNearestRowIndex(swingRows, '2024-01-05')).toBe(4)
    expect(findNearestRowIndex(swingRows, '2030-01-01')).toBe(swingRows.length - 1)
    expect(findNearestRowIndex(swingRows, 'bad-date')).toBe(-1)
  })

  it('returns null for empty or single-row input', () => {
    expect(buildFibOverlay([])).toBeNull()
    expect(buildFibOverlay([{ trade_date: '20240101', low: 100, high: 101 }])).toBeNull()
  })
})
