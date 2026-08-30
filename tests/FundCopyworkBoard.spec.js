import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../src/api/fundCopywork', () => ({
  getFundCopyworkPeriods: vi.fn(async () => ({
    success: true,
    data: {
      periods: ['20251231'],
      items: [{ period: '20251231', quality_status: 'official', compare_mode: 'full_vs_full' }],
    },
  })),
  getFundCopyworkWatchlist: vi.fn(async () => ({
    success: true,
    data: {
      period: '20251231',
      meta: {
        lag_note: '不是今日买卖',
        compare_mode: 'full_vs_full',
        quality_status: 'official',
        quality: { status: 'official', warning: '已通过报告期成熟度与全持仓覆盖检查。', strategy_coverage_pct: 100 },
      },
      rows: [
        {
          fund_key: '易方达|明星混合',
          name: '明星混合A',
          management: '易方达',
          aum_curr_yi: 120,
          n_new: 2,
          n_increased: 3,
          n_decreased: 1,
          n_exited: 1,
        },
      ],
    },
  })),
  getFundCopyworkProduct: vi.fn(async () => ({
    success: true,
    data: {
      product: {
        name: '明星混合A',
        holdings: [{ symbol: '300502', action: 'increased', action_label: '加仓', change_pct: 20, mkv_curr_yi: 10 }],
      },
    },
  })),
  getFundCopyworkConsensus: vi.fn(async () => ({ success: true, data: { rows: [] } })),
  getFundCopyworkStock: vi.fn(async () => ({ success: true, data: { stock: { n_operated: 0, cards: [] } } })),
}))

vi.mock('../src/components/common/AppLink.vue', () => ({
  default: {
    name: 'AppLink',
    props: ['tab', 'params'],
    template: '<a><slot /></a>',
  },
}))

import FundCopyworkBoard from '../src/views/FundCopyworkBoard.vue'

describe('FundCopyworkBoard', () => {
  it('renders watchlist cards from the snapshot API', async () => {
    const wrapper = mount(FundCopyworkBoard)
    await flushPromises()
    expect(wrapper.text()).toContain('明星混合A')
    expect(wrapper.text()).toContain('新买 2')
    expect(wrapper.text()).toContain('全持仓对比')
    expect(wrapper.text()).toContain('OFFICIAL')
  })

  it('labels incomplete periods as provisional top-10 preview', async () => {
    const { getFundCopyworkWatchlist } = await import('../src/api/fundCopywork')
    getFundCopyworkWatchlist.mockResolvedValueOnce({
      success: true,
      data: {
        period: '20260331',
        meta: {
          lag_note: '前十大对齐',
          compare_mode: 'top10_vs_top10',
          quality_status: 'provisional',
          quality: {
            status: 'provisional',
            warning: '当前为披露进行中或覆盖不足的前十大预览；未披露基金不会被视为退出。',
            strategy_coverage_pct: 41.2,
            holding_depth_pct: 14.5,
            full_readiness_pct: 14.5,
          },
        },
        rows: [
          {
            fund_key: '易方达|明星混合',
            name: '明星混合A',
            management: '易方达',
            aum_curr_yi: 80,
            n_new: 1,
            n_increased: 2,
            n_decreased: 1,
            n_exited: 3,
          },
        ],
      },
    })
    const wrapper = mount(FundCopyworkBoard)
    await flushPromises()
    expect(wrapper.text()).toContain('PROVISIONAL')
    expect(wrapper.text()).toContain('前十大预览')
    expect(wrapper.text()).toContain('掉出前十 3')
    expect(wrapper.text()).toContain('（前十大）')
  })

  it('uses A-share red/green classes for holding changes', async () => {
    const wrapper = mount(FundCopyworkBoard)
    await flushPromises()
    await wrapper.find('.product-card').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('加仓')
    expect(wrapper.text()).toContain('明细')
    expect(wrapper.find('.holdings-card').exists()).toBe(true)
    expect(wrapper.find('.is-up').exists()).toBe(true)
  })
})
