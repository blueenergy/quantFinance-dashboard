import { describe, expect, it } from 'vitest'
import {
  aiRiskTitle,
  baselineSourceLabel,
  baselineSyncedLabel,
  blockerText,
  buildEquityChart,
  buildEquityRows,
  capitalBasisLabel,
  effectiveConstructionMode,
  effectiveInitialCapital,
  effectiveRebalanceDays,
  effectiveTopN,
  findingSourceMeta,
  formatSnapshotAt,
  formatSummary,
  latestRankCellTitle,
  latestRankHeaderTitle,
  llmRiskTitle,
  pct,
  planBaselineEquity,
  planCadenceBadge,
  planLineage,
  planParamSummary,
  planRelationBadge,
  planRowClass,
  previousPlanIdFor,
  riskDisplaySeverity,
  scoringRunText,
  selectionExclusionLabel,
  shortPlanId,
  signalDisplayName,
  signedMoney,
  signedPct,
  summarizeByStatus,
  todayInputDate,
} from '../usePortfolioPlanFormat'

describe('portfolio plan risk formatting', () => {
  it('formats rule and llm findings in separate tooltip sections', () => {
    const title = aiRiskTitle({
      severity: 'medium',
      reasons: ['近期涨幅过大'],
      llm: {
        severity: 'high',
        summary: '监管问询带来短期事件风险',
        findings: [
          {
            title: '收到问询函',
            detail: '交易所要求说明收入确认问题',
            source_date: '2026-06-29',
            source_title: '测试股份问询公告',
          },
        ],
      },
    })

    expect(title).toContain('规则风控')
    expect(title).toContain('近期涨幅过大')
    expect(title).toContain('LLM 事件风控')
    expect(title).toContain('监管问询带来短期事件风险')
    expect(title).toContain('测试股份问询公告')
  })

  it('uses the higher severity between rules and llm', () => {
    expect(riskDisplaySeverity({ severity: 'low', llm: { severity: 'high' } })).toBe('high')
    expect(riskDisplaySeverity({ severity: 'medium', llm: { severity: 'low' } })).toBe('medium')
    expect(riskDisplaySeverity(null)).toBe('none')
  })

  it('formats llm-only tooltip text for the standalone llm tag', () => {
    const title = llmRiskTitle({
      severity: 'medium',
      reasons: ['规则风控内容不应展示'],
      llm: {
        severity: 'high',
        summary: '股东减持带来事件风险',
        model: 'test-model',
        analyzed_at: '2026-06-29T14:25:56',
        findings: [{ title: '减持公告', source_title: '测试股份减持公告' }],
      },
    })

    expect(title).toContain('LLM 事件风控')
    expect(title).toContain('股东减持带来事件风险')
    expect(title).toContain('测试股份减持公告')
    expect(title).toContain('test-model')
    expect(title).not.toContain('规则风控内容不应展示')
  })

  it('extracts ledger evidence source and time for finding cards', () => {
    const meta = findingSourceMeta({
      discovered_by: 'llm',
      first_detected_as_of: '20260708',
      last_confirmed_as_of: '20260709',
      evidence: [
        {
          evidence_type: 'news',
          source_title: '半导体国产替代政策持续推进',
          source_date: '20260707',
          source_url: 'https://example.com/news',
        },
      ],
    })

    expect(meta.sourceText).toBe('新闻：半导体国产替代政策持续推进')
    expect(meta.eventTime).toBe('2026-07-07')
    expect(meta.ledgerFirstAt).toBe('2026-07-08')
    expect(meta.ledgerConfirmedAt).toBe('2026-07-09')
    expect(meta.url).toBe('https://example.com/news')
  })

  it('includes nested evidence source in copied llm finding lines', () => {
    const title = llmRiskTitle({
      llm: {
        findings: [
          {
            summary: '监管问询',
            detail: '交易所要求说明收入确认',
            evidence: [
              {
                evidence_type: 'announcement',
                source_title: '问询函公告',
                source_date: '20260629',
              },
            ],
          },
        ],
      },
    })

    expect(title).toContain('问询函公告')
    expect(title).toContain('2026-06-29')
  })

  it('labels board-lot blockers in Chinese', () => {
    expect(blockerText('below_star_min_order')).toBe('低于科创板单笔 200 股下单门槛')
    expect(blockerText('below_lot_size')).toBe('低于一手交易单位')
  })

  it('formats latest rank tooltip with snapshot vs latest dates', () => {
    const title = latestRankCellTitle(
      {
        snapshot_rank: 13,
        latest_rank: 13,
        rank_delta: 0,
        rank: 1,
      },
      { score_snapshot_date: '20260710', latest_score_date: '20260710' },
    )
    expect(title).toContain('计划快照日（20260710）全市场排名：13')
    expect(title).toContain('最新记分日（20260710）全市场排名：13')
    expect(title).toContain('本计划目标组合序号：#1')
  })

  it('includes selection exclusion reason in rank tooltip', () => {
    const title = latestRankCellTitle(
      { selection_exclusion_reason: 'dropped_from_target_pool', latest_rank: 73 },
      { score_snapshot_date: '20260710', latest_score_date: '20260710' },
    )
    expect(title).toContain(selectionExclusionLabel('dropped_from_target_pool'))
  })

  it('describes latest rank column header context', () => {
    const title = latestRankHeaderTitle({
      score_snapshot_date: '20260710',
      latest_score_date: '20260710',
      target_slot_amount: 4499.68,
    })
    expect(title).toContain('全市场 universe 排名')
    expect(title).toContain('单槽预算约：4500 元/槽')
  })
})

