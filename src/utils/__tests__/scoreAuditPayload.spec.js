import { describe, expect, it } from 'vitest'
import {
  buildOpsRepairPayload,
  buildRepairNotePayload,
  buildScoreAuditPayload,
  canQueueOpsRepair,
  defaultScoreAuditRange,
  getRepairRollupStatus,
  listAuditHeadline,
  localYmd,
  needsYearConfirm,
  formatAuditClock,
  formatAuditJobTiming,
  parseAuditTimestamp,
  repairStatusHint,
  suggestedAuditStep,
  toDateInput,
} from '../scoreAuditPayload'

describe('buildScoreAuditPayload', () => {
  it('compacts dates and keeps sampling knobs', () => {
    expect(
      buildScoreAuditPayload({
        start_date: '2021-01-04',
        end_date: '2021-05-15',
        universe_index: 'csi1000',
        step: '20',
        sample: '12',
      }),
    ).toEqual({
      start_date: '20210104',
      end_date: '20210515',
      universe_index: 'csi1000',
      step: 20,
      sample: 12,
      max_dates: 40,
    })
  })

  it('raises step so a 2021–2023 window stays under the 40-date cap', () => {
    const payload = buildScoreAuditPayload({
      start_date: '2021-01-01',
      end_date: '2023-12-29',
      step: 2,
      sample: 12,
    })
    expect(payload.step).toBeGreaterThanOrEqual(18)
    expect(payload.step).toBeLessThanOrEqual(22)
    expect(suggestedAuditStep('20260901', '20260910', 40, 2)).toBe(2)
  })

  it('rejects an inverted window', () => {
    expect(() =>
      buildScoreAuditPayload({
        start_date: '2021-05-15',
        end_date: '2021-01-04',
        step: 2,
        sample: 12,
      }),
    ).toThrow(/开始日期/)
  })
})

