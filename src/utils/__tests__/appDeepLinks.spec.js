import { describe, expect, it } from 'vitest'
import { buildDeepLinkHref, parseDeepLinkFromUrl } from '../appDeepLinks.js'

describe('app deep links', () => {
  it('builds chart links with symbol params', () => {
    expect(buildDeepLinkHref('chart', { symbol: '600519.SH' })).toBe('/?tab=chart&symbol=600519.SH')
  })

  it('parses chart links with symbol params', () => {
    expect(parseDeepLinkFromUrl('?tab=chart&symbol=600519.SH')).toEqual({
      tab: 'chart',
      params: { symbol: '600519.SH' },
    })
  })

  it('rejects chart links without a symbol', () => {
    expect(parseDeepLinkFromUrl('?tab=chart')).toBeNull()
  })
})
