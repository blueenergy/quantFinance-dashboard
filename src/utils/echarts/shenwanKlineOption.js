/**
 * 申万行业指数 K 线 ECharts option（K + 可选涨跌幅% + 量/额 副图）。
 * 与 ETF 前复权三格图数据字段不同，故单独成模块；后续可在更底层抽象复用「多 grid 同步缩放」模式。
 *
 * @param {Array<Record<string, *>>} data  sw_daily 行（时间升序）
 * @param {object} formatters  来自视图层的展示函数
 * @param {object} [_meta]  预留，如 { tf: '1d' } 供日后同步标题
 */
export function buildShenwanKlineOption (data, formatters, _meta = {}) {
  const {
    fmtAxis,
    formatNum2,
    toNumOrNull,
    formatVolShow,
    formatAmountQianYuan,
    formatMvWan,
    markers = []
  } = formatters

  const times = data.map((r) => fmtAxis(r.trade_date))
  const ohlc = data.map((r) => {
    const o = finiteOrFallback(r.open, 0)
    const cl = finiteOrFallback(r.close, 0)
    const l = finiteOrFallback(r.low, Math.min(o, cl))
    const h = finiteOrFallback(r.high, Math.max(o, cl))
    return [o, cl, l, h]
  })
  const pcts = data.map((r) => {
    const p = toNumOrNull(r.pct_change)
    return p == null || !Number.isFinite(p) ? null : p
  })
  const hasPct = pcts.some((p) => p != null)
  const vols = data.map((r) => toNumOrNull(r.vol))
  const hasVol = vols.some((v) => v != null)
  const amounts = data.map((r) => toNumOrNull(r.amount))
  const hasAmt = amounts.some((a) => a != null)
  const volData = hasVol
    ? vols.map((v, i) => {
        const d = data[i]
        return {
          value: v == null || !Number.isFinite(v) ? 0 : v,
          itemStyle: { color: barUpDnColor(d.open, d.close) }
        }
      })
    : []
  const amountData = hasAmt
    ? amounts.map((v) => (v == null || !Number.isFinite(v) ? 0 : v))
    : []

  const hasSub = hasVol || hasAmt
  const subBoth = hasVol && hasAmt

  const gxy = buildGridsXAxesYAxes({ times, hasPct, hasVol, hasAmt, hasSub, subBoth })
  const yVol = hasSub && hasVol ? (hasPct ? 2 : 1) : 0
  const yAmt = hasSub && hasAmt
    ? (subBoth ? (hasPct ? 3 : 2) : (hasPct ? 2 : 1))
    : 0
  const xVol = hasSub ? 1 : 0
  const xAmt = hasSub && subBoth ? 2 : (hasSub && hasAmt ? 1 : 0)

  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#ccc' },
    axisPointer: { link: [{ xAxisIndex: 'all' }], type: 'cross' },
    grid: gxy.grid,
    xAxis: gxy.xAxis,
    yAxis: gxy.yAxis,
    dataZoom: hasSub
      ? [
          { type: 'inside', xAxisIndex: gxy.xZoomIdx },
          { type: 'slider', xAxisIndex: gxy.xZoomIdx, height: 20, bottom: 4, borderColor: '#444' }
        ]
      : [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 6 }],
    series: buildSeries({
      ohlc,
      pcts,
      hasPct,
      hasSub,
      hasVol,
      hasAmt,
      volData,
      amountData,
      xVol,
      xAmt,
      yVol,
      yAmt,
      markers,
      fmtAxis
    }),
    tooltip: buildShenwanTooltip(data, { fmtAxis, formatNum2, toNumOrNull, formatVolShow, formatAmountQianYuan, formatMvWan })
  }
}

function barUpDnColor (o, c) {
  const open = Number(o) || 0
  const close = Number(c) || 0
  return close >= open ? '#b71c1c' : '#1b5e20'
}

