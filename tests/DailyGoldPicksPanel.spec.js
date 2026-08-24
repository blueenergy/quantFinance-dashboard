import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const requestMock = vi.hoisted(() => vi.fn())

vi.mock('../src/utils/request', () => ({
  default: requestMock,
}))

import DailyGoldPicksPanel from '../src/components/DailyGoldPicksPanel.vue'

const panel = {
  recipe_id: 'daily_gold_v1_csi1000_g60c40',
  score_date: '20260820',
  is_historical: false,
  recipe: {
    recipe_id: 'daily_gold_v1_csi1000_g60c40',
    label: '中证1000 · 成长周期 60:40',
    growth_weight: 0.6,
    cycle_weight: 0.4,
    loss_stop_cooldown_trading_days: 5,
  },
  recipes: [],
  top10: [
    {
      symbol: '000003.SZ',
      name: '冷却样本',
      rank: 1,
      score: 90,
      growth_score: 90,
      cycle_score: 60,
      entry_blocked_reason: 'losing_stop_cooldown',
      cooldown_remaining_trading_days: 3,
    },
  ],
  open_lots: [
    {
      lot_id: 'open-1',
      symbol: '000004.SZ',
      name: '持仓样本',
      status: 'open',
      entry_score_date: '20260715',
      entry_price: 10,
      current_price: 11.5,
      current_price_date: '20260820',
      current_price_source: 'realtime',
      current_price_data_source: 'miniqmt_full_market_daily',
      current_price_updated_at: '20260820 14:59:00',
      unrealized_return_pct: 0.15,
      peak_high: 12.3,
    },
  ],
  recent_closed: [
    {
      lot_id: 'win',
      symbol: '000001.SZ',
      name: '盈利样本',
      entry_score_date: '20260701',
      exit_date: '20260801',
      return_pct: 0.1,
      outcome_label: '回撤止盈',
      hold_to_latest_return_pct: 0.15,
      hold_to_latest_date: '20260820',
      hold_to_latest_price_source: 'realtime',
      hold_to_latest_data_source: 'miniqmt_full_market_daily',
      hold_to_latest_updated_at: '20260820 14:59:00',
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

const mountedWrappers = []

function mountPanel() {
  const wrapper = mount(DailyGoldPicksPanel, {
    global: {
      stubs: {
        'v-select': true,
        'v-text-field': true,
        'v-btn': { template: '<button><slot /></button>' },
        AppLink: { template: '<a><slot /></a>' },
      },
    },
  })
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('DailyGoldPicksPanel', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  afterEach(() => {
    mountedWrappers.splice(0).forEach(wrapper => wrapper.unmount())
    vi.useRealTimers()
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
    expect(wrapper.get('.dg-section').text()).toContain('成长贡献主导，60:40 加权后第 1 名')
    expect(wrapper.text()).toContain('至今涨跌幅')
    expect(wrapper.text()).toContain('15.00%')
    expect(wrapper.text()).toContain('盘中实时 · miniQMT · 2026-08-20 14:59')
    expect(wrapper.text()).toContain('行情每 60 秒刷新')
    expect(wrapper.get('.dg-footnote').text()).toContain('事后观察值')

    const holdings = wrapper.findAll('.dg-section').find(section => section.text().includes('持有中'))
    expect(holdings.text()).toContain('成本')
    expect(holdings.text()).toContain('现价')
    expect(holdings.text()).toContain('峰值')
    expect(holdings.text().indexOf('成本')).toBeLessThan(holdings.text().indexOf('现价'))
    expect(holdings.text().indexOf('现价')).toBeLessThan(holdings.text().indexOf('峰值'))
    expect(holdings.text()).toContain('11.50')
    expect(holdings.text()).toContain('+15.00%')
    expect(holdings.text()).toContain('10.00')
    expect(holdings.text()).toContain('12.30')

    const returnCells = wrapper.findAll('td').filter(cell => cell.classes().includes('dg-pos') || cell.classes().includes('dg-neg'))
    const actualWin = returnCells.find(cell => cell.text() === '10.00%')
    const holdToLatest = returnCells.find(cell => cell.text().includes('15.00%'))
    const currentMark = returnCells.find(cell => cell.text().includes('11.50'))
    const actualLoss = returnCells.find(cell => cell.text() === '-4.00%')
    expect(actualWin.classes()).toContain('dg-pos')
    expect(holdToLatest.classes()).toContain('dg-pos')
    expect(currentMark.classes()).toContain('dg-pos')
    expect(actualLoss.classes()).toContain('dg-neg')
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

  it('silently refreshes the latest view every 60 seconds', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-21T15:03:00+08:00'))
    requestMock.mockResolvedValue(panel)
    mountPanel()
    await flushPromises()

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock.mock.calls[0][0].params).toEqual({
      recipe_id: 'daily_gold_v1_csi1000_g60c40',
    })

    await vi.advanceTimersByTimeAsync(60_000)
    await flushPromises()

    expect(requestMock).toHaveBeenCalledTimes(2)
    expect(requestMock.mock.calls[1][0].params).toEqual({
      recipe_id: 'daily_gold_v1_csi1000_g60c40',
    })
  })
})
