import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useStrategyCompareForm } from '../useStrategyCompareForm.js'
import {
  extractSymbolsFromEtfListResponse,
  extractSymbolsFromIndexResponse,
  extractSymbolsFromWatchlistResponse,
} from '../../constants/compareUniverseShortcuts.js'

describe('useStrategyCompareForm bulk helpers', () => {
  const strategies = ref([
    { key: 'turtle', name: 'Turtle', can_use: true },
    { key: 'ma', name: 'MA', can_use: true },
    { key: 'vip', name: 'VIP', can_use: false },
  ])
  const templates = ref({
    turtle: [
      { preset: 'default', is_default: true, params_with_desc: { period: { value: 20 } } },
      { preset: 'fast', params_with_desc: { period: { value: 10 } } },
    ],
    ma: [
      { preset: 'default', is_default: true, params_with_desc: { fast: { value: 5 } } },
      { preset: 'slow', params_with_desc: { fast: { value: 10 } } },
    ],
  })

  it('selects all usable strategies and all presets in grid mode', () => {
    const form = useStrategyCompareForm({ strategies, templates })
    form.selectAllStrategies()
    expect(form.selectedStrategyKeys.value).toEqual(['turtle', 'ma'])
    form.selectAllPresets()
    expect(form.strategyStates.value.turtle.selectedPresetKeys).toEqual(['default', 'fast'])
    expect(form.strategyStates.value.ma.selectedPresetKeys).toEqual(['default', 'slow'])
    expect(form.activeCombos.value.length).toBe(4)
  })

  it('replaces and appends symbols', () => {
    const form = useStrategyCompareForm({ strategies, templates })
    form.replaceSymbols(['000001.SZ', '000002.SZ'], 'stock')
    expect(form.parsedSymbols.value).toEqual(['000001.SZ', '000002.SZ'])
    form.addSymbols(['510300.SH'], 'etf')
    expect(form.parsedSymbols.value).toEqual(['000001.SZ', '000002.SZ', '510300.SH'])
  })

  it('restores default presets only', () => {
    const form = useStrategyCompareForm({ strategies, templates })
    form.selectAllStrategies()
    form.selectAllPresets()
    form.selectDefaultPresetsOnly()
    expect(form.strategyStates.value.turtle.selectedPresetKeys).toEqual(['default'])
    expect(form.strategyStates.value.ma.selectedPresetKeys).toEqual(['default'])
  })
})

describe('compareUniverseShortcuts parsers', () => {
  it('extracts watchlist / index / etf symbols', () => {
    expect(extractSymbolsFromWatchlistResponse({ data: { symbols: ['000001.SZ'] } })).toEqual([
      '000001.SZ',
    ])
    expect(
      extractSymbolsFromIndexResponse({
        success: true,
        data: [{ symbol: '600519.SH' }, { ts_code: '000001.SZ' }],
      }),
    ).toEqual(['600519.SH', '000001.SZ'])
    expect(
      extractSymbolsFromEtfListResponse({
        data: [{ ts_code: '510300.SH' }, { symbol: '512100.SH' }],
      }),
    ).toEqual(['510300.SH', '512100.SH'])
  })
})
