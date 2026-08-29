/** Self-contained combo-detail HTML export (payload schema matches analysis.sweep.combo_export). */

import { money, num, pct } from './portfolioResearchView'
import { formatIndexRegimeLabel } from './regimeCash'

export const COMBO_EXPORT_SCHEMA = 'portfolio_research_combo_export'
export const COMBO_EXPORT_SCHEMA_VERSION = 1
export const COMBO_EXPORT_SCRIPT_ID = 'combo-export-payload'

export const COMBO_EXPORT_PARAM_KEYS = [
  'universe_index',
  'start_date',
  'end_date',
  'growth_cycle_weights',
  'top_n_values',
  'rebalance_interval_days',
  'trailing_stop_pcts',
  'regime_modes',
  'regime_rule',
  'selection_mode',
]

export const COMBO_EXPORT_WATERMARK_KEYS = [
  'requested_start_date',
  'requested_end_date',
  'backtest_score_min_date',
  'backtest_score_max_date',
  'stock_scores_max_date',
  'dataset_rows',
  'dataset_symbol_count',
  'universe_pit_quality',
]

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function pickParams(params) {
  const raw = asObject(params)
  const picked = {}
  for (const key of COMBO_EXPORT_PARAM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(raw, key)) picked[key] = raw[key]
  }
  return picked
}

export function buildComboExportPayload(detail = {}, identity = {}) {
  const body = asObject(detail)
  const identIn = asObject(identity)
  const meta = asObject(body.meta)
  const comboKey = identIn.combo_key || meta.combo_key || ''
  return {
    schema: COMBO_EXPORT_SCHEMA,
    schema_version: COMBO_EXPORT_SCHEMA_VERSION,
    identity: {
      combo_key: comboKey,
      job_id: identIn.job_id || '',
      result_id: identIn.result_id || '',
      params: pickParams(identIn.params),
      data_watermark: asObject(identIn.data_watermark),
    },
    meta,
    summary: asObject(body.summary),
    periods: Array.isArray(body.periods) ? body.periods : [],
    trades: Array.isArray(body.trades) ? body.trades : [],
  }
}

export function comboExportFilename(payload = {}) {
  const ident = asObject(payload.identity)
  const meta = asObject(payload.meta)
  const combo = safeFilenamePart(ident.combo_key || meta.combo_key, 'combo')
  const result = safeFilenamePart(String(ident.result_id || '').slice(0, 8), 'export')
  return `portfolio-combo_${combo}_${result}.html`
}

function safeFilenamePart(value, fallback = 'combo') {
  const text = String(value || '').replace(/[^0-9A-Za-z._-]+/g, '-').replace(/^-+|-+$/g, '')
  return (text.slice(0, 80) || fallback)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function jsonForScript(payload) {
  return JSON.stringify(payload).replace(/</g, '\\u003c')
}

function signedClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number > 0 ? 'pos' : 'neg'
}

function tradeStatus(trade) {
  return trade?.is_unrealized ? '未平仓' : '已平仓'
}

function dash(value) {
  if (value == null || value === '') return '-'
  return String(value)
}

function kvRows(rows) {
  return rows
    .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${value}</td></tr>`)
    .join('')
}

function th(label, tableId, col) {
  return `<th onclick="sortTable('${tableId}',${col})">${escapeHtml(label)}</th>`
}

function td(html, { cls = '', sort = '' } = {}) {
  const attrs = []
  if (cls) attrs.push(`class="${cls}"`)
  if (sort !== '' && sort != null) attrs.push(`data-sort="${escapeHtml(String(sort))}"`)
  const attr = attrs.length ? ` ${attrs.join(' ')}` : ''
  return `<td${attr}>${html}</td>`
}

function summaryCards(summary) {
  const cards = [
    ['累计收益(净)', pct(summary.cumulative_return)],
    ['年化收益', pct(summary.annualized_return)],
    ['Sharpe', num(summary.sharpe, 2)],
    ['最大回撤', pct(summary.max_drawdown)],
    ['超额(对指数)', pct(summary.index_excess_cumulative_return)],
    ['平均换手', pct(summary.average_turnover)],
    ['平均暴露', pct(summary.average_exposure)],
    ['调仓期数', num(summary.periods, 0)],
  ]
  return `<div class="summary-card">${cards.map(([label, value]) => (
    `<div><span class="label">${escapeHtml(label)}</span><div class="big">${escapeHtml(value)}</div></div>`
  )).join('')}</div>`
}

function yearlyTable(summary) {
  const yearly = asObject(summary.yearly_returns)
  const excess = asObject(summary.yearly_index_excess)
  const years = [...new Set([...Object.keys(yearly), ...Object.keys(excess)])].sort()
  if (!years.length) return ''
  const rows = years.map((year) => {
    const ret = yearly[year]
    const xs = excess[year]
    return `<tr>${td(escapeHtml(year), { sort: year })}${td(pct(ret), { cls: signedClass(ret), sort: ret })}${td(pct(xs), { cls: signedClass(xs), sort: xs })}</tr>`
  }).join('')
  return `<h2>分年收益</h2><div class="table-wrap"><table id="yearly"><thead><tr>${th('年份', 'yearly', 0)}${th('组合收益', 'yearly', 1)}${th('指数超额', 'yearly', 2)}</tr></thead><tbody>${rows}</tbody></table></div>`
}

function periodsTable(periods) {
  if (!periods.length) return '<h2>调仓期</h2><p class="meta">无期频记录。</p>'
  const headers = ['调仓日', '指数', '净收益', '暴露', '选股数', '换手']
  const head = headers.map((label, idx) => th(label, 'periods', idx)).join('')
  const rows = periods.map((row) => {
    const net = row.portfolio_return_net
    return `<tr>${
      td(escapeHtml(dash(row.score_date)), { sort: row.score_date })
    }${td(escapeHtml(formatIndexRegimeLabel(row.regime_label)))}${
      td(pct(net), { cls: signedClass(net), sort: net })
    }${td(pct(row.portfolio_exposure), { sort: row.portfolio_exposure })}${
      td(num(row.selected_count, 0), { sort: row.selected_count })
    }${td(pct(row.turnover), { sort: row.turnover })}</tr>`
  }).join('')
  return `<h2>调仓期（${periods.length}）</h2><div class="table-wrap"><table id="periods"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
}

