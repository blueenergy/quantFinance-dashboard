<template>
  <div class="national-team-panel">
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="panel-title">国家队动向</span>
        <span v-if="snapshot" class="panel-meta">
          基准日 <strong>{{ fmtDate(snapshot.trade_date) }}</strong>
          · 信号时点 <strong>{{ asOfLabel }}</strong>
          · 份额截至 {{ fmtDate(snapshot.share?.date) }}
        </span>
      </div>
      <div class="toolbar-right">
        <span class="toolbar-label">时点</span>
        <button
          v-for="opt in asOfOptions"
          :key="opt.value || 'latest'"
          type="button"
          class="asof-btn"
          :class="{ on: asOf === opt.value }"
          @click="setAsOf(opt.value)"
        >
          {{ opt.label }}
        </button>
        <button type="button" class="refresh-btn" :disabled="loading" @click="refresh">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>
    </div>

    <div v-if="loading && !snapshot" class="loading-state">正在计算国家队 ETF 信号…</div>
    <div v-else-if="error" class="error-state">{{ error }}</div>
    <template v-else-if="snapshot">
      <div class="summary-grid">
        <div class="summary-card level-card" :class="'level-' + snapshot.level">
          <span class="card-label">今日态势</span>
          <strong class="card-value">{{ snapshot.level_label }}</strong>
          <span class="card-sub">
            首次观察 {{ fmtTime(snapshot.first_signal?.watch) }}
            · 首次疑似 {{ fmtTime(snapshot.first_signal?.suspect) }}
          </span>
        </div>
        <div class="summary-card">
          <span class="card-label">池子总量 / 20 日基线</span>
          <strong class="card-value">{{ fmtRatio(snapshot.pool?.ratio) }}</strong>
          <span class="card-sub">
            {{ fmtYi(snapshot.pool?.amount_yuan) }} / {{ fmtYi(snapshot.pool?.baseline_yuan) }}
          </span>
          <span class="card-sub">
            较昨 {{ fmtRatio(snapshot.pool?.prev_day_ratio) }} · 较5日 {{ fmtRatio(snapshot.pool?.avg5_ratio) }}
          </span>
        </div>
        <div class="summary-card">
          <span class="card-label">放量广度</span>
          <strong class="card-value">{{ snapshot.breadth?.ratio2 }} / {{ snapshot.breadth?.pool_size }}</strong>
          <span class="card-sub">≥2.5x：{{ snapshot.breadth?.ratio25 }} 只</span>
        </div>
        <div class="summary-card">
          <span class="card-label">尾盘 14:30–15:00</span>
          <strong class="card-value">{{ fmtPct(snapshot.tail?.share) }}</strong>
          <span class="card-sub">
            基线 {{ fmtPct(snapshot.tail?.baseline) }} · {{ fmtRatio(snapshot.tail?.ratio) }}
          </span>
        </div>
        <div class="summary-card">
          <span class="card-label">份额确认（T+1）</span>
          <strong class="card-value">{{ fmtPct(snapshot.share?.avg_chg_1d) }}</strong>
          <span class="card-sub">5 日 {{ fmtPct(snapshot.share?.avg_chg_5d) }}</span>
        </div>
      </div>

      <div class="index-row">
        <span
          v-for="idx in snapshot.index_moves || []"
          :key="idx.ts_code"
          class="index-chip"
          :class="valueClass(idx.pct_chg)"
        >
          {{ idx.name }} {{ fmtPct(idx.pct_chg) }}
        </span>
        <span class="index-note">指数为日线收盘口径；盘中以 ETF 价格为准</span>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>指数</th>
              <th class="num">现价</th>
              <th class="num">涨跌</th>
              <th class="num">今日成交额</th>
              <th class="num">量比（20日 / 昨 / 5日）</th>
              <th class="num">尾盘占比</th>
              <th class="num">份额日变</th>
              <th class="num">份额 5 日</th>
              <th>信号</th>
              <th>前十名国家队（2025 年报）</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="etf in sortedEtfs"
              :key="etf.ts_code"
              class="etf-row"
              :class="{ selected: etf.ts_code === selectedCode }"
              @click="selectEtf(etf.ts_code)"
            >
              <td><span class="code-link">{{ etf.ts_code }}</span></td>
              <td class="name-cell">{{ etf.name }}</td>
              <td>{{ etf.index }}</td>
              <td class="num">{{ fmtPrice(etf.price) }}</td>
              <td class="num" :class="valueClass(etf.pct_chg)">{{ fmtPct(etf.pct_chg) }}</td>
              <td class="num">{{ fmtYi(etf.amount_yuan) }}</td>
              <td class="num ratio-cell">
                <div class="ratio-main ratio" :class="ratioClass(etf.ratio)">{{ fmtRatio(etf.ratio) }}</div>
                <div class="ratio-sub">昨 {{ fmtRatio(etf.prev_day_ratio) }} · 5日 {{ fmtRatio(etf.avg5_ratio) }}</div>
              </td>
              <td class="num">{{ fmtPct(etf.tail_share) }}</td>
              <td class="num" :class="valueClass(etf.share_chg_1d)">{{ fmtPct(etf.share_chg_1d) }}</td>
              <td class="num" :class="valueClass(etf.share_chg_5d)">{{ fmtPct(etf.share_chg_5d) }}</td>
              <td>
                <span class="signal-badge" :class="'signal-' + etf.signal">{{ etf.signal_label }}</span>
              </td>
              <td class="holder-cell" :title="etf.holder">{{ etf.holder }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="chart-card">
        <div class="chart-header">
          <div>
            <strong>{{ selectedEtf?.name || selectedCode }}</strong>
            <span class="muted">{{ selectedCode }}</span>
          </div>
          <div class="muted">今日累计成交额 vs 20 日基线 · 价格</div>
        </div>
        <div ref="chartRef" class="chart-canvas"></div>
      </div>

      <div class="footnote">
        量比主值 = 今日同一时刻累计成交额 / 过去 20 个交易日同一时刻中位数；下方为较昨日、较 5 日均。
        20 日中位数会被低量日拉低，和同花顺的「今天 / 昨天」不是同一个口径。
        图上浅灰点线为基线 p25 / p75，只作参考，不在图例里。
        尾盘只统计 14:30 之后；份额为 T+1 的基金份额变化；持有人为 2025 年报前十名，不是实时持仓。
        数据源：QMT 1m bars + Tushare fund_share。
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { getNationalTeamCurve, getNationalTeamSnapshot } from '../api/nationalTeam'
import { loadEcharts } from '../utils/echarts/loadEcharts.js'

const asOfOptions = [
  { value: '', label: '最新' },
  { value: '1030', label: '10:30' },
  { value: '1130', label: '11:30' },
  { value: '1400', label: '14:00' },
  { value: '1430', label: '14:30' },
  { value: '1500', label: '15:00' },
]

const loading = ref(false)
const error = ref('')
const snapshot = ref(null)
const curve = ref(null)
const selectedCode = ref('510300.SH')
const asOf = ref('')
const chartRef = ref(null)
let chartInstance = null
let echartsLib = null
let resizeOb = null
let refreshTimer = null

const asOfLabel = computed(() => {
  const hm = asOf.value || snapshot.value?.as_of || ''
  return hm ? `${hm.slice(0, 2)}:${hm.slice(2)}` : '最新'
})

const sortedEtfs = computed(() => {
  const rows = snapshot.value?.etfs || []
  return [...rows].sort((a, b) => (b.ratio || 0) - (a.ratio || 0))
})

const selectedEtf = computed(() => {
  return (snapshot.value?.etfs || []).find((row) => row.ts_code === selectedCode.value) || null
})

function fmtYi(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const yi = Number(value) / 1e8
  return `${yi >= 100 ? yi.toFixed(0) : yi.toFixed(1)} 亿`
}

function fmtPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const num = Number(value)
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`
}

function fmtRatio(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(2)}x`
}

function fmtPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(3)
}

function fmtTime(hm) {
  if (!hm) return '—'
  return `${hm.slice(0, 2)}:${hm.slice(2)}`
}

function fmtDate(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return value || '—'
}

function valueClass(value) {
  if (value == null || Number.isNaN(Number(value))) return ''
  if (Number(value) > 0) return 'up'
  if (Number(value) < 0) return 'down'
  return ''
}

function ratioClass(value) {
  if (value == null) return ''
  if (Number(value) >= 2.5) return 'hot'
  if (Number(value) >= 2.0) return 'warm'
  return ''
}

async function ensureChart() {
  if (!chartRef.value) return null
  if (!echartsLib) echartsLib = await loadEcharts()
  if (!chartInstance) {
    chartInstance = echartsLib.init(chartRef.value)
    resizeOb = new ResizeObserver(() => {
      if (chartInstance) chartInstance.resize()
    })
    resizeOb.observe(chartRef.value)
  }
  return chartInstance
}

function drawChart() {
  if (!chartInstance || !curve.value?.times?.length) return
  const times = curve.value.times
  const today = (curve.value.today_cum || []).map((v) => (v == null ? null : v / 1e8))
  const base = (curve.value.baseline_med || []).map((v) => (v == null ? null : v / 1e8))
  const p25 = (curve.value.baseline_p25 || []).map((v) => (v == null ? null : v / 1e8))
  const p75 = (curve.value.baseline_p75 || []).map((v) => (v == null ? null : v / 1e8))
  const price = curve.value.price || []
  const asOfIdx = asOf.value ? times.indexOf(fmtTime(curve.value.as_of)) : -1

  chartInstance.setOption(
    {
      animation: false,
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const idx = params?.[0]?.dataIndex ?? 0
          const lines = [`<b>${times[idx]}</b>`]
          if (today[idx] != null) lines.push(`今日累计：${today[idx].toFixed(1)} 亿`)
          if (base[idx] != null) lines.push(`20 日基线：${base[idx].toFixed(1)} 亿`)
          if (price[idx] != null) lines.push(`价格：${Number(price[idx]).toFixed(3)}`)
          return lines.join('<br/>')
        },
      },
      legend: {
        top: 0,
        data: ['今日累计', '20 日基线', '价格'],
        textStyle: { color: '#64748b', fontSize: 11 },
      },
      grid: { left: 56, right: 58, top: 36, bottom: 30 },
      xAxis: {
        type: 'category',
        data: times,
        axisLabel: { color: '#64748b', fontSize: 11, interval: 29 },
        axisLine: { lineStyle: { color: '#e2e8f0' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '亿元',
          nameTextStyle: { color: '#64748b', fontSize: 11 },
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f1f5f9' } },
        },
        {
          type: 'value',
          name: '价格',
          scale: true,
          position: 'right',
          nameTextStyle: { color: '#64748b', fontSize: 11 },
          axisLabel: { color: '#64748b', fontSize: 11 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '今日累计',
          type: 'line',
          showSymbol: false,
          data: today,
          itemStyle: { color: '#e53935' },
          lineStyle: { width: 2, color: '#e53935' },
          areaStyle: { color: 'rgba(229, 57, 53, 0.08)' },
          markLine: asOfIdx >= 0
            ? {
                symbol: 'none',
                silent: true,
                lineStyle: { color: '#94a3b8', type: 'dashed' },
                label: { formatter: '信号时点', color: '#64748b', fontSize: 10 },
                data: [{ xAxis: times[asOfIdx] }],
              }
            : undefined,
        },
        {
          name: '20 日基线',
          type: 'line',
          showSymbol: false,
          data: base,
          itemStyle: { color: '#78909c' },
          lineStyle: { width: 1.5, color: '#78909c', type: 'dashed' },
        },
        {
          name: '基线 p25',
          type: 'line',
          showSymbol: false,
          silent: true,
          legendHoverLink: false,
          tooltip: { show: false },
          data: p25,
          itemStyle: { color: '#cbd5e1' },
          lineStyle: { width: 1, color: '#cbd5e1', type: 'dotted' },
        },
        {
          name: '基线 p75',
          type: 'line',
          showSymbol: false,
          silent: true,
          legendHoverLink: false,
          tooltip: { show: false },
          data: p75,
          itemStyle: { color: '#cbd5e1' },
          lineStyle: { width: 1, color: '#cbd5e1', type: 'dotted' },
        },
        {
          name: '价格',
          type: 'line',
          yAxisIndex: 1,
          showSymbol: false,
          data: price,
          itemStyle: { color: '#1e88e5' },
          lineStyle: { width: 1.5, color: '#1e88e5' },
        },
      ],
    },
    true,
  )
}

