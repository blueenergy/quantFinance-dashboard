/** Turns score-audit form state into POST /score-audit/jobs body. */

export function toYyyymmdd(value) {
  const raw = String(value || '').replace(/-/g, '').trim()
  if (raw.length >= 8 && /^\d{8}$/.test(raw.slice(0, 8))) return raw.slice(0, 8)
  throw new Error('需要完整的开始与结束日期')
}

export function toDateInput(value) {
  const raw = String(value || '').replace(/-/g, '')
  if (raw.length >= 8) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
  return ''
}

export function localYmd(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function defaultScoreAuditRange(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - 40)
  return { start_date: localYmd(start), end_date: localYmd(end) }
}

export function buildScoreAuditPayload(state = {}) {
  const start_date = toYyyymmdd(state.start_date)
  const end_date = toYyyymmdd(state.end_date)
  if (start_date > end_date) throw new Error('开始日期不能晚于结束日期')
  const step = Number(state.step)
  const sample = Number(state.sample)
  if (!Number.isInteger(step) || step < 1) throw new Error('step 必须是 >= 1 的整数')
  if (!Number.isInteger(sample) || sample < 0) throw new Error('sample 必须是 >= 0 的整数')
  return {
    start_date,
    end_date,
    universe_index: state.universe_index || 'csi1000',
    step,
    sample,
    max_dates: Number(state.max_dates) || 40,
  }
}

export const SCORE_AUDIT_VERDICT_LABEL = {
  self_consistent: '落库与现算一致',
  stored_growth_stale_vs_live: '成长分过期，请刷本环境',
  stored_cycle_stale_vs_live: '周期分过期，请刷本环境',
  stored_both_stale_vs_live: '成长和周期都过期，请刷本环境',
  no_overlap: '窗口内没有可对的评分',
}
