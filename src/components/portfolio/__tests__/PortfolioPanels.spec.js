import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HoldingsTable from '../HoldingsTable.vue'
import HoldingsTableToolbar from '../HoldingsTableToolbar.vue'
import PortfolioIdentityCard from '../PortfolioIdentityCard.vue'
import PortfolioPlanDetailHeader from '../PortfolioPlanDetailHeader.vue'
import PlanOverviewExecuteLink from '../PlanOverviewExecuteLink.vue'
import PortfolioReconcileBanner from '../PortfolioReconcileBanner.vue'

const copyTextToClipboard = vi.fn(async () => true)

vi.mock('../../../utils/clipboard', () => ({
  copyTextToClipboard: (...args) => copyTextToClipboard(...args),
}))

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
  const row = {
    symbol: '600000.SH',
    name: '浦发银行',
    shares: 100,
    avg_cost: 10,
    last_price: 11,
    market_value: 1100,
    realized_pnl: 20,
    unrealized_pnl: 100,
  }

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
      latestHoldingRows: [row],
    })

    expect(wrapper.text()).toContain('600000.SH')
    expect(wrapper.text()).toContain('浦发银行')
    expect(wrapper.text()).toContain('1,100')
  })

  it('hides target shares and fast actions until edit mode', async () => {
    const wrapper = mount(HoldingsTable, {
      props: {
        ...tableFunctions,
        latestHoldingRows: [row],
      },
      global: {
        stubs: { AppLink: { template: '<a><slot /></a>' } },
      },
    })

    expect(wrapper.text()).not.toContain('目标')
    expect(wrapper.text()).not.toContain('快思考')
    expect(wrapper.find('.target-input').exists()).toBe(false)
    expect(wrapper.find('.fast-btn-swap').exists()).toBe(false)

    await wrapper.setProps({ editMode: true })
    expect(wrapper.text()).toContain('目标')
    expect(wrapper.text()).toContain('快思考')
    expect(wrapper.find('.target-input').exists()).toBe(true)
    expect(wrapper.get('.fast-btn-swap').text()).toBe('换股')
  })
})

describe('HoldingsTableToolbar', () => {
  const baseProps = {
    selectedLatestPlanId: 'plan-1',
    hasHoldings: true,
  }

  it('keeps liquidate and manual-entry in more until edit mode', () => {
    const wrapper = mount(HoldingsTableToolbar, {
      props: {
        ...baseProps,
        isLivePortfolio: true,
      },
    })

    expect(wrapper.text()).toContain('手动调仓')
    expect(wrapper.text()).not.toContain('提交手动调仓')
    expect(wrapper.get('.holdings-more').text()).toContain('实盘一键清仓')
    expect(wrapper.get('.holdings-more').text()).toContain('补录 miniQMT 手工操作')
    expect(wrapper.find('.holdings-actions > button.danger').exists()).toBe(false)
  })

  it('shows submit and a pressed toggle in edit mode', async () => {
    const wrapper = mount(HoldingsTableToolbar, {
      props: {
        ...baseProps,
        editMode: false,
        hasManualChanges: true,
      },
    })

    expect(wrapper.get('.holdings-edit-toggle').text()).toBe('手动调仓 · 未提交')
    await wrapper.get('.holdings-edit-toggle').trigger('click')
    expect(wrapper.emitted('update:editMode')[0]).toEqual([true])

    await wrapper.setProps({ editMode: true, hasManualChanges: true })
    expect(wrapper.get('.holdings-edit-toggle').text()).toBe('退出手动调仓')
    expect(wrapper.get('.holdings-edit-toggle').attributes('aria-pressed')).toBe('true')
    expect(wrapper.text()).toContain('提交手动调仓')
  })

  it('emits liquidate from more and closes the menu', async () => {
    const wrapper = mount(HoldingsTableToolbar, {
      props: {
        ...baseProps,
        isLivePortfolio: false,
      },
    })

    const menu = wrapper.get('.holdings-more')
    menu.element.open = true
    await wrapper.get('.holdings-more-menu button.danger').trigger('click')
    expect(wrapper.emitted('open-liquidate')).toHaveLength(1)
    expect(menu.element.open).toBe(false)
    expect(wrapper.text()).toContain('纸面一键清仓')
    expect(wrapper.text()).not.toContain('补录 miniQMT 手工操作')
  })
})

const FULL_HASH = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'