describe('portfolio plan view formatting', () => {
  it('formats percentages, signed values, dates, and status summaries', () => {
    expect(pct(0.1234)).toBe('12.34%')
    expect(signedPct(-0.1234)).toBe('-12.34%')
    expect(signedMoney(1234)).toBe('+1,234')
    expect(formatSnapshotAt('2026-07-20T01:02:03.456Z')).toBe('2026-07-20 01:02:03')
    expect(todayInputDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(scoringRunText({ score_date: '20260720', status: 'completed' })).toBe('20260720 / completed')

    const summary = summarizeByStatus([
      { status: 'filled' },
      { status: 'filled' },
      {},
    ])
    expect(summary).toEqual({ filled: 2, unknown: 1 })
    expect(formatSummary(summary)).toBe('filled: 2 / unknown: 1')
  })

  it('formats signal names and effective plan parameters', () => {
    const plan = {
      summary: { target_top_n: 8 },
      params_snapshot: {
        top_n: 10,
        rebalance_days: 20,
        construction_mode: 'equal_weight',
        initial_capital: 500000,
      },
    }

    expect(signalDisplayName({ stock_name: '测试股份', symbol: '000001.SZ' })).toBe('测试股份')
    expect(effectiveTopN(plan)).toBe(8)
    expect(effectiveRebalanceDays(plan)).toBe(20)
    expect(effectiveConstructionMode(plan)).toBe('equal_weight')
    expect(effectiveInitialCapital(plan)).toBe(500000)
    expect(planParamSummary(plan)).toBe('Top8 · 20d · equal_weight')
    expect(shortPlanId('123456789012345678901234567890')).toBe('123456789012345678…34567890')
  })

  it('formats capital basis and baseline metadata', () => {
    const plan = {
      capital_basis: 'account_equity',
      summary: {
        baseline_source: 'live_lineage_reconstruction',
        baseline_equity: '123456.78',
      },
    }

    expect(capitalBasisLabel(plan)).toBe('实盘账户滚动权益')
    expect(baselineSourceLabel(plan)).toBe('实盘成交重建')
    expect(planBaselineEquity(plan)).toBe(123456.78)
    expect(baselineSyncedLabel({ summary: {} })).toBe('—')
    expect(baselineSyncedLabel({ summary: { baseline_synced_at: 'invalid' } })).toBe('invalid')
  })

  it('builds sorted equity rows and SVG chart data', () => {
    const rows = buildEquityRows([
      { date: '2026-07-20', equity: '110', cash: 20 },
      { date: '2026-07-18', equity: 'invalid' },
      { date: '2026-07-19', equity: 100, cash: 10 },
    ])

    expect(rows).toEqual([
      { date: '2026-07-19', equity: 100, cash: 10, change: null, changePct: null },
      { date: '2026-07-20', equity: 110, cash: 20, change: 10, changePct: 0.1 },
    ])
    const chart = buildEquityChart(rows)
    expect(chart).toMatchObject({
      points: '28.0,192.0 612.0,28.0',
      min: 100,
      max: 110,
      labels: [
        { text: '2026-07-19', x: 28, y: 214, anchor: 'start' },
        { text: '2026-07-20', x: 612, y: 214, anchor: 'end' },
      ],
    })
    expect(chart.latestReturn).toBeCloseTo(0.1)
    expect(buildEquityChart([])).toEqual({
      points: '',
      labels: [],
      min: 0,
      max: 0,
      latestReturn: null,
    })
  })

  it('labels plan cadence from authoritative record kind', () => {
    expect(planCadenceBadge({
      record_kind: 'trade_plan',
      status: 'needs_review',
      previous_rebalance_date: '2026-07-01',
    })).toEqual({ text: '待审核调仓', cls: 'cadence-rebalance-pending' })
    expect(planCadenceBadge({
      record_kind: 'observation',
      executable: false,
    })).toEqual({ text: '观察·不交易', cls: 'cadence-monitor-readonly' })
    expect(planCadenceBadge({
      record_kind: 'ledger_event',
      is_liquidation: true,
    })).toEqual({ text: '手工补录·清仓', cls: 'cadence-manual' })
  })

  it('resolves lineage and selected-plan row relationships from explicit inputs', () => {
    const previous = {
      plan_id: 'plan-previous',
      base_date: '2026-07-01',
      params_hash: 'hash',
      strategy_template_id: 'strategy',
      user_id: 'user',
      record_kind: 'trade_plan',
    }
    const selected = {
      plan_id: 'plan-selected',
      previous_rebalance_date: '2026-07-01',
      params_hash: 'hash',
      strategy_template_id: 'strategy',
      user_id: 'user',
      record_kind: 'trade_plan',
    }
    const next = {
      plan_id: 'plan-next',
      previous_rebalance_plan_id: 'plan-selected',
      record_kind: 'trade_plan',
    }
    const plans = [previous, selected, next]
    const selectedDetail = { plan: selected }

    expect(previousPlanIdFor(selected, plans)).toBe('plan-previous')
    expect(planLineage(selected, plans)).toEqual({
      show: true,
      previousDate: '2026-07-01',
      previousPlanId: 'plan-previous',
    })
    expect(planRelationBadge(previous, 'plan-selected', selectedDetail, plans))
      .toEqual({ text: '上游', cls: 'relation-upstream' })
    expect(planRelationBadge(next, 'plan-selected', selectedDetail, plans))
      .toEqual({ text: '下游', cls: 'relation-downstream' })
    expect(planRowClass(previous, 'plan-selected', selectedDetail, plans)).toEqual({
      active: false,
      upstream: true,
      downstream: false,
    })
    expect(planRowClass(selected, 'plan-selected', selectedDetail, plans)).toEqual({
      active: true,
      upstream: false,
      downstream: false,
    })
  })
})
