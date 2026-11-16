/** 分时线 ECharts option：价格线 + 均价线 + 昨收虚线 + 量柱。
 *
 * 数据来自 `GET /api/intraday-line/`（241 个分钟槽位，`price/avg` 缺失为 null）。
 * 股票与 ETF 共用同一套画法，价格精度按 assetType 区分（ETF 3 位 / 股票 2 位）。
 */
import { assetTypeForSymbol, formatAssetPrice } from '../assetPriceFormat.js'
import { formatPctChange, pctChangeColor } from '../klineTooltip.js'

function compactVolume(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}亿`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`
  return `${n.toFixed(0)}`
}

function priceColors(isDark) {
  return {
    up: isDark ? '#ef5350' : '#eb4444',
    down: isDark ? '#26a69a' : '#22ab94',
  }
}

export function buildIntradayLineOption(payload, { theme = 'dark', symbol = '' } = {}) {
  const bars = Array.isArray(payload?.bars) ? payload.bars : []
  const isDark = theme === 'dark'
  const axisColor = isDark ? '#444c56' : '#d1d5da'
  const labelColor = isDark ? '#768390' : '#586069'
  const splitColor = isDark ? '#2d333b' : '#eaecef'
  const colors = priceColors(isDark)
  const asset = assetTypeForSymbol(symbol)
  const priceText = (value) => formatAssetPrice(value, asset)

  const times = Array.isArray(payload?.times) && payload.times.length
    ? payload.times
    : bars.map((bar) => bar.time)
  const preClose = Number(payload?.pre_close)
  const hasPreClose = Number.isFinite(preClose) && preClose > 0
  const prices = bars.map((bar) => (bar.price == null ? null : Number(bar.price)))
  const avgs = bars.map((bar) => (bar.avg == null ? null : Number(bar.avg)))

  // 量柱：当前分钟价 vs 上一个成交分钟价（第一根比昨收）
  const volumeData = []
  let prevPrice = hasPreClose ? preClose : null
  for (const bar of bars) {
    const price = bar.price == null ? null : Number(bar.price)
    const base = prevPrice == null ? price : prevPrice
    volumeData.push({
      value: bar.volume ?? 0,
      itemStyle: {
        color: price == null || base == null
          ? 'transparent'
          : (price >= base ? colors.up : colors.down),
      },
    })
    if (price != null) prevPrice = price
  }

  const basis = prices.filter((value) => value != null)
  if (hasPreClose) basis.push(preClose)
  const hi = basis.length ? Math.max(...basis) : 0
  const lo = basis.length ? Math.min(...basis) : 0
  const pad = (hi - lo) * 0.02 || Math.max(Math.abs(hi) * 0.002, 0.001)
  const priceMin = Number((lo - pad).toFixed(4))
  const priceMax = Number((hi + pad).toFixed(4))
  const pctSpan = hasPreClose
    ? Math.max(Math.abs(priceMax - preClose), Math.abs(preClose - priceMin)) / preClose * 100
    : 5
  const pctMax = Math.max(Number(pctSpan.toFixed(2)), 0.5)

  const timeLabel = (value) => {
    if (value === '13:01') return '13:00'
    return ['09:30', '10:30', '11:30', '14:00', '15:00'].includes(value) ? value : ''
  }

  return {
    backgroundColor: 'transparent',
    textStyle: { color: labelColor },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        if (!Array.isArray(params) || !params.length) return ''
        const idx = params[0].dataIndex
        const bar = bars[idx]
        if (!bar) return ''
        const pctText = bar.pct == null ? '' : formatPctChange(bar.pct)
        const pctHtml = pctText
          ? `　<span style="color:${pctChangeColor(bar.pct, colors)}">${pctText}</span>`
          : ''
        return `<div class="k-tip"><strong>${bar.time}</strong><br/>`
          + `价格 ${bar.price == null ? '-' : priceText(bar.price)}${pctHtml}<br/>`
          + `均价 ${bar.avg == null ? '-' : priceText(bar.avg)}<br/>`
          + `成交量 ${bar.volume == null ? '-' : compactVolume(bar.volume)}手</div>`
      },
    },
    grid: [
      { left: 56, right: 64, top: 24, height: '62%' },
      { left: 56, right: 64, top: '76%', height: '16%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: times,
        gridIndex: 0,
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { show: false },
        axisLabel: { color: labelColor, fontSize: 11, formatter: timeLabel },
      },
      {
        type: 'category',
        data: times,
        gridIndex: 1,
        boundaryGap: false,
        axisLine: { lineStyle: { color: axisColor } },
        axisTick: { show: false },
        axisLabel: { color: labelColor, fontSize: 11, formatter: timeLabel },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        min: priceMin,
        max: priceMax,
        splitLine: { lineStyle: { color: splitColor } },
        axisLabel: { color: labelColor, fontSize: 11, formatter: (v) => priceText(v) },
        axisPointer: { label: { formatter: (p) => priceText(p?.value) } },
      },
      {
        type: 'value',
        gridIndex: 0,
        position: 'right',
        min: -pctMax,
        max: pctMax,
        splitLine: { show: false },
        axisLabel: {
          color: labelColor,
          fontSize: 11,
          formatter: (v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`,
        },
      },
      {
        type: 'value',
        gridIndex: 1,
        scale: true,
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '价格',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: prices,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1.4, color: isDark ? '#7ab0ff' : '#0466c8' },
        emphasis: { focus: 'series' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: {
            position: 'insideEndTop',
            fontSize: 10,
            color: labelColor,
            formatter: hasPreClose ? `昨收 ${priceText(preClose)}` : '',
          },
          lineStyle: { color: labelColor, type: 'dashed', width: 1 },
          data: hasPreClose ? [{ yAxis: preClose }] : [],
        },
      },
      {
        name: '均价',
        type: 'line',
        xAxisIndex: 0,
        yAxisIndex: 0,
        data: avgs,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 1, color: '#f5c542' },
        emphasis: { focus: 'series' },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 2,
        data: volumeData,
        barMaxWidth: 4,
      },
    ],
  }
}
