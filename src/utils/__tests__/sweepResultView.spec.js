import { describe, expect, it } from 'vitest'
import {
  buildCandidateConfigFromRow,
  buildSweepResultView,
  experimentSummary,
  filterRowsByFacet,
  formatAxisValue,
  inferSweepAxes,
  paginateRows,
  parseTrailingStopFromComboKey,
  resolveComboTrailingStopPct,
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

  it('filters rows when trailing stop is disabled (null facet value)', () => {
    const rows = [
      { score_variant: 'g30_c70', variant: 'topn', top_n: 10, trailing_stop_pct: null, risk_adjusted_score: 0.8 },
      { score_variant: 'g30_c70', variant: 'topn', top_n: 10, trailing_stop_pct: 0, risk_adjusted_score: 0.75 },
      { score_variant: 'g30_c70', variant: 'topn', top_n: 10, trailing_stop_pct: 0.1, risk_adjusted_score: 0.6 },
    ]
    const filtered = filterRowsByFacet(rows, 'trailing_stop_pct', null)
    expect(filtered).toHaveLength(2)
    expect(filtered.every((row) => row.trailing_stop_pct == null || row.trailing_stop_pct === 0)).toBe(true)
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

  it('normalizes legacy percent-point trailing stop values for display', () => {
    expect(formatAxisValue('trailing_stop_pct', 10)).toBe('10%')
    expect(formatAxisValue('trailing_stop_pct', 0.1)).toBe('10%')
  })

  it('normalizes legacy percent-point trailing stop in candidate config', () => {
    const row = { ...sampleRows[2], trailing_stop_pct: 15 }
    const candidate = buildCandidateConfigFromRow(row, { job_id: 'job-1' }, { universe_index: 'csi1000' })
    expect(candidate.trailing_stop_pct).toBe(0.15)
  })

  it('parses trailing stop from combo key suffix', () => {
    expect(parseTrailingStopFromComboKey('foo__ts0.2')).toBe(0.2)
    expect(parseTrailingStopFromComboKey('foo__tsoff')).toBeNull()
    expect(parseTrailingStopFromComboKey('foo__rb10')).toBeUndefined()
  })

  it('resolves combo trailing stop from meta, row, then combo key', () => {
    expect(resolveComboTrailingStopPct({
      meta: { trailing_stop_pct: 0.15 },
      row: { trailing_stop_pct: 0.2 },
      comboKey: 'foo__ts0.1',
    })).toBe(0.15)
    expect(resolveComboTrailingStopPct({
      row: { trailing_stop_pct: 0.2 },
      comboKey: 'foo__ts0.1',
    })).toBe(0.2)
    expect(resolveComboTrailingStopPct({
      comboKey: 'foo__ts0.2',
    })).toBe(0.2)
    expect(resolveComboTrailingStopPct({
      comboKey: 'foo__tsoff',
    })).toBeNull()
  })

  it('degrades gracefully with zero sweep axes', () => {
    const single = [{ variant: 'topn', top_n: 10, risk_adjusted_score: 0.5 }]
    const view = buildSweepResultView({ rows: single }, { top_n_values: [10] })
    expect(view.sweep_axes).toHaveLength(0)
  })

  it('recomputes facet_best from preview rows instead of stale sweep_view', () => {
    const previewRows = [
      { top_n: 10, risk_adjusted_score: 0.536 },
      { top_n: 20, risk_adjusted_score: 0.5 },
    ]
    const view = buildSweepResultView(
      {
        rows: previewRows,
        sweep_view: {
          sweep_axes: [{ key: 'top_n', label: 'Top N', values: [10, 20] }],
          facet_best: {
            top_n: [
              { value: 10, label: '10', row: { top_n: 10, risk_adjusted_score: 0.622 } },
              { value: 20, label: '20', row: { top_n: 20, risk_adjusted_score: 0.6 } },
            ],
          },
        },
      },
      { top_n_values: [10, 20] },
    )
    expect(view.facet_best.top_n[0].row.risk_adjusted_score).toBe(0.536)
  })
})
