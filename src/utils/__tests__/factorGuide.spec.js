import { describe, expect, it } from 'vitest'
import {
  FACTOR_A_SHARE_NOTES,
  FACTOR_COVERAGE_NOTE,
  FACTOR_DIRECTION_NOTE,
  FACTOR_METRIC_GUIDE,
  FACTOR_STATUSES,
  FACTOR_STATUS_GUIDE,
  FACTOR_TEST_TYPE_GUIDE,
  parseInlineMarkup,
} from '../../constants/factorGuide'

describe('factor guide', () => {
  it('explains every status the filter offers', () => {
    const explained = FACTOR_STATUS_GUIDE.map((item) => item.key)
    expect(explained.slice().sort()).toEqual(FACTOR_STATUSES.slice().sort())
  })

  it('gives every status and metric a non-empty explanation', () => {
    for (const item of [...FACTOR_STATUS_GUIDE, ...FACTOR_TEST_TYPE_GUIDE, ...FACTOR_METRIC_GUIDE]) {
      expect(item.desc.trim().length).toBeGreaterThan(0)
    }
    expect(FACTOR_COVERAGE_NOTE.trim().length).toBeGreaterThan(0)
    expect(FACTOR_DIRECTION_NOTE.trim().length).toBeGreaterThan(0)
    expect(FACTOR_A_SHARE_NOTES.length).toBeGreaterThan(0)
    for (const note of FACTOR_A_SHARE_NOTES) expect(note.trim().length).toBeGreaterThan(0)
  })

  it('keeps the guide keys unique', () => {
    for (const list of [FACTOR_STATUS_GUIDE, FACTOR_TEST_TYPE_GUIDE, FACTOR_METRIC_GUIDE]) {
      const keys = list.map((item) => item.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })
})

describe('parseInlineMarkup', () => {
  it('splits bold and code segments out of plain text', () => {
    expect(parseInlineMarkup('实测是**低换手更好**，见 `turnover_20d`。')).toEqual([
      { text: '实测是', strong: false, code: false },
      { text: '低换手更好', strong: true, code: false },
      { text: '，见 ', strong: false, code: false },
      { text: 'turnover_20d', strong: false, code: true },
      { text: '。', strong: false, code: false },
    ])
  })

  it('returns a single plain segment when there is no markup', () => {
    expect(parseInlineMarkup('没有标记的句子')).toEqual([
      { text: '没有标记的句子', strong: false, code: false },
    ])
  })

  it('never emits markup for an empty or missing body', () => {
    expect(parseInlineMarkup('')).toEqual([])
    expect(parseInlineMarkup(undefined)).toEqual([])
  })

  it('leaves unmatched markers as literal text', () => {
    const segments = parseInlineMarkup('一个 ** 单独的星号')
    expect(segments.map((item) => item.text).join('')).toBe('一个 ** 单独的星号')
    expect(segments.every((item) => !item.strong)).toBe(true)
  })
})
