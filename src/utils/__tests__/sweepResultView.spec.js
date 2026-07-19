import { describe, expect, it } from 'vitest'
import {
  buildCandidateConfigFromRow,
  buildSweepResultView,
  experimentSummary,
  filterRowsByFacet,
  inferSweepAxes,
  paginateRows,
} from '../sweepResultView'

const sampleRows = [
  { score_variant: 'g30_c70', variant: 'topn', top_n: 10, trailing_stop_pct: null, risk_adjusted_score: 0.8 },
  { score_variant: 'g30_c70', variant: 'topn', top_n: 10, trailing_stop_pct: 0.1, risk_adjusted_score: 0.6 },
  { score_variant: 'g30_c70', variant: 'topn', top_n: 10, trailing_stop_pct: 0.15, risk_adjusted_score: 0.7 },
]

describe('sweepResultView', () => {
  it('infers trailing stop axis from params', () => {
    const axes = inferSweepAxes({ trailing_stop_pcts: [0, 0.1, 0.15] }, sampleRows)
    expect(axes[0].key).toBe('trailing_stop_pct')
    expect(axes[0].values).toHaveLength(3)
  })

  it('builds facet best from rows when sweep_view missing', () => {
    const view = buildSweepResultView({ rows: sampleRows }, { trailing_stop_pcts: [0, 0.1, 0.15] })
    expect(view.facet_best.trailing_stop_pct).toHaveLength(3)
    expect(experimentSummary(view)).toContain('组合')
  })

  it('filters rows by facet value', () => {
    const filtered = filterRowsByFacet(sampleRows, 'trailing_stop_pct', 0.15)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].risk_adjusted_score).toBe(0.7)
  })

  it('paginates rows with visible total', () => {
    const page = paginateRows(sampleRows, 1, 2)
    expect(page.items).toHaveLength(2)
    expect(page.total).toBe(3)
    expect(page.totalPages).toBe(2)
  })

  it('builds candidate config from selected row', () => {
    const candidate = buildCandidateConfigFromRow(sampleRows[2], { job_id: 'job-1' }, { universe_index: 'csi1000' })
    expect(candidate.trailing_stop_pct).toBe(0.15)
    expect(candidate.top_n).toBe(10)
  })

  it('degrades gracefully with zero sweep axes', () => {
    const single = [{ variant: 'topn', top_n: 10, risk_adjusted_score: 0.5 }]
    const view = buildSweepResultView({ rows: single }, { top_n_values: [10] })
    expect(view.sweep_axes).toHaveLength(0)
  })
})
