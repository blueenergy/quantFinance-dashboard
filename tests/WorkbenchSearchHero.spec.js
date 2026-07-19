import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkbenchHero from '../src/components/stock/WorkbenchHero.vue'
import WorkbenchSearchBar from '../src/components/stock/WorkbenchSearchBar.vue'

function mountSearchBar(props = {}) {
  return mount(WorkbenchSearchBar, {
    props: {
      modelValue: '',
      recentStocks: [],
      ...props,
    },
    global: {
      stubs: {
        StockSearchInput: {
          template: '<input class="stock-search-stub" />',
        },
        'v-btn': {
          template: '<button class="load-btn" type="button" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  })
}

describe('WorkbenchSearchBar', () => {
  it('emits load-symbol from quick example buttons', async () => {
    const wrapper = mountSearchBar()
    const buttons = wrapper.findAll('.quick-symbols button')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('load-symbol')?.[0]).toEqual(['600519.SH'])
  })

  it('emits load-symbol and clear-recent for recent stocks', async () => {
    const wrapper = mountSearchBar({
      recentStocks: [{ symbol: '000001.SZ', name: '平安银行' }],
    })
    await wrapper.get('.recent-stock-btn').trigger('click')
    expect(wrapper.emitted('load-symbol')?.[0]).toEqual(['000001.SZ'])
    await wrapper.get('.clear-recent-btn').trigger('click')
    expect(wrapper.emitted('clear-recent')).toHaveLength(1)
  })

  it('emits submit from the load button', async () => {
    const wrapper = mountSearchBar({ loading: false })
    await wrapper.get('.load-btn').trigger('click')
    expect(wrapper.emitted('submit')?.length).toBeGreaterThanOrEqual(1)
  })
})

describe('WorkbenchHero', () => {
  it('emits select-panel when a section status chip is clicked', async () => {
    const wrapper = mount(WorkbenchHero, {
      props: {
        name: '贵州茅台',
        symbol: '600519.SH',
        fallbackSymbol: '600519.SH',
        sectionStatusItems: [
          { key: 'quote', label: '行情', panel: 'quote', found: true, asOf: '20260101', title: 'quote' },
        ],
        ratingText: '强',
      },
    })
    await wrapper.get('.section-status-chip').trigger('click')
    expect(wrapper.emitted('select-panel')?.[0]).toEqual(['quote'])
  })

  it('renders price and score metrics', () => {
    const wrapper = mount(WorkbenchHero, {
      props: {
        name: '贵州茅台',
        symbol: '600519.SH',
        latestPrice: 1800.5,
        latestPctChange: 1.25,
        changeClass: 'is-up',
        compositeScore: 88.2,
        ratingText: '强',
        scoreDate: '20260102',
        quoteDate: '20260102',
      },
    })
    const text = wrapper.text()
    expect(text).toContain('贵州茅台')
    expect(text).toContain('1800.50')
    expect(text).toContain('+1.25%')
    expect(text).toContain('88.20')
    expect(text).toContain('强')
  })
})
