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
          <button class="mrp-btn-sm mrp-btn-ghost" :disabled="loading || penLoading" @click="refreshAll">↻ 刷新</button>
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
                <p class="mrp-caption">沪深北合计融资融券余额（亿元）</p>
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
                <h2>两融每日增量</h2>
                <p class="mrp-caption">当日相对前一交易日（亿元，最近 {{ marginDailySeries.length }} 个交易日）</p>
              </div>
              <div class="stat-latest" :class="deltaClass(latestDailyDelta)">
                <strong>{{ fmtYiDelta(latestDailyDelta) }}</strong>
                <span>{{ fmtDate(marginLatest?.trade_date) }}</span>
              </div>
            </header>
            <div v-if="loading && !overview" class="stat-empty">加载中…</div>
            <template v-else>
              <div v-if="!marginDailySeries.length" class="stat-empty">至少需要 2 个交易日样本</div>
              <div v-show="marginDailySeries.length" ref="marginDailyRef" class="stat-chart"></div>
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
        <v-col cols="12">
          <article class="stat-card">
            <header class="stat-card-head">
              <div>
                <h2>头部宽基 ETF 渗透率</h2>
                <p class="mrp-caption">
                  头部 ETF 合计规模 / 指数流通市值；两边同乘指数点位，曲线≈份额申赎
                </p>
                <div v-if="penetrationIndices.length > 1" class="index-toggle">
                  <button
                    v-for="idx in penetrationIndices"
                    :key="idx.key"
                    type="button"
                    class="range-btn"
                    :class="{ active: penIndex === idx.key }"
                    @click="setPenIndex(idx.key)"
                  >
                    {{ idx.name }}
                  </button>
                </div>
              </div>
              <div class="stat-latest">
                <strong>{{ fmtPct(penLatest?.ratio_pct) }}</strong>
                <span>份额截至 {{ fmtDate(penLatest?.trade_date) }}</span>
              </div>
            </header>
            <div class="pen-toolbar">
              <span class="mrp-caption">
                {{ penPoolLabel }}
                <template v-if="penCoverage?.first_full_date">
                  · 头部池全部成立后起 {{ fmtDate(penCoverage.first_full_date) }}
                </template>
              </span>
              <div class="pen-controls">
                <button
                  type="button"
                  class="range-btn"
                  :class="{ active: penShowIndex }"
                  @click="togglePenShowIndex"
                >
                  指数走势
                </button>
                <div class="range-toggle">
                  <button
                    v-for="opt in penRangeOptions"
                    :key="opt.days"
                    type="button"
                    class="range-btn"
                    :class="{ active: penDays === opt.days }"
                    @click="setPenDays(opt.days)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>
            <div v-if="penError" class="xiv-error-bar mb-3">{{ penError }}</div>
            <div v-if="penLoading && !penData" class="stat-empty">加载中…</div>
            <template v-else>
              <div v-if="!penSeries.length" class="stat-empty">
                暂无数据：需先同步 index_daily_basic 的 float_mv 与 ETF 份额。
              </div>
              <div
                v-show="penSeries.length"
                ref="penetrationRef"
                class="stat-chart"
                :class="penShowIndex ? 'stat-chart-tall' : 'stat-chart-wide'"
              ></div>
            </template>
          </article>
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { getEtfPenetration, getMarketStatsOverview } from '../api/marketStats.js'

const rangeOptions = [
  { label: '3月', days: 60 },
  { label: '6月', days: 120 },
  { label: '1年', days: 250 },
  { label: '3年', days: 750 },
  { label: '5年', days: 1250 },
]

const days = ref(60)
const peIndex = ref('')
const loading = ref(false)
const errorMsg = ref('')
const overview = ref(null)

// 头部宽基 ETF 渗透率：独立于页面顶部公共区间，自带更长的历史窗口。
const penRangeOptions = [
  { label: '5年', days: 1250 },
  { label: '10年', days: 2500 },
  { label: '全部', days: 0 },
]
const penIndex = ref('hs300')
const penDays = ref(2500)
const penShowIndex = ref(true)
const penLoading = ref(false)
const penError = ref('')
const penData = ref(null)

const marginTotalRef = ref(null)
const marginDeltaRef = ref(null)
const marginDailyRef = ref(null)
const peChartRef = ref(null)
const penetrationRef = ref(null)

let echartsMod = null
let marginTotalChart = null
let marginDeltaChart = null
let marginDailyChart = null
let peChart = null
let penetrationChart = null
const resizeObservers = []

const MARGIN_DAILY_DAYS = 60

