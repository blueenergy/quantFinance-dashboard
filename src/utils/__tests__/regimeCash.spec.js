import { describe, expect, it } from 'vitest'
import { isRegimeCashEnabled, regimeCashFromParams } from '../regimeCash'

describe('regimeCashFromParams', () => {
  it('treats explicit true as enabled on any universe', () => {
    expect(isRegimeCashEnabled(true)).toBe(true)
    expect(regimeCashFromParams({ regime_cash: true })).toBe(true)
    expect(regimeCashFromParams({ regime_cash: false })).toBe(false)
    expect(regimeCashFromParams({})).toBe(false)
  })

  it('treats a non-off regime_modes sweep as enabled', () => {
    expect(regimeCashFromParams({ regime_modes: ['off', 'bull_g60_else_cash'] })).toBe(true)
    expect(regimeCashFromParams({ regime_modes: ['off'] })).toBe(false)
  })
})
