export function buildMoneyFlowOption(rows, formatters = {}) {
  const {
    fmtAxis = (value) => String(value || ''),
    fmtWanAmount = defaultFmtWanAmount,
    rollingLabel = '5日主力累计',
    showRollingLine = true,
  } = formatters
  const data = [...(rows || [])]
    .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))

  const times = data.map((row) => fmtAxis(row.trade_date))
  const elgNet = data.map((row) => toFinite(row.elg_net))
  const lgNet = data.map((row) => toFinite(row.lg_net))
  const mainNet = data.map((row) => toFinite(row.main_net))
  const mainNet5d = data.map((_, idx) => rollingSum(mainNet, idx, 5))
  const series = [
    {
      name: '超大单净额',
      type: 'bar',
      stack: 'main',
      data: elgNet.map((value) => barPoint(value, { up: '#ef4444', down: '#22c55e' })),
      barMaxWidth: 18,
    },
    {
      name: '大单净额',
      type: 'bar',
      stack: 'main',
      data: lgNet.map((value) => barPoint(value, { up: '#fb923c', down: '#14b8a6' })),
      barMaxWidth: 18,
    },
  ]
  if (showRollingLine) {
    series.push({
      name: rollingLabel,
      type: 'line',
      smooth: true,
      symbol: 'none',
      data: mainNet5d,
      lineStyle: { width: 2, color: '#60a5fa' },
    })
  }

  return {
    backgroundColor: 'transparent',
    color: ['#f87171', '#fb923c', '#60a5fa'],
    legend: { show: false },
    grid: { left: 64, right: 24, top: 18, bottom: 58 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(15, 23, 42, .94)',
      borderColor: 'rgba(148, 163, 184, .28)',
      textStyle: { color: '#e2e8f0' },
      formatter(params) {
        const idx = params?.[0]?.dataIndex ?? 0
        const row = data[idx] || {}
        return [
          `<strong>${fmtAxis(row.trade_date)}</strong>`,
          `主力净额：${fmtWanAmount(row.main_net)}`,
          `超大单：${fmtWanAmount(row.elg_net)}`,
          `大单：${fmtWanAmount(row.lg_net)}`,
          `中单：${fmtWanAmount(row.md_net)}`,
          `小单：${fmtWanAmount(row.sm_net)}`,
          ...(showRollingLine ? [`${rollingLabel}：${fmtWanAmount(mainNet5d[idx])}`] : []),
        ].join('<br/>')
      },
    },
    xAxis: {
      type: 'category',
      data: times,
      axisLine: { lineStyle: { color: '#475569' } },
      axisLabel: { color: '#94a3b8' },
    },
    yAxis: {
      type: 'value',
      name: '亿元',
      scale: true,
      axisLabel: {
        color: '#94a3b8',
        formatter(value) {
          const n = Number(value)
          return Number.isFinite(n) ? (n / 10000).toFixed(1) : '-'
        },
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, .14)' } },
    },
    dataZoom: [
      { type: 'inside' },
      { type: 'slider', height: 18, bottom: 16, borderColor: 'rgba(148, 163, 184, .25)' },
    ],
    series,
  }
}

function toFinite(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function rollingSum(values, idx, size) {
  const slice = values.slice(Math.max(0, idx - size + 1), idx + 1).filter((value) => value != null)
  if (!slice.length) return null
  return slice.reduce((sum, value) => sum + value, 0)
}

function barPoint(value, colors) {
  return {
    value,
    itemStyle: {
      color: value >= 0 ? colors.up : colors.down,
      opacity: value == null ? 0 : 0.88,
    },
  }
}

function defaultFmtWanAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}亿`
  return `${n.toFixed(2)}万`
}
