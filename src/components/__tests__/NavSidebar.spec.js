import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import NavSidebar from '../NavSidebar.vue'

const tabs = [
  { id: 'watchlist', name: '自选股', group: 'stock' },
  { id: 'ranking', name: '金榜', group: 'screening' },
  { id: 'user-profile', name: '用户配置', group: 'system' },
]

function mountSidebar(props = {}) {
  return mount(NavSidebar, {
    props: {
      tabs,
      activeTab: '',
      chartSymbol: '',
      ...props,
    },
  })
}

describe('NavSidebar', () => {
  it('renders group headers and keeps children folded by default', () => {
    const wrapper = mountSidebar()

    expect(wrapper.find('[data-testid="nav-group-stock"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-tab-watchlist"]').exists()).toBe(false)
  })

  it('opens a group and collapses it on a second click', async () => {
    const wrapper = mountSidebar()
    const header = wrapper.find('[data-testid="nav-group-stock"]')

    await header.trigger('click')
    expect(wrapper.find('[data-testid="nav-tab-watchlist"]').exists()).toBe(true)

    await header.trigger('click')
    expect(wrapper.find('[data-testid="nav-tab-watchlist"]').exists()).toBe(false)
  })

  it('auto-expands the active group and marks its leaf active', () => {
    const wrapper = mountSidebar({ activeTab: 'watchlist' })

    expect(wrapper.find('[data-testid="nav-tab-watchlist"]').classes()).toContain('active')
  })

  it('emits select on a plain leaf click', async () => {
    const wrapper = mountSidebar({ activeTab: 'watchlist' })

    await wrapper.find('[data-testid="nav-tab-watchlist"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['watchlist']])
  })

  it('does not emit select for modified clicks', async () => {
    const wrapper = mountSidebar({ activeTab: 'watchlist' })

    await wrapper.find('[data-testid="nav-tab-watchlist"]').trigger('click', { ctrlKey: true })

    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('shows a transient chart item under 个股 when chart is active', () => {
    const wrapper = mountSidebar({ activeTab: 'chart', chartSymbol: '600519.SH' })

    expect(wrapper.find('[data-testid="nav-tab-chart"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="nav-tab-chart"]').text()).toContain('图表 · 600519.SH')
  })
})
