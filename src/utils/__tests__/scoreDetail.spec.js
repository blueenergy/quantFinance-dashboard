import { describe, expect, it } from 'vitest'
import {
  extractCompositeTotal,
  normalizeCategoryDetails,
  normalizeComposite,
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
  })

  it('returns error payload when details contain 错误', () => {
    const result = normalizeCategoryDetails({ 错误: '技术面评分计算失败' })
    expect(result.error).toBe('技术面评分计算失败')
    expect(result.subModules).toEqual([])
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

describe('extractCompositeTotal', () => {
  it('reads composite total from details', () => {
    expect(extractCompositeTotal({ '综合得分(当前策略)': 75.2 })).toBe(75.2)
  })
})
