/**
 * 因子注册表的判读词表。
 *
 * 页面上出现的 status、检验类型和指标都是内部术语，新用户看不懂就等于
 * 没有信息。这里的文案只解释「这个词是什么意思」，不含任何绩效结论。
 */

export const FACTOR_STATUSES = [
  'candidate', 'confirmed', 'in_use', 'inconclusive',
  'screened', 'no_increment', 'rejected', 'untested',
]

export const FACTOR_STATUS_GUIDE = [
  { key: 'candidate', desc: '算过了，既没被证伪也没被确认，等更多证据。' },
  { key: 'confirmed', desc: '检验通过，但还没接进生产。' },
  { key: 'in_use', desc: '已经被模型或策略实际使用。' },
  { key: 'inconclusive', desc: '样本量或统计功效不够，下不了结论——不等于无效。' },
  { key: 'screened', desc: '跑过批量筛查，还没有更细的判决。' },
  { key: 'no_increment', desc: '单独看可能有效，但对现有评分没有额外贡献。' },
  { key: 'rejected', desc: '检验明确不通过。' },
  { key: 'untested', desc: '登记了，但还没跑过任何检验。' },
]

export const FACTOR_TEST_TYPE_GUIDE = [
  {
    key: 'ic_screen',
    label: 'IC 初筛（重叠）',
    desc: '因子值与下期收益的秩相关。快，但重叠窗口会高估显著性，只用来粗筛。',
  },
  {
    key: 'nonoverlap',
    label: '非重叠 t（判决）',
    desc: '把重叠窗口切成互不重叠的持有期再算 t 值。这是最终判决口径。',
  },
  {
    key: 'quantile',
    label: '分位单调性',
    desc: '按因子值分组，看收益是否随组号单调。单调比单个 IC 更可信。',
  },
  {
    key: 'long_only',
    label: 'Long-only 成本',
    desc: '只看多头组合、扣掉成本后的年化收益。最接近实盘，也最严格。',
  },
  {
    key: 'delta_ic',
    label: '增量 ΔIC',
    desc: '把因子加进现有评分后 IC 提升了多少。判断「有没有用」看增量，不看绝对 IC。',
  },
]

export const FACTOR_METRIC_GUIDE = [
  { key: 'IC', desc: '因子值与下期收益的秩相关系数。|IC| > 0.03 通常算有信号。' },
  { key: 'ICIR', desc: 'IC 均值 / IC 标准差，衡量信号稳不稳。> 0.5 可接受，> 1.0 优秀。' },
  { key: 't', desc: '统计显著性。|t| < 2 与 0 没法区分。' },
  {
    key: 'MDE₈₀',
    desc: '最小可检测效应 = 2.80 × 标准误（80% 功效）。MDE 比你想测的效应还大时，'
      + '「不显著」只说明样本不够，不是因子无效。',
  },
  { key: 'ΔIC', desc: '增量检验的 IC 提升量。检验「加进去有没有用」用这个。' },
]

export const FACTOR_COVERAGE_NOTE =
  '覆盖率是因子面板 (date, symbol) 行的非空比例，不是可交易池的占比——停牌、'
  + '未上市、财报未披露都会算成缺失。'

export const FACTOR_A_SHARE_NOTES = [
  '涨跌停：涨停买不进、跌停卖不出，回测里当成能成交会高估收益。',
  'T+1：当天买入当天不能卖，持仓周期至少一天。',
  '停牌：期间价格不变但无法交易，涨跌幅类因子会被稀释。',
  '财报点时：财务因子只能用公告日之前已披露的版本，否则就是未来函数。',
]

/**
 * Split a primer body into inline segments for `**bold**` and `` `code` ``.
 *
 * The primer text is written in the code repo, so it is trusted, but it is
 * still rendered as text nodes rather than with v-html — a reader must never
 * be able to turn a note into markup.
 *
 * @returns {Array<{text: string, strong: boolean, code: boolean}>}
 */
export function parseInlineMarkup(text) {
  const source = String(text ?? '')
  const segments = []
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let cursor = 0
  let match
  while ((match = pattern.exec(source)) !== null) {
    if (match.index > cursor) {
      segments.push({ text: source.slice(cursor, match.index), strong: false, code: false })
    }
    if (match[1] !== undefined) {
      segments.push({ text: match[1], strong: true, code: false })
    } else {
      segments.push({ text: match[2], strong: false, code: true })
    }
    cursor = match.index + match[0].length
  }
  if (cursor < source.length) {
    segments.push({ text: source.slice(cursor), strong: false, code: false })
  }
  return segments
}
