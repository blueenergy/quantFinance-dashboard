import { describe, expect, it } from 'vitest'
import {
  buildScoreHistoryComparison,
  classifyRawValue,
  extractCompositeRawFields,
  extractCompositeTotal,
  extractExpressFromDetails,
  normalizeCategoryDetails,
  normalizeComposite,
  normalizeScoreMeta,
  submoduleWeightsFromDetails,
} from '../scoreDetail.js'

describe('normalizeCategoryDetails', () => {
  it('parses nested submodule details with signals and metrics', () => {
    const result = normalizeCategoryDetails({
      均线系统: {
        MA5: '12.10',
        '价格vs MA5': '✅ 价格在MA5之上',
        均线系统得分: 78,
      },
      量价配合: {
        '量价配合评价': '❌ 明显空头信号',
        量价配合得分: 42,
      },
      技术面评分: 72.5,
    }, {
      均线系统: 0.3,
      量价配合: 0.25,
    })

    expect(result.total).toBe(72.5)
    expect(result.subModules).toHaveLength(2)
    expect(result.subModules[0]).toMatchObject({
      name: '均线系统',
      score: 78,
      weight: 0.3,
    })
    expect(result.subModules[0].signals[0]).toMatchObject({
      key: '价格vs MA5',
      positive: true,
    })
    expect(result.subModules[1].signals[0].positive).toBe(false)
    expect(result.subModules[0].rawFields).toHaveLength(2)
  })

  it('captures top-level scalar and array fields', () => {
    const result = normalizeCategoryDetails({
      多周期交互分析: '短中长期趋势一致向上',
      短期周期: { 短期周期得分: 80 },
      周期综合评分: 75,
    })

    expect(result.topLevelFields).toHaveLength(1)
    expect(result.topLevelFields[0]).toMatchObject({
      key: '多周期交互分析',
      type: 'scalar',
      display: '短中长期趋势一致向上',
    })
  })

  it('includes array values in submodule rawFields', () => {
    const result = normalizeCategoryDetails({
      营收增长分析: {
        历年营收: ['10.2亿', '12.3亿', '15.1亿'],
        营收增长得分: 82,
      },
      成长性综合评分: 80,
    })

    const revenue = result.subModules[0]
    expect(revenue.rawFields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: '历年营收',
        type: 'array',
        items: ['10.2亿', '12.3亿', '15.1亿'],
      }),
    ]))
  })

  it('returns error payload when details contain 错误', () => {
    const result = normalizeCategoryDetails({ 错误: '技术面评分计算失败' })
    expect(result.error).toBe('技术面评分计算失败')
    expect(result.subModules).toEqual([])
  })
})

describe('classifyRawValue', () => {
  it('formats arrays and objects', () => {
    expect(classifyRawValue(['a', 'b']).type).toBe('array')
    expect(classifyRawValue({ x: 1 }).type).toBe('object')
    expect(classifyRawValue(12.345).display).toBe('12.35')
  })
})

describe('normalizeComposite', () => {
  it('prefers structured dimensions from backend', () => {
    const dims = normalizeComposite([
      { key: 'cycle', name: '动量评分', score: 80, weight: 0.25, contribution: 20 },
      { key: 'growth', name: '成长评分', score: 70, weight: 0.25, contribution: 17.5 },
    ])
    expect(dims).toHaveLength(2)
    expect(dims[0].contribution).toBe(20)
  })

  it('falls back to legacy string-key details', () => {
    const dims = normalizeComposite(null, {
      '动量评分 (权重: 25.0%)': 80,
      '成长评分 (权重: 25.0%)': 70,
      '当前策略': 'balanced',
      '综合得分(当前策略)': 75,
    })
    expect(dims).toHaveLength(2)
    expect(dims[0].weight).toBeCloseTo(0.25)
    expect(dims[0].contribution).toBe(20)
  })
})

describe('extractCompositeRawFields', () => {
  it('lists all composite detail keys', () => {
    const rows = extractCompositeRawFields({
      '动量评分 (权重: 25.0%)': 80,
      '当前策略': 'balanced',
      '综合得分(当前策略)': 75,
    })
    expect(rows).toHaveLength(3)
    expect(rows.find((r) => r.key === '当前策略')?.display).toBe('balanced')
  })
})

describe('extractCompositeTotal', () => {
  it('reads composite total from details', () => {
    expect(extractCompositeTotal({ '综合得分(当前策略)': 75.2 })).toBe(75.2)
  })
})

