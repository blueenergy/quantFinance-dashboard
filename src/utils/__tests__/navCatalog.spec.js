import { describe, expect, it } from 'vitest'
import {
  NAV_GROUPS,
  NAV_TABS,
  buildNavGroups,
  groupForTab,
} from '../navCatalog.js'

describe('navCatalog', () => {
  it('assigns every tab to a known group and keeps ids unique', () => {
    const groupIds = new Set(NAV_GROUPS.map((group) => group.id))
    for (const tab of NAV_TABS) {
      expect(groupIds.has(tab.group)).toBe(true)
    }
    expect(new Set(NAV_TABS.map((tab) => tab.id)).size).toBe(NAV_TABS.length)
  })

  it('keeps temporarily retired tabs out of the primary navigation', () => {
    const ids = new Set(NAV_TABS.map((tab) => tab.id))
    expect(ids.has('chat')).toBe(false)
    expect(ids.has('x-influencer-voices')).toBe(false)
  })

  it('prefixes every nav tab with an icon', () => {
    for (const tab of NAV_TABS) {
      // Sidebar labels start with an emoji/pictograph. A label starting with a
      // letter or digit would render without an icon.
      expect(tab.name).toMatch(/^[^\p{L}\p{N}]/u)
    }
  })

  it('maps the hidden chart detail view to the stock group', () => {
    expect(groupForTab('chart')).toBe('stock')
    expect(groupForTab('watchlist')).toBe('stock')
    expect(groupForTab('missing')).toBe('')
  })

  it('builds groups in catalog order and hides empty groups', () => {
    const groups = buildNavGroups([
      { id: 'ranking', name: '金榜', group: 'screening' },
      { id: 'watchlist', name: '自选股', group: 'stock' },
    ])

    expect(groups.map((group) => group.id)).toEqual(['stock', 'screening'])
    expect(groups[0].tabs.map((tab) => tab.id)).toEqual(['watchlist'])
    expect(groups[1].tabs.map((tab) => tab.id)).toEqual(['ranking'])
  })

  it('puts unknown tabs into the 其他 group', () => {
    const groups = buildNavGroups([
      { id: 'future-tab', name: 'future-tab', group: 'other' },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ id: 'other', label: '其他' })
    expect(groups[0].tabs.map((tab) => tab.id)).toEqual(['future-tab'])
  })
})
