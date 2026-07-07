import { describe, expect, it } from 'vitest'

function buildTradeActivitiesParams(viewMode, statusFilter = 'all') {
  const params = {
    limit: 200,
    skip: 0,
    activity_type: viewMode === 'signals' ? 'signals' : 'executions',
  }
  if (statusFilter && statusFilter !== 'all') {
    params.status_filter = statusFilter
  }
  return params
}

function shouldReloadTradesOnFilterChange(changedKey) {
  const reloadKeys = new Set([
    'statusFilter',
    'dateRangeType',
    'selectedDate',
    'startDate',
    'endDate',
  ])
  return reloadKeys.has(changedKey)
}

describe('TradeExecutionTable request semantics', () => {
  it('maps tab viewMode to activity_type', () => {
    expect(buildTradeActivitiesParams('signals', 'pending')).toEqual({
      limit: 200,
      skip: 0,
      activity_type: 'signals',
      status_filter: 'pending',
    })
    expect(buildTradeActivitiesParams('executions', 'executed')).toEqual({
      limit: 200,
      skip: 0,
      activity_type: 'executions',
      status_filter: 'executed',
    })
    expect(buildTradeActivitiesParams('executions', 'all')).toEqual({
      limit: 200,
      skip: 0,
      activity_type: 'executions',
    })
  })

  it('does not reload trades for client-side search or strategy filters', () => {
    expect(shouldReloadTradesOnFilterChange('searchSymbol')).toBe(false)
    expect(shouldReloadTradesOnFilterChange('selectedStrategy')).toBe(false)
    expect(shouldReloadTradesOnFilterChange('statusFilter')).toBe(true)
    expect(shouldReloadTradesOnFilterChange('dateRangeType')).toBe(true)
  })
})