function finiteOrFallback (value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function xAxis0 (times) {
  return {
    type: 'category',
    data: times,
    scale: true,
    gridIndex: 0,
    axisLine: { lineStyle: { color: '#666' } }
  }
}

function xAxisH (times, gi) {
  return {
    type: 'category',
    data: times,
    gridIndex: gi,
    scale: true,
    axisLine: { show: false },
    axisLabel: { show: false },
    axisTick: { show: false },
    splitLine: { show: false }
  }
}

function xAxisSubBottom (times, gi) {
  return {
    type: 'category',
    data: times,
    gridIndex: gi,
    scale: true,
    axisLine: { lineStyle: { color: '#666' } }
  }
}

/**
 * 无副图 | 量+额 三格 | 单副图（仅量或仅额）
 */
function buildGridsXAxesYAxes ({ times, hasPct, hasVol, hasAmt, hasSub, subBoth }) {
  if (!hasSub) {
    return {
      grid: [{ left: 48, right: hasPct ? 56 : 20, top: 36, bottom: 56 }],
      xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#666' } } },
      yAxis: hasPct
        ? [
            { type: 'value', scale: true, splitLine: { lineStyle: { color: '#333' } } },
            { type: 'value', scale: true, name: '涨跌%', nameTextStyle: { color: '#888' }, position: 'right', splitLine: { show: false } }
          ]
        : { type: 'value', scale: true, splitLine: { lineStyle: { color: '#333' } } },
      xZoomIdx: [0]
    }
  }
  if (subBoth) {
    const yMain = hasPct
      ? [
          { type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } },
          { type: 'value', scale: true, name: '涨跌%', nameTextStyle: { color: '#888' }, position: 'right', gridIndex: 0, splitLine: { show: false } }
        ]
      : [{ type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } }]
    return {
      grid: [
        { left: 50, right: hasPct ? 56 : 20, top: 32, height: '48%' },
        { left: 50, right: 20, top: '60%', height: '14%' },
        { left: 50, right: 20, top: '76%', height: '12%' }
      ],
      xAxis: [xAxis0(times), xAxisH(times, 1), xAxisSubBottom(times, 2)],
      yAxis: [
        ...yMain,
        { type: 'value', name: '量(手)', nameLocation: 'end', nameGap: 0, nameTextStyle: { color: '#888', fontSize: 10, align: 'left', padding: [2, 0, 0, 4] }, scale: true, gridIndex: 1, splitLine: { show: true, lineStyle: { color: '#2a2a2a' } } },
        { type: 'value', name: '额(亿)', nameLocation: 'end', nameGap: 0, nameTextStyle: { color: '#888', fontSize: 10, align: 'left', padding: [2, 0, 0, 4] }, scale: true, gridIndex: 2, splitLine: { show: true, lineStyle: { color: '#2a2a2a' } } }
      ],
      xZoomIdx: [0, 1, 2]
    }
  }
  const yMainSingle = hasPct
    ? [
        { type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } },
        { type: 'value', scale: true, name: '涨跌%', nameTextStyle: { color: '#888' }, position: 'right', gridIndex: 0, splitLine: { show: false } }
      ]
    : [{ type: 'value', scale: true, gridIndex: 0, splitLine: { lineStyle: { color: '#333' } } }]
  return {
    grid: [
      { left: 50, right: hasPct ? 56 : 20, top: 32, height: '55%' },
      { left: 50, right: 20, top: '64%', height: '22%' }
    ],
    xAxis: [xAxis0(times), xAxisSubBottom(times, 1)],
    yAxis: [
      ...yMainSingle,
      { type: 'value', name: hasVol ? '量(手)' : '额(亿)', nameLocation: 'end', nameGap: 0, nameTextStyle: { color: '#888', fontSize: 10, align: 'left', padding: [2, 0, 0, 4] }, scale: true, gridIndex: 1, splitLine: { show: true, lineStyle: { color: '#2a2a2a' } } }
    ],
    xZoomIdx: [0, 1]
  }
}

