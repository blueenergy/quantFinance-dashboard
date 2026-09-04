/**
 * 申万行业指数 K 线 ECharts option（K + 均线 + 可选涨跌幅% + 量/额 副图）。
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
    formatAmount = formatAmountByUnit,
    formatMvWan,
    markers = []
  } = formatters

  const times = data.map((r) => fmtAxis(r.trade_date))
  const closes = data.map((r) => toNumOrNull(r.close))
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
  const showPctLine = _meta?.showPctLine === true
  const hasPct = showPctLine && pcts.some((p) => p != null)
  const showDecisionGs = _meta?.showDecisionGs !== false && data.some((r) => r.mj20 != null)
  const showMa = showDecisionGs ? _meta?.showMa === true : _meta?.showMa !== false
  const maPeriods = movingAveragePeriods(_meta?.tf)
  const maFast = showMa ? movingAverage(closes, maPeriods.fast) : []
  const maSlow = showMa ? movingAverage(closes, maPeriods.slow) : []
  const vols = data.map((r) => volumeToHands(r))
  const hasVol = vols.some((v) => v != null)
  const amountYi = data.map((r) => amountToYi(r))
  const hasAmt = amountYi.some((a) => a != null)
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
    ? amountYi.map((v) => (v == null || !Number.isFinite(v) ? 0 : v))
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

  const option = {
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
      maFast,
      maSlow,
      maPeriods,
      showMa,
      showDecisionGs,
      mj20: showDecisionGs ? data.map((r) => toNumOrNull(r.mj20)) : [],
      mj30Bull: showDecisionGs ? data.map((r) => (r.gs_is_bull ? toNumOrNull(r.mj30) : null)) : [],
      mj30Bear: showDecisionGs ? data.map((r) => (r.gs_is_bull === false ? toNumOrNull(r.mj30) : null)) : [],
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
      fmtAxis,
      markLineDate: _meta?.markLineDate
    }),
    tooltip: buildShenwanTooltip(data, { fmtAxis, formatNum2, toNumOrNull, formatVolShow, formatAmount, formatMvWan })
  }

  applyFocusZoom(option, times, {
    focusDate: _meta?.focusDate,
    fmtAxis,
    barsBefore: _meta?.focusBarsBefore,
    barsAfter: _meta?.focusBarsAfter
  })
  return option
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

function amountToYi (row) {
  const n = Number(row?.amount)
  if (!Number.isFinite(n)) return null
  const unit = String(row?.amount_unit || 'qian_yuan').toLowerCase()
  if (unit === 'yuan') return n / 100000000
  if (unit === 'wan_yuan') return n / 10000
  return n / 100000
}

function volumeToHands (row) {
  const raw = row?.vol ?? row?.volume
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  const unit = String(row?.volume_unit || 'hands').toLowerCase()
  if (unit === 'shares' || unit === 'share') return n / 100
  return n
}

function formatAmountByUnit (value, unit = 'qian_yuan') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const normalized = String(unit || 'qian_yuan').toLowerCase()
  if (normalized === 'yuan') return `${(n / 100000000).toFixed(2)}亿`
  if (normalized === 'wan_yuan') return `${(n / 10000).toFixed(2)}亿`
  return `${(n / 100000).toFixed(2)}亿`
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
        { left: 50, right: hasPct ? 56 : 20, top: 32, height: '44%' },
        { left: 50, right: 20, top: '57%', height: '17%' },
        { left: 50, right: 20, top: '77%', height: '15%' }
      ],
      xAxis: [xAxis0(times), xAxisH(times, 1), xAxisSubBottom(times, 2)],
      yAxis: [
        ...yMain,
        {
          type: 'value',
          name: '量(手)',
          nameLocation: 'end',
          nameGap: 0,
          nameTextStyle: { color: '#888', fontSize: 10, align: 'left', padding: [2, 0, 0, 4] },
          axisLabel: { formatter: compactVolumeLabel },
          scale: true,
          gridIndex: 1,
          splitLine: { show: true, lineStyle: { color: '#2a2a2a' } }
        },
        {
          type: 'value',
          name: '额(亿)',
          nameLocation: 'end',
          nameGap: 0,
          nameTextStyle: { color: '#888', fontSize: 10, align: 'left', padding: [2, 0, 0, 4] },
          axisLabel: { formatter: compactNumberLabel },
          scale: true,
          gridIndex: 2,
          splitLine: { show: true, lineStyle: { color: '#2a2a2a' } }
        }
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
      { left: 50, right: hasPct ? 56 : 20, top: 32, height: '52%' },
      { left: 50, right: 20, top: '62%', height: '27%' }
    ],
    xAxis: [xAxis0(times), xAxisSubBottom(times, 1)],
    yAxis: [
      ...yMainSingle,
      {
        type: 'value',
        name: hasVol ? '量(手)' : '额(亿)',
        nameLocation: 'end',
        nameGap: 0,
        nameTextStyle: { color: '#888', fontSize: 10, align: 'left', padding: [2, 0, 0, 4] },
        axisLabel: { formatter: hasVol ? compactVolumeLabel : compactNumberLabel },
        scale: true,
        gridIndex: 1,
        splitLine: { show: true, lineStyle: { color: '#2a2a2a' } }
      }
    ],
    xZoomIdx: [0, 1]
  }
}

function buildSeries (ctx) {
  const {
    ohlc,
    maFast,
    maSlow,
    maPeriods,
    showMa = true,
    showDecisionGs = false,
    mj20 = [],
    mj30Bull = [],
    mj30Bear = [],
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
    fmtAxis,
    markLineDate
  } = ctx
  const markPointData = buildMarkerPoints(markers, fmtAxis)
  const candle = {
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
    }
  }
  if (markPointData.length) {
    candle.markPoint = {
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
  }
  const axisDate = markLineDate ? fmtAxis(markLineDate) : ''
  if (axisDate) {
    candle.markLine = {
      symbol: 'none',
      label: { formatter: '信号日', color: '#fbbf24', fontSize: 11 },
      lineStyle: { color: '#fbbf24', type: 'dashed', width: 1 },
      data: [{ xAxis: axisDate }]
    }
  }
  const s = [candle]
  if (showMa !== false) {
    s.push(movingAverageSeries(`MA${maPeriods.fast}`, maFast, '#facc15', 3))
    s.push(movingAverageSeries(`MA${maPeriods.slow}`, maSlow, '#a855f7', 2))
  }
  if (showDecisionGs) {
    s.push(movingAverageSeries('决策线', mj20, '#facc15', 4))
    s.push(movingAverageSeries('牛线', mj30Bull, '#ef4444', 3))
    s.push(movingAverageSeries('熊线', mj30Bear, '#22c55e', 3))
    s.push(...buildGsScatterSeries(markers, fmtAxis))
  }
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
      barMaxWidth: 6,
      barMinHeight: 2
    })
  }
  if (hasSub && hasAmt) {
    s.push({
      name: '成交额(亿)',
      type: 'bar',
      xAxisIndex: xAmt,
      yAxisIndex: yAmt,
      data: amountData,
      itemStyle: { color: 'rgba(100, 181, 246, 0.65)' },
      barMaxWidth: 6,
      barMinHeight: 2
    })
  }
  if (!hasSub) {
    s[0].xAxisIndex = 0
    s[0].yAxisIndex = 0
  }
  return s
}

function movingAveragePeriods (tf) {
  const normalized = String(tf || '1d').toLowerCase()
  if (normalized === '1w' || normalized === 'w') return { fast: 11, slow: 46 }
  if (normalized === '1m' || normalized === 'm') return { fast: 12, slow: 36 }
  return { fast: 55, slow: 233 }
}

function movingAverage (values, windowSize) {
  let sum = 0
  let count = 0
  const result = []
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (value != null) {
      sum += value
      count += 1
    }
    if (i >= windowSize) {
      const dropped = values[i - windowSize]
      if (dropped != null) {
        sum -= dropped
        count -= 1
      }
    }
    result.push(i >= windowSize - 1 && count === windowSize ? Number((sum / windowSize).toFixed(4)) : null)
  }
  return result
}

function movingAverageSeries (name, data, color, z) {
  return {
    name,
    type: 'line',
    xAxisIndex: 0,
    yAxisIndex: 0,
    data,
    showSymbol: false,
    smooth: false,
    connectNulls: false,
    lineStyle: { width: 1.2, color },
    emphasis: { focus: 'series' },
    z
  }
}

export function buildDecisionGsChartSeries (rows, fmtAxis) {
  if (!Array.isArray(rows) || !rows.some((r) => r.mj20 != null)) return []
  const toNum = (value) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  const mj20 = rows.map((r) => toNum(r.mj20))
  const mj30Bull = rows.map((r) => (r.gs_is_bull ? toNum(r.mj30) : null))
  const mj30Bear = rows.map((r) => (r.gs_is_bull === false ? toNum(r.mj30) : null))
  const markers = []
  rows.forEach((r) => {
    if (r.gs_signal !== 'g' && r.gs_signal !== 's') return
    markers.push({
      kind: r.gs_signal,
      trade_date: r.trade_date,
      low: r.low,
      high: r.high,
      price: r.gs_signal === 'g' ? r.low : r.high
    })
  })
  return [
    movingAverageSeries('决策线', mj20, '#facc15', 4),
    movingAverageSeries('牛线', mj30Bull, '#ef4444', 3),
    movingAverageSeries('熊线', mj30Bear, '#22c55e', 3),
    ...buildGsScatterSeries(markers, fmtAxis)
  ]
}

function buildGsScatterSeries (markers, fmtAxis) {
  const gData = []
  const sData = []
  if (Array.isArray(markers)) {
    markers.forEach((marker) => {
      const date = fmtAxis(marker.trade_date)
      if (!date) return
      if (marker.kind === 'g') {
        const y = Number(marker.low ?? marker.price)
        if (Number.isFinite(y)) gData.push([date, y])
      } else if (marker.kind === 's') {
        const y = Number(marker.high ?? marker.price)
        if (Number.isFinite(y)) sData.push([date, y])
      }
    })
  }
  return [
    {
      name: 'G',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: gData,
      symbol: 'triangle',
      symbolSize: 14,
      itemStyle: { color: '#4ade80' },
      label: {
        show: true,
        formatter: 'G',
        position: 'bottom',
        color: '#86efac',
        fontWeight: 800,
        fontSize: 12,
        distance: 4
      },
      z: 20
    },
    {
      name: 'S',
      type: 'scatter',
      xAxisIndex: 0,
      yAxisIndex: 0,
      data: sData,
      symbol: 'triangle',
      symbolRotate: 180,
      symbolSize: 14,
      itemStyle: { color: '#f87171' },
      label: {
        show: true,
        formatter: 'S',
        position: 'top',
        color: '#fca5a5',
        fontWeight: 800,
        fontSize: 12,
        distance: 4
      },
      z: 20
    }
  ]
}

function compactVolumeLabel (value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  if (abs >= 100000000) return `${trimFixed(n / 100000000, 1)}亿`
  if (abs >= 10000) return `${trimFixed(n / 10000, 1)}万`
  return trimFixed(n, 0)
}

function compactNumberLabel (value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return ''
  const abs = Math.abs(n)
  if (abs >= 10000) return `${trimFixed(n / 10000, 1)}万`
  if (abs >= 1000) return trimFixed(n / 1000, 1) + 'k'
  return trimFixed(n, abs >= 10 ? 0 : 1)
}

function trimFixed (value, digits) {
  return Number(value).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
}

function applyFocusZoom (option, times, { focusDate, fmtAxis, barsBefore, barsAfter } = {}) {
  if (!focusDate || !Array.isArray(times) || !times.length || typeof fmtAxis !== 'function') return
  const key = fmtAxis(focusDate)
  const compact = String(focusDate || '').replace(/-/g, '')
  let idx = times.indexOf(key)
  if (idx < 0) {
    idx = times.findIndex((item) => String(item || '').replace(/-/g, '') === compact)
  }
  if (idx < 0) return
  const before = Number.isFinite(Number(barsBefore)) ? Number(barsBefore) : 60
  const after = Number.isFinite(Number(barsAfter)) ? Number(barsAfter) : 40
  const startIdx = Math.max(0, idx - before)
  const endIdx = Math.min(times.length - 1, idx + after)
  const n = times.length
  const start = (startIdx / n) * 100
  const end = ((endIdx + 1) / n) * 100
  const zooms = Array.isArray(option.dataZoom) ? option.dataZoom : []
  zooms.forEach((zoom) => {
    zoom.start = start
    zoom.end = Math.max(start + 1, end)
  })
}

function markerKind (marker) {
  if (marker?.kind === 'buy' || marker?.kind === 'sell' || marker?.kind === 'g' || marker?.kind === 's') {
    return marker.kind
  }
  if (marker?.direction === 'up' || marker?.direction === 'down') return 'nineturn'
  return 'nineturn'
}

function buildMarkerPoints (markers, fmtAxis) {
  if (!Array.isArray(markers) || !markers.length) return []
  return markers
    .map((marker) => {
      const kind = markerKind(marker)
      const date = fmtAxis(marker.trade_date)
      if (!date) return null
      if (kind === 'buy' || kind === 'sell' || kind === 'g' || kind === 's') {
        const isBuy = kind === 'buy' || kind === 'g'
        const priced = Number(marker.price)
        const rawY = Number.isFinite(priced)
          ? priced
          : Number(isBuy ? marker.low : marker.high)
        if (!Number.isFinite(rawY)) return null
        const isGs = kind === 'g' || kind === 's'
        const label = isGs ? (isBuy ? 'G' : 'S') : (isBuy ? '买' : '卖')
        return {
          name: isGs ? (isBuy ? '决策线G' : '决策线S') : (isBuy ? '买入' : '卖出'),
          coord: [date, rawY],
          value: label,
          label,
          symbol: 'pin',
          symbolSize: marker.highlighted ? 42 : 34,
          symbolOffset: isBuy ? [0, 10] : [0, -10],
          itemStyle: {
            color: isBuy ? '#22c55e' : '#ef4444',
            borderColor: marker.highlighted ? '#fde68a' : '#f8fafc',
            borderWidth: marker.highlighted ? 2 : 1
          }
        }
      }
      const isTop = marker.direction === 'up'
      const rawY = isTop ? marker.high : marker.low
      const y = Number(rawY)
      if (!Number.isFinite(y)) return null
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
        formatAmount,
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
        if (typeof p.seriesName === 'string' && /^MA\d+$/.test(p.seriesName) && p.data != null) {
          return `${p.seriesName} ${formatNum2(p.data)}`
        }
        if ((p.seriesName === '决策线' || p.seriesName === '牛线' || p.seriesName === '熊线') && p.data != null) {
          return `${p.seriesName} ${formatNum2(p.data)}`
        }
        if (p.seriesName === '成交量') {
          const v = p.data
          const val = v && typeof v === 'object' && 'value' in v ? v.value : v
          return `成交 ${formatVolShow(val)}`
        }
        if (p.seriesName && p.seriesName.indexOf('成交额') === 0) {
          const y = toNumOrNull(d.amount)
          return `成交额 ${formatAmount(y, d.amount_unit)}`
        }
        return ''
      }).filter(Boolean)
      const extra = []
      if (d.pct_change != null) extra.push(`涨跌幅(字段) ${formatNum2(d.pct_change)}%`)
      if (d.change != null) extra.push(`涨跌额 ${(Number(d.change) > 0 ? '+' : '')}${formatNum2(d.change)}`)
      if (d.float_mv != null) extra.push(`流通市值 ${formatMvWan(d.float_mv)}`)
      if (d.total_mv != null) extra.push(`总市值 ${formatMvWan(d.total_mv)}`)
      const body = t.concat(extra).filter(Boolean).join('<br/>')
      const partialLabel = d.is_partial ? '（未完周期，日线动态聚合）' : ''
      return `<div class="k-tip"><strong>${fmtAxis(d.trade_date)}${partialLabel}</strong><br/>${body}</div>`
    }
  }
}
