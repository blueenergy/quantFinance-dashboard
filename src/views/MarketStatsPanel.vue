<template>
  <v-container fluid class="market-stats-panel pa-4">
    <div class="mrp-paper">
      <v-row class="mb-4">
        <v-col cols="12" md="8">
          <h1 class="mrp-h1">📉 市场统计</h1>
          <p class="mrp-sub">两融余额 · 指数市盈率 — 后续可在此页继续加图</p>
        </v-col>
        <v-col cols="12" md="4" class="d-flex align-center justify-end gap-2 flex-wrap">
          <div class="range-toggle">
            <button
              v-for="opt in rangeOptions"
              :key="opt.days"
              type="button"
              class="range-btn"
              :class="{ active: days === opt.days }"
              @click="setDays(opt.days)"
            >
              {{ opt.label }}
            </button>
          </div>
          <button class="mrp-btn-sm mrp-btn-ghost" :disabled="loading" @click="loadOverview">↻ 刷新</button>
        </v-col>
      </v-row>

      <div v-if="errorMsg" class="xiv-error-bar mb-3">
        {{ errorMsg }}
        <button type="button" class="xiv-error-dismiss" aria-label="关闭" @click="errorMsg = ''">×</button>
      </div>

      <v-row>
        <v-col cols="12" md="6">
          <article class="stat-card">
            <header class="stat-card-head">
              <div>
                <h2>两融余额总量</h2>
                <p class="mrp-caption">沪深合计融资融券余额（亿元）</p>
              </div>
              <div class="stat-latest">
                <strong>{{ fmtYi(marginLatest?.rzrqye) }}</strong>
                <span>{{ fmtDate(marginLatest?.trade_date) }}</span>
              </div>
            </header>
            <div v-if="loading && !overview" class="stat-empty">加载中…</div>
            <template v-else>
              <div v-if="!marginSeries.length" class="stat-empty">暂无两融数据，需先跑 margin_sync</div>
              <div v-show="marginSeries.length" ref="marginTotalRef" class="stat-chart"></div>
            </template>
          </article>
        </v-col>
        <v-col cols="12" md="6">
          <article class="stat-card">
            <header class="stat-card-head">
              <div>
                <h2>两融余额 30 日增量</h2>
                <p class="mrp-caption">相对 30 个交易日前（亿元）</p>
              </div>
              <div class="stat-latest" :class="deltaClass(marginLatest?.delta_30d)">
                <strong>{{ fmtYiDelta(marginLatest?.delta_30d) }}</strong>
                <span>{{ fmtDate(marginLatest?.trade_date) }}</span>
              </div>
            </header>
            <div v-if="loading && !overview" class="stat-empty">加载中…</div>
            <template v-else>
              <div v-if="!marginDeltaSeries.length" class="stat-empty">增量需至少 30 个交易日样本</div>
              <div v-show="marginDeltaSeries.length" ref="marginDeltaRef" class="stat-chart"></div>
            </template>
          </article>
        </v-col>
        <v-col cols="12">
          <article class="stat-card">
            <header class="stat-card-head">
              <div>
                <h2>{{ peTitle }}</h2>
                <p class="mrp-caption">{{ peCaption }}</p>
                <div v-if="availableIndices.length > 1" class="index-toggle">
                  <button
                    v-for="idx in availableIndices"
                    :key="idx.ts_code"
                    type="button"
                    class="range-btn"
                    :class="{ active: peIndex === idx.ts_code }"
                    @click="setPeIndex(idx.ts_code)"
                  >
                    {{ idx.name }}
                  </button>
                </div>
              </div>
              <div class="stat-latest">
                <strong>{{ fmtPe(peLatest?.pe_ttm) }}</strong>
                <span>{{ fmtDate(peLatest?.trade_date) }}</span>
              </div>
            </header>
            <div v-if="loading && !overview" class="stat-empty">加载中…</div>
            <template v-else>
              <div v-if="!peSeries.length" class="stat-empty">暂无市盈率。全A需先跑 market_pe_aggregate；上证 / 沪深300 / 创业板来自 index_dailybasic。</div>
              <div v-show="peSeries.length" ref="peChartRef" class="stat-chart stat-chart-wide"></div>
            </template>
          </article>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getMarketStatsOverview } from '../api/marketStats.js'

