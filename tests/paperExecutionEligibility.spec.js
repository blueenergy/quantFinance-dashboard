import { describe, it, expect } from 'vitest'
import {
  canExecutePaperNowFromState,
  paperExecuteReadyTextFromState,
  paperExecutionPriceStatusText,
} from '../src/utils/paperExecutionEligibility'

describe('paperExecutionEligibility', () => {
  it('allows approved paper plans without open prices when execute_date exists', () => {
    expect(canExecutePaperNowFromState({
      planStatus: 'approved',
      hasLiveSignals: false,
      hasPaperExecution: false,
      missingExecuteDate: false,
    })).toBe(true)
  })

  it('blocks paper execution when open prices are missing but execute_date is absent', () => {
    expect(canExecutePaperNowFromState({
      planStatus: 'approved',
      hasLiveSignals: false,
      hasPaperExecution: false,
      missingExecuteDate: true,
    })).toBe(false)
  })

  it('does not block paper execution solely because open prices are missing', () => {
    expect(canExecutePaperNowFromState({
      planStatus: 'approved',
      hasLiveSignals: false,
      hasPaperExecution: false,
      missingExecuteDate: false,
    })).toBe(true)
  })

  it('describes fallback pricing when open prices are missing', () => {
    const text = paperExecuteReadyTextFromState({
      planStatus: 'approved',
      executionStatus: {
        open_price_ready: false,
        execute_date: '20260713',
        missing_open_price_count: 3,
      },
    })
    expect(text).toContain('回退最近收盘价/计划价')
    expect(text).not.toContain('都会等待/失败')
  })

  it('reports execution price readiness separately from open prices', () => {
    expect(paperExecutionPriceStatusText({
      execution_price_ready: true,
      open_price_ready: false,
    })).toBe('已就绪')
    expect(paperExecutionPriceStatusText({
      execution_price_ready: false,
      missing_execution_price_count: 2,
    })).toBe('部分缺失（2 个）')
  })
})
