import { describe, expect, it } from 'vitest'
import {
  buildRegimeModesFromForm,
  formatIndexRegimeLabel,
  formatRegimeModes,
  formatRegimeRule,
  indexRegimeTone,
  isRegimeCashEnabled,
  regimeCashFromParams,
  regimeFlagsFromParams,
  regimeRuleFromParams,
  regimeRulesFromParams,
  regimeRulesMissingOnRows,
  toggleRegimeRuleSelection,
  VOLUME_PRICE_REGIME_RULE,
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

describe('regime rule', () => {
  it('defaults missing rules to price K and labels volume-price timing', () => {
    expect(regimeRuleFromParams({})).toBe('k_slow_anchor')
    expect(regimeRuleFromParams({ regime_rule: VOLUME_PRICE_REGIME_RULE })).toBe(VOLUME_PRICE_REGIME_RULE)
    expect(formatRegimeRule(VOLUME_PRICE_REGIME_RULE)).toContain('量价择时')
    expect(formatRegimeRule('k_slow_anchor')).toContain('价格K交叉')
  })

  it('resolves multi-select regime rules from params and toggles', () => {
    expect(regimeRulesFromParams({ regime_rules: ['k_slow_anchor', 'k_slow_anchor_with_volume'] })).toEqual([
      'k_slow_anchor',
      'k_slow_anchor_with_volume',
    ])
    expect(toggleRegimeRuleSelection(['k_slow_anchor'], 'k_slow_anchor_with_volume', true)).toEqual([
      'k_slow_anchor',
      'k_slow_anchor_with_volume',
    ])
    expect(toggleRegimeRuleSelection(['k_slow_anchor'], 'k_slow_anchor', false)).toEqual(['k_slow_anchor'])
  })

  it('detects when multi-rule jobs lack regime_rule on cash rows', () => {
    const params = { regime_rules: ['k_slow_anchor', 'k_slow_anchor_with_volume'] }
    expect(regimeRulesMissingOnRows(params, [
      { regime_mode: 'bull_g60_else_cash' },
      { regime_mode: 'off' },
    ])).toBe(true)
    expect(regimeRulesMissingOnRows(params, [
      { regime_mode: 'bull_g60_else_cash', regime_rule: 'k_slow_anchor' },
      { regime_mode: 'bull_g60_else_cash', regime_rule: 'k_slow_anchor_with_volume' },
    ])).toBe(false)
  })
})
