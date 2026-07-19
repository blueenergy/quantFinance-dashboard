import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HoldingsTable from '../HoldingsTable.vue'
import PortfolioReconcileBanner from '../PortfolioReconcileBanner.vue'

const tableFunctions = {
  effectiveTarget: () => 100,
  manualDelta: () => 0,
  riskRowClass: () => '',
  formatRiskTime: (value) => value,
  halfTargetShares: () => 0,
  signedMoney: (value) => (value == null ? '-' : `${Number(value) >= 0 ? '+' : ''}${value}`),
}

describe('PortfolioReconcileBanner', () => {
  it('renders diffs and emits the manual-entry action', async () => {
    const wrapper = mount(PortfolioReconcileBanner, {
      props: {
        isLivePortfolio: true,
        reconcileData: {
          account_synced_at: '2026-07-20T01:02:03Z',
          diffs: [{
            symbol: '000001.SZ',
            name: '平安银行',
            ledger_shares: 100,
            account_shares: 200,
            diff: 100,
          }],
        },
      },
    })

    expect(wrapper.text()).toContain('000001.SZ')
    expect(wrapper.text()).toContain('+100')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('open-external-manual')).toHaveLength(1)
  })
})

describe('HoldingsTable', () => {
  it('renders empty and one-row states', async () => {
    const wrapper = mount(HoldingsTable, {
      props: {
        ...tableFunctions,
        latestHoldingRows: [],
      },
      global: {
        stubs: { AppLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.text()).toContain('暂无当前持仓')

    await wrapper.setProps({
      latestHoldingRows: [{
        symbol: '600000.SH',
        name: '浦发银行',
        shares: 100,
        avg_cost: 10,
        last_price: 11,
        market_value: 1100,
        realized_pnl: 20,
        unrealized_pnl: 100,
      }],
    })

    expect(wrapper.text()).toContain('600000.SH')
    expect(wrapper.text()).toContain('浦发银行')
    expect(wrapper.text()).toContain('1,100')
  })
})
