import { describe, expect, it } from 'vitest'
import {
  buildAllCombos,
  buildCompareSubmitPayload,
  buildStrategyCombos,
  comboPreviewKey,
  parseCsvBooleans,
  parseExperimentValues,
} from '../backtestComboPayload.js'

describe('parseCsvBooleans', () => {
  it('parses true/false variants case-insensitively', () => {
    expect(parseCsvBooleans('true, false, TRUE, 0')).toEqual([true, false, true, false])
  })
})

describe('parseExperimentValues', () => {
  it('parses integer grids from comma-separated numbers', () => {
    expect(parseExperimentValues('10,20,30', 5)).toEqual([10, 20, 30])
  })

  it('rejects comma-separated string grids', () => {
    expect(() => parseExperimentValues('a,b', 'default')).toThrow(/字符串/)
  })
})

describe('buildStrategyCombos', () => {
  const presets = [
    {
      preset: 'default',
      name: 'Default',
      params_with_desc: {
        entry_period: { value: 20 },
        use_filter: { value: true },
      },
    },
    {
      preset: 'aggressive',
      name: 'Aggressive',
      params_with_desc: {
        entry_period: { value: 10 },
        use_filter: { value: false },
      },
    },
  ]

  it('sums combos across presets without cross-multiplying strategies', () => {
    const turtle = buildStrategyCombos({
      strategyKey: 'turtle',
      presets,
      selectedPresetKeys: ['default', 'aggressive'],
      experimentValuesByPreset: {},
    })
    expect(turtle.length).toBe(2)

    const maPresets = [
      {
        preset: 'default',
        params_with_desc: { fast: { value: 5 }, slow: { value: 20 } },
      },
    ]
    const ma = buildStrategyCombos({
      strategyKey: 'ma',
      presets: maPresets,
      selectedPresetKeys: ['default'],
      experimentValuesByPreset: { default: { fast: '5,10' } },
    })
    expect(ma.length).toBe(2)

    const all = buildAllCombos([
      {
        strategyKey: 'turtle',
        presets,
        selectedPresetKeys: ['default', 'aggressive'],
        experimentValuesByPreset: {},
      },
      {
        strategyKey: 'ma',
        presets: maPresets,
        selectedPresetKeys: ['default'],
        experimentValuesByPreset: { default: { fast: '5,10' } },
      },
    ])
    expect(all.length).toBe(4)
  })

  it('materializes full strategy_params per combo', () => {
    const combos = buildStrategyCombos({
      strategyKey: 'turtle',
      presets,
      selectedPresetKeys: ['default'],
      experimentValuesByPreset: { default: { entry_period: '10,20' } },
    })
    expect(combos.length).toBe(2)
    expect(combos[0].strategy_params).toEqual({ entry_period: 10, use_filter: true })
    expect(combos[1].strategy_params).toEqual({ entry_period: 20, use_filter: true })
    expect(combos[0].preview_key).toBe(comboPreviewKey('turtle', 'default', combos[0].strategy_params))
  })
})

describe('buildCompareSubmitPayload', () => {
  it('builds compare payload and respects exclusion set', () => {
    const combos = buildStrategyCombos({
      strategyKey: 'turtle',
      presets: [
        {
          preset: 'default',
          params_with_desc: { entry_period: { value: 20 } },
        },
      ],
      selectedPresetKeys: ['default'],
      experimentValuesByPreset: { default: { entry_period: '10,20' } },
    })
    const payload = buildCompareSubmitPayload({
      name: 'test',
      symbol: '510300.SH',
      startDate: '20240101',
      endDate: '20241231',
      initialCash: 1000000,
      combos,
      excludedPreviewKeys: [combos[0].preview_key],
    })
    expect(payload.experiment_type).toBe('compare')
    expect(payload.combos.length).toBe(1)
    expect(payload.strategy_key).toBe('turtle')
    expect(payload.combos[0].strategy_params.entry_period).toBe(20)
    expect(payload.symbols).toEqual(['510300.SH'])
  })

  it('accepts multiple stock and ETF symbols', () => {
    const combos = buildStrategyCombos({
      strategyKey: 'turtle',
      presets: [
        {
          preset: 'default',
          params_with_desc: { entry_period: { value: 20 } },
        },
      ],
      selectedPresetKeys: ['default'],
      experimentValuesByPreset: {},
    })
    const payload = buildCompareSubmitPayload({
      name: 'multi',
      symbols: '000001.SZ, 510300.SH, 000001.SZ',
      startDate: '20240101',
      endDate: '20241231',
      initialCash: 1000000,
      combos,
    })
    expect(payload.symbols).toEqual(['000001.SZ', '510300.SH'])
    expect(payload.asset_type).toBe('stock')
  })
})
