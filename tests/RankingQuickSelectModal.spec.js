import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RankingQuickSelectModal from '../src/components/ranking/RankingQuickSelectModal.vue'

const categories = [
  {
    key: 'finance',
    name: '金融股',
    stocks: [
      { symbol: '000001', name: '平安银行' },
      { symbol: '600036', name: '招商银行' }
    ]
  },
  { key: 'hs300', name: '沪深300 成分股', stocks: [] }
]

const hs300Stocks = [
  { symbol: '000001.SZ', name: '平安银行' },
  { symbol: '600519.SH', name: '贵州茅台' }
]

function mountModal(overrides = {}) {
  return mount(RankingQuickSelectModal, {
    props: {
      show: true,
      categories,
      selectedCategory: 'finance',
      selectedStocks: ['000001'],
      indexStocks: { hs300: hs300Stocks },
      indexLoading: {},
      ...overrides
    }
  })
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find(button => button.text().includes(text))
}

describe('RankingQuickSelectModal', () => {
  it('emits stock toggle and apply actions', async () => {
    const wrapper = mountModal()

    await wrapper.findAll('.quick-stock-item')[1].trigger('click')
    await buttonByText(wrapper, '应用选择').trigger('click')

    expect(wrapper.emitted('toggle-stock')).toEqual([['600036']])
    expect(wrapper.emitted('apply')).toHaveLength(1)
  })

  it('supports index category bulk selection', async () => {
    const wrapper = mountModal({
      selectedCategory: 'hs300',
      selectedStocks: ['000001.SZ']
    })

    expect(wrapper.text()).toContain('已选 1 / 2')

    await buttonByText(wrapper, '全选沪深300').trigger('click')
    await buttonByText(wrapper, '取消选择').trigger('click')

    expect(wrapper.emitted('select-all-index')).toEqual([['hs300']])
    expect(wrapper.emitted('deselect-all-index')).toEqual([['hs300']])
  })
})
