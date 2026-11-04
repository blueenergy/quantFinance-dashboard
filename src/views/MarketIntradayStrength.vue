<template>
  <div class="intraday-panorama">
    <header class="ip-header">
      <div>
        <h2 class="ip-title">盘中强弱全景</h2>
        <p class="ip-sub">申万 L1 · 2 分钟快照 · 同一时刻跨行业短线分</p>
      </div>
      <div class="ip-header-right">
        <label class="ip-date">
          <span>日期</span>
          <input
            v-model="dateInput"
            type="date"
            :min="dateMin"
            :max="dateMax"
            :disabled="loading"
            @change="onDateChange"
          />
        </label>
        <span v-if="asOf" class="ip-asof">截至 {{ formatAsOf(asOf) }}</span>
        <label class="ip-auto">
          <input v-model="autoRefresh" type="checkbox" />
          自动刷新
        </label>
        <button type="button" class="ip-btn" :disabled="loading" @click="load">
          {{ loading ? '加载中…' : '刷新' }}
        </button>
      </div>
    </header>

    <div v-if="loading && !data" class="ip-state">盘中数据加载中…</div>
    <div v-else-if="error" class="ip-state is-error">{{ error }}</div>
    <div v-else-if="!hasData" class="ip-state">{{ emptyMessage }}</div>
    <template v-else>
      <section class="ip-summary" aria-label="盘中摘要">
        <div class="ip-card ip-score-card" :style="marketScoreStyle">
          <span class="ip-card-label">市场短线分</span>
          <strong class="ip-score-value">{{ marketScoreText }}</strong>
          <span class="ip-card-hint">31 行业横截面均值</span>
        </div>

        <div class="ip-card">
          <span class="ip-card-label">全市场 MA5 阳谱</span>
          <strong class="ip-kpi">{{ formatPctFraction(latestYang5) }}</strong>
          <span class="ip-card-hint">
            上涨 {{ formatCount(summary.up) }} / 下跌 {{ formatCount(summary.down) }} / 平 {{ formatCount(summary.flat) }}
          </span>
        </div>

        <div class="ip-card">
          <span class="ip-card-label">最强</span>
          <ul class="ip-rank-list">
            <li v-for="item in (summary.top || []).slice(0, 3)" :key="item.code">
              <span>{{ item.name }}</span>
              <strong>{{ formatTrendScore(item.score) }}</strong>
            </li>
            <li v-if="!(summary.top || []).length" class="ip-muted">暂无</li>
          </ul>
        </div>

        <div class="ip-card">
          <span class="ip-card-label">最弱</span>
          <ul class="ip-rank-list">
            <li v-for="item in (summary.bottom || []).slice(0, 3)" :key="item.code">
              <span>{{ item.name }}</span>
              <strong>{{ formatTrendScore(item.score) }}</strong>
            </li>
            <li v-if="!(summary.bottom || []).length" class="ip-muted">暂无</li>
          </ul>
        </div>
      </section>

      <section class="ip-rotation" aria-label="强弱切换">
        <div class="ip-rotation-block">
          <span class="ip-rotation-title">09:45 以来弱转强</span>
          <div class="ip-chips">
            <span v-for="item in (summary.weak_to_strong || []).slice(0, 6)" :key="item.code" class="ip-chip is-up">
              {{ item.name }} <em>{{ formatTrendScore(item.from) }}→{{ formatTrendScore(item.to) }}</em>
            </span>
            <span v-if="!(summary.weak_to_strong || []).length" class="ip-muted">暂无</span>
          </div>
        </div>
        <div class="ip-rotation-block">
          <span class="ip-rotation-title">09:45 以来强转弱</span>
          <div class="ip-chips">
            <span v-for="item in (summary.strong_to_weak || []).slice(0, 6)" :key="item.code" class="ip-chip is-down">
              {{ item.name }} <em>{{ formatTrendScore(item.from) }}→{{ formatTrendScore(item.to) }}</em>
            </span>
            <span v-if="!(summary.strong_to_weak || []).length" class="ip-muted">暂无</span>
          </div>
        </div>
      </section>

      <section v-if="hasBreadth" class="ip-panel">
        <div class="ip-panel-head">
          <div>
            <h3>全市场广度</h3>
            <p>MA5 阳谱 {{ formatPctFraction(latestYang5) }} · MA30 阳谱 {{ formatPctFraction(latestYang30) }}</p>
          </div>
          <span class="ip-panel-hint">50% = 一半股票站上均线</span>
        </div>
        <div ref="chartRef" class="ip-chart"></div>
      </section>

      <section class="ip-panel">
        <div class="ip-panel-head">
          <div>
            <h3>行业短线强弱</h3>
            <p>{{ groupLabel }} · 最新 {{ formatAsOf(asOf) }}</p>
          </div>
          <div class="ip-sort">
            <button type="button" :class="{ active: sortMode === 'latest' }" @click="sortMode = 'latest'">按最新分</button>
            <button type="button" :class="{ active: sortMode === 'fixed' }" @click="sortMode = 'fixed'">固定顺序</button>
          </div>
        </div>

        <div class="ip-scroll">
          <table class="ip-table" aria-label="盘中行业短线强弱矩阵">
            <thead>
              <tr class="ip-group-row">
                <th class="ip-time-col" rowspan="2" scope="col">时间</th>
                <th :colspan="visibleSectors.length" class="ip-group-head" scope="colgroup">{{ groupLabel }}</th>
              </tr>
              <tr class="ip-name-row">
                <th
                  v-for="sector in visibleSectors"
                  :key="sector.code"
                  class="ip-name-cell"
                  scope="col"
                  :title="`${sector.name}（${sector.code}）`"
                >{{ sector.name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.time">
                <th class="ip-time-col" scope="row">{{ formatHHMM(row.time) }}</th>
                <td
                  v-for="sector in visibleSectors"
                  :key="sector.code"
                  class="ip-cell"
                  :style="trendCellStyle(sector.scores[row.idx])"
                  :title="cellTitle(sector, row)"
                >{{ formatTrendScore(sector.scores[row.idx]) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <footer class="ip-notes">
        <p><strong>短线分（intraday-v1）：</strong>每个 2 分钟快照上，对 31 个申万 L1 做横截面百分位排名，5 个指标取均值 ×100：上涨家数占比、站上均线占比、相对全市场强弱、平均涨幅、中位涨幅。</p>
        <p><strong>怎么读：</strong>100 = 当前时点最强，0 = 最弱；分数是同一时刻行业之间的相对强弱，不是涨跌幅。红色区域走强、蓝色区域走弱，颜色切换就是盘中轮动。</p>
        <p><strong>边界：</strong>数据源 <code>realtime_sector_strength</code>（QMT 全市场日 K 快照），2 分钟一条，不是逐笔；历史从 2026-08-25 起。仅用于盘中观察，不构成买卖信号。</p>
        <p><strong>刷新：</strong>交易日 09:30–15:00 每 60 秒自动拉取；数据本身约 2 分钟更新一次。</p>
      </footer>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { fetchMarketIntradayStrength } from '../api/marketTrend'
import { formatTrendScore, trendCellStyle } from '../utils/trendHeatmapScale'

const data = ref(null)
const loading = ref(false)
const error = ref('')
const dateInput = ref('')
const autoRefresh = ref(true)
const sortMode = ref('latest')

const chartRef = ref(null)
let echarts = null
let chartInstance = null
let timer = null
let requestId = 0

const asOf = computed(() => data.value?.as_of || '')
const hasData = computed(() => (data.value?.times || []).length > 0)
const emptyMessage = computed(() => data.value?.message || '该日暂无盘中快照')
const summary = computed(() => data.value?.summary || {})
const breadth = computed(() => data.value?.breadth || {})
const hasBreadth = computed(() => (breadth.value.times || []).length > 0)

const dateMin = computed(() => {
  const first = data.value?.available_dates?.[0]
  return first ? formatDateInput(first) : '2026-08-25'
})
const dateMax = computed(() => todayIso())

const rows = computed(() => {
  const times = data.value?.times || []
  return times.map((time, idx) => ({ time, idx })).reverse()
})

const visibleSectors = computed(() => {
  const list = data.value?.sectors || []
  if (sortMode.value === 'fixed') return list
  return [...list].sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1))
})

const groupLabel = computed(() => `申万一级（${visibleSectors.value.length}）`)

const latestYang5 = computed(() => lastNonNull(breadth.value.yang5))
const latestYang30 = computed(() => lastNonNull(breadth.value.yang30))
const marketScoreText = computed(() => formatTrendScore(summary.value.market_score))
const marketScoreStyle = computed(() => trendCellStyle(summary.value.market_score))

function lastNonNull(values) {
  if (!Array.isArray(values)) return null
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] != null) return values[i]
  }
  return null
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatHHMM(raw) {
  const value = String(raw || '')
  if (value.length !== 4) return value
  return `${value.slice(0, 2)}:${value.slice(2, 4)}`
}

