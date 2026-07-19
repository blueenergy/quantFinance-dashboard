import { describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount, shallowMount } from '@vue/test-utils'

import WorkbenchNineTurnPanel from '../src/components/stock/WorkbenchNineTurnPanel.vue'
import WorkbenchQuotePanel from '../src/components/stock/WorkbenchQuotePanel.vue'

describe('WorkbenchQuotePanel', () => {
  it('emits refresh from the quote refresh action', async () => {
    const wrapper = shallowMount(WorkbenchQuotePanel)

    await wrapper.get('.text-link-button').trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })

  it('emits a model update when changing the K-line timeframe', async () => {
    const wrapper = shallowMount(WorkbenchQuotePanel, {
      props: {
        quoteKlineTf: '1d',
        quoteKlineTfOptions: [
          { label: '日线', value: '1d' },
          { label: '周线', value: '1w' },
        ],
      },
    })

    const weeklyButton = wrapper.findAll('.quote-kline-tf button')
      .find((button) => button.text() === '周线')
    await weeklyButton.trigger('click')

    expect(wrapper.emitted('update:quoteKlineTf')?.[0]).toEqual(['1w'])
  })

  it('passes money-flow props and shows partial kline tags', () => {
    const wrapper = mount(WorkbenchQuotePanel, {
      props: {
        latestMoneyFlow: { trade_date: '20260717', net_mf_amount: 100 },
        moneyFlowMetrics: [{ label: '主力净额', value: '1.00万', className: 'is-up' }],
        quoteKlineTitle: '日线行情',
        quoteKlineShortLabel: '日线',
        quoteKlineRows: [
          { trade_date: '20260717', close: 10, pct_chg: 1.2, high: 11, low: 9, amount: 1000, is_partial: true },
        ],
        activeMoneyFlowHistory: [{ trade_date: '20260717' }],
        moneyFlowSummary: { main_net_today: 100 },
        moneyFlowIsLoading: false,
        quoteKlineTf: '1d',
      },
      global: {
        stubs: {
          StockKLineChart: true,
          MoneyFlowPanel: {
            name: 'MoneyFlowPanel',
            props: ['latest', 'history', 'summary', 'period', 'klineRows', 'loading'],
            template: '<div class="money-flow-stub" />',
          },
        },
      },
    })

    const moneyFlow = wrapper.findComponent({ name: 'MoneyFlowPanel' })
    expect(moneyFlow.props('latest')).toEqual({ trade_date: '20260717', net_mf_amount: 100 })
    expect(moneyFlow.props('period')).toBe('1d')
    expect(moneyFlow.props('history')).toEqual([{ trade_date: '20260717' }])
    expect(wrapper.get('.partial-kline-tag').text()).toBe('未完')
  })

  it('shows empty money-flow and loading kline states', () => {
    const wrapper = shallowMount(WorkbenchQuotePanel, {
      props: {
        latestMoneyFlow: null,
        quoteKlineRows: [],
        quoteKlineIsLoading: true,
        quoteKlineShortLabel: '周线',
      },
    })
    expect(wrapper.text()).toContain('暂无该股票的资金流数据')
    expect(wrapper.text()).toContain('正在加载周线行情')
  })

  it('wires parent v-model and refresh handler like StockWorkbench', async () => {
    const refreshQuoteSection = vi.fn()
    const Host = defineComponent({
      components: { WorkbenchQuotePanel },
      setup() {
        const quoteKlineTf = ref('1d')
        return { quoteKlineTf, refreshQuoteSection }
      },
      template: `
        <WorkbenchQuotePanel
          v-model:quote-kline-tf="quoteKlineTf"
          :quote-kline-tf-options="[
            { label: '日线', value: '1d' },
            { label: '周线', value: '1w' },
          ]"
          @refresh="refreshQuoteSection"
        />
      `,
    })
    const wrapper = mount(Host, {
      global: {
        stubs: {
          StockKLineChart: true,
          MoneyFlowPanel: true,
        },
      },
    })

    await wrapper.get('.text-link-button').trigger('click')
    expect(refreshQuoteSection).toHaveBeenCalledOnce()

    const weeklyButton = wrapper.findAll('.quote-kline-tf button')
      .find((button) => button.text() === '周线')
    await weeklyButton.trigger('click')
    expect(wrapper.vm.quoteKlineTf).toBe('1w')
  })
})

describe('WorkbenchNineTurnPanel', () => {
  it('renders the latest signal label when provided', () => {
    const wrapper = shallowMount(WorkbenchNineTurnPanel, {
      props: {
        latestNineTurnSignal: {
          direction: 'down',
          label: '下九转',
          grade_label: '完美',
          trade_date: '20260717',
          strength: 3,
          perfect: true,
          vol_filter_pass: true,
          trend_filter_pass: false,
        },
      },
    })

    expect(wrapper.get('.nine-turn-summary').text()).toContain('下九转 · 完美')
  })

  it('renders signal table rows and markers on the chart', () => {
    const wrapper = mount(WorkbenchNineTurnPanel, {
      props: {
        nineTurnDailyRows: [{ trade_date: '20260717', close: 10 }],
        nineTurnMarkers: [{ trade_date: '20260717', direction: 'down' }],
        nineTurnSignals: [{
          trade_date: '20260717',
          direction: 'down',
          label: '下九转',
          grade_label: '强',
          perfect: true,
          vol_filter_pass: true,
          trend_filter_pass: true,
          close: 10.5,
          volume_ma: 1000,
        }],
      },
      global: {
        stubs: {
          StockKLineChart: {
            name: 'StockKLineChart',
            props: ['records', 'markers'],
            template: '<div class="kline-stub" />',
          },
        },
      },
    })

    const chart = wrapper.findComponent({ name: 'StockKLineChart' })
    expect(chart.props('markers')).toEqual([{ trade_date: '20260717', direction: 'down' }])
    expect(wrapper.text()).toContain('下九转')
    expect(wrapper.text()).toContain('强')
    expect(wrapper.text()).toContain('10.50')
  })

  it('shows empty states when signal and kline data are missing', () => {
    const wrapper = shallowMount(WorkbenchNineTurnPanel, {
      props: {
        latestNineTurnSignal: null,
        nineTurnDailyRows: [],
        nineTurnSignals: [],
      },
    })
    expect(wrapper.text()).toContain('暂无已完成的九转信号')
    expect(wrapper.text()).toContain('暂无该股票的九转 K 线数据')
    expect(wrapper.text()).toContain('暂无完成 9 计数的九转信号')
  })
})
