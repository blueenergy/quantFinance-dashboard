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

export function isStaleVerdict(verdict) {
  return String(verdict || '').includes('stale')
}

export function isSuccessfulRepairLogEntry(entry) {
  const code = entry?.exit_code
  return code === 0 || code === '0'
}

export function hasSuccessfulRepairLog(repairLog) {
  return Array.isArray(repairLog) && repairLog.some(isSuccessfulRepairLogEntry)
}

export function isActiveRepairJob(job) {
  const status = String(job?.status || '')
  return status === 'pending' || status === 'running' || status === 'blocked'
}

export function isSuccessfulRepairJob(job) {
  if (String(job?.status || '') !== 'completed') return false
  const shards = job?.shards || []
  if (!shards.length) return true
  return shards.every((shard) => {
    const status = String(shard?.status || '').toLowerCase()
    if (status !== 'completed' && status !== 'done') return false
    const code = shard?.exit_code
    return code == null || code === 0
  })
}

export function repairJobTime(job) {
  const raw = job?.created_at || job?.updated_at || job?.started_at || ''
  const time = Date.parse(raw)
  return Number.isFinite(time) ? time : 0
}

export function sortRepairJobsNewestFirst(repairJobs = []) {
  return [...repairJobs].sort((left, right) => repairJobTime(right) - repairJobTime(left))
}

export function hasRecordedRepairSuccess(auditJob, repairJobs = []) {
  const repairLog = auditJob?.repair_log || []
  return hasSuccessfulRepairLog(repairLog) || repairJobs.some(isSuccessfulRepairJob)
}

/** idle | needs_repair | repairing | repaired | failed */
export function getRepairRollupStatus(auditJob, repairJobs = []) {
  const ordered = sortRepairJobsNewestFirst(repairJobs)
  const latest = ordered[0]
  const recordedSuccess = hasRecordedRepairSuccess(auditJob, repairJobs)

  if (latest && isActiveRepairJob(latest)) {
    // repair_log is written when scratch exits 0; a leftover running doc is stale.
    if (hasSuccessfulRepairLog(auditJob?.repair_log || [])) return 'repaired'
    return 'repairing'
  }
  if (recordedSuccess) return 'repaired'
  if (latest && String(latest.status) === 'failed') return 'failed'
  if (ordered.some(isActiveRepairJob)) return 'repairing'
  if (auditJob?.status === 'completed' && isStaleVerdict(auditJob?.overall_verdict)) return 'needs_repair'
  return 'idle'
}

export function repairRollupLabel(status) {
  return {
    repairing: '修复中',
    repaired: '已刷库',
    failed: '修复失败',
    needs_repair: '待刷库',
  }[status] || ''
}

export function listAuditHeadline(auditJob, repairJobs = []) {
  const rollup = getRepairRollupStatus(auditJob, repairJobs)
  if (rollup === 'repaired') return '已刷库，待复查'
  if (rollup === 'repairing') return '修复进行中'
  if (rollup === 'failed') return '修复失败'
  if (rollup === 'needs_repair') {
    return SCORE_AUDIT_VERDICT_LABEL[auditJob?.overall_verdict] || auditJob?.overall_verdict || '待刷库'
  }
  if (auditJob?.overall_verdict) return SCORE_AUDIT_VERDICT_LABEL[auditJob.overall_verdict] || auditJob.overall_verdict
  return auditJob?.status || '—'
}

export function isSupersededRepairJob(job, auditJob, repairJobs = []) {
  if (!job || !isActiveRepairJob(job)) return false
  return hasSuccessfulRepairLog(auditJob?.repair_log || [])
}

export function repairJobStatusLabel(job, auditJob, repairJobs = []) {
  const status = String(job?.status || '')
  if (isSupersededRepairJob(job, auditJob, repairJobs)) {
    return `${status}（已有成功记录，可忽略）`
  }
  return status
}

/** Stale audit still needs a repair queue action. */
export function canQueueOpsRepair(auditJob, { repairJobs = [], repairLog = [] } = {}) {
  if (!auditJob || auditJob.status !== 'completed') return false
  if (!isStaleVerdict(auditJob.overall_verdict)) return false
  return getRepairRollupStatus(auditJob, repairJobs) === 'needs_repair'
    || (getRepairRollupStatus(auditJob, repairJobs) === 'failed' && !hasSuccessfulRepairLog(repairLog))
}