const rangeOptions = [
  { label: '1年', days: 250 },
  { label: '3年', days: 750 },
  { label: '5年', days: 1250 },
]

const days = ref(750)
const peIndex = ref('')
const loading = ref(false)
const errorMsg = ref('')
const overview = ref(null)

const marginTotalRef = ref(null)
const marginDeltaRef = ref(null)
const peChartRef = ref(null)

let echartsMod = null
let marginTotalChart = null
let marginDeltaChart = null
let peChart = null
const resizeObservers = []

const marginSeries = computed(() => overview.value?.margin?.series || [])
const marginLatest = computed(() => overview.value?.margin?.latest || null)
const marginDeltaSeries = computed(() => marginSeries.value.filter((row) => row.delta_30d != null))
const peSeries = computed(() => overview.value?.pe?.series || [])
const peLatest = computed(() => overview.value?.pe?.latest || null)
const availableIndices = computed(() => overview.value?.pe?.available_indices || [])
const peTitle = computed(() => {
  const name = overview.value?.pe?.index_name
  return name ? `${name}市盈率` : '指数市盈率'
})
const peCaption = computed(() => {
  if (overview.value?.pe?.index_code === 'ALLA.WI') {
    const used = peLatest.value?.n_used
    const extra = used != null ? ` · 纳入 ${used} 只盈利股` : ''
    return `沪深A股盈利公司总市值/净利润TTM，剔除亏损与北交所${extra}。不是中证全指。`
  }
  return '市盈率 TTM · 数据来自指数估值指标'
})

function fmtDate(value) {
  if (!value) return '—'
  const text = String(value)
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  return text
}

function fmtPe(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return Number(value).toFixed(2)
}

function fmtYi(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${(Number(value) / 1e8).toFixed(0)} 亿`
}

function fmtYiDelta(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const yi = Number(value) / 1e8
  const sign = yi > 0 ? '+' : ''
  return `${sign}${yi.toFixed(0)} 亿`
}

function deltaClass(value) {
  if (value == null) return ''
  if (Number(value) > 0) return 'is-up'
  if (Number(value) < 0) return 'is-down'
  return ''
}

function chartDates(rows) {
  return rows.map((row) => fmtDate(row.trade_date))
}

async function ensureEcharts() {
  if (!echartsMod) {
    echartsMod = await import('echarts')
  }
  return echartsMod
}

function bindChart(el) {
  if (!el || !echartsMod) return null
  const chart = echartsMod.init(el, null, { renderer: 'canvas' })
  if (window.ResizeObserver) {
    const obs = new ResizeObserver(() => chart.resize())
    obs.observe(el)
    resizeObservers.push(obs)
  }
  return chart
}

function lineOption({ dates, values, color, area, yFormatter, markZero }) {
  return {
    animation: false,
    grid: { top: 24, left: 52, right: 16, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#d9e1ee',
      textStyle: { color: '#172033', fontSize: 12 },
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#c8d2e2' } },
      axisLabel: { color: '#667085', fontSize: 11, interval: Math.max(Math.floor(dates.length / 6), 0) },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLine: { show: false },
      axisLabel: { color: '#667085', fontSize: 11, formatter: yFormatter },
      splitLine: { lineStyle: { color: '#edf1f7' } },
    },
    series: [
      {
        type: 'line',
        showSymbol: false,
        data: values,
        lineStyle: { width: 2, color },
        areaStyle: area
          ? {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${color}2e` },
                  { offset: 1, color: `${color}05` },
                ],
              },
            }
          : undefined,
        markLine: markZero
          ? {
              symbol: 'none',
              silent: true,
              lineStyle: { color: '#98a2b3', type: 'dashed', width: 1 },
              data: [{ yAxis: 0, label: { formatter: '0', color: '#667085', fontSize: 11 } }],
            }
          : undefined,
      },
    ],
  }
}