const marginSeries = computed(() => overview.value?.margin?.series || [])
const marginLatest = computed(() => overview.value?.margin?.latest || null)
const marginDeltaSeries = computed(() => marginSeries.value.filter((row) => row.delta_30d != null))
const marginDailySeries = computed(() => {
  const rows = marginSeries.value
  if (rows.length < 2) return []
  const start = Math.max(1, rows.length - MARGIN_DAILY_DAYS)
  const out = []
  for (let i = start; i < rows.length; i += 1) {
    const cur = rows[i]
    const prev = rows[i - 1]
    const delta = cur?.rzrqye != null && prev?.rzrqye != null
      ? Number(cur.rzrqye) - Number(prev.rzrqye)
      : null
    out.push({ trade_date: cur.trade_date, delta_1d: delta })
  }
  return out
})
const latestDailyDelta = computed(() => {
  const rows = marginDailySeries.value
  return rows.length ? rows[rows.length - 1].delta_1d : null
})
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

const penSeries = computed(() => penData.value?.series || [])
const penLatest = computed(() => penData.value?.latest || null)
const penCoverage = computed(() => penData.value?.coverage || null)
const penetrationIndices = computed(() => penData.value?.available_indices || [])
const penPoolLabel = computed(() => {
  const funds = penData.value?.index?.funds || []
  if (!funds.length) return '头部池加载中'
  return `头部池 ${funds.map((fund) => fund.ts_code).join(' / ')}`
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

function fmtPct(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(2)}%`
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
  const lastValue = values.length ? values[values.length - 1] : null
  return {
    animation: false,
    grid: { top: 24, left: 52, right: 36, bottom: 28 },
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
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        interval: Math.max(Math.floor(dates.length / 6), 0),
        // 间隔采样会省掉最右端的日期，导致最新点看起来停在上一交易日
        showMaxLabel: true,
        showMinLabel: true,
      },
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
        // 750 个点 + showSymbol:false 时最后一个点几乎看不出来；显式标出最新点
        markPoint: lastValue == null
          ? undefined
          : {
              symbol: 'circle',
              symbolSize: 7,
              itemStyle: { color },
              label: {
                show: true,
                position: 'left',
                formatter: yFormatter(lastValue),
                color,
                fontSize: 11,
                fontWeight: 600,
              },
              data: [{ xAxis: dates[dates.length - 1], yAxis: lastValue }],
            },
      },
    ],
  }
}

function barOption({ dates, values, yFormatter }) {
  return {
    animation: false,
    grid: { top: 24, left: 52, right: 20, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#d9e1ee',
      textStyle: { color: '#172033', fontSize: 12 },
      valueFormatter: yFormatter,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: '#c8d2e2' } },
      axisLabel: {
        color: '#667085',
        fontSize: 11,
        interval: Math.max(Math.floor(dates.length / 6), 0),
        showMaxLabel: true,
        showMinLabel: true,
      },
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
        type: 'bar',
        barMaxWidth: 10,
        data: values.map((value) => ({
          value,
          itemStyle: { color: value == null ? '#cbd5e1' : value >= 0 ? '#dc2626' : '#16a34a' },
        })),
      },
    ],
  }
}

function fmtYiAmt(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(1)} 亿`
}

function fmtCapWanYi(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `${(Number(value) / 1e4).toFixed(2)} 万亿`
}

function penetrationOption({ dates, values, indexValues, rows, showIndex, indexName }) {
  const lastRow = rows.length ? rows[rows.length - 1] : null
  const xLabel = {
    color: '#667085',
    fontSize: 11,
    interval: Math.max(Math.floor(dates.length / 6), 0),
    showMaxLabel: true,
    showMinLabel: true,
  }
  const xAxis = showIndex
    ? [
        {
          type: 'category',
          gridIndex: 0,
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#c8d2e2' } },
          axisTick: { show: false },
          axisLabel: { show: false },
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#c8d2e2' } },
          axisTick: { show: false },
          axisLabel: xLabel,
        },
      ]
    : [
        {
          type: 'category',
          data: dates,
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#c8d2e2' } },
          axisLabel: xLabel,
        },
      ]
  const ratioAxis = {
    type: 'value',
    scale: true,
    axisLine: { show: false },
    axisLabel: { color: '#667085', fontSize: 11, formatter: (v) => `${Number(v).toFixed(2)}%` },
    splitLine: { lineStyle: { color: '#edf1f7' } },
  }
  const yAxis = showIndex
    ? [
        { ...ratioAxis, gridIndex: 0 },
        {
          type: 'value',
          gridIndex: 1,
          scale: true,
          name: indexName,
          nameTextStyle: { color: '#98a2b3', fontSize: 11, align: 'left' },
          axisLine: { show: false },
          axisLabel: { color: '#98a2b3', fontSize: 11, formatter: (v) => Number(v).toFixed(0) },
          splitLine: { lineStyle: { color: '#f2f4f7' } },
        },
      ]
    : [ratioAxis]
  const ratioSeries = {
    name: '渗透率',
    type: 'line',
    xAxisIndex: 0,
    yAxisIndex: 0,
    showSymbol: false,
    data: values,
    lineStyle: { width: 2, color: '#0f766e' },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: '#0f766e2e' },
          { offset: 1, color: '#0f766e05' },
        ],
      },
    },
    markPoint: lastRow
      ? {
          symbol: 'circle',
          symbolSize: 7,
          itemStyle: { color: '#0f766e' },
          label: {
            show: true,
            position: 'left',
            formatter: `${Number(lastRow.ratio_pct).toFixed(2)}%`,
            color: '#0f766e',
            fontSize: 11,
            fontWeight: 600,
          },
          data: [{ xAxis: dates[dates.length - 1], yAxis: values[values.length - 1] }],
        }
      : undefined,
  }
  const indexSeries = {
    name: indexName,
    type: 'line',
    xAxisIndex: showIndex ? 1 : 0,
    yAxisIndex: showIndex ? 1 : 0,
    showSymbol: false,
    data: indexValues,
    lineStyle: { width: 1.5, color: '#94a3b8' },
  }
  return {
    animation: false,
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: showIndex
      ? [
          { left: 56, right: 40, top: 16, height: '50%' },
          { left: 56, right: 40, top: '68%', bottom: 26 },
        ]
      : [{ left: 56, right: 40, top: 24, bottom: 28 }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: '#d9e1ee',
      textStyle: { color: '#172033', fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: '#c8d2e2' } },
      formatter: (items) => {
        if (!items?.length) return ''
        const idx = items[0].dataIndex
        const row = rows[idx]
        if (!row) return ''
        const lines = [
          `<div style="font-weight:600">${fmtDate(row.trade_date)}</div>`,
          `占比 <b>${Number(row.ratio_pct).toFixed(2)}%</b>`,
          `头部 ETF 规模 ${fmtYiAmt(row.aum_yi)}`,
          `指数流通市值 ${fmtCapWanYi(row.float_mv_yi)}`,
        ]
        if (row.index_close != null) {
          const prev = idx >= 20 ? rows[idx - 20] : null
          const chg = prev && prev.index_close != null
            ? (Number(row.index_close) / Number(prev.index_close) - 1) * 100
            : null
          const chgText = chg == null ? '' : `（20日 ${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%）`
          lines.push(`${indexName} ${Number(row.index_close).toFixed(2)}${chgText}`)
        }
        lines.push(`覆盖 ${row.n_funds} 只头部 ETF`)
        return lines.join('<br/>')
      },
    },
    xAxis,
    yAxis,
    series: showIndex ? [ratioSeries, indexSeries] : [ratioSeries],
  }
}

