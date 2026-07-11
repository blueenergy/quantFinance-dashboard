import { describe, expect, it } from 'vitest'
import { aiRiskTitle, blockerText, findingSourceMeta, latestRankCellTitle, latestRankHeaderTitle, llmRiskTitle, riskDisplaySeverity, selectionExclusionLabel } from '../usePortfolioPlanFormat'

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