describe('PortfolioIdentityCard', () => {
  beforeEach(() => {
    copyTextToClipboard.mockClear()
  })

  it('renders a compact row without the full params_hash', () => {
    const wrapper = mount(PortfolioIdentityCard, {
      props: {
        portfolio: {
          strategy_name: '成长周期',
          strategy_template_id: 'growth_cycle_active',
          execution_venue: 'live',
          param_summary: 'CSI1000 · Top10 · 40日',
          first_base_date: '2025-01-02',
          last_base_date: '2026-09-08',
          plan_count: 12,
          params_hash: FULL_HASH,
          params_hash_short: 'abcdef01',
        },
      },
    })

    const text = wrapper.text()
    expect(text).toContain('成长周期')
    expect(text).toContain('实盘')
    expect(text).toContain('CSI1000 · Top10 · 40日')
    expect(text).toContain('2025-01-02 → 2026-09-08')
    expect(text).toContain('#abcdef01 复制')
    expect(text).not.toContain('组合标识')
    expect(text).not.toContain(FULL_HASH)
    expect(wrapper.get('.copy-hash').attributes('title')).toBe(FULL_HASH)
  })

  it('keeps paper snapshot on a secondary line and copies the full hash', async () => {
    const wrapper = mount(PortfolioIdentityCard, {
      props: {
        portfolio: {
          strategy_name: '纸面组合',
          execution_venue: 'paper',
          paper_snapshot_date: '2026-09-07',
          paper_holding_count: 8,
          paper_equity: 123456,
          paper_execution_mode: 'auto_shadow',
          params_hash: FULL_HASH,
          params_hash_short: 'abcdef01',
        },
      },
    })

    expect(wrapper.text()).toContain('纸面')
    expect(wrapper.text()).toContain('快照 2026-09-07')
    expect(wrapper.text()).toContain('持仓 8 只')
    expect(wrapper.text()).toContain('自动跟跑')
    expect(wrapper.text()).not.toContain(FULL_HASH)

    await wrapper.get('.copy-hash').trigger('click')
    expect(copyTextToClipboard).toHaveBeenCalledWith(FULL_HASH)
  })

  it('keeps the paused resume banner', async () => {
    const wrapper = mount(PortfolioIdentityCard, {
      props: {
        portfolio: {
          strategy_name: '已暂停组合',
          execution_venue: 'live',
          paused: true,
          params_hash: 'hash-1',
          params_hash_short: 'hash-1',
        },
      },
    })

    expect(wrapper.text()).toContain('已暂停')
    expect(wrapper.text()).toContain('该组合已暂停自动调仓')
    await wrapper.get('.paused-banner button').trigger('click')
    expect(wrapper.emitted('resume-lineage')).toHaveLength(1)
  })
})

describe('PortfolioPlanDetailHeader', () => {
  it('links to the overview lineage for the selected plan', () => {
    const wrapper = mount(PortfolioPlanDetailHeader, {
      props: {
        detail: {
          plan: {
            plan_id: 'plan-1',
            strategy_template_id: 'alpha',
            params_hash: 'hash-a',
            base_date: '2026-09-01',
            status: 'approved',
          },
        },
        displayTitle: () => 'Alpha',
      },
    })

    const link = wrapper.get('a.app-link')
    expect(link.text()).toContain('在总览打开')
    expect(link.attributes('href')).toBe(
      '/?tab=portfolio-overview&strategy=alpha&params_hash=hash-a&plan_id=plan-1',
    )
  })

  it('hides the overview link when the plan has no lineage key', () => {
    const wrapper = mount(PortfolioPlanDetailHeader, {
      props: {
        detail: {
          plan: {
            plan_id: 'plan-1',
            base_date: '2026-09-01',
            status: 'approved',
          },
        },
        displayTitle: () => 'Alpha',
      },
    })

    expect(wrapper.find('a.app-link').exists()).toBe(false)
  })
})

describe('PlanOverviewExecuteLink', () => {
  it('links approved plans to the overview workbench', () => {
    const wrapper = mount(PlanOverviewExecuteLink, {
      props: {
        plan: {
          plan_id: 'plan-1',
          strategy_template_id: 'alpha',
          params_hash: 'hash-a',
          status: 'approved',
        },
      },
    })

    const link = wrapper.get('a.app-link')
    expect(link.text()).toContain('去总览执行')
    expect(link.attributes('href')).toBe(
      '/?tab=portfolio-overview&strategy=alpha&params_hash=hash-a&plan_id=plan-1',
    )
  })

  it('hides the execute link until the plan is approved with a lineage key', () => {
    const pending = mount(PlanOverviewExecuteLink, {
      props: {
        plan: {
          plan_id: 'plan-1',
          strategy_template_id: 'alpha',
          params_hash: 'hash-a',
          status: 'needs_review',
        },
      },
    })
    expect(pending.find('a.app-link').exists()).toBe(false)

    const missingKey = mount(PlanOverviewExecuteLink, {
      props: {
        plan: {
          plan_id: 'plan-1',
          status: 'approved',
        },
      },
    })
    expect(missingKey.find('a.app-link').exists()).toBe(false)
  })
})
