import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const ACCOUNTS = [
  { id: 'acc-1', broker: '财通证券', account_id: '75569019', account_type: 'real' },
]

// 口径与生产一致：unrealized_pnl 是金额，unrealized_pnl_pct 是百分比数值（-9.84 = -9.84%）
const POSITIONS = [
  {
    symbol: '300196.SZ', stock_name: '日海智能', quantity: 11800, cost_price: 14.06,
    current_price: 15.38, market_value: 181484, unrealized_pnl: 15576, unrealized_pnl_pct: 9.39,
    daily_pnl_ratio: 1.2,
  },
  {
    symbol: '002130.SZ', stock_name: '沃尔核材', quantity: 7500, cost_price: 17.2,
    current_price: 14.67, market_value: 110025, unrealized_pnl: -18975, unrealized_pnl_pct: -14.71,
    daily_pnl_ratio: -0.8,
  },
  {
    symbol: '000951.SZ', stock_name: '金贵银业', quantity: 5000, cost_price: 20.84,
    current_price: 18.79, market_value: 93950, unrealized_pnl: -10250, unrealized_pnl_pct: -9.84,
    daily_pnl_ratio: null,
  },
  {
    // 缺成本价 / 后端没给浮盈：必须显示为"无数据"，不能染成盈利
    symbol: '600000.SH', stock_name: '浦发银行', quantity: 1000, cost_price: 0,
    current_price: 9.5, market_value: 9500, unrealized_pnl: null, unrealized_pnl_pct: null,
    daily_pnl_ratio: 0,
  },
]

vi.mock('../../api/trader', () => ({
  getSecuritiesAccounts: vi.fn(async () => ACCOUNTS),
  getTraderPositions: vi.fn(async () => POSITIONS),
  getTraderAccount: vi.fn(async () => ({
    total_assets: 395000, available_cash: 9500, market_value: 395000, daily_pnl: 0, daily_pnl_ratio: 0,
  })),
  getTraderAccountEquity: vi.fn(async () => []),
  getTraderCashFlows: vi.fn(async () => []),
  getTradeSignals: vi.fn(async () => []),
  getTraderHeartbeats: vi.fn(async () => []),
  createTraderCashFlow: vi.fn(async () => ({})),
  deleteTraderCashFlow: vi.fn(async () => ({})),
}))

vi.mock('../../api/trading', () => ({
  getTradeExecutionsBySymbol: vi.fn(async () => []),
}))

vi.mock('../../composables/useVisibilityAwarePolling.js', () => ({
  useVisibilityAwarePolling: vi.fn(),
}))

vi.mock('../TradeDialog.vue', () => ({
  default: { name: 'TradeDialog', template: '<div class="trade-dialog-stub" />' },
}))

import SecuritiesAccountDashboard from '../SecuritiesAccountDashboard.vue'

function mountDashboard() {
  return mount(SecuritiesAccountDashboard, {
    global: {
      plugins: [createVuetify({ components, directives })],
    },
  })
}

function pnlCell(wrapper, amountText) {
  return wrapper.findAll('span').find(node => node.text().trim() === amountText)
}

describe('账户工作台 持仓盈亏着色', () => {
  let wrapper

  beforeEach(async () => {
    wrapper = mountDashboard()
    await flushPromises()
  })

  it('浮盈浮亏按符号着色：涨红跌绿，并带上正负号', () => {
    const gain = pnlCell(wrapper, '+¥15,576.00')
    expect(gain).toBeTruthy()
    expect(gain.classes()).toContain('is-up')

    const loss = pnlCell(wrapper, '-¥18,975.00')
    expect(loss).toBeTruthy()
    expect(loss.classes()).toContain('is-down')
  })

  it('每行按浮盈正负打上左侧色条标记', () => {
    expect(wrapper.findAll('tr.pnl-row-up')).toHaveLength(1)
    expect(wrapper.findAll('tr.pnl-row-down')).toHaveLength(2)
    // 无浮盈数据的行不画色条
    expect(wrapper.findAll('tr.pnl-row-flat')).toHaveLength(0)
  })

  it('缺少浮盈数据显示为破折号，且不着色', () => {
    const dash = wrapper.findAll('span').find(node => node.text().trim() === '—')
    expect(dash).toBeTruthy()
    expect(dash.classes()).toContain('is-flat')
  })

  it('表头汇总合计浮盈与盈亏只数', () => {
    const summary = wrapper.find('.position-summary')
    expect(summary.exists()).toBeTruthy()
    // 15576 - 18975 - 10250 = -13649，无数据的那笔不计入
    expect(summary.text()).toContain('-¥13,649.00')
    expect(summary.text()).toContain('1 盈')
    expect(summary.text()).toContain('2 亏')
  })

  it('旧的 red--text / green--text 是 Vuetify 2 语法，Vue 3 下无效果', () => {
    expect(wrapper.findAll('.red--text')).toHaveLength(0)
    expect(wrapper.findAll('.green--text')).toHaveLength(0)
  })
})
