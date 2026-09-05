import { describe, expect, it } from 'vitest'
import {
  DEFAULT_VISIBLE_MONTHS,
  defaultVisibleRange,
  formatLocalYmd,
  fullCacheVisibleRange,
  nextVisibleRange,
  normalizeChartDate,
  parseLocalYmd,
  shiftVisibleEarlier,
  subtractMonthsYmd,
} from '../chartVisibleWindow.js'

function makeRecords(startYmd, endYmd) {
  const start = parseLocalYmd(startYmd)
  const end = parseLocalYmd(endYmd)
  const out = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push({ trade_date: formatLocalYmd(cur) })
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

describe('chartVisibleWindow', () => {
  it('normalizes compact trade_date to YYYY-MM-DD', () => {
    expect(normalizeChartDate('20250315')).toBe('2025-03-15')
    expect(normalizeChartDate('2025-03-15T08:00:00')).toBe('2025-03-15')
  })

  it('defaultVisibleRange uses latest minus 6 months, not earliest bar', () => {
    const records = makeRecords('2024-01-01', '2025-01-15')
    const { start, end } = defaultVisibleRange(records, DEFAULT_VISIBLE_MONTHS)
    expect(end).toBe('2025-01-15')
    expect(start).toBe('2024-07-15')
    expect(start).not.toBe('2024-01-01')
  })

  it('defaultVisibleRange uses all data when listing is shorter than 6 months', () => {
    const records = makeRecords('2025-04-01', '2025-06-30')
    const { start, end } = defaultVisibleRange(records, DEFAULT_VISIBLE_MONTHS)
    expect(start).toBe('2025-04-01')
    expect(end).toBe('2025-06-30')
  })

  it('subtractMonthsYmd uses local calendar without UTC offset', () => {
    expect(subtractMonthsYmd('2025-03-15', 6)).toBe('2024-09-15')
    const d = parseLocalYmd('2025-08-31')
    d.setMonth(d.getMonth() - 6)
    expect(formatLocalYmd(d)).toBe(subtractMonthsYmd('2025-08-31', 6))
  })

  it('nextVisibleRange resets on symbol change', () => {
    const records = makeRecords('2024-01-01', '2025-01-15')
    const next = nextVisibleRange({
      symbol: '000002.SZ',
      prevSymbol: '000001.SZ',
      records,
      prevRecords: records,
      startDate: '2024-01-01',
      endDate: '2025-01-15',
    })
    expect(next.start).toBe('2024-07-15')
    expect(next.end).toBe('2025-01-15')
  })

  it('nextVisibleRange applies default when startDate is empty on first data', () => {
    const records = makeRecords('2024-01-01', '2025-01-15')
    const next = nextVisibleRange({
      symbol: '000001.SZ',
      prevSymbol: '000001.SZ',
      records,
      prevRecords: [],
      startDate: '',
      endDate: '',
    })
    expect(next.start).toBe('2024-07-15')
    expect(next.end).toBe('2025-01-15')
  })

  it('nextVisibleRange expands start only when older cache was prepended', () => {
    const prevRecords = makeRecords('2024-07-01', '2025-01-15')
    const records = makeRecords('2024-01-01', '2025-01-15')
    const next = nextVisibleRange({
      symbol: '000001.SZ',
      prevSymbol: '000001.SZ',
      records,
      prevRecords,
      startDate: '2024-07-01',
      endDate: '2025-01-15',
    })
    expect(next.start).toBe('2024-01-01')
    expect(next.end).toBe('2025-01-15')
  })

  it('nextVisibleRange keeps manual window when records refresh without older prepend', () => {
    const records = makeRecords('2024-01-01', '2025-01-15')
    const next = nextVisibleRange({
      symbol: '000001.SZ',
      prevSymbol: '000001.SZ',
      records,
      prevRecords: records,
      startDate: '2024-10-01',
      endDate: '2025-01-15',
    })
    expect(next.start).toBe('2024-10-01')
    expect(next.end).toBe('2025-01-15')
  })

  it('fullCacheVisibleRange spans entire cache', () => {
    const records = makeRecords('2024-01-01', '2025-01-15')
    expect(fullCacheVisibleRange(records)).toEqual({
      start: '2024-01-01',
      end: '2025-01-15',
    })
  })

  it('shiftVisibleEarlier shifts within cache before load-more', () => {
    const records = makeRecords('2024-01-01', '2025-01-15')
    const shift = shiftVisibleEarlier({
      records,
      startDate: '2024-07-15',
      endDate: '2025-01-15',
    })
    expect(shift.action).toBe('shift')
    expect(shift.start).toBe('2024-01-15')
    expect(shift.end).toBe('2025-01-15')
  })

  it('shiftVisibleEarlier requests load-more at cache left edge', () => {
    const records = makeRecords('2024-01-01', '2025-01-15')
    const result = shiftVisibleEarlier({
      records,
      startDate: '2024-01-01',
      endDate: '2025-01-15',
    })
    expect(result.action).toBe('load-more')
  })
})