describe('_series and _formula parsing', () => {
  it('extracts structured series and hides duplicate raw keys', () => {
    const result = normalizeCategoryDetails({
      利润增长分析: {
        利润增长得分: 78,
        历年净利润: ['FY2022: 12.34亿'],
        _series: {
          归母净利润: {
            unit: '亿元',
            source: 'blocks_ttm',
            points: [
              { period: 'FY2022', end_date: '20221231', value: 12.34, yoy: null },
              { period: 'FY2023', end_date: '20231231', value: 15.67, yoy: 27.0 },
            ],
          },
        },
      },
      成长性综合评分: 80,
    })

    const profit = result.subModules[0]
    expect(profit.series).toHaveLength(1)
    expect(profit.series[0].points).toHaveLength(2)
    expect(profit.rawFields.find((row) => row.key === '历年净利润')).toBeUndefined()
    expect(profit.rawFields.find((row) => row.key === '_series')).toBeUndefined()
  })

  it('parses formula steps from _formula block', () => {
    const result = normalizeCategoryDetails({
      营收增长分析: {
        营收增长得分: 85,
        _formula: {
          base: 50,
          steps: [
            { rule: '最近增长', delta: 30, reason: 'YoY > 30%' },
            { rule: '稳定性', delta: 5 },
          ],
          raw_score: 85,
          clipped_score: 85,
          clipped: false,
        },
      },
      成长性综合评分: 85,
    })

    expect(result.subModules[0].formula).toMatchObject({
      base: 50,
      rawScore: 85,
    })
    expect(result.subModules[0].formula.steps).toHaveLength(2)
  })

  it('carries step weights so weighted contributions are distinguishable', () => {
    const result = normalizeCategoryDetails({
      _formula: {
        base: 0,
        steps: [
          { rule: '短期周期(5-10日)', delta: 33.2, weight: 0.4 },
          { rule: '价格位置', delta: 15 },
        ],
        raw_score: 48.2,
        clipped_score: 48.2,
        clipped: false,
      },
      周期综合评分: 48.2,
    })

    const [weighted, flat] = result.topLevelFormula.steps
    expect(result.topLevelFormula.base).toBe(0)
    expect(weighted.weight).toBe(0.4)
    expect(flat.weight).toBeNull()
    // The reserved key must not leak into the plain field list.
    expect(result.topLevelFields.find((row) => row.key === '_formula')).toBeUndefined()
  })

  it('carries the accounting note explaining renormalized weights', () => {
    const result = normalizeCategoryDetails({
      _formula: {
        base: 0,
        note: '快报口径：仅 PE/PB/PS 可用，名义权重合计 45%，已等比例放大至 100%',
        steps: [
          { rule: 'PE估值分析', delta: 50, weight: 0.666667 },
          { rule: 'PS估值分析', delta: 21.666667, weight: 0.333333 },
        ],
        raw_score: 71.666667,
        clipped_score: 71.666667,
        clipped: false,
      },
      价值评分: 71.67,
    })

    expect(result.topLevelFormula.note).toContain('等比例放大至 100%')
    const totalWeight = result.topLevelFormula.steps.reduce((sum, s) => sum + s.weight, 0)
    expect(totalWeight).toBeCloseTo(1)
  })

  it('leaves the note empty when the scorer set none', () => {
    const result = normalizeCategoryDetails({
      _formula: { base: 50, steps: [{ rule: 'A', delta: 10 }], raw_score: 60 },
      技术面评分: 60,
    })
    expect(result.topLevelFormula.note).toBe('')
  })
})

describe('submoduleWeightsFromDetails', () => {
  it('reads weights recorded by the scorer ledger', () => {
    const weights = submoduleWeightsFromDetails({
      _formula: {
        steps: [
          { rule: '短期周期(5-10日)', delta: 33.2, weight: 0.4 },
          { rule: '中期周期(20-60日)', delta: 30.8, weight: 0.35 },
          { rule: '长期周期(120-250日)', delta: 21.25, weight: 0.25 },
        ],
      },
    })
    expect(weights).toEqual({
      '短期周期(5-10日)': 0.4,
      '中期周期(20-60日)': 0.35,
      '长期周期(120-250日)': 0.25,
    })
  })

  it('returns null when no weights were recorded, so callers can fall back', () => {
    expect(submoduleWeightsFromDetails(null)).toBeNull()
    expect(submoduleWeightsFromDetails({})).toBeNull()
    expect(submoduleWeightsFromDetails({ _formula: { steps: [] } })).toBeNull()
    expect(
      submoduleWeightsFromDetails({ _formula: { steps: [{ rule: '5日趋势', delta: 10 }] } }),
    ).toBeNull()
  })
})

describe('normalizeScoreMeta', () => {
  it('merges API meta with express flags from details', () => {
    const meta = normalizeScoreMeta(
      { algorithm_version: 'v0.1', details_schema_version: 0 },
      { express_source: 'express', express_discount: 0.85 },
      '20240809',
    )
    expect(meta.score_date).toBe('20240809')
    expect(meta.express.express_discount).toBe(0.85)
  })
})

describe('extractExpressFromDetails', () => {
  it('reads express markers', () => {
    expect(extractExpressFromDetails({ 数据来源: 'express' })).toMatchObject({
      data_source: 'express',
    })
  })
})

describe('buildScoreHistoryComparison', () => {
  it('builds chronological score rows for a dimension', () => {
    const rows = buildScoreHistoryComparison([
      { score_date: '20240101', growth_score: 70 },
      { score_date: '20240201', growth_score: 75 },
    ], 'growth')
    expect(rows).toHaveLength(2)
    expect(rows[1].score).toBe(75)
  })
})