function formatAsOf(raw) {
  const value = String(raw || '')
  if (value.length < 12) return value
  return `${value.slice(8, 10)}:${value.slice(10, 12)}`
}

function formatDateInput(raw) {
  const value = String(raw || '')
  if (value.length !== 8) return value
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

function formatPctFraction(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(1)}%`
}

function formatPctValue(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(2)}%`
}

function formatDelta(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  const rounded = Math.round(n * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function formatCount(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN')
}

function cellTitle(sector, row) {
  const i = row.idx
  const score = sector.scores?.[i]
  const head = `${sector.name} ${formatHHMM(row.time)}`
  if (score == null) return `${head}\n暂无评分`
  return [
    head,
    `短线分 ${Math.round(score)}`,
    `30分钟变化 ${formatDelta(sector.chg30m?.[i])}`,
    `上涨占比 ${formatPctFraction(sector.positive_ratio?.[i])}`,
    `站上MA5 ${formatPctFraction(sector.above_ma_ratio?.[i])}`,
    `平均涨幅 ${formatPctValue(sector.avg_pct_chg?.[i])}`,
  ].join('\n')
}

function isTradingTime() {
  const now = new Date()
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  return (minutes >= 570 && minutes <= 690) || (minutes >= 780 && minutes <= 905)
}

function isTodaySelected() {
  return dateInput.value === todayIso()
}

async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const params = {}
    if (dateInput.value) params.date = dateInput.value.replaceAll('-', '')
    const payload = await fetchMarketIntradayStrength(params)
    if (id !== requestId) return
    data.value = payload
    if (!dateInput.value && payload?.date) {
      dateInput.value = formatDateInput(payload.date)
    }
    await nextTick()
    await renderChart()
  } catch (err) {
    if (id !== requestId) return
    error.value = err?.message || '盘中数据加载失败'
  } finally {
    if (id === requestId) loading.value = false
  }
}

