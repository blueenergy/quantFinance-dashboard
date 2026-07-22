import { describe, expect, it } from 'vitest'
import {
  buildPortfolioResearchPayload,
  formatResearchApiError,
  parseCsvNumbers,
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
      top_n_values: [10, 20],
      horizon: 20,
      rebalance_interval_days: [20],
      active_caps: [0.2, 0.3],
      trailing_stop_pcts: [0, 0.15],
      force: true,
    })
    expect(payload).not.toHaveProperty('cash_buffer')
  })

  it('omits empty-string optional numbers that would 422 FastAPI', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      buy_commission_rate: '',
      cash_buffer: '',
      stamp_tax_rate: '',
      horizon: '',
    })
    expect(payload).not.toHaveProperty('buy_commission_rate')
    expect(payload).not.toHaveProperty('cash_buffer')
    expect(payload).not.toHaveProperty('stamp_tax_rate')
    expect(payload).not.toHaveProperty('horizon')
    expect(payload).not.toHaveProperty('rebalance_interval_days')
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

  it('normalizes percent-point trailing stop inputs on submit', () => {
    const payload = buildPortfolioResearchPayload({
      ...baseForm,
      trailing_stop_pcts: '0,10,15,20',
    })
    expect(payload.trailing_stop_pcts).toEqual([0, 0.1, 0.15, 0.2])
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
