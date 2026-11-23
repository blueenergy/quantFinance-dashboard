import { describe, expect, it } from 'vitest'
import { portfolioShortLabel, shortModelName } from '../portfolioOverviewFormat'

describe('shortModelName', () => {
  it('strips the common prefix, universe token and version suffix', () => {
    expect(shortModelName('research-csi1000-clean-raw5')).toBe('clean-raw5')
    expect(shortModelName('wf-csi1000-raw5-defensive-20d')).toBe('raw5-defensive')
    expect(shortModelName('sleeve-quality-lowrisk-v1')).toBe('quality-lowrisk')
  })

  it('leaves an already-short id alone', () => {
    expect(shortModelName('raw5')).toBe('raw5')
    expect(shortModelName('')).toBe('')
  })
})

describe('portfolioShortLabel', () => {
  const base = {
    strategy_name: '成长周期指数增强',
    universe_index: 'csi1000',
    top_n: 20,
    rebalance_days: 20,
    construction_mode: 'top_n',
  }

  it('leads with the model name and hides the default universe', () => {
    const label = portfolioShortLabel({ ...base, model_id: 'sleeve-quality-lowrisk-v1' })
    expect(label).toBe('quality-lowrisk · Top20 · 20d')
  })

  it('keeps a non-default universe', () => {
    const label = portfolioShortLabel({ ...base, universe_index: 'hs300', rebalance_days: 30 })
    expect(label).toBe('成长周期指数增强 · hs300 · Top20 · 30d')
  })

  it('names construction only when it is not plain top_n', () => {
    expect(portfolioShortLabel({ ...base, construction_mode: 'top_n_buffer' }))
      .toContain('buffer')
    expect(portfolioShortLabel({ ...base, construction_mode: 'top_n' })).not.toContain('buffer')
    expect(portfolioShortLabel({ ...base, construction_mode: 'industry_neutral' }))
      .toContain('行业中性')
  })

  it('marks a paused lineage', () => {
    expect(portfolioShortLabel({ ...base, paused: true })).toContain('暂停')
  })
})
