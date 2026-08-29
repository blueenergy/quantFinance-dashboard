import { describe, expect, it, vi } from 'vitest'
import {
  COMBO_EXPORT_SCHEMA,
  COMBO_EXPORT_SCRIPT_ID,
  buildComboExportPayload,
  comboExportFilename,
  downloadComboExportHtml,
  extractComboExportPayloadFromHtml,
  renderComboExportHtml,
} from '../comboExport.js'

const detail = {
  meta: {
    combo_key: 'growth-cycle-topn__tn10__rb30',
    construction_mode: 'top_n',
    top_n: 10,
    horizon: 30,
    trailing_stop_pct: 0.08,
    regime_mode: 'off',
  },
  summary: {
    cumulative_return: 0.794,
    max_drawdown: -0.1162,
    periods: 1,
    yearly_returns: { 2021: 0.008 },
  },
  periods: [{ score_date: '20210104', portfolio_return_net: 0.01, selected_count: 10 }],
  trades: [{ score_date: '20210104', symbol: '600000.SH', name: '浦发银行', holding_return: 0.05 }],
}

const identity = {
  job_id: 'job-a',
  result_id: '8c980eb5-ca48-452f-a05b-250311a0b2e5',
  params: { universe_index: 'csi1000', start_date: '20210101', secret_token: 'nope' },
  data_watermark: { dataset_rows: 1219747, universe_pit_quality: 'point_in_time' },
}

describe('comboExport', () => {
  it('builds a portable payload and drops unknown params', () => {
    const payload = buildComboExportPayload(detail, identity)
    expect(payload.schema).toBe(COMBO_EXPORT_SCHEMA)
    expect(payload.identity.job_id).toBe('job-a')
    expect(payload.identity.params.universe_index).toBe('csi1000')
    expect(payload.identity.params.secret_token).toBeUndefined()
    expect(payload.identity.data_watermark.dataset_rows).toBe(1219747)
    expect(payload.trades).toHaveLength(1)
  })

  it('embeds JSON that round-trips from the HTML', () => {
    const payload = buildComboExportPayload(detail, identity)
    const html = renderComboExportHtml(payload)
    expect(html).toContain(`id="${COMBO_EXPORT_SCRIPT_ID}"`)
    expect(html).toContain('1219747')
    expect(html).toContain('600000.SH')
    const extracted = extractComboExportPayloadFromHtml(html)
    expect(extracted.identity.result_id).toBe(identity.result_id)
    expect(extracted.trades[0].symbol).toBe('600000.SH')
  })

  it('names the file from combo_key and result_id prefix', () => {
    const payload = buildComboExportPayload(detail, identity)
    expect(comboExportFilename(payload)).toBe(
      'portfolio-combo_growth-cycle-topn__tn10__rb30_8c980eb5.html',
    )
  })

  it('triggers a browser download', () => {
    const click = vi.fn()
    const remove = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: vi.fn(),
    })
    const originalCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') {
        return { href: '', download: '', click, remove }
      }
      return originalCreate(tag)
    })
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {})

    downloadComboExportHtml(buildComboExportPayload(detail, identity))

    expect(click).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })
})
