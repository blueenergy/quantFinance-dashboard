import { describe, expect, it } from 'vitest'
import {
  buildParamDiff,
  normalizeStrategies,
  normalizeSuggestionParams,
  normalizeTemplateGroups,
  stableStringify,
  stringifyValue,
} from './strategyLabParams'

describe('strategyLabParams', () => {
  it('builds a stable diff for added, changed, and removed params', () => {
    const diff = buildParamDiff(
      { atr: 20, risk: 0.01, obsolete: true },
      { atr: 30, risk: 0.01, stop_loss: 0.08 }
    )

    expect(diff.beforeText).toBe('{\n  "atr": 20,\n  "obsolete": true,\n  "risk": 0.01\n}')
    expect(diff.afterText).toBe('{\n  "atr": 30,\n  "risk": 0.01,\n  "stop_loss": 0.08\n}')
    expect(diff.changes).toEqual([
      { key: 'atr', before: 20, after: 30, type: 'changed', label: '修改' },
      { key: 'obsolete', before: true, after: undefined, type: 'removed', label: '删除' },
      { key: 'stop_loss', before: undefined, after: 0.08, type: 'added', label: '新增' },
    ])
  })

  it('normalizes multiple AI suggestion shapes to strategy params', () => {
    expect(normalizeSuggestionParams({ strategy_params: { atr: 30 } })).toEqual({ atr: 30 })
    expect(normalizeSuggestionParams({ params: { risk: 0.02 } })).toEqual({ risk: 0.02 })
    expect(normalizeSuggestionParams({ suggested_params: { stop_loss: 0.08 } })).toEqual({ stop_loss: 0.08 })
    expect(normalizeSuggestionParams({ name: 'atr', suggested_values: [25, 30] })).toEqual({ atr: 25 })
    expect(normalizeSuggestionParams({ name: 'risk', value: 0.015 })).toEqual({ risk: 0.015 })
    expect(normalizeSuggestionParams(null)).toEqual({})
  })

  it('stringifies values consistently for the diff chips', () => {
    expect(stableStringify({ b: 2, a: { d: 4, c: 3 } })).toBe('{\n  "a": {\n    "c": 3,\n    "d": 4\n  },\n  "b": 2\n}')
    expect(stringifyValue(undefined)).toBe('undefined')
    expect(stringifyValue('turtle')).toBe('turtle')
    expect(stringifyValue({ atr: 20 })).toBe('{"atr":20}')
  })

  it('normalizes strategy metadata and keeps fallback choices visible', () => {
    const normalized = normalizeStrategies(
      [
        { strategy_key: 'hidden_dragon', label: '潜龙低吸', can_use: false },
        { value: 'grid', name: '网格策略' },
      ],
      [
        { key: 'hidden_dragon', name: '本地潜龙' },
        { key: 'turtle', name: '海龟交易法' },
      ]
    )

    expect(normalized).toEqual([
      {
        strategy_key: 'hidden_dragon',
        label: '潜龙低吸',
        can_use: false,
        key: 'hidden_dragon',
        name: '潜龙低吸',
        allow_backtest: true,
      },
      {
        value: 'grid',
        name: '网格策略',
        key: 'grid',
        allow_backtest: true,
        can_use: true,
      },
      {
        key: 'turtle',
        name: '海龟交易法',
        allow_backtest: true,
        can_use: true,
      },
    ])
  })

  it('merges template API results with fallback templates', () => {
    const merged = normalizeTemplateGroups(
      { hidden_dragon: [{ preset: 'dragon_default' }], turtle: [] },
      { turtle: [{ preset: 'turtle_conservative' }] }
    )

    expect(merged).toEqual({
      hidden_dragon: [{ preset: 'dragon_default' }],
      turtle: [{ preset: 'turtle_conservative' }],
    })
  })
})
