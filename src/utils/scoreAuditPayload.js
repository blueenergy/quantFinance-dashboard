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
  const max_dates = Number(state.max_dates) || 40
  return {
    start_date,
    end_date,
    universe_index: state.universe_index || 'csi1000',
    step: suggestedAuditStep(start_date, end_date, max_dates, step),
    sample,
    max_dates,
  }
}

/** Keep ~maxDates samples across a long window (2021–2023 + step=2 is ~364 days). */
export function suggestedAuditStep(startDate, endDate, maxDates = 40, step = 1) {
  const start = toYyyymmdd(startDate)
  const end = toYyyymmdd(endDate)
  const startUtc = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(4, 6)) - 1, Number(start.slice(6, 8)))
  const endUtc = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(4, 6)) - 1, Number(end.slice(6, 8)))
  const calendarDays = Math.floor((endUtc - startUtc) / 86400000) + 1
  const approxTrading = Math.max(1, Math.ceil((calendarDays * 243) / 365))
  const need = Math.max(1, Math.ceil(approxTrading / Math.max(1, Number(maxDates) || 40)))
  const requested = Number(step)
  return Math.max(Number.isInteger(requested) && requested >= 1 ? requested : 1, need)
}

export const SCORE_AUDIT_VERDICT_LABEL = {
  self_consistent: '落库与现算一致',
  stored_growth_stale_vs_live: '成长分过期，请刷本环境',
  stored_cycle_stale_vs_live: '周期分过期，请刷本环境',
  stored_both_stale_vs_live: '成长和周期都过期，请刷本环境',
  no_overlap: '窗口内没有可对的评分',
}
