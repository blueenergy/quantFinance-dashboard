import { describe, expect, it } from 'vitest'
import { etfRowPct, formatEtfKlineTooltip } from '../etfKlineTooltip.js'

// 588080.SH 20261113 as returned by /api/etf/588080.SH/kline
const rows = [
  {
    trade_date: '20261113',
    open: 1.359,
    close: 1.312,
    low: 1.302,
    high: 1.375,
    pre_close: 1.342,
    pct_chg: -2.2354694485842046,
    vol: 19727073.74,
    amount: 2636358.696,
    fd_share: 3404262.81,
  },
  {
    trade_date: '20261112',
    open: 1.333,
    close: 1.342,
    low: 1.33,
    high: 1.398,
    pre_close: 1.335,
    pct_chg: 0.5243445692883983,
    vol: 23687884.49,
    amount: 3229709.074,
    fd_share: 3404262.81,
  },
]

describe('etfKlineTooltip', () => {
  it('reads the source row by dataIndex, not the shifted ECharts params.data', () => {
    // ECharts candlestick mutates each item via item.unshift(index), so the
    // tooltip param looks like [index, open, close, low, high]. If the formatter
    // ever reads that array again, 开 becomes 249.000 for a 250-bar series.
    const shiftedParamsData = [249, 1.359, 1.312, 1.302, 1.375]
    const html = formatEtfKlineTooltip(rows, 0)
    expect(shiftedParamsData[0]).toBe(249)
    expect(html).toContain('开 1.359')
    expect(html).toContain('收 1.312')
    expect(html).toContain('低 1.302')
    expect(html).toContain('高 1.375')
    expect(html).not.toContain('249.000')
  })

  it('shows the server pct_chg with sign and color', () => {
    const html = formatEtfKlineTooltip(rows, 0)
    expect(html).toContain('-2.24%')
    expect(html).toContain('#26a69a')
    const second = formatEtfKlineTooltip(rows, 1)
    expect(second).toContain('+0.52%')
  })

  it('falls back to the previous bar close when pct_chg is missing', () => {
    const local = [
      { trade_date: '20261112', close: 1.342 },
      { trade_date: '20261113', open: 1.359, close: 1.312, low: 1.302, high: 1.375 },
    ]
    expect(etfRowPct(local[1], 1, local)).toBeCloseTo((1.312 - 1.342) / 1.342 * 100, 6)
    expect(etfRowPct(local[0], 0, local)).toBeNull()
  })

  it('formats volume in hands and turnover in yuan', () => {
    const html = formatEtfKlineTooltip(rows, 0)
    expect(html).toContain('1972.71万手')
    expect(html).toContain('26.36亿')
    expect(html).toContain('3,404,262.81万份')
  })
})
