<template>
  <section v-if="equityCaveat" class="caveat-box">
    <strong>说明：</strong>{{ equityCaveat }}
  </section>

  <section v-if="bookEquity" class="summary-cards">
    <div class="card">
      <div class="label">连续权益（一本账）</div>
      <div class="value">{{ money(bookEquity.equity) }}</div>
    </div>
    <div class="card">
      <div class="label">初始本金</div>
      <div class="value">{{ money(bookEquity.initial_capital) }}</div>
    </div>
    <div class="card">
      <div class="label">可用现金</div>
      <div class="value">{{ money(bookEquity.cash) }}</div>
    </div>
    <div class="card">
      <div class="label">累计盈亏</div>
      <div class="value">{{ signedMoney(Number(bookEquity.realized_pnl || 0) + Number(bookEquity.unrealized_pnl || 0)) }}</div>
    </div>
  </section>

  <section class="chart-section">
    <h3>净值曲线（当前血缘权益 · 日频）</h3>
    <div v-if="!equityRowsForChart.length" class="muted">暂无净值数据。</div>
    <div v-else class="equity-chart" aria-label="Lineage equity curve" @mouseleave="onChartLeave">
      <svg
        class="equity-svg"
        :viewBox="`0 0 ${equityChart.width} ${equityChart.height}`"
        @mousemove="onChartMove"
      >
        <defs>
          <linearGradient :id="equityGradId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="equityChart.up ? 'rgba(220,38,38,0.30)' : 'rgba(22,163,74,0.30)'" />
            <stop offset="100%" stop-color="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>
        <g class="grid">
          <line
            v-for="tick in equityChart.yTicks"
            :key="`grid-${tick.y}`"
            :x1="equityChart.plotLeft"
            :x2="equityChart.plotRight"
            :y1="tick.y"
            :y2="tick.y"
          />
          <text
            v-for="tick in equityChart.yTicks"
            :key="`yl-${tick.y}`"
            class="axis-label"
            :x="equityChart.plotLeft - 8"
            :y="tick.y + 4"
            text-anchor="end"
          >{{ tick.label }}</text>
        </g>
        <g v-if="equityChart.baselineY != null">
          <line
            class="baseline"
            :x1="equityChart.plotLeft"
            :x2="equityChart.plotRight"
            :y1="equityChart.baselineY"
            :y2="equityChart.baselineY"
          />
          <text class="baseline-label" :x="equityChart.plotRight" :y="equityChart.baselineY - 6" text-anchor="end">
            成本线 {{ moneyShort(equityChart.baseline) }}
          </text>
        </g>
        <path v-if="equityChart.areaPath" class="area" :d="equityChart.areaPath" :fill="`url(#${equityGradId})`" />
        <polyline class="line" :class="equityChart.up ? 'up' : 'down'" :points="equityChart.linePoints" />
        <text
          v-for="tick in equityChart.xTicks"
          :key="`xl-${tick.x}`"
          class="axis-label"
          :x="tick.x"
          :y="equityChart.height - 8"
          :text-anchor="tick.anchor"
        >{{ tick.text }}</text>
        <g v-if="hoverPoint">
          <line
            class="crosshair"
            :x1="hoverPoint.x"
            :x2="hoverPoint.x"
            :y1="equityChart.plotTop"
            :y2="equityChart.plotBottom"
          />
          <circle class="dot" :cx="hoverPoint.x" :cy="hoverPoint.y" r="4.5" />
        </g>
      </svg>
      <div v-if="hoverPoint" class="equity-tip" :style="hoverPoint.tipStyle">
        <div class="tip-date">{{ hoverPoint.date }}</div>
        <div class="tip-row"><span>血缘权益</span><strong>{{ money(hoverPoint.equity) }}</strong></div>
        <div class="tip-row">
          <span>当日盈亏</span>
          <strong :class="signClass(hoverPoint.dayPnl)">{{ signedMoney(hoverPoint.dayPnl) }} · {{ signedPct(hoverPoint.dayPct) }}</strong>
        </div>
        <div class="tip-row">
          <span>累计盈亏</span>
          <strong :class="signClass(hoverPoint.cumPnl)">{{ signedMoney(hoverPoint.cumPnl) }} · {{ signedPct(hoverPoint.cumPct) }}</strong>
        </div>
      </div>
      <p v-if="equityChart.latestReturn != null" class="chart-meta">
        区间收益：<strong :class="signClass(equityChart.latestReturn)">{{ signedPct(equityChart.latestReturn) }}</strong>
        <span class="chart-meta-hint">· 悬浮查看每日净值与盈亏</span>
      </p>
      <p v-if="equityRows.length === 0 && equityRowsForChart.length" class="muted chart-note">
        当前暂无账户日权益快照；这里用一本账当前权益生成一个估算点。
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  equityRows: { type: Array, default: () => [] },
  bookEquity: { type: Object, default: null },
  equityCaveat: { type: String, default: '' },
})