function buildSeries (ctx) {
  const {
    ohlc,
    pcts,
    hasPct,
    hasSub,
    hasVol,
    hasAmt,
    volData,
    amountData,
    xVol,
    xAmt,
    yVol,
    yAmt,
    markers,
    fmtAxis
  } = ctx
  const markPointData = buildMarkerPoints(markers, fmtAxis)
  const s = [
    {
      name: 'K线',
      type: 'candlestick',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: ohlc,
      itemStyle: {
        color: '#ef5350',
        color0: '#26a69a',
        borderColor: '#ef5350',
        borderColor0: '#26a69a'
      },
      ...(markPointData.length ? {
        markPoint: {
          symbol: 'circle',
          symbolSize: 24,
          data: markPointData,
          label: {
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            formatter: (params) => params?.data?.label || '9'
          }
        }
      } : {})
    }
  ]
  if (hasPct) {
    s.push({
      name: '涨跌幅%',
      type: 'line',
      xAxisIndex: 0,
      yAxisIndex: 1,
      data: pcts,
      showSymbol: false,
      lineStyle: { width: 1, color: '#9ccc65' },
      connectNulls: true,
      z: 5
    })
  }
  if (hasSub && hasVol) {
    s.push({
      name: '成交量',
      type: 'bar',
      xAxisIndex: xVol,
      yAxisIndex: yVol,
      data: volData,
      barMaxWidth: 6
    })
  }
  if (hasSub && hasAmt) {
    s.push({
      name: '成交额(千元→亿轴)',
      type: 'bar',
      xAxisIndex: xAmt,
      yAxisIndex: yAmt,
      data: amountData.map((q) => (q == null ? 0 : q / 1e5)),
      itemStyle: { color: 'rgba(100, 181, 246, 0.65)' },
      barMaxWidth: 6
    })
  }
  if (!hasSub) {
    s[0].xAxisIndex = 0
    s[0].yAxisIndex = 0
  }
  return s
}

function buildMarkerPoints (markers, fmtAxis) {
  if (!Array.isArray(markers) || !markers.length) return []
  return markers
    .map((marker) => {
      const direction = marker.direction
      const isTop = direction === 'up'
      const date = fmtAxis(marker.trade_date)
      const rawY = isTop ? marker.high : marker.low
      const y = Number(rawY)
      if (!date || !Number.isFinite(y)) return null
      return {
        name: marker.grade === 'strong' ? '强九转' : marker.grade === 'perfect' ? '完美九转' : '九转',
        coord: [date, isTop ? y * 1.012 : y * 0.988],
        value: marker.label || 9,
        label: String(marker.label || 9),
        itemStyle: {
          color: isTop ? '#ef4444' : '#22c55e',
          borderColor: marker.grade === 'normal' ? 'rgba(255,255,255,.55)' : '#f8fafc',
          borderWidth: marker.grade === 'normal' ? 1 : 2
        }
      }
    })
    .filter(Boolean)
}

function buildShenwanTooltip (data, fmt) {
  return {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
    confine: true,
    formatter (params) {
      if (!params || !params.length) return ''
      const idx = params[0].dataIndex
      const d = data[idx]
      if (!d) return ''
      const {
        fmtAxis,
        formatNum2,
        toNumOrNull,
        formatVolShow,
        formatAmountQianYuan,
        formatMvWan
      } = fmt
      const t = params.map((p) => {
        if (p.seriesName === 'K线') {
          const o = toNumOrNull(d.open)
          const c = toNumOrNull(d.close)
          const l = toNumOrNull(d.low)
          const h = toNumOrNull(d.high)
          return `开 ${formatNum2(o)}　收 ${formatNum2(c)}<br/>低 ${formatNum2(l)}　高 ${formatNum2(h)}`
        }
        if (p.seriesName === '涨跌幅%' && p.data != null) {
          return `涨跌幅 ${Number(p.data).toFixed(2)}%`
        }
        if (p.seriesName === '成交量') {
          const v = p.data
          const val = v && typeof v === 'object' && 'value' in v ? v.value : v
          return `成交 ${formatVolShow(val)}`
        }
        if (p.seriesName && p.seriesName.indexOf('成交额') === 0) {
          const y = toNumOrNull(d.amount)
          return `成交额 ${formatAmountQianYuan(y)}（Tushare 为千元）`
        }
        return ''
      }).filter(Boolean)
      const extra = []
      if (d.pct_change != null) extra.push(`涨跌幅(字段) ${formatNum2(d.pct_change)}%`)
      if (d.change != null) extra.push(`涨跌额 ${(Number(d.change) > 0 ? '+' : '')}${formatNum2(d.change)}`)
      if (d.float_mv != null) extra.push(`流通市值 ${formatMvWan(d.float_mv)}`)
      if (d.total_mv != null) extra.push(`总市值 ${formatMvWan(d.total_mv)}`)
      const body = t.concat(extra).filter(Boolean).join('<br/>')
      return `<div class="k-tip"><strong>${fmtAxis(d.trade_date)}</strong><br/>${body}</div>`
    }
  }
}
