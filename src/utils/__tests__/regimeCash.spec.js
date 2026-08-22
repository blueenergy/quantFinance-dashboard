import { describe, expect, it } from 'vitest'
import {
  buildRegimeModesFromForm,
  formatIndexRegimeLabel,
  formatRegimeModes,
  indexRegimeTone,
  isRegimeCashEnabled,
  regimeCashFromParams,
  regimeFlagsFromParams,
} from '../regimeCash'

describe('regime modes', () => {
  it('treats explicit true as enabled on any universe', () => {
    expect(isRegimeCashEnabled(true)).toBe(true)
    expect(regimeCashFromParams({ regime_cash: true })).toBe(true)
    expect(regimeCashFromParams({ regime_cash: false })).toBe(false)
    expect(regimeCashFromParams({})).toBe(false)
  })

  it('can select cash without always-invest', () => {
    expect(regimeFlagsFromParams({ regime_modes: ['bull_g60_else_cash'] })).toEqual({
      regime_always_invest: false,
      regime_cash: true,
    })
    expect(buildRegimeModesFromForm({
      regime_always_invest: false,
      regime_cash: true,
    })).toEqual(['bull_g60_else_cash'])
    expect(formatRegimeModes({ regime_modes: ['bull_g60_else_cash'] })).toBe('非牛空仓')
  })

  it('can sweep both first-class modes', () => {
    expect(regimeCashFromParams({ regime_modes: ['off', 'bull_g60_else_cash'] })).toBe(true)
    expect(regimeCashFromParams({ regime_modes: ['off'] })).toBe(false)
    expect(buildRegimeModesFromForm({
      regime_always_invest: true,
      regime_cash: true,
    })).toEqual(['off', 'bull_g60_else_cash'])
  })
})

describe('index regime labels', () => {
  it('maps MA tags to Chinese labels', () => {
    expect(formatIndexRegimeLabel('bull')).toBe('牛市')
    expect(formatIndexRegimeLabel('bear')).toBe('熊市')
    expect(formatIndexRegimeLabel('uncertain')).toBe('震荡')
    expect(formatIndexRegimeLabel('')).toBe('-')
    expect(indexRegimeTone('BULL')).toBe('bull')
    expect(indexRegimeTone('unknown')).toBe('')
  })
})
