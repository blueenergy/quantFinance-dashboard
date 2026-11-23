import { describe, expect, it } from 'vitest'
import { driftActionBadge } from '../usePortfolioPlanFormat'

describe('driftActionBadge', () => {
  it('shows the intended sell a monitor plan will not execute', () => {
    // The backend stamps action=hold / delta=0 because a monitor plan cannot
    // trade; a held name whose target is 0 still means "sell it".
    const badge = driftActionBadge({ action: 'hold', current_shares: 1400, target_shares: 0, drift_delta_shares: -1400 })
    expect(badge.text).toBe('S')
    expect(badge.label).toContain('拟卖出')
  })

  it('shows the intended buy for a new name', () => {
    expect(driftActionBadge({ action: 'skip', current_shares: 0, drift_delta_shares: 500 }).text).toBe('B')
  })

  it('keeps a held name with no drift as hold', () => {
    expect(driftActionBadge({ action: 'hold', current_shares: 1400, drift_delta_shares: 0 }).text).toBe('H')
  })

  it('keeps an unheld name with no drift as skip', () => {
    expect(driftActionBadge({ action: 'skip', current_shares: 0, drift_delta_shares: 0 }).text).toBe('·')
  })
})