const hoverIndex = ref(null)
const equityGradId = `equityFill-${Math.random().toString(36).slice(2, 8)}`

const equityRowsForChart = computed(() => {
  if (props.equityRows.length) return props.equityRows
  const currentEquity = Number(props.bookEquity?.equity)
  if (!Number.isFinite(currentEquity) || currentEquity <= 0) return []
  return [{ date: '当前估算', equity: currentEquity, estimated: true }]
})

const equityChart = computed(() => {
  const rows = equityRowsForChart.value
  const width = 720
  const height = 260
  const plotLeft = 58
  const plotRight = width - 18
  const plotTop = 18
  const plotBottom = height - 28
  const empty = {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints: '', areaPath: '', coords: [], yTicks: [], xTicks: [],
    min: 0, max: 0, baseline: null, baselineY: null, up: true, latestReturn: null,
  }
  if (!rows.length) return empty

  const values = rows.map((row) => Number(row.equity)).filter((v) => Number.isFinite(v))
  if (!values.length) return empty
  const baselineRaw = Number(props.bookEquity?.initial_capital)
  const baseline = Number.isFinite(baselineRaw) && baselineRaw > 0 ? baselineRaw : values[0]

  let min = Math.min(...values, baseline)
  let max = Math.max(...values, baseline)
  if (max === min) { max += 1; min -= 1 }
  const headroom = (max - min) * 0.08
  min -= headroom
  max += headroom
  const span = max - min || 1

  const xAt = (index) =>
    rows.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + (index * (plotRight - plotLeft)) / (rows.length - 1)
  const yAt = (equity) => plotBottom - ((equity - min) * (plotBottom - plotTop)) / span

  const coords = rows.map((row, index) => {
    const equity = Number(row.equity)
    const prev = index > 0 ? Number(rows[index - 1].equity) : equity
    const dayPnl = index > 0 ? equity - prev : 0
    const dayPct = index > 0 && prev ? equity / prev - 1 : 0
    return {
      x: xAt(index),
      y: yAt(equity),
      date: row.date,
      equity,
      dayPnl,
      dayPct,
      cumPnl: equity - baseline,
      cumPct: baseline ? equity / baseline - 1 : 0,
    }
  })

  const linePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const areaPath = coords.length > 1
    ? `M ${coords[0].x.toFixed(1)},${plotBottom} ` +
      coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
      ` L ${coords[coords.length - 1].x.toFixed(1)},${plotBottom} Z`
    : ''

  const tickCount = 4
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const value = min + (span * i) / tickCount
    return { value, y: yAt(value), label: moneyShort(value) }
  })

  const labelCount = Math.min(rows.length, 5)
  const xTicks = Array.from({ length: labelCount }, (_, i) => {
    const index = labelCount === 1 ? 0 : Math.round((i * (rows.length - 1)) / (labelCount - 1))
    const c = coords[index]
    const anchor = i === 0 ? 'start' : i === labelCount - 1 ? 'end' : 'middle'
    return { x: c.x, text: shortDate(c.date), anchor }
  })

  const first = values[0]
  const latest = values[values.length - 1]
  return {
    width, height, plotLeft, plotRight, plotTop, plotBottom,
    linePoints, areaPath, coords, yTicks, xTicks,
    min, max,
    baseline,
    baselineY: yAt(baseline),
    up: latest >= baseline,
    latestReturn: first ? latest / first - 1 : null,
  }
})

const hoverPoint = computed(() => {
  const chart = equityChart.value
  const i = hoverIndex.value
  if (i == null || !chart.coords[i]) return null
  const c = chart.coords[i]
  const leftPct = Math.max(14, Math.min(86, (c.x / chart.width) * 100))
  return { ...c, tipStyle: { left: `${leftPct}%` } }
})