async function loadCurve() {
  if (!selectedCode.value) return
  const params = { code: selectedCode.value }
  if (asOf.value) params.as_of = asOf.value
  curve.value = await getNationalTeamCurve(params)
  await nextTick()
  await ensureChart()
  drawChart()
}

async function loadSnapshot() {
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (asOf.value) params.as_of = asOf.value
    const data = await getNationalTeamSnapshot(params)
    snapshot.value = data
    const rows = data?.etfs || []
    if (!rows.some((row) => row.ts_code === selectedCode.value)) {
      selectedCode.value = rows[0]?.ts_code || '510300.SH'
    }
    await loadCurve()
  } catch (exc) {
    error.value = exc?.response?.data?.detail || exc?.message || '加载国家队 ETF 信号失败'
  } finally {
    loading.value = false
  }
}

function refresh() {
  loadSnapshot()
}

function setAsOf(value) {
  asOf.value = value
  loadSnapshot()
}

async function selectEtf(code) {
  if (!code || code === selectedCode.value) return
  selectedCode.value = code
  try {
    await loadCurve()
  } catch (exc) {
    error.value = exc?.response?.data?.detail || exc?.message || '加载分时曲线失败'
  }
}

function setupTimer() {
  if (refreshTimer) clearInterval(refreshTimer)
  refreshTimer = setInterval(() => {
    if (!asOf.value) loadSnapshot()
  }, 30000)
}

