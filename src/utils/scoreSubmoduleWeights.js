/**
 * Submodule weights for score detail UI (mirrors quantFinance SUBMODULE_WEIGHTS).
 *
 * Scorers report their applied weights in `_formula.steps`, so
 * `submoduleWeightsFromDetails` is preferred. This table is the fallback for
 * documents scored before the ledger landed, which are not backfilled
 * automatically and so persist indefinitely.
 */
export const SUBMODULE_WEIGHTS = {
  cycle: {
    '短期周期(5-10日)': 0.4,
    '中期周期(20-60日)': 0.35,
    '长期周期(120-250日)': 0.25,
  },
  growth: {
    营收增长分析: 0.3,
    利润增长分析: 0.3,
    ROE变化分析: 0.2,
    市场竞争力: 0.1,
    创新能力: 0.1,
  },
  fundamental: {
    财务健康度: 0.4,
    盈利能力: 0.25,
    估值水平: 0.2,
    市值规模: 0.1,
    行业地位: 0.05,
  },
  value: {
    PE估值分析: 0.3,
    PB估值分析: 0.25,
    PS估值分析: 0.15,
    股息率分析: 0.15,
    PEG分析: 0.1,
    相对估值: 0.05,
  },
  technical: {
    均线系统: 0.3,
    量价配合: 0.25,
    技术指标: 0.25,
    趋势强度: 0.2,
  },
  money_flow: {
    主力资金流向: 0.4,
    资金流强度: 0.3,
    成交活跃度: 0.2,
    机构关注度: 0.1,
  },
}