export function repairStatusHint(auditJob, { repairJobs = [], repairLog = [] } = {}) {
  const verdict = auditJob?.overall_verdict || ''
  if (!isStaleVerdict(verdict)) return ''
  const start = auditJob?.start_date || ''
  const end = auditJob?.end_date || ''
  const window = start && end ? `窗口 ${start}–${end}。` : ''
  const rollup = getRepairRollupStatus(auditJob, repairJobs)

  if (rollup === 'repairing') {
    const active = sortRepairJobsNewestFirst(repairJobs).find(isActiveRepairJob)
    return `修复任务进行中（${active?.status || 'running'}）。${window}`
  }
  if (rollup === 'repaired') {
    const stale = sortRepairJobsNewestFirst(repairJobs).filter((job) => isSupersededRepairJob(job, auditJob, repairJobs))
    const staleNote = stale.length
      ? `另有 ${stale.length} 条关联任务状态未更新（已有 exit=0 记录，可忽略）。`
      : ''
    return `刷库已完成。自查结论仍是过期抽样结果；若要确认一致，请重新排队检查。${staleNote}${window}`
  }
  if (rollup === 'failed') {
    return `上次修复失败，可再次点「确认刷本环境」重试。${window}不要在常驻 quant-scorer 里刷。`
  }
  return (
    `检查已完成：落库分过期。点「确认刷本环境」入队，由 ops-launcher 自动起 scratch 刷库。` +
    `${window}不要在常驻 quant-scorer 里刷。`
  )
}

export function calendarYearCount(startDate, endDate) {
  const start = toYyyymmdd(startDate)
  const end = toYyyymmdd(endDate)
  return Number(end.slice(0, 4)) - Number(start.slice(0, 4)) + 1
}

export function needsYearConfirm(startDate, endDate) {
  return calendarYearCount(startDate, endDate) > 1
}

export function buildOpsRepairPayload(auditJob = {}, { confirmYears = false } = {}) {
  if (auditJob.status !== 'completed') throw new Error('只有已完成的自查单才能刷库')
  if (!isStaleVerdict(auditJob.overall_verdict)) throw new Error('自查未过期，不用刷库')
  if (!auditJob.job_id) throw new Error('缺少 source_audit_job_id')
  const payload = {
    source_audit_job_id: auditJob.job_id,
    job_kind: 'score_force_refresh',
  }
  if (needsYearConfirm(auditJob.start_date, auditJob.end_date)) {
    if (!confirmYears) throw new Error('窗口跨年，需要确认')
    payload.confirm_years = true
  }
  return payload
}

export function buildRepairNotePayload(state = {}) {
  const container_name = String(state.container_name || '').trim()
  if (!container_name) throw new Error('需要 scratch 容器名')
  const payload = {
    method: 'manual_docker_run',
    container_name,
    note: String(state.note || '').trim(),
  }
  if (state.exit_code !== '' && state.exit_code != null) {
    const code = Number(state.exit_code)
    if (!Number.isInteger(code) || code < 0) throw new Error('exit_code 必须是 >= 0 的整数')
    payload.exit_code = code
  }
  return payload
}

/** API stores UTC; naive iso strings without Z must be treated as UTC. */
export function parseAuditTimestamp(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : null
  }
  const raw = String(value).trim()
  if (!raw) return null
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)
  const normalized = hasTimezone ? raw : (raw.includes('T') ? `${raw}Z` : raw)
  const time = Date.parse(normalized)
  return Number.isFinite(time) ? time : null
}

/** Render instants in the viewer's local timezone (browser default). */
export function formatAuditClock(value, { locale, timeZone } = {}) {
  const time = parseAuditTimestamp(value)
  if (time == null) return ''
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(time))
  const pick = (type) => parts.find((part) => part.type === type)?.value || ''
  return `${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
}

export function formatAuditDurationMs(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return ''
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}秒`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return sec ? `${min}分${sec}秒` : `${min}分钟`
  const hour = Math.floor(min / 60)
  const remMin = min % 60
  return remMin ? `${hour}小时${remMin}分` : `${hour}小时`
}

/** Compact timing label for score-audit list/detail. */
export function formatAuditJobTiming(job, now = Date.now(), clockOptions = {}) {
  if (!job) return ''
  const status = String(job.status || '')
  const created = formatAuditClock(job.created_at, clockOptions)
  const started = formatAuditClock(job.started_at, clockOptions)
  const completed = formatAuditClock(job.completed_at, clockOptions)
  const startMs = parseAuditTimestamp(job.started_at) ?? parseAuditTimestamp(job.created_at)
  const endMs = parseAuditTimestamp(job.completed_at)
    ?? (status === 'running' ? now : null)

  if (status === 'pending') {
    return created ? `${created} 排队` : '排队中'
  }
  if (status === 'running') {
    const since = started || created
    if (!since) return '执行中'
    const duration = startMs != null ? formatAuditDurationMs(now - startMs) : ''
    return duration ? `${since} 起 · ${duration}` : `${since} 起`
  }
  if (status === 'completed' || status === 'failed') {
    const end = completed || formatAuditClock(job.updated_at, clockOptions)
    const duration = startMs != null && endMs != null ? formatAuditDurationMs(endMs - startMs) : ''
    if (end && duration) return `${end} · ${duration}`
    if (end) return end
  }
  return created || ''
}
