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

  it('builds stock workbench links with swot finding params', () => {
    expect(
      buildDeepLinkHref('stock-workbench', {
        symbol: '300196.SZ',
        panel: 'swot',
        dimension: 'strength',
        findingKey: 'profitability.roe_high',
      }),
    ).toBe(
      '/?tab=stock-workbench&symbol=300196.SZ&panel=swot&dimension=strength&findingKey=profitability.roe_high',
    )
  })

  it('parses stock workbench swot deep links', () => {
    expect(
      parseDeepLinkFromUrl(
        '?tab=stock-workbench&symbol=300196.SZ&panel=swot&dimension=weakness&findingKey=growth.profit_negative',
      ),
    ).toEqual({
      tab: 'stock-workbench',
      params: {
        symbol: '300196.SZ',
        panel: 'swot',
        dimension: 'weakness',
        findingKey: 'growth.profit_negative',
      },
    })
  })
})