async function renderPenetration() {
  if (!penSeries.value.length || !penetrationRef.value) return
  await ensureEcharts()
  await nextTick()
  if (!penetrationChart) penetrationChart = bindChart(penetrationRef.value)
  penetrationChart?.setOption(
    penetrationOption({
      dates: chartDates(penSeries.value),
      values: penSeries.value.map((row) => (row.ratio_pct == null ? null : Number(row.ratio_pct))),
      indexValues: penSeries.value.map((row) => (row.index_close == null ? null : Number(row.index_close))),
      rows: penSeries.value,
      showIndex: penShowIndex.value,
      indexName: penData.value?.index?.name || '指数',
    }),
    true,
  )
  penetrationChart?.resize()
}

async function loadPenetration() {
  penLoading.value = true
  penError.value = ''
  try {
    const body = await getEtfPenetration({ index: penIndex.value, days: penDays.value })
    penData.value = body || { series: [], latest: null, coverage: null, available_indices: [] }
    await renderPenetration()
  } catch (err) {
    penError.value = err?.message || '头部 ETF 渗透率加载失败'
  } finally {
    penLoading.value = false
  }
}

async function setPenIndex(key) {
  if (penIndex.value === key) return
  penIndex.value = key
  await loadPenetration()
}

async function setPenDays(nextDays) {
  if (penDays.value === nextDays) return
  penDays.value = nextDays
  await loadPenetration()
}

async function togglePenShowIndex() {
  penShowIndex.value = !penShowIndex.value
  await nextTick()
  penetrationChart?.resize()
  await renderPenetration()
}

async function refreshAll() {
  await Promise.all([loadOverview(), loadPenetration()])
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

  if (marginDailySeries.value.length && marginDailyRef.value) {
    if (!marginDailyChart) marginDailyChart = bindChart(marginDailyRef.value)
    marginDailyChart?.setOption(
      barOption({
        dates: chartDates(marginDailySeries.value),
        values: marginDailySeries.value.map((row) => (row.delta_1d == null ? null : Number(row.delta_1d) / 1e8)),
        yFormatter: (v) => `${Number(v).toFixed(0)}`,
      }),
      true,
    )
    marginDailyChart?.resize()
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

onMounted(() => {
  loadOverview()
  loadPenetration()
})

onBeforeUnmount(() => {
  resizeObservers.forEach((obs) => obs.disconnect())
  marginTotalChart?.dispose()
  marginDeltaChart?.dispose()
  marginDailyChart?.dispose()
  peChart?.dispose()
  penetrationChart?.dispose()
})
</script>

<style scoped>
.market-stats-panel {
  padding: 0 !important;
  background: var(--surface-bg-muted);
}
.mrp-paper {
  background: var(--surface-bg);
  color: #111111;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
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
.pen-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin: 10px 0 4px;
}
.pen-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.stat-chart-tall {
  height: 430px;
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
