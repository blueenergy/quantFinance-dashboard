import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const requestMock = vi.hoisted(() => vi.fn())

vi.mock('../src/utils/request', () => ({
  default: requestMock,
}))

import DailyGoldPicksPanel from '../src/components/DailyGoldPicksPanel.vue'

const panel = {
  recipe_id: 'daily_gold_v1_csi1000_g60c40',
  score_date: '20260820',
  recipe: {
    recipe_id: 'daily_gold_v1_csi1000_g60c40',
    label: '中证1000 · 成长周期 60:40',
    loss_stop_cooldown_trading_days: 5,
  },
  recipes: [],
  top10: [
    {
      symbol: '000003.SZ',
      name: '冷却样本',
      rank: 1,
      score: 90,
      entry_blocked_reason: 'losing_stop_cooldown',
      cooldown_remaining_trading_days: 3,
    },
  ],
  open_lots: [],
  recent_closed: [
    {
      lot_id: 'win',
      symbol: '000001.SZ',
      name: '盈利样本',
      entry_score_date: '20260701',
      exit_date: '20260801',
      return_pct: 0.1,
      outcome_label: '回撤止盈',
    },
    {
      lot_id: 'loss',
      symbol: '000002.SZ',
      name: '亏损样本',
      entry_score_date: '20260702',
      exit_date: '20260802',
      return_pct: -0.04,
      outcome_label: '回撤止损',
    },
  ],
  strategy_twr: {
    score_date: '20260820',
    cumulative_return: 0.1234,
    max_drawdown: -0.0567,
    active_lots: 12,
    peak_active_lots: 24,
  },
  stats: {
    closed_count: 12,
    scored_count: 12,
    insufficient_data_count: 0,
    win_count: 7,
    loss_count: 5,
    win_rate: 7 / 12,
    avg_return_pct: 0.025,
    payoff_ratio: 1.8,
    profit_factor: 1.4,
    trailing_stop_count: 9,
    expire_count: 3,
  },
}

function mountPanel() {
  return mount(DailyGoldPicksPanel, {
    global: {
      stubs: {
        'v-select': true,
        'v-text-field': true,
        'v-btn': { template: '<button><slot /></button>' },
        AppLink: { template: '<a><slot /></a>' },
      },
    },
  })
}

describe('DailyGoldPicksPanel', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('uses A-share P&L classes and summarizes overall history', async () => {
    requestMock.mockResolvedValue(panel)
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.get('.dg-performance__title').text()).toBe('累计收益 +12.34%')
    expect(wrapper.get('.dg-performance__description').text()).toContain('资金追加和退出不会直接改变收益率')
    expect(wrapper.get('.dg-performance__description').text()).toContain('单笔胜率 58.3%')
    expect(wrapper.get('.dg-performance__metrics').text()).toContain('+12.34%')
    expect(wrapper.get('.dg-performance__metrics').text()).toContain('-5.67%')
    expect(wrapper.get('.dg-performance__metrics').text()).toContain('单笔胜率')
    expect(wrapper.get('.dg-performance__metrics').text()).toContain('+2.50%')
    expect(wrapper.get('.dg-performance__metrics').text()).toContain('1.80')
    expect(wrapper.get('.dg-sub').text()).toContain('亏损止损后冷却 5 个交易日')
    expect(wrapper.get('.dg-section').text()).toContain('剩余 3 日')

    const returnCells = wrapper.findAll('td').filter(cell => cell.classes().includes('dg-pos') || cell.classes().includes('dg-neg'))
    expect(returnCells[0].classes()).toContain('dg-pos')
    expect(returnCells[0].text()).toBe('10.00%')
    expect(returnCells[1].classes()).toContain('dg-neg')
    expect(returnCells[1].text()).toBe('-4.00%')
  })

  it('explains when the ledger has no completed samples', async () => {
    requestMock.mockResolvedValue({
      ...panel,
      recent_closed: [],
      strategy_twr: null,
      stats: { scored_count: 0 },
    })
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.get('.dg-performance__title').text()).toBe('尚无足够的已结束交易样本')
    expect(wrapper.find('.dg-performance__metrics').exists()).toBe(false)
  })
})