function tradesTable(trades) {
  if (!trades.length) return '<h2>模拟成交明细</h2><p class="meta">无成交记录。</p>'
  const headers = [
    '状态', '调仓日', '指数', '代码', '名称', '分值', '买入日', '买价',
    '卖出日', '卖价', '数量', '买入额', '持有收益', '净盈亏', '费用', '顺延日',
  ]
  const head = headers.map((label, idx) => th(label, 'trades', idx)).join('')
  const rows = trades.map((trade) => {
    const holding = trade.holding_return
    const pnl = trade.net_pnl
    const sellDate = trade.is_unrealized ? '持有中' : (trade.sell_date || '')
    const sellPrice = trade.is_unrealized ? trade.mark_price : trade.sell_price
    return `<tr>${
      td(escapeHtml(tradeStatus(trade)))
    }${td(escapeHtml(dash(trade.score_date)), { sort: trade.score_date })}${
      td(escapeHtml(formatIndexRegimeLabel(trade.regime_label)))
    }${td(escapeHtml(dash(trade.symbol)))}${td(escapeHtml(trade.name || ''))}${
      td(num(trade.score_value, 1), { sort: trade.score_value })
    }${td(escapeHtml(dash(trade.buy_date)))}${
      td(num(trade.buy_price), { sort: trade.buy_price })
    }${td(escapeHtml(dash(sellDate)))}${
      td(num(sellPrice), { sort: sellPrice })
    }${td(escapeHtml(money(trade.quantity)), { sort: trade.quantity })}${
      td(escapeHtml(money(trade.buy_amount)), { sort: trade.buy_amount })
    }${td(pct(holding), { cls: signedClass(holding), sort: holding })}${
      td(escapeHtml(money(pnl)), { cls: signedClass(pnl), sort: pnl })
    }${td(escapeHtml(money(trade.estimated_transaction_cost)), { sort: trade.estimated_transaction_cost })}${
      td(num(trade.sell_delayed_days, 0), { sort: trade.sell_delayed_days })
    }</tr>`
  }).join('')
  return `<h2>模拟成交明细（${trades.length} 笔）</h2><div class="table-wrap"><table id="trades"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`
}

const EXPORT_CSS = `
body { margin: 0; padding: 32px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #172033; background: #f6f8fb; line-height: 1.55; }
main { max-width: 1440px; margin: 0 auto; padding: 32px; background: #fff; border: 1px solid #e6eaf0; border-radius: 14px; }
.hero { border-bottom: 1px solid #edf0f5; margin-bottom: 22px; padding-bottom: 18px; }
.eyebrow { margin: 0 0 4px; color: #64748b; font-size: 13px; letter-spacing: .04em; text-transform: uppercase; }
h1 { margin: 0; font-size: 26px; }
h2 { margin: 34px 0 14px; font-size: 21px; }
.subtitle { margin: 8px 0 0; color: #64748b; }
.meta { color: #64748b; font-size: 13px; margin: 4px 0; }
.summary-card { border: 1px solid #e6eaf0; border-radius: 12px; padding: 18px; background: #fbfcfe; margin: 18px 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.label { color: #475569; font-weight: 700; }
.big { font-size: 20px; font-weight: 800; margin: 4px 0; }
.table-wrap { overflow-x: auto; border: 1px solid #e6eaf0; border-radius: 10px; margin-bottom: 18px; max-height: 840px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 12px; border-bottom: 1px solid #edf0f5; text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
th { background: #f8fafc; color: #475569; font-weight: 700; position: sticky; top: 0; cursor: pointer; user-select: none; }
tbody tr:nth-child(even) td { background: #fbfcfe; }
td.pos { color: #067a4e; font-weight: 600; }
td.neg { color: #c0392b; font-weight: 600; }
code { padding: 2px 6px; border-radius: 5px; background: #eef2f7; color: #0f3f75; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .92em; }
.hint { color: #64748b; font-size: 13px; }
`

