import { describe, expect, it } from 'vitest'
import {
  buildPortfolioResearchPayload,
  formatResearchApiError,
  parseCsvNumbers,
  parseWeightedScoreSpecs,
} from '../portfolioResearchPayload.js'

describe('parseCsvNumbers', () => {
  it('parses ascii and chinese commas and drops non-finite numbers', () => {
    expect(parseCsvNumbers('10,20，50', Number)).toEqual([10, 20, 50])
    expect(parseCsvNumbers('0,abc,0.15', Number)).toEqual([0, 0.15])
    expect(parseCsvNumbers('30:70,40:60', String)).toEqual(['30:70', '40:60'])
  })
})

describe('buildPortfolioResearchPayload', () => {
  const baseForm = {
    name: 'test research',
    universe_index: 'csi1000',
    start_date: '2023-01-01',
    end_date: '2024-01-01',
    score_column: 'composite_growth_cycle_score',
    growth_cycle_weights: '30:70',
    top_n_values: '10,20',
    horizon: 20,
    active_caps: '0.2,0.3',
    transaction_cost: 0.001,
    buy_commission_rate: 0.0001,
    sell_commission_rate: 0.0001,
    min_commission: 5,
    stamp_tax_rate: 0.0005,
    transfer_fee_rate: 0,
    initial_capital: 1_000_000,
    trailing_stop_pcts: '0,0.15',
  }

  it('builds a valid rerun/create body', () => {
    const payload = buildPortfolioResearchPayload(baseForm)
    expect(payload).toMatchObject({
      name: 'test research',
      universe_index: 'csi1000',
      growth_cycle_weights: ['30:70'],
      selection_mode: 'fixed_top_n',
      threshold_lookback_days: 10,
      max_positions: 20,
      top_n_values: [10, 20],
      horizon: 20,
      rebalance_interval_days: [20],
      active_caps: [0.2, 0.3],
      trailing_stop_pcts: [0, 0.15],
      force: true,
    })
    expect(payload.regime_cash).toBe(false)
    expect(payload).not.toHaveProperty('cash_buffer')
  })

  it('omits empty-string optional numbers that would 422 FastAPI', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      buy_commission_rate: '',
      cash_buffer: '',
      stamp_tax_rate: '',
    })
    expect(payload).not.toHaveProperty('buy_commission_rate')
    expect(payload).not.toHaveProperty('cash_buffer')
    expect(payload).not.toHaveProperty('stamp_tax_rate')
    expect(payload.horizon).toBe(20)
    expect(payload.rebalance_interval_days).toEqual([20])
  })

  it('parses comma-separated rebalance days into interval list', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      horizon: '10,20,30,40',
    })
    expect(payload.rebalance_interval_days).toEqual([10, 20, 30, 40])
    expect(payload.horizon).toBe(10)
  })

  it('builds dynamic-threshold fields and requires exactly one baseline rank', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      selection_mode: 'dynamic_score_threshold',
      threshold_lookback_days: '15',
      max_positions: '30',
      top_n_values: '20',
    })
    expect(payload).toMatchObject({
      selection_mode: 'dynamic_score_threshold',
      threshold_lookback_days: 15,
      max_positions: 30,
      top_n_values: [20],
    })

    expect(() => buildPortfolioResearchPayload({
      ...baseForm,
      selection_mode: 'dynamic_score_threshold',
      top_n_values: '10,20',
    })).toThrow('恰好填写一个')
  })

  it('rejects invalid dynamic-threshold bounds', () => {
    expect(() => buildPortfolioResearchPayload({
      ...baseForm,
      selection_mode: 'dynamic_score_threshold',
      threshold_lookback_days: 0,
      top_n_values: '10',
    })).toThrow('threshold_lookback_days')
    expect(() => buildPortfolioResearchPayload({
      ...baseForm,
      selection_mode: 'dynamic_score_threshold',
      max_positions: 9,
      top_n_values: '10',
    })).toThrow('max_positions')
  })

  it('rejects empty rebalance days', () => {
    expect(() => buildPortfolioResearchPayload({
      ...baseForm,
      horizon: '',
    })).toThrow('rebalance_days')
  })

  it('includes cash_buffer and benchmark when provided', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      cash_buffer: 0.03,
      index_benchmark_symbol: '000852.SH',
    })
    expect(payload.cash_buffer).toBe(0.03)
    expect(payload.index_benchmark_symbol).toBe('000852.SH')
  })

  it('sends regime_cash on any universe when checked', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      universe_index: 'csi500',
      regime_cash: true,
    })
    expect(payload.universe_index).toBe('csi500')
    expect(payload.regime_cash).toBe(true)
  })

  it('normalizes percent-point trailing stop inputs on submit', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      trailing_stop_pcts: '0,10,15,20',
    })
    expect(payload.trailing_stop_pcts).toEqual([0, 0.1, 0.15, 0.2])
  })

  it('builds a single-column score spec without legacy weights', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      score_mode: 'column',
      score_column: 'money_flow_score',
    })
    expect(payload.score_specs).toEqual([
      { mode: 'column', column: 'money_flow_score' },
    ])
    expect(payload).not.toHaveProperty('growth_cycle_weights')
  })

  it('builds multiple column score specs from multi-select', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      score_mode: 'column',
      score_columns: ['fundamental_score', 'value_score', 'fundamental_score'],
    })
    expect(payload.score_column).toBe('fundamental_score')
    expect(payload.score_specs).toEqual([
      { mode: 'column', column: 'fundamental_score' },
      { mode: 'column', column: 'value_score' },
    ])
  })

  it('treats predefined composites as multi-dimension preset columns', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      score_mode: 'preset',
      score_column: 'composite_conservative_score',
    })
    expect(payload.score_specs).toEqual([
      { mode: 'column', column: 'composite_conservative_score' },
    ])
    expect(payload).not.toHaveProperty('growth_cycle_weights')
  })

  it('builds multiple predefined composite score specs', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      score_mode: 'preset',
      score_columns: ['composite_conservative_score', 'composite_defensive_score'],
    })
    expect(payload.score_specs).toEqual([
      { mode: 'column', column: 'composite_conservative_score' },
      { mode: 'column', column: 'composite_defensive_score' },
    ])
  })

  it('builds generic weighted specs and preserves legacy growth-cycle shortcut', () => {
    const generic = buildPortfolioResearchPayload({
      ...baseForm,
      score_mode: 'weighted',
      score_specs: 'fundamental:60,value:40',
    })
    expect(generic.score_specs).toEqual([
      { mode: 'weighted', weights: { fundamental: 60, value: 40 } },
    ])
    expect(generic).not.toHaveProperty('growth_cycle_weights')

    const legacy = buildPortfolioResearchPayload({
      ...baseForm,
      score_mode: 'weighted',
      score_specs: 'growth:30,cycle:70\ngrowth:60,cycle:40',
    })
    expect(legacy.growth_cycle_weights).toEqual(['30:70', '60:40'])
    expect(legacy).not.toHaveProperty('score_specs')
  })

  it('includes industry_l1 when selected in the form', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      industry_l1: '801730.SI',
      index_benchmark_symbol: '801730.SI',
      top_n_values: '5,8,10',
    })
    expect(payload.industry_l1).toBe('801730.SI')
    expect(payload.index_benchmark_symbol).toBe('801730.SI')
    expect(payload.top_n_values).toEqual([5, 8, 10])
  })
})

describe('parseWeightedScoreSpecs', () => {
  it('parses multiple lines and rejects malformed items', () => {
    expect(parseWeightedScoreSpecs('growth:30,cycle:70\nvalue:1')).toEqual([
      { mode: 'weighted', weights: { growth: 30, cycle: 70 } },
      { mode: 'weighted', weights: { value: 1 } },
    ])
    expect(() => parseWeightedScoreSpecs('growth')).toThrow('格式应为')
  })
})

describe('formatResearchApiError', () => {
  it('formats FastAPI 422 detail arrays', () => {
    const err = {
      response: {
        status: 422,
        data: {
          detail: [
            {
              type: 'float_parsing',
              loc: ['body', 'cash_buffer'],
              msg: 'Input should be a valid number',
            },
          ],
        },
      },
    }
    expect(formatResearchApiError(err, '提交失败')).toContain('cash_buffer')
    expect(formatResearchApiError(err, '提交失败')).toContain('valid number')
  })
})
