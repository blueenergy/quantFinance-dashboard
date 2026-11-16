/**
 * ETF K-line tooltip — shared by the ETF淘金 detail chart.
 *
 * ECharts' candlestick series is built on `WhiskerBoxCommonMixin`, which calls
 * `item.unshift(index)` on the raw data item. `params.data` is therefore
 * `[index, open, close, low, high]`, NOT the `[open, close, low, high]` we
 * passed. Reading `params.data[0..3]` shifts 开/收/低/高 by one (开 = bar index,
 * 收 = open, 低 = close, 高 = low). Always read the source row by `dataIndex`.
 */
import { formatAssetPrice } from './assetPriceFormat.js'
import { barChangePctForSeries, formatPctChange, pctChangeColor } from './klineTooltip.js'

function finiteOrNull(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** 涨跌幅：优先用后端算好的 pct_chg，缺失时退回上一根 bar 收盘。 */
export function etfRowPct(row, index, rows) {
  const serverPct = finiteOrNull(row?.pct_chg)
  if (serverPct != null) return serverPct
  return barChangePctForSeries(row, index, rows)
}

function priceText(value) {
  return formatAssetPrice(value, 'etf')
}

function formatHands(raw) {
  const n = finiteOrNull(raw)
  if (n == null) return '-'
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿手`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万手`
  return `${n.toFixed(0)}手`
}

/** amount 是千元（tushare 口径），统一换成元再压缩。 */
function formatTurnover(rawQianYuan) {
  const n = finiteOrNull(rawQianYuan)
  if (n == null) return '-'
  const yuan = n * 1000
  if (Math.abs(yuan) >= 1e8) return `${(yuan / 1e8).toFixed(2)}亿`
  if (Math.abs(yuan) >= 1e4) return `${(yuan / 1e4).toFixed(2)}万`
  return `${yuan.toFixed(0)}元`
}

function formatShares(raw) {
  const n = finiteOrNull(raw)
  return n == null ? '-' : `${n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}万份`
}

export function formatEtfKlineTooltip(rows, index) {
  const list = Array.isArray(rows) ? rows : []
  const row = Number.isInteger(index) ? list[index] : null
  if (!row) return ''
  const pct = etfRowPct(row, index, list)
  const pctText = formatPctChange(pct)
  const pctHtml = pctText
    ? `　<span style="color:${pctChangeColor(pct)}">${pctText}</span>`
    : ''
  const lines = [
    `<strong>${row.trade_date ?? ''}</strong>`,
    `开 ${priceText(row.open)}　收 ${priceText(row.close)}${pctHtml}<br/>`
      + `低 ${priceText(row.low)}　高 ${priceText(row.high)}`,
    `量 ${formatHands(row.vol ?? row.volume)}　额 ${formatTurnover(row.amount)}`,
  ]
  if (row.fd_share != null) lines.push(`份额 ${formatShares(row.fd_share)}`)
  return lines.join('<br/>')
}