function onChartMove(event) {
  const chart = equityChart.value
  const n = chart.coords.length
  if (!n) { hoverIndex.value = null; return }
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width) return
  const frac = (event.clientX - rect.left) / rect.width
  const left = chart.plotLeft / chart.width
  const right = chart.plotRight / chart.width
  const t = Math.max(0, Math.min(1, (frac - left) / (right - left || 1)))
  hoverIndex.value = Math.round(t * (n - 1))
}

function onChartLeave() {
  hoverIndex.value = null
}

function moneyShort(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (abs >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return n.toFixed(0)
}

function shortDate(value) {
  const text = String(value || '')
  if (/^\d{8}$/.test(text)) return `${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

function money(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  return Number.isFinite(number) ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) : '-'
}

function signedMoney(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  const formatted = Math.abs(number).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
  return `${number >= 0 ? '+' : '-'}${formatted}`
}

function signedPct(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return `${number >= 0 ? '+' : ''}${(number * 100).toFixed(2)}%`
}

function signClass(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number === 0) return ''
  return number > 0 ? 'positive' : 'negative'
}
</script>

<style scoped>
.caveat-box {
  background: #fffbeb;
  border: 1px solid #d97706;
  border-radius: 6px;
  color: #422006;
  font-size: 13px;
  line-height: 1.55;
  margin-bottom: 16px;
  padding: 12px 14px;
}

.caveat-box strong {
  color: #1c1917;
}

.summary-cards {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  margin: 16px 0;
}

.summary-cards .card {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 12px;
}

.summary-cards .label {
  color: #64748b;
  font-size: 12px;
}

.summary-cards .value {
  color: #111827;
  font-size: 20px;
  font-weight: 700;
  margin-top: 4px;
}

.chart-section h3 {
  color: #111827;
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 8px;
}

.muted {
  color: #374151;
  font-size: 13px;
  margin: 0;
}

.equity-chart {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  position: relative;
}

.equity-chart .equity-svg {
  cursor: crosshair;
  display: block;
  height: auto;
  width: 100%;
}

.equity-chart polyline.line {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.25;
}

.equity-chart polyline.line.up {
  stroke: #dc2626;
}

.equity-chart polyline.line.down {
  stroke: #16a34a;
}

.equity-chart .grid line {
  stroke: #eef2f7;
  stroke-width: 1;
}

.equity-chart .axis-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .baseline {
  stroke: #94a3b8;
  stroke-dasharray: 4 4;
  stroke-width: 1;
}

.equity-chart .baseline-label {
  fill: #94a3b8;
  font-size: 11px;
}

.equity-chart .crosshair {
  stroke: #94a3b8;
  stroke-dasharray: 3 3;
  stroke-width: 1;
}

.equity-chart .dot {
  fill: #fff;
  stroke: #1d4ed8;
  stroke-width: 2;
}

.equity-tip {
  background: rgba(15, 23, 42, 0.94);
  border-radius: 8px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.25);
  color: #f8fafc;
  font-size: 12px;
  line-height: 1.5;
  padding: 8px 10px;
  pointer-events: none;
  position: absolute;
  top: 14px;
  transform: translateX(-50%);
  white-space: nowrap;
  z-index: 2;
}

.equity-tip .tip-date {
  color: #e2e8f0;
  font-weight: 600;
  margin-bottom: 4px;
}

.equity-tip .tip-row {
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.equity-tip .tip-row span {
  color: #94a3b8;
}

.equity-tip .tip-row strong {
  color: #f8fafc;
  font-weight: 600;
}

.equity-tip .tip-row strong.positive {
  color: #f87171;
}

.equity-tip .tip-row strong.negative {
  color: #4ade80;
}

.chart-meta {
  color: #374151;
  font-size: 13px;
  margin: 10px 0 0;
}

.chart-meta strong {
  color: #111827;
}

.chart-meta strong.positive {
  color: #dc2626;
}

.chart-meta strong.negative {
  color: #16a34a;
}

.chart-meta-hint {
  color: #94a3b8;
  margin-left: 6px;
}

.chart-note {
  margin-top: 8px;
}
</style>