describe('defaultScoreAuditRange', () => {
  it('looks back 40 local calendar days', () => {
    const range = defaultScoreAuditRange(new Date(2026, 8, 10))
    expect(range.end_date).toBe('2026-09-10')
    expect(range.start_date).toBe('2026-08-01')
    expect(toDateInput('20210104')).toBe('2021-01-04')
    expect(localYmd(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('ops repair payload', () => {
  it('queues score_force_refresh from a stale completed audit', () => {
    expect(
      buildOpsRepairPayload({
        job_id: 'audit-1',
        status: 'completed',
        overall_verdict: 'stored_growth_stale_vs_live',
        start_date: '20260801',
        end_date: '20260910',
      }),
    ).toEqual({
      source_audit_job_id: 'audit-1',
      job_kind: 'score_force_refresh',
    })
  })

  it('requires confirm_years for a multi-year window', () => {
    const audit = {
      job_id: 'audit-2',
      status: 'completed',
      overall_verdict: 'stored_both_stale_vs_live',
      start_date: '20210101',
      end_date: '20230630',
    }
    expect(needsYearConfirm(audit.start_date, audit.end_date)).toBe(true)
    expect(() => buildOpsRepairPayload(audit)).toThrow(/跨年/)
    expect(buildOpsRepairPayload(audit, { confirmYears: true }).confirm_years).toBe(true)
  })

  it('rejects a consistent audit', () => {
    expect(() =>
      buildOpsRepairPayload({
        job_id: 'audit-3',
        status: 'completed',
        overall_verdict: 'self_consistent',
        start_date: '20260801',
        end_date: '20260910',
      }),
    ).toThrow(/未过期/)
  })

  it('builds a manual docker run note', () => {
    expect(
      buildRepairNotePayload({
        container_name: 'backfill-gc-20260801-20260910',
        exit_code: '0',
        note: 'wsl',
      }),
    ).toEqual({
      method: 'manual_docker_run',
      container_name: 'backfill-gc-20260801-20260910',
      note: 'wsl',
      exit_code: 0,
    })
  })

  it('hides repair queue when a successful repair already exists', () => {
    const audit = {
      job_id: 'audit-1',
      status: 'completed',
      overall_verdict: 'stored_both_stale_vs_live',
      start_date: '20260801',
      end_date: '20260910',
      repair_log: [{ method: 'score_force_refresh', exit_code: 0 }],
    }
    expect(canQueueOpsRepair(audit, { repairJobs: [], repairLog: audit.repair_log })).toBe(false)
    expect(repairStatusHint(audit, { repairJobs: [], repairLog: audit.repair_log })).toMatch(/刷库已完成/)
    expect(listAuditHeadline(audit, [])).toBe('已刷库，待复查')
  })

  it('still allows repair when the linked job failed', () => {
    const audit = {
      job_id: 'audit-2',
      status: 'completed',
      overall_verdict: 'stored_growth_stale_vs_live',
      start_date: '20260801',
      end_date: '20260910',
    }
    const repairJobs = [{ job_id: 'repair-1', status: 'failed', shards: [] }]
    expect(canQueueOpsRepair(audit, { repairJobs, repairLog: [] })).toBe(true)
    expect(repairStatusHint(audit, { repairJobs, repairLog: [] })).toMatch(/上次修复失败/)
  })

  it('treats stale running jobs as repaired when exit=0 is already recorded', () => {
    const audit = {
      job_id: 'audit-3',
      status: 'completed',
      overall_verdict: 'stored_both_stale_vs_live',
      repair_log: [{ method: 'score_force_refresh', exit_code: 0 }],
    }
    const repairJobs = [{ job_id: 'repair-2', status: 'running', shards: [] }]
    expect(getRepairRollupStatus(audit, repairJobs)).toBe('repaired')
    expect(listAuditHeadline(audit, repairJobs)).toBe('已刷库，待复查')
    expect(repairStatusHint(audit, { repairJobs, repairLog: audit.repair_log })).toMatch(/可忽略/)
  })

  it('parses naive UTC iso strings and formats in a target timezone', () => {
    expect(parseAuditTimestamp('2026-09-11T05:15:43.845000')).toBe(Date.parse('2026-09-11T05:15:43.845Z'))
    expect(formatAuditClock('2026-09-11T05:15:43.845000', { timeZone: 'Asia/Shanghai' })).toBe('09-11 13:15')
    expect(formatAuditClock('2026-09-11T05:15:43.845Z', { timeZone: 'Asia/Shanghai' })).toBe('09-11 13:15')
  })

  it('formats audit job timing for list rows', () => {
    const now = Date.parse('2026-09-11T05:30:00.000Z')
    const tz = { timeZone: 'Asia/Shanghai' }
    expect(
      formatAuditJobTiming(
        { status: 'pending', created_at: '2026-09-11T05:15:43.845Z' },
        now,
        tz,
      ),
    ).toMatch(/13:15 排队/)
    expect(
      formatAuditJobTiming(
        {
          status: 'running',
          created_at: '2026-09-11T05:15:43.845Z',
          started_at: '2026-09-11T05:20:00.488Z',
        },
        now,
        tz,
      ),
    ).toMatch(/起/)
    expect(
      formatAuditJobTiming(
        {
          status: 'completed',
          started_at: '2026-09-11T05:20:00.488Z',
          completed_at: '2026-09-11T05:28:10.000Z',
        },
        now,
        tz,
      ),
    ).toMatch(/13:28 ·/)
  })

  it('shows repairing when the latest linked job is still active', () => {
    const audit = {
      job_id: 'audit-4',
      status: 'completed',
      overall_verdict: 'stored_both_stale_vs_live',
    }
    const repairJobs = [
      { job_id: 'repair-old', status: 'completed', created_at: '2026-09-10T08:00:00Z', shards: [{ status: 'completed', exit_code: 0 }] },
      { job_id: 'repair-new', status: 'running', created_at: '2026-09-11T08:00:00Z', shards: [] },
    ]
    expect(getRepairRollupStatus(audit, repairJobs)).toBe('repairing')
    expect(listAuditHeadline(audit, repairJobs)).toBe('修复进行中')
  })
})
