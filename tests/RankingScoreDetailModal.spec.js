import { describe, expect, it } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import RankingScoreDetailModal from '../src/components/ranking/RankingScoreDetailModal.vue'
import ScoreDetailView from '../src/components/ranking/ScoreDetailView.vue'

const stock = { symbol: '600519.SH', name: '贵州茅台' }
const details = { 总分: 88 }
const weights = { 动量: 0.25 }
const dimensions = [{ key: 'cycle', name: '动量', score: 88 }]

function mountModal(overrides = {}) {
  return shallowMount(RankingScoreDetailModal, {
    props: {
      show: true,
      stock,
      category: 'cycle',
      details,
      weights,
      dimensions,
      loading: false,
      inWatchlist: true,
      ...overrides,
    },
  })
}

function buttonByText(wrapper, text) {
  return wrapper.findAll('button').find(button => button.text().includes(text))
}

describe('RankingScoreDetailModal', () => {
  it('renders the fullscreen shell and embeds ScoreDetailView', () => {
    const wrapper = mountModal()
    const detailView = wrapper.findComponent(ScoreDetailView)

    expect(wrapper.text()).toContain('600519.SH - 贵州茅台 评分详情')
    expect(wrapper.text()).toContain('动量评分')
    expect(wrapper.text()).toContain('从自选股移除')
    expect(detailView.props()).toMatchObject({
      category: 'cycle',
      details,
      weights,
      dimensions,
      loading: false,
      maximized: false,
    })
  })

  it('emits actions and exits fullscreen before closing from the backdrop', async () => {
    const wrapper = mountModal()

    await buttonByText(wrapper, '查看走势图').trigger('click')
    await buttonByText(wrapper, '从自选股移除').trigger('click')
    expect(wrapper.emitted('view-chart')).toEqual([[stock.symbol]])
    expect(wrapper.emitted('toggle-watchlist')).toEqual([[stock.symbol]])

    await buttonByText(wrapper, '全屏').trigger('click')
    expect(wrapper.find('.score-detail-modal--maximized').exists()).toBe(true)
    expect(wrapper.findComponent(ScoreDetailView).props('maximized')).toBe(true)

    await wrapper.find('.score-detail-modal-overlay').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.find('.score-detail-modal--maximized').exists()).toBe(false)

    await wrapper.find('.score-detail-modal-overlay').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
