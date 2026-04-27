import { describe, it, expect } from 'vitest'
import { nextRankingTabMountedState } from '../rankingTabMountGate.js'

describe('nextRankingTabMountedState', () => {
  it('stays false until ranking tab is visited', () => {
    expect(nextRankingTabMountedState(false, 'etf')).toBe(false)
    expect(nextRankingTabMountedState(false, 'watchlist')).toBe(false)
  })

  it('becomes true when ranking tab is active', () => {
    expect(nextRankingTabMountedState(false, 'ranking')).toBe(true)
  })

  it('stays true after leaving ranking', () => {
    expect(nextRankingTabMountedState(true, 'etf')).toBe(true)
    expect(nextRankingTabMountedState(true, 'ranking')).toBe(true)
  })
})