function onDateChange() {
  load()
}

function buildChartOption() {
  const times = breadth.value.times || []
  const labels = times.map(formatHHMM)
  const toPct = (values) => (values || []).map((v) => (v == null ? null : Number((v * 100).toFixed(1))))
  return {
    animation: false,
    grid: { left: 44, right: 18, top: 32, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#94a3b8' } },
      valueFormatter: (value) => (value == null ? '—' : `${Number(value).toFixed(1)}%`),
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 14,
      itemHeight: 8,
      textStyle: { color: '#475569', fontSize: 11 },
    },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLabel: { color: '#64748b', fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: '#dbe3ef' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { color: '#64748b', fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#eef2f7' } },
    },
    series: [
      {
        name: 'MA5 阳谱',
        type: 'line',
        data: toPct(breadth.value.yang5),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#256abf' },
        areaStyle: { color: 'rgba(37,106,191,0.10)' },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: '#94a3b8', type: 'dashed', width: 1 },
          data: [{ yAxis: 50 }],
        },
      },
      {
        name: 'MA30 阳谱',
        type: 'line',
        data: toPct(breadth.value.yang30),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#e98282', type: 'dashed' },
      },
    ],
  }
}

async function renderChart() {
  const el = chartRef.value
  if (!el || !hasBreadth.value) {
    if (chartInstance) {
      chartInstance.dispose()
      chartInstance = null
      window.removeEventListener('resize', handleResize)
    }
    return
  }
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (!chartInstance) {
    chartInstance = echarts.init(el)
    window.addEventListener('resize', handleResize)
  }
  chartInstance.setOption(buildChartOption(), true)
}

function handleResize() {
  chartInstance?.resize()
}

function startTimer() {
  stopTimer()
  timer = window.setInterval(() => {
    if (!autoRefresh.value || !isTodaySelected() || !isTradingTime()) return
    load()
  }, 60_000)
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  load()
  startTimer()
})

onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('resize', handleResize)
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.intraday-panorama {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  color: var(--text-primary, #172033);
}

.ip-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.ip-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.ip-sub {
  margin: 4px 0 0;
  color: var(--text-muted, #64748b);
  font-size: 13px;
}

.ip-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ip-date,
.ip-auto {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-subtle, #475569);
  font-size: 12px;
}

.ip-date input {
  border: 1px solid var(--surface-border, #dbe3ef);
  border-radius: 7px;
  padding: 5px 7px;
  font-size: 12px;
  color: var(--text-primary, #172033);
  background: #fff;
}

.ip-asof {
  color: var(--text-subtle, #475569);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.ip-btn {
  border: 1px solid var(--surface-border, #dbe3ef);
  background: #fff;
  color: var(--text-primary, #172033);
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
}

.ip-btn:disabled {
  cursor: default;
  opacity: 0.6;
}

.ip-state {
  padding: 32px 12px;
  text-align: center;
  color: var(--text-muted, #64748b);
  border: 1px dashed var(--surface-border, #dbe3ef);
  border-radius: 10px;
}

.ip-state.is-error {
  color: #b42318;
  border-color: #fda29b;
  background: #fff7f6;
}

.ip-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.ip-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 78px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--surface-border, #dbe3ef);
  border-radius: 10px;
}

.ip-score-card {
  border-width: 0;
}

.ip-card-label {
  font-size: 11px;
  color: inherit;
  opacity: 0.82;
}

.ip-score-value {
  font-size: 24px;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.ip-kpi {
  font-size: 22px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.ip-card-hint {
  font-size: 11px;
  color: inherit;
  opacity: 0.72;
}

.ip-rank-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
}

.ip-rank-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.ip-rank-list strong {
  font-variant-numeric: tabular-nums;
}

.ip-muted {
  color: var(--text-muted, #64748b);
  font-size: 12px;
}

.ip-rotation {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.ip-rotation-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--surface-bg-muted, #f9fafb);
  border: 1px solid var(--surface-border, #dbe3ef);
  border-radius: 10px;
}

.ip-rotation-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-subtle, #475569);
}

.ip-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ip-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid transparent;
}

.ip-chip em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
  opacity: 0.82;
}

.ip-chip.is-up {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #9f1239;
}

.ip-chip.is-down {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #184f95;
}

.ip-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--surface-border, #dbe3ef);
  border-radius: 10px;
}

.ip-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.ip-panel-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.ip-panel-head p {
  margin: 3px 0 0;
  color: var(--text-muted, #64748b);
  font-size: 12px;
}

.ip-panel-hint {
  color: var(--text-muted, #64748b);
  font-size: 11px;
}

.ip-sort {
  display: inline-flex;
  gap: 6px;
}

.ip-sort button {
  border: 1px solid var(--surface-border, #dbe3ef);
  background: #fff;
  color: var(--text-subtle, #475569);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.ip-sort button.active {
  border-color: #256abf;
  background: #e9f1fc;
  color: #184f95;
  font-weight: 600;
}

.ip-chart {
  width: 100%;
  height: 180px;
}

.ip-scroll {
  overflow: auto;
  max-height: calc(100vh - 520px);
  min-height: 220px;
  border: 1px solid var(--surface-border, #dbe3ef);
  border-radius: 8px;
}

.ip-table {
  border-collapse: separate;
  border-spacing: 2px;
  width: max-content;
  min-width: 100%;
  font-variant-numeric: tabular-nums;
}

.ip-table th,
.ip-table td {
  box-sizing: border-box;
}

.ip-group-row th {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #fff;
  color: var(--text-muted, #64748b);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  padding: 4px 0;
  border-bottom: 1px solid var(--surface-border, #dbe3ef);
}

.ip-name-row th {
  position: sticky;
  top: 26px;
  z-index: 3;
  background: #fff;
  color: var(--text-primary, #172033);
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  padding: 4px 3px;
  min-width: 52px;
  max-width: 68px;
  line-height: 1.2;
  vertical-align: bottom;
}

.ip-time-col {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 4;
  background: #fff;
  color: var(--text-subtle, #475569);
  font-size: 11px;
  font-weight: 500;
  text-align: right;
  padding: 0 8px;
  min-width: 54px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

thead .ip-time-col {
  z-index: 5;
  text-align: left;
  vertical-align: middle;
}

.ip-cell {
  height: 26px;
  min-width: 52px;
  padding: 0 3px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  cursor: default;
}

tbody tr:hover .ip-cell {
  box-shadow: inset 0 0 0 2px #172033;
}

.ip-notes {
  margin: 0;
  padding: 12px 14px;
  border-left: 3px solid #256abf;
  background: var(--surface-bg-muted, #f9fafb);
  border-radius: 0 8px 8px 0;
  color: var(--text-subtle, #475569);
  font-size: 12px;
  line-height: 1.7;
}

.ip-notes p {
  margin: 0 0 4px;
}

.ip-notes p:last-child {
  margin-bottom: 0;
}

.ip-notes code {
  background: #eef2f7;
  border-radius: 4px;
  padding: 0 4px;
  font-size: 11px;
}

@media (max-width: 720px) {
  .intraday-panorama {
    padding: 10px;
  }

  .ip-rotation {
    grid-template-columns: minmax(0, 1fr);
  }

  .ip-scroll {
    max-height: calc(100vh - 460px);
  }

  .ip-cell {
    min-width: 46px;
    height: 24px;
  }

  .ip-name-row th {
    min-width: 46px;
    font-size: 10px;
  }
}
</style>