async function renderCharts() {
  await ensureEcharts()
  await nextTick()

  if (marginSeries.value.length && marginTotalRef.value) {
    if (!marginTotalChart) marginTotalChart = bindChart(marginTotalRef.value)
    marginTotalChart?.setOption(
      lineOption({
        dates: chartDates(marginSeries.value),
        values: marginSeries.value.map((row) => (row.rzrqye == null ? null : Number(row.rzrqye) / 1e8)),
        color: '#2563eb',
        area: true,
        yFormatter: (v) => `${Number(v).toFixed(0)}`,
      }),
      true,
    )
    marginTotalChart?.resize()
  }

  if (marginDeltaSeries.value.length && marginDeltaRef.value) {
    if (!marginDeltaChart) marginDeltaChart = bindChart(marginDeltaRef.value)
    marginDeltaChart?.setOption(
      lineOption({
        dates: chartDates(marginDeltaSeries.value),
        values: marginDeltaSeries.value.map((row) => (row.delta_30d == null ? null : Number(row.delta_30d) / 1e8)),
        color: '#d97706',
        area: true,
        yFormatter: (v) => `${Number(v).toFixed(0)}`,
        markZero: true,
      }),
      true,
    )
    marginDeltaChart?.resize()
  }

  if (peSeries.value.length && peChartRef.value) {
    if (!peChart) peChart = bindChart(peChartRef.value)
    peChart?.setOption(
      lineOption({
        dates: chartDates(peSeries.value),
        values: peSeries.value.map((row) => (row.pe_ttm == null ? null : Number(row.pe_ttm))),
        color: '#7c3aed',
        area: true,
        yFormatter: (v) => Number(v).toFixed(1),
      }),
      true,
    )
    peChart?.resize()
  }
}

async function loadOverview() {
  loading.value = true
  errorMsg.value = ''
  try {
    const body = await getMarketStatsOverview({
      days: days.value,
      peIndex: peIndex.value || undefined,
    })
    overview.value = body || {
      pe: { series: [], latest: null, available_indices: [] },
      margin: { series: [], latest: null },
    }
    const chosen = overview.value?.pe?.index_code
    if (chosen && !peIndex.value) peIndex.value = chosen
    await renderCharts()
  } catch (err) {
    errorMsg.value = err?.message || '市场统计加载失败'
  } finally {
    loading.value = false
  }
}

async function setDays(nextDays) {
  if (days.value === nextDays) return
  days.value = nextDays
  await loadOverview()
}

async function setPeIndex(code) {
  if (peIndex.value === code) return
  peIndex.value = code
  await loadOverview()
}

watch([marginSeries, peSeries], () => {
  nextTick(renderCharts)
})

onMounted(loadOverview)

onBeforeUnmount(() => {
  resizeObservers.forEach((obs) => obs.disconnect())
  marginTotalChart?.dispose()
  marginDeltaChart?.dispose()
  peChart?.dispose()
})
</script>

<style scoped>
.market-stats-panel {
  min-height: 100vh;
  background: #f5f5f5;
}
.mrp-paper {
  background: #ffffff;
  color: #111111;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px 24px;
}
.mrp-h1 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 4px;
}
.mrp-sub,
.mrp-caption {
  color: #667085;
  font-size: 13px;
  margin: 0;
}
.mrp-btn-sm {
  border: 1px solid #d0d5dd;
  background: #fff;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  cursor: pointer;
}
.mrp-btn-sm:disabled {
  opacity: 0.55;
  cursor: default;
}
.range-toggle,
.index-toggle {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.index-toggle {
  margin-top: 8px;
}
.range-btn {
  border: 1px solid #d0d5dd;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: #344054;
}
.range-btn.active {
  background: #111;
  color: #fff;
  border-color: #111;
}
.xiv-error-bar {
  background: #fef3f2;
  color: #b42318;
  border: 1px solid #fecdca;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.xiv-error-dismiss {
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
}
.stat-card {
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  padding: 16px;
  background: #fff;
  min-height: 280px;
}
.stat-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.stat-card-head h2 {
  margin: 0 0 4px;
  font-size: 16px;
}
.stat-latest {
  text-align: right;
}
.stat-latest strong {
  display: block;
  font-size: 22px;
  line-height: 1.2;
}
.stat-latest span {
  color: #667085;
  font-size: 12px;
}
.stat-latest.is-up strong {
  color: #b42318;
}
.stat-latest.is-down strong {
  color: #027a48;
}
.stat-empty {
  color: #667085;
  font-size: 13px;
  padding: 48px 8px;
  text-align: center;
}
.stat-chart {
  width: 100%;
  height: 260px;
}
.stat-chart-wide {
  height: 320px;
}
</style>
