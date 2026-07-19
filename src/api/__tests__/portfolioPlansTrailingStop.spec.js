import { describe, expect, it, vi } from 'vitest'
import { updatePortfolioPlanTrailingStop } from '../portfolioPlans'

vi.mock('../../utils/request', () => ({
  default: vi.fn((config) => Promise.resolve(config)),
}))

describe('updatePortfolioPlanTrailingStop', () => {
  it('calls PUT trailing-stop endpoint with plan id and payload', async () => {
    const request = (await import('../../utils/request')).default
    await updatePortfolioPlanTrailingStop('plan-1', { trailing_stop_pct: 0.15 })
    expect(request).toHaveBeenCalledWith({
      url: '/portfolio-plans/plans/plan-1/trailing-stop',
      method: 'put',
      data: { trailing_stop_pct: 0.15 },
    })
  })
})