const SORT_JS = `
function sortTable(id,col){
 var t=document.getElementById(id),tb=t.tBodies[0],rows=Array.prototype.slice.call(tb.rows);
 var asc=t.getAttribute('data-sortcol')==col?!(t.getAttribute('data-asc')=='1'):true;
 rows.sort(function(a,b){
  var x=parseFloat(a.cells[col].getAttribute('data-sort')),y=parseFloat(b.cells[col].getAttribute('data-sort'));
  if(isNaN(x)&&isNaN(y)){x=a.cells[col].innerText;y=b.cells[col].innerText;return asc?(x<y?-1:x>y?1:0):(x>y?-1:x<y?1:0);}
  return asc?x-y:y-x;});
 rows.forEach(function(r){tb.appendChild(r);});
 t.setAttribute('data-sortcol',col);t.setAttribute('data-asc',asc?'1':'0');
}
`

export function renderComboExportHtml(payload = {}) {
  const ident = asObject(payload.identity)
  const meta = asObject(payload.meta)
  const summary = asObject(payload.summary)
  const watermark = asObject(ident.data_watermark)
  const params = asObject(ident.params)
  const comboKey = ident.combo_key || meta.combo_key || ''
  const title = `组合成交明细 ${comboKey}`.trim()
  const identityRows = [
    ['combo_key', `<code>${escapeHtml(comboKey)}</code>`],
    ['job_id', escapeHtml(dash(ident.job_id))],
    ['result_id', escapeHtml(dash(ident.result_id))],
    ['construction_mode', escapeHtml(dash(meta.construction_mode))],
    ['top_n', escapeHtml(dash(meta.top_n))],
    ['horizon', escapeHtml(dash(meta.horizon))],
    ['trailing_stop_pct', escapeHtml(dash(meta.trailing_stop_pct))],
    ['regime_mode', escapeHtml(dash(meta.regime_mode))],
    ['universe_index', escapeHtml(dash(params.universe_index))],
    ['start_date', escapeHtml(dash(params.start_date))],
    ['end_date', escapeHtml(dash(params.end_date))],
  ]
  const watermarkRows = COMBO_EXPORT_WATERMARK_KEYS
    .filter((key) => Object.prototype.hasOwnProperty.call(watermark, key))
    .map((key) => [key, escapeHtml(String(watermark[key]))])
  const watermarkBlock = watermarkRows.length
    ? `<div class="table-wrap"><table id="watermark"><thead><tr>${th('项', 'watermark', 0)}${th('值', 'watermark', 1)}</tr></thead><tbody>${kvRows(watermarkRows)}</tbody></table></div>`
    : '<p class="meta">导出时没有 watermark（裸 combo JSON）。</p>'

  const body = `
<header class="hero">
  <p class="eyebrow">Portfolio Research</p>
  <h1>${escapeHtml(title)}</h1>
  <p class="subtitle">自包含成交明细，可离线打开。交叉比较请用 <code>python -m analysis.sweep.compare_combo_details</code>。</p>
</header>
<h2>身份</h2>
<div class="table-wrap"><table id="identity"><thead><tr>${th('项', 'identity', 0)}${th('值', 'identity', 1)}</tr></thead><tbody>${kvRows(identityRows)}</tbody></table></div>
<h2>data_watermark</h2>
${watermarkBlock}
<h2>摘要</h2>
${summaryCards(summary)}
${yearlyTable(summary)}
${periodsTable(Array.isArray(payload.periods) ? payload.periods : [])}
${tradesTable(Array.isArray(payload.trades) ? payload.trades : [])}
<p class="hint">成交价口径：后复权 next_open；等权建仓、整手取整、含费用。未平仓行是窗口末日 mark-to-market，不计入上方摘要累计收益。</p>
<script type="application/json" id="${COMBO_EXPORT_SCRIPT_ID}">${jsonForScript(payload)}</script>
`
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${EXPORT_CSS}</style>
</head>
<body>
  <main>${body}</main>
  <script>${SORT_JS}</script>
</body>
</html>`
}

export function extractComboExportPayloadFromHtml(html) {
  const match = String(html || '').match(
    new RegExp(`<script[^>]*\\bid=["']${COMBO_EXPORT_SCRIPT_ID}["'][^>]*>([\\s\\S]*?)</script>`, 'i'),
  )
  if (!match) throw new Error(`HTML is missing script#${COMBO_EXPORT_SCRIPT_ID}`)
  return JSON.parse(match[1])
}

export function downloadComboExportHtml(payload) {
  const html = renderComboExportHtml(payload)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = comboExportFilename(payload)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
