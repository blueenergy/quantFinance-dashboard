import { describe, expect, it } from 'vitest'
import {
  heatmapCellBackground,
  heatmapCellForeground,
  heatmapIntensityCap,
  heatmapRateLevel,
  formatInflowRatePct,
  formatInflowYi,
} from '../etfHeatmapScale.js'

describe('etfHeatmapScale', () => {
  it('heatmapIntensityCap uses 95th percentile of abs rates', () => {
    const cap = heatmapIntensityCap([0.01, 0.02, 0.03, 0.04, 0.5])
    expect(cap).toBe(0.04)
  })

  it('heatmapIntensityCap defaults to 1 when empty', () => {
    expect(heatmapIntensityCap([])).toBe(1)
  })

  it('heatmapRateLevel assigns higher level for larger |rate|', () => {
    const cap = 0.1
    const low = heatmapRateLevel(0.02, cap)
    const high = heatmapRateLevel(0.09, cap)
    expect(low.sign).toBe('pos')
    expect(high.level).toBeGreaterThan(low.level)
  })

  it('heatmapRateLevel negative sign for outflow', () => {
    expect(heatmapRateLevel(-0.05, 0.1).sign).toBe('neg')
  })

  it('heatmapCellBackground returns neutral for zero', () => {
    expect(heatmapCellBackground(0, 0.1)).toBe('#f1f5f9')
  })

  it('heatmapCellBackground uses opaque red for inflow', () => {
    expect(heatmapCellBackground(0.08, 0.1)).toMatch(/^#/)
  })

  it('uses white foreground on the darkest color step', () => {
    expect(heatmapCellForeground(0.1, 0.1)).toBe('#ffffff')
  })

  it('does not present missing data as zero', () => {
    expect(formatInflowRatePct(null)).toBe('—')
    expect(formatInflowYi(null)).toBe('—')
  })
})
