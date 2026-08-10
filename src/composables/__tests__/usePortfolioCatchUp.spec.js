import { describe, expect, it } from 'vitest'
import { buildCatchUpRows } from '../usePortfolioCatchUp'

describe('buildCatchUpRows', () => {
  it('keeps cancelled and partial_cancelled buys only', () => {
    const rows = buildCatchUpRows([
      { order_id: 'a', action: 'buy', status: 'cancelled', size: 100, filled_qty: 0 },
      { order_id: 'b', action: 'buy', status: 'partial_cancelled', size: 300, filled_qty: 100 },
      { order_id: 'c', action: 'sell', status: 'cancelled', size: 100, filled_qty: 0 },
      { order_id: 'd', action: 'buy', status: 'filled', size: 100, filled_qty: 100 },
      { order_id: 'e', action: 'buy', status: 'submitted', size: 100, filled_qty: 0 },
    ])
    expect(rows.map((row) => row.order_id)).toEqual(['a', 'b'])
    expect(rows[1].remaining_size).toBe(200)
  })

  it('hides cancelled buys already replaced by a newer signal', () => {
    const rows = buildCatchUpRows([
      { order_id: 'old', action: 'buy', status: 'cancelled', size: 100, filled_qty: 0 },
      {
        order_id: 'new',
        action: 'buy',
        status: 'pending',
        size: 100,
        filled_qty: 0,
        replaces_order_id: 'old',
      },
    ])
    expect(rows).toEqual([])
  })

  it('shows the replacement when it is also cancelled', () => {
    const rows = buildCatchUpRows([
      { order_id: 'old', action: 'buy', status: 'cancelled', size: 100, filled_qty: 0 },
      {
        order_id: 'new',
        action: 'buy',
        status: 'canceled',
        size: 100,
        filled_qty: 0,
        replaces_order_id: 'old',
      },
    ])
    expect(rows.map((row) => row.order_id)).toEqual(['new'])
  })
})