onMounted(async () => {
  await nextTick()
  await ensureChart()
  await loadSnapshot()
  setupTimer()
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (resizeOb) resizeOb.disconnect()
  if (chartInstance) chartInstance.dispose()
  chartInstance = null
})
</script>

<style scoped>
.national-team-panel {
  --card-bg: #ffffff;
  --border-color: #e2e8f0;
  --text-color: #172033;
  --text-secondary: #64748b;
  --primary-color: #0466c8;
  color: var(--text-color);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
}

.panel-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.toolbar-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.toolbar-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.asof-btn,
.refresh-btn {
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 12px;
  cursor: pointer;
}

.asof-btn.on {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.refresh-btn {
  border-radius: 6px;
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

.refresh-btn:disabled {
  opacity: 0.55;
  cursor: wait;
}

.loading-state,
.error-state {
  padding: 24px;
  text-align: center;
  border-radius: 10px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
}

.error-state {
  color: #b91c1c;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--card-bg);
}

.level-card {
  border-left-width: 4px;
}

.level-high {
  border-left-color: #d32f2f;
}

.level-suspect {
  border-left-color: #f57c00;
}

.level-watch {
  border-left-color: #1976d2;
}

.level-calm {
  border-left-color: #94a3b8;
}

.card-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.card-value {
  font-size: 22px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.card-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.index-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.index-chip {
  padding: 3px 10px;
  border-radius: 999px;
  background: #f1f5f9;
  font-size: 12px;
}

.index-note {
  font-size: 11px;
  color: var(--text-secondary);
}

.table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 1120px;
}

.data-table th,
.data-table td {
  padding: 9px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}

.data-table th {
  background: #f8fafc;
  font-weight: 600;
  white-space: nowrap;
}

.data-table th.num,
.data-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.etf-row {
  cursor: pointer;
}

.etf-row:hover {
  background: rgba(4, 102, 200, 0.05);
}

.etf-row.selected {
  background: rgba(4, 102, 200, 0.1);
}

.code-link {
  color: var(--primary-color);
  font-weight: 600;
}

.name-cell {
  font-weight: 500;
  max-width: 180px;
}

.holder-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
  font-size: 12px;
}

.up {
  color: #d32f2f;
}

.down {
  color: #2e7d32;
}

.ratio-cell {
  min-width: 104px;
}

.ratio-main {
  font-weight: 600;
}

.ratio-sub {
  margin-top: 2px;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.ratio.hot {
  color: #d32f2f;
  font-weight: 700;
}

.ratio.warm {
  color: #f57c00;
  font-weight: 600;
}

.signal-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  white-space: nowrap;
}

.signal-high {
  background: #fee2e2;
  color: #b91c1c;
}

.signal-suspect {
  background: #ffedd5;
  color: #c2410c;
}

.signal-watch {
  background: #dbeafe;
  color: #1d4ed8;
}

.signal-calm {
  background: #f1f5f9;
  color: #64748b;
}

.chart-card {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--card-bg);
}

.chart-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.chart-header .muted {
  margin-left: 8px;
}

.muted {
  color: var(--text-secondary);
  font-size: 12px;
}

.chart-canvas {
  width: 100%;
  height: 340px;
}

.footnote {
  margin-top: 10px;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .chart-canvas {
    height: 280px;
  }
}
</style>
