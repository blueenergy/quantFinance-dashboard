<template>
  <div class="money-flow-panel">
    <div class="money-flow-summary">
      <div v-for="metric in summaryMetrics" :key="metric.label">
        <span>{{ metric.label }}</span>
        <strong :class="metric.className">{{ metric.value }}</strong>
        <small v-if="metric.hint">{{ metric.hint }}</small>
      </div>
    </div>

    <div v-if="historyRows.length" class="money-flow-legend" aria-label="资金流图例">
      <span><i class="legend-dot legend-elg-up"></i>超大单净额：流入红</span>
      <span><i class="legend-dot legend-elg-down"></i>流出绿</span>
      <span><i class="legend-dot legend-lg-up"></i>大单净额：流入橙</span>
      <span><i class="legend-dot legend-lg-down"></i>流出青</span>
      <span v-if="periodMeta.showRollingLine"><i class="legend-line legend-main"></i>{{ periodMeta.rollingLabel }}</span>
    </div>

    <div v-show="historyRows.length" ref="chartRef" class="money-flow-chart"></div>
    <div v-if="!historyRows.length" class="money-flow-empty">
      {{ loading ? `正在加载${periodMeta.shortLabel}资金流…` : `暂无该股票的${periodMeta.shortLabel}资金流历史。` }}
    </div>

    <details v-if="historyRows.length" class="money-flow-details">
      <summary>展开最近 10 {{ periodMeta.unitLabel }}资金流明细</summary>
      <div class="money-flow-table-wrap">
        <table class="money-flow-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>超大单净额</th>
              <th>大单净额</th>
              <th>主力净额</th>
              <th>中单净额</th>
              <th>小单净额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in recentRows" :key="row.trade_date">
              <td>{{ row.trade_date }}</td>
              <td :class="valueClass(row.elg_net)">{{ fmtWanAmount(row.elg_net) }}</td>
              <td :class="valueClass(row.lg_net)">{{ fmtWanAmount(row.lg_net) }}</td>
              <td :class="valueClass(row.main_net)">{{ fmtWanAmount(row.main_net) }}</td>
              <td :class="valueClass(row.md_net)">{{ fmtWanAmount(row.md_net) }}</td>
              <td :class="valueClass(row.sm_net)">{{ fmtWanAmount(row.sm_net) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { buildMoneyFlowOption } from '../utils/echarts/moneyFlowOption'

const props = defineProps({
  latest: {
    type: Object,
    default: () => null,
  },
  history: {
    type: Array,
    default: () => [],
  },
  summary: {
    type: Object,
    default: () => ({}),
  },
  period: {
    type: String,
    default: '1d',
  },
  klineRows: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const chartRef = ref(null)
let echarts = null
let chart = null
let resizeObserver = null

const periodMeta = computed(() => periodConfig(props.period))
const sourceRows = computed(() => {
  const rows = Array.isArray(props.history) ? props.history.filter((row) => row?.trade_date) : []
  if (rows.length) return rows
  const latest = latestToHistoryRow(props.latest)
  return latest ? [latest] : []
})
const historyRows = computed(() => aggregateMoneyFlowRows(sourceRows.value, props.period, props.klineRows))
const recentRows = computed(() => [...historyRows.value]
  .sort((a, b) => String(b.trade_date || '').localeCompare(String(a.trade_date || '')))
  .slice(0, 10))

const summaryMetrics = computed(() => [
  {
    label: '今日主力净额',
    value: fmtWanAmount(props.summary?.main_net_today ?? props.latest?.net_mf_amount),
    className: valueClass(props.summary?.main_net_today ?? props.latest?.net_mf_amount),
    hint: props.summary?.as_of || props.latest?.trade_date || '',
  },
  {
    label: '5日累计',
    value: fmtWanAmount(props.summary?.main_net_5d),
    className: valueClass(props.summary?.main_net_5d),
  },
  {
    label: '20日累计',
    value: fmtWanAmount(props.summary?.main_net_20d),
    className: valueClass(props.summary?.main_net_20d),
  },
  {
    label: streakLabel(props.summary?.inflow_streak),
    value: streakValue(props.summary?.inflow_streak),
    className: valueClass(props.summary?.inflow_streak),
    hint: props.summary?.sample_count ? `样本 ${props.summary.sample_count} 日` : '',
  },
])

onMounted(async () => {
  await scheduleRender()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (chart) {
    chart.dispose()
    chart = null
  }
})

watch(
  () => historyRows.value,
  () => {
    void scheduleRender()
  },
  { deep: true },
)

function attachResizeObserver() {
  if (resizeObserver || !chartRef.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(() => {
    if (!historyRows.value.length) return
    void renderChart()
  })
  resizeObserver.observe(chartRef.value)
}

async function scheduleRender() {
  await nextTick()
  await waitForPaint()
  await renderChart()
}

async function ensureChart() {
  if (!chartRef.value) return null
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (!chart) {
    chart = echarts.init(chartRef.value, 'dark')
  }
  return chart
}

async function renderChart() {
  attachResizeObserver()
  const instance = await ensureChart()
  if (!instance) return
  if (!historyRows.value.length) {
    instance.clear()
    return
  }
  if (chartRef.value && (chartRef.value.clientWidth < 2 || chartRef.value.clientHeight < 2)) {
    await waitForVisibleSize()
  }
  instance.setOption(
    buildMoneyFlowOption(historyRows.value, {
      fmtAxis,
      fmtWanAmount,
      rollingLabel: periodMeta.value.rollingLabel,
      showRollingLine: periodMeta.value.showRollingLine,
    }),
    true,
  )
  instance.resize()
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

async function waitForVisibleSize() {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    if (!chartRef.value || chartRef.value.clientWidth >= 2) return
  }
}

function fmtAxis(value) {
  const s = String(value || '')
  if (s.length === 8 && /^\d+$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s.slice(0, 10)
}

function latestToHistoryRow(row) {
  if (!row || !row.trade_date) return null
  const elgNet = amountDiff(row.buy_elg_amount, row.sell_elg_amount)
  const lgNet = amountDiff(row.buy_lg_amount, row.sell_lg_amount)
  return {
    trade_date: row.trade_date,
    elg_net: elgNet,
    lg_net: lgNet,
    main_net: (elgNet != null || lgNet != null)
      ? (elgNet || 0) + (lgNet || 0)
      : toNumber(row.net_mf_amount),
    md_net: amountDiff(row.buy_md_amount, row.sell_md_amount),
    sm_net: amountDiff(row.buy_sm_amount, row.sell_sm_amount),
    amount: toNumber(row.amount),
    unit: 'wan_yuan',
  }
}

function aggregateMoneyFlowRows(rows, period, klineRows = []) {
  const sortedRows = [...(rows || [])]
    .filter((row) => row?.trade_date)
    .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
  if (period === '1d') return sortedRows

  const sortedKlines = [...(klineRows || [])]
    .filter((row) => row?.trade_date)
    .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
  if (!sortedRows.length || !sortedKlines.length) return []

  const buckets = []
  let rowIdx = 0
  let previousEnd = ''
  sortedKlines.forEach((kline) => {
    const end = String(kline.trade_date || '')
    const bucketRows = []
    while (rowIdx < sortedRows.length) {
      const tradeDate = String(sortedRows[rowIdx]?.trade_date || '')
      if (tradeDate <= previousEnd) {
        rowIdx += 1
        continue
      }
      if (tradeDate > end) break
      bucketRows.push(sortedRows[rowIdx])
      rowIdx += 1
    }
    if (bucketRows.length) {
      buckets.push(aggregateBucket(bucketRows, end))
    }
    previousEnd = end
  })
  return buckets
}

function aggregateBucket(rows, tradeDate) {
  const fields = ['elg_net', 'lg_net', 'main_net', 'md_net', 'sm_net', 'net_mf_amount', 'amount']
  const result = {
    symbol: rows[rows.length - 1]?.symbol || rows[rows.length - 1]?.ts_code,
    ts_code: rows[rows.length - 1]?.ts_code,
    trade_date: tradeDate,
    period_start: rows[0]?.trade_date,
    sample_count: rows.length,
    unit: 'wan_yuan',
  }
  fields.forEach((field) => {
    const values = rows.map((row) => toNumber(row?.[field])).filter((value) => value != null)
    result[field] = values.length ? values.reduce((sum, value) => sum + value, 0) : null
  })
  return result
}

function amountDiff(buy, sell) {
  const b = toNumber(buy)
  const s = toNumber(sell)
  if (b == null && s == null) return null
  return (b || 0) - (s || 0)
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function fmtWanAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const sign = n > 0 ? '+' : ''
  if (Math.abs(n) >= 10000) return `${sign}${(n / 10000).toFixed(2)}亿`
  return `${sign}${n.toFixed(2)}万`
}

function valueClass(value) {
  const n = Number(value)
  return n > 0 ? 'is-up' : n < 0 ? 'is-down' : ''
}

function streakLabel(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '连续方向'
  return n > 0 ? '连续流入' : '连续流出'
}

function streakValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return '-'
  return `${Math.abs(n)} 天`
}

function periodConfig(period) {
  if (period === '1w') {
    return {
      shortLabel: '周线',
      unitLabel: '周',
      rollingLabel: '5周主力累计',
      showRollingLine: true,
    }
  }
  if (period === '1m') {
    return {
      shortLabel: '月线',
      unitLabel: '月',
      rollingLabel: '5月主力累计',
      showRollingLine: false,
    }
  }
  return {
    shortLabel: '日线',
    unitLabel: '日',
    rollingLabel: '5日主力累计',
    showRollingLine: true,
  }
}
</script>

<style scoped>
.money-flow-panel {
  display: grid;
  gap: 14px;
}

.money-flow-summary {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.money-flow-summary div {
  background: rgba(30, 41, 59, .68);
  border: 1px solid rgba(148, 163, 184, .16);
  border-radius: 14px;
  padding: 14px;
}

.money-flow-summary span,
.money-flow-summary small {
  color: #94a3b8;
  display: block;
  font-size: 12px;
}

.money-flow-summary strong {
  color: #f8fafc;
  display: block;
  font-size: 22px;
  margin: 4px 0;
}

.money-flow-legend {
  align-items: center;
  color: #cbd5e1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
}

.money-flow-legend span {
  align-items: center;
  display: inline-flex;
  gap: 6px;
}

.legend-dot {
  border-radius: 3px;
  display: inline-block;
  height: 10px;
  width: 10px;
}

.legend-line {
  border-radius: 999px;
  display: inline-block;
  height: 3px;
  width: 18px;
}

.legend-elg-up {
  background: #ef4444;
}

.legend-elg-down {
  background: #22c55e;
}

.legend-lg-up {
  background: #fb923c;
}

.legend-lg-down {
  background: #14b8a6;
}

.legend-main {
  background: #60a5fa;
}

.money-flow-chart {
  background: rgba(2, 6, 23, .38);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 14px;
  height: 340px;
  min-height: 340px;
  width: 100%;
}

.money-flow-empty {
  background: rgba(30, 41, 59, .56);
  border-radius: 12px;
  color: #94a3b8;
  padding: 18px;
}

.money-flow-table-wrap {
  margin-top: 10px;
  overflow-x: auto;
}

.money-flow-details {
  background: rgba(15, 23, 42, .36);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 12px;
  padding: 10px 12px;
}

.money-flow-details summary {
  color: #bfdbfe;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.money-flow-table {
  border-collapse: collapse;
  min-width: 760px;
  width: 100%;
}

.money-flow-table th,
.money-flow-table td {
  border-bottom: 1px solid rgba(148, 163, 184, .16);
  color: #cbd5e1;
  font-size: 13px;
  padding: 10px 8px;
  text-align: right;
  white-space: nowrap;
}

.money-flow-table th:first-child,
.money-flow-table td:first-child {
  text-align: left;
}

.money-flow-table th {
  color: #94a3b8;
  font-weight: 600;
}

.is-up {
  color: #ef4444 !important;
}

.is-down {
  color: #22c55e !important;
}
</style>
