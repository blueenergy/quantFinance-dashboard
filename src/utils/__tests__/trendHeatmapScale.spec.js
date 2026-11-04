import { describe, expect, it } from 'vitest'
import {
  TREND_BINS,
  formatTrendScore,
  trendCellStyle,
  trendLegendGradient,
} from '../trendHeatmapScale.js'

describe('trendHeatmapScale', () => {
  it('missing score uses the neutral empty style', () => {
    expect(trendCellStyle(null).background).toBe('#f1f5f9')
    expect(trendCellStyle(undefined).background).toBe('#f1f5f9')
    expect(trendCellStyle('not-a-number').background).toBe('#f1f5f9')
  })

  it('clamps scores into the 0-100 ramp', () => {
    expect(trendCellStyle(-10)).toEqual(trendCellStyle(0))
    expect(trendCellStyle(120)).toEqual(trendCellStyle(100))
  })

  it('weak scores are blue and strong scores are red', () => {
    const weak = trendCellStyle(5)
    const neutral = trendCellStyle(55)
    const strong = trendCellStyle(95)
    expect(weak.background).toBe(TREND_BINS[0].bg)
    expect(neutral.background).toBe(TREND_BINS[5].bg)
    expect(strong.background).toBe(TREND_BINS[9].bg)
    expect(weak.color).toBe('#ffffff')
    expect(strong.color).toBe('#ffffff')
  })

  it('scores either side of 50 land in different bins', () => {
    expect(trendCellStyle(49).background).not.toBe(trendCellStyle(51).background)
  })

  it('formats scores as integers and missing as a dash', () => {
    expect(formatTrendScore(61.7)).toBe('62')
    expect(formatTrendScore(null)).toBe('—')
  })

  it('legend gradient spans the full ramp', () => {
    const gradient = trendLegendGradient()
    expect(gradient.startsWith('linear-gradient(90deg,')).toBe(true)
    expect(gradient).toContain('0%')
    expect(gradient).toContain('90%')
    expect(gradient).toContain(TREND_BINS[0].bg)
    expect(gradient).toContain(TREND_BINS[9].bg)
  })
})
