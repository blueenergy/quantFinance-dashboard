import { describe, expect, it } from 'vitest'
import { aiRiskTitle, llmRiskTitle, riskDisplaySeverity } from '../usePortfolioPlanFormat'

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
})
