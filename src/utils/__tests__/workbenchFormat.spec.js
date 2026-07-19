import { describe, expect, it } from 'vitest'
import {
  blankDash,
  calcYoy,
  canonicalSymbol,
  ddmGrowthSourceLabel,
  diffOrNull,
  firstFinite,
  fmtAmount,
  fmtKlineAmount,
  fmtNumber,
  fmtNullableNumber,
  fmtNullablePct,
  fmtPct,
  fmtPctFromRatio,
  fmtPctPlain,
  fmtShares,
  fmtSignedShares,
  fmtStatementAmount,
  fmtWanAmount,
  formatCheck,
  formatDetail,
  holderTrendClass,
  inDeLabel,
  isFutureDate,
  nineturnSignalClass,
  ratioPct,
  reportQuarter,
  reportRcTargetRange,
  reportYear,
  scorePercent,
  scoreRowComposite,
  statementPeriod,
  statementReportTypeLabel,
  sumFinite,
  toNumber,
  top10ChangeLabel,
  top10RatioChangeText,
  valuationRelativeLabel,
  valuationScenarioLabel,
  valueClass,
} from '../workbenchFormat.js'

describe('workbenchFormat', () => {
  it('formats numbers and percents with empty fallbacks', () => {
    expect(fmtNumber(null)).toBe('-')
    expect(fmtNumber(12.345, 1)).toBe('12.3')
    expect(fmtNumber(1.2, 2, '%')).toBe('1.20%')
    expect(fmtPct(1.25)).toBe('+1.25%')
    expect(fmtPct(-2)).toBe('-2.00%')
    expect(fmtPct('x')).toBe('-')
    expect(fmtPctPlain(12.34)).toBe('12.3%')
    expect(fmtPctFromRatio(0.1234)).toBe('12.34%')
    expect(fmtNullableNumber(undefined)).toBe('-')
    expect(fmtNullableNumber(1.234, 1)).toBe('1.2')
    expect(fmtNullablePct(undefined)).toBe('-')
    expect(fmtNullablePct(3.2)).toBe('3.20%')
    expect(blankDash('  ')).toBe('-')
    expect(blankDash('foo')).toBe('foo')
  })

  it('parses numeric helpers used by financial/yoy math', () => {
    expect(toNumber(undefined)).toBe(null)
    expect(toNumber('x')).toBe(null)
    expect(toNumber('')).toBe(0) // Number('') === 0; keep existing Workbench behavior
    expect(toNumber(null)).toBe(0) // Number(null) === 0
    expect(toNumber('12.5')).toBe(12.5)
    expect(firstFinite([undefined, 'x', 3])).toBe(3)
    expect(diffOrNull(5, 2)).toBe(3)
    expect(diffOrNull(5, undefined)).toBe(null)
    expect(ratioPct(1, 4)).toBe(25)
    expect(ratioPct(1, 0)).toBe(null)
    expect(sumFinite(1, undefined, 2)).toBe(3)
    expect(sumFinite('x', undefined)).toBe(null)
    expect(reportYear('20240630')).toBe(2024)
    expect(statementPeriod({ end_date: '20240630' })).toBe('20240630')
    expect(statementReportTypeLabel('1')).toContain('合并报表')
    expect(statementReportTypeLabel('')).toBe('未标注口径')
  })

  it('scales amounts and shares by magnitude', () => {
    expect(fmtAmount(5000)).toBe('5000.00万')
    expect(fmtAmount(25000)).toBe('2.50亿')
    expect(fmtWanAmount(8000)).toBe('8000.00万')
    expect(fmtWanAmount(12000)).toBe('1.20亿')
    expect(fmtStatementAmount(500)).toBe('500.00元')
    expect(fmtStatementAmount(50000)).toBe('5.00万')
    expect(fmtStatementAmount(2e8)).toBe('2.00亿')
    expect(fmtShares(500)).toBe('500股')
    expect(fmtShares(25000)).toBe('2.50万股')
    expect(fmtSignedShares(-25000)).toBe('-2.50万股')
    expect(fmtKlineAmount({ amount: 1e8, amount_unit: 'yuan' })).toBe('1.00亿')
    expect(fmtKlineAmount({ amount: 1e5 })).toBe('1.00亿')
  })

  it('handles score helpers and report metadata', () => {
    expect(scorePercent(150)).toBe(100)
    expect(scorePercent(-5)).toBe(0)
    expect(scoreRowComposite({ composite_score: { balanced: 81, aggressive: 90 } })).toBe(81)
    expect(scoreRowComposite({ composite_score: 77 })).toBe(77)
    expect(reportQuarter('20240630')).toBe(2)
    expect(reportQuarter('bad')).toBe(null)
    expect(calcYoy(120, 100)).toBe(20)
    expect(calcYoy(120, 0)).toBe(null)
    expect(reportRcTargetRange({ min_price: 10, max_price: 12 })).toBe('目标价 10.00-12.00元')
    expect(canonicalSymbol(' 600519.sh ')).toBe('600519')
    expect(formatDetail({})).toBe('暂无详情')
    expect(formatDetail({ a: 1 })).toContain('"a": 1')
  })

  it('maps valuation/shareholder labels and trend classes', () => {
    expect(ddmGrowthSourceLabel('fallback_config_ddm_growth', 'base')).toBe('配置回退')
    expect(ddmGrowthSourceLabel('', 'conservative')).toContain('保守档')
    expect(valuationScenarioLabel('base')).toBe('中性')
    expect(valuationRelativeLabel('below_own_history')).toBe('低于自身历史')
    expect(formatCheck(true)).toBe('通过')
    expect(formatCheck(false)).toBe('未通过')
    expect(formatCheck(null)).toBe('不适用')
    expect(nineturnSignalClass({ direction: 'up' })).toBe('is-up')
    expect(inDeLabel('IN')).toBe('增持')
    expect(top10ChangeLabel('increased')).toBe('增持')
    expect(top10ChangeLabel('unknown')).toBe('变化未知')
    expect(top10RatioChangeText({ hold_ratio_chg: 0.5, hold_ratio_rel_chg_pct: 2 })).toBe(
      '占比 +0.50pct（相对 +2.0%）',
    )
    expect(valueClass(1)).toBe('is-up')
    expect(valueClass(-1)).toBe('is-down')
    expect(holderTrendClass(-3)).toBe('is-up')
    expect(holderTrendClass(3)).toBe('is-down')
    expect(isFutureDate('20990101')).toBe(true)
    expect(isFutureDate('20000101')).toBe(false)
  })
})
