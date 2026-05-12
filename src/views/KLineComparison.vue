<template>
  <div class="kc-page">
    <h3 class="page-title">走势对比</h3>

    <div class="controls">
      <!-- Symbol A & B -->
      <div class="symbol-row">
        <div v-for="(slot, idx) in ['A', 'B']" :key="slot" class="symbol-slot">
          <span class="slot-badge" :class="idx === 0 ? 'badge-a' : 'badge-b'">{{ slot }}</span>
          <select v-model="preset[slot]" @change="onPresetChange(slot)" class="preset-sel">
            <option value="">— 选指数 —</option>
            <option v-for="p in PRESET_INDICES" :key="p.symbol" :value="p.symbol">{{ p.name }}</option>
          </select>
          <span class="or-text">或</span>
          <input
            v-model="sym[slot]"
            type="text"
            :placeholder="slot === 'A' ? '如 600519.SH' : '如 000300.SH'"
            class="sym-input"
            @keyup.enter="fetchAll"
          />
        </div>
      </div>

      <!-- Watchlist quick add -->
      <div class="watchlist-row">
        <span class="qr-label">自选股:</span>
        <button @click="loadWatchlist" :disabled="watchlistLoading" class="btn-base btn-sm btn-gradient-teal">导入自选</button>
        <template v-if="watchlistSymbols.length">
          <select v-model="watchlistPickA" @change="pickWatchlist('A')" class="wl-sel">
            <option value="">— → 设为A</option>
            <option v-for="s in watchlistSymbols" :key="s.symbol" :value="s.symbol">{{ s.label }}</option>
          </select>
          <select v-model="watchlistPickB" @change="pickWatchlist('B')" class="wl-sel">
            <option value="">— → 设为B</option>
            <option v-for="s in watchlistSymbols" :key="s.symbol" :value="s.symbol">{{ s.label }}</option>
          </select>
        </template>
      </div>

      <!-- Date range -->
      <div class="date-row">
        <span class="qr-label">区间:</span>
        <button
          v-for="btn in QUICK_RANGES"
          :key="btn.days"
          @click="setRange(btn.days)"
          :class="['btn-base btn-sm', activeRange === btn.days ? 'btn-gradient-blue' : 'btn-gradient-orange']"
        >{{ btn.label }}</button>
        <input type="date" v-model="startDate" :max="today" />
        <span>~</span>
        <input type="date" v-model="endDate" :max="today" />
        <button @click="fetchAll" :disabled="loading" class="btn-base btn-sm btn-gradient-blue">加载</button>
      </div>

      <!-- Chart mode -->
      <div class="mode-row">
        <span class="qr-label">视图:</span>
        <button @click="chartMode = 'normalized'" :disabled="chartMode === 'normalized'" class="btn-base btn-sm btn-gradient-blue">走势对比</button>
        <button @click="chartMode = 'candlestick'" :disabled="chartMode === 'candlestick'" class="btn-base btn-sm btn-gradient-teal">标的A K线</button>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="stats" class="stats-bar">
      <span class="stat" :class="stats.returnA >= 0 ? 'up' : 'dn'">
        {{ symLabel('A') }}: {{ stats.returnA >= 0 ? '+' : '' }}{{ stats.returnA.toFixed(2) }}%
      </span>
      <span class="stat" :class="stats.returnB >= 0 ? 'up' : 'dn'">
        {{ symLabel('B') }}: {{ stats.returnB >= 0 ? '+' : '' }}{{ stats.returnB.toFixed(2) }}%
      </span>
      <span v-if="stats.corr !== null" class="stat corr">
        相关系数: {{ stats.corr.toFixed(3) }}
      </span>
      <span class="stat muted">{{ seriesA.length }}条(A) / {{ seriesB.length }}条(B)</span>
    </div>

    <div v-if="loading" class="loading text-subtle">加载中...</div>
    <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
    <div ref="chartRef" class="kc-chart" v-show="hasData && !loading"></div>
    <div v-if="!loading && !hasData && !errorMsg" class="empty text-subtle">请选择标的并点击加载</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import axios from 'axios'

let echarts

const PRESET_INDICES = [
  { symbol: '000300.SH', name: '沪深300' },
  { symbol: '000905.SH', name: '中证500' },
  { symbol: '000852.SH', name: '中证1000' },
  { symbol: '000016.SH', name: '上证50' },
  { symbol: '000688.SH', name: '科创50' },
  { symbol: '399006.SZ', name: '创业板指' },
  { symbol: '000001.SH', name: '上证指数' },
  { symbol: '399001.SZ', name: '深证成指' },
]
const PRESET_MAP = Object.fromEntries(PRESET_INDICES.map(p => [p.symbol, p.name]))

const QUICK_RANGES = [
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
  { days: 180, label: '6M' },
  { days: 365, label: '1Y' },
  { days: 365 * 3, label: '3Y' },
  { days: 365 * 5, label: '5Y' },
]

const today = new Date().toISOString().slice(0, 10)

// State
const sym = ref({ A: '000300.SH', B: '000852.SH' })
const preset = ref({ A: '000300.SH', B: '000852.SH' })
const startDate = ref((() => {
  const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10)
})())
const endDate = ref(today)
const activeRange = ref(365)
const chartMode = ref('normalized')
const loading = ref(false)
const errorMsg = ref('')
const seriesA = ref([])
const seriesB = ref([])
const watchlistSymbols = ref([])
const watchlistLoading = ref(false)
const watchlistPickA = ref('')
const watchlistPickB = ref('')
const chartRef = ref(null)
let chartInstance = null

// Computed
const hasData = computed(() => seriesA.value.length > 0 || seriesB.value.length > 0)

function symLabel(slot) {
  const s = sym.value[slot]
  return PRESET_MAP[s] || s || `标的${slot}`
}

const stats = computed(() => {
  if (!seriesA.value.length && !seriesB.value.length) return null
  const returnA = seriesA.value.length >= 2
    ? ((seriesA.value.at(-1).close - seriesA.value[0].close) / seriesA.value[0].close) * 100
    : 0
  const returnB = seriesB.value.length >= 2
    ? ((seriesB.value.at(-1).close - seriesB.value[0].close) / seriesB.value[0].close) * 100
    : 0
  let corr = null
  if (seriesA.value.length >= 10 && seriesB.value.length >= 10) {
    const mapA = Object.fromEntries(seriesA.value.map(r => [r.trade_date, r.close]))
    const mapB = Object.fromEntries(seriesB.value.map(r => [r.trade_date, r.close]))
    const common = seriesA.value.map(r => r.trade_date).filter(d => mapB[d] != null)
    if (common.length >= 10) {
      const cA = common.map(d => mapA[d])
      const cB = common.map(d => mapB[d])
      const rA = cA.slice(1).map((v, i) => Math.log(v / cA[i]))
      const rB = cB.slice(1).map((v, i) => Math.log(v / cB[i]))
      corr = pearson(rA, rB)
    }
  }
  return { returnA, returnB, corr }
})

function pearson(xs, ys) {
  const n = xs.length
  if (n < 2) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, sdx = 0, sdy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my
    num += dx * dy; sdx += dx * dx; sdy += dy * dy
  }
  const denom = Math.sqrt(sdx * sdy)
  return denom === 0 ? 0 : num / denom
}

function onPresetChange(slot) {
  const v = preset.value[slot]
  if (v) sym.value[slot] = v
}

async function loadWatchlist() {
  if (watchlistLoading.value) return
  watchlistLoading.value = true
  try {
    const res = await axios.get('/api/user/watchlist-stocks')
    const stocks = res.data?.data || []
    watchlistSymbols.value = stocks.map(s => {
      const name = s.name || s.stock_name || s.company_name || s.title || ''
      return { symbol: s.symbol, label: name ? `${name} (${s.symbol})` : s.symbol }
    })
  } catch (e) {
    console.error('watchlist load failed', e)
  } finally {
    watchlistLoading.value = false
  }
}

function pickWatchlist(slot) {
  const v = slot === 'A' ? watchlistPickA.value : watchlistPickB.value
  if (!v) return
  sym.value[slot] = v
  preset.value[slot] = ''
}

function setRange(days) {
  activeRange.value = days
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days)
  startDate.value = start.toISOString().slice(0, 10)
  endDate.value = end.toISOString().slice(0, 10)
}

async function fetchSeries(symbol) {
  const sd = startDate.value.replace(/-/g, '')
  const ed = endDate.value.replace(/-/g, '')
  const res = await axios.get(`/api/kline-series?symbol=${symbol}&start_date=${sd}&end_date=${ed}&limit=2000`)
  return res.data?.data || []
}

async function fetchAll() {
  if (!sym.value.A && !sym.value.B) {
    errorMsg.value = '请至少选择一个标的'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const [a, b] = await Promise.all([
      sym.value.A ? fetchSeries(sym.value.A) : Promise.resolve([]),
      sym.value.B ? fetchSeries(sym.value.B) : Promise.resolve([]),
    ])
    seriesA.value = a
    seriesB.value = b
    if (!a.length && !b.length) {
      errorMsg.value = '两个标的均无数据，请检查代码格式（如 000300.SH / 600519.SH）'
    } else if (sym.value.A && !a.length) {
      errorMsg.value = `标的A (${sym.value.A}) 无数据`
    } else if (sym.value.B && !b.length) {
      errorMsg.value = `标的B (${sym.value.B}) 无数据`
    }
  } catch (e) {
    errorMsg.value = '数据加载失败: ' + (e?.response?.data?.detail || e.message)
  } finally {
    loading.value = false
    await nextTick() // 等 v-show 生效、div 获得实际宽度，再初始化/渲染图表
    renderChart()
  }
}

async function ensureECharts() {
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (!chartInstance && chartRef.value) {
    chartInstance = echarts.init(chartRef.value)
    window.addEventListener('resize', handleResize)
  }
}

async function renderChart() {
  await ensureECharts()
  if (!chartInstance) return
  if (!hasData.value) { chartInstance.clear(); return }
  chartMode.value === 'normalized' ? renderNormalized() : renderCandlestick()
}

function formatDate(d) {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

function renderNormalized() {
  const mapA = Object.fromEntries(seriesA.value.map(r => [r.trade_date, r.close]))
  const mapB = Object.fromEntries(seriesB.value.map(r => [r.trade_date, r.close]))
  const allDates = [...new Set([
    ...seriesA.value.map(r => r.trade_date),
    ...seriesB.value.map(r => r.trade_date),
  ])].sort()

  const baseA = seriesA.value[0]?.close || 1
  const baseB = seriesB.value[0]?.close || 1
  const normA = allDates.map(d => mapA[d] != null ? +(mapA[d] / baseA * 100).toFixed(3) : null)
  const normB = allDates.map(d => mapB[d] != null ? +(mapB[d] / baseB * 100).toFixed(3) : null)

  const labelA = symLabel('A'), labelB = symLabel('B')
  const option = {
    backgroundColor: '#ffffff',
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let s = `<b>${params[0]?.axisValue}</b><br/>`
        for (const p of params) {
          if (p.value == null) continue
          const pct = (p.value - 100).toFixed(2)
          const sign = pct >= 0 ? '+' : ''
          s += `${p.marker}${p.seriesName}: ${p.value.toFixed(2)} (${sign}${pct}%)<br/>`
        }
        return s
      },
    },
    legend: { data: [labelA, labelB], top: 4 },
    grid: { left: '6%', right: '4%', top: 40, bottom: 70 },
    xAxis: {
      type: 'category',
      data: allDates.map(formatDate),
      boundaryGap: false,
      axisLabel: { rotate: allDates.length > 60 ? 45 : 0, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { formatter: v => `${(v - 100).toFixed(0)}%`, fontSize: 11 },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    dataZoom: [
      { type: 'slider', start: 0, end: 100, height: 18, bottom: 40 },
      { type: 'inside' },
    ],
    series: [
      {
        name: labelA,
        type: 'line',
        data: normA,
        connectNulls: false,
        smooth: false,
        symbol: 'none',
        lineStyle: { width: 2, color: '#e53935' },
        color: '#e53935',
        markLine: {
          silent: true, symbol: 'none',
          lineStyle: { type: 'dashed', color: '#bbb' },
          data: [{ yAxis: 100, name: '基准' }],
          label: { show: false },
        },
      },
      {
        name: labelB,
        type: 'line',
        data: normB,
        connectNulls: false,
        smooth: false,
        symbol: 'none',
        lineStyle: { width: 2, color: '#1e88e5' },
        color: '#1e88e5',
      },
    ],
    animation: false,
  }
  chartInstance.setOption(option, true)
  chartInstance.resize()
}

function renderCandlestick() {
  if (!seriesA.value.length) { chartInstance.clear(); return }
  const data = seriesA.value
  const dates = data.map(r => formatDate(r.trade_date))
  const candleData = data.map(r => [r.open, r.close, r.low, r.high])

  const labelA = symLabel('A'), labelB = symLabel('B')
  const baseA = data[0]?.close || 1
  const baseB = seriesB.value[0]?.close || 1
  const mapB = Object.fromEntries(seriesB.value.map(r => [r.trade_date, r.close]))
  const normBonA = data.map(r => {
    const v = mapB[r.trade_date]
    return v != null ? +(v / baseB * baseA).toFixed(3) : null
  })
  const hasBData = normBonA.some(v => v != null)

  const series = [
    {
      name: labelA,
      type: 'candlestick',
      data: candleData,
      itemStyle: {
        color: '#eb4444', color0: '#22ab94',
        borderColor: '#eb4444', borderColor0: '#22ab94',
      },
    },
  ]
  if (hasBData) {
    series.push({
      name: `${labelB}(参考)`,
      type: 'line',
      data: normBonA,
      connectNulls: false,
      symbol: 'none',
      lineStyle: { width: 1.5, color: '#1e88e5', type: 'dashed' },
      color: '#1e88e5',
    })
  }

  const defaultStart = data.length > 120 ? Math.round((1 - 120 / data.length) * 100) : 0
  const option = {
    backgroundColor: '#ffffff',
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { data: hasBData ? [labelA, `${labelB}(参考)`] : [labelA], top: 4 },
    grid: { left: '6%', right: '4%', top: 40, bottom: 70 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { rotate: dates.length > 60 ? 45 : 0, fontSize: 11 },
    },
    yAxis: [{ scale: true, splitLine: { lineStyle: { color: '#e2e8f0' } } }],
    dataZoom: [
      { type: 'slider', start: defaultStart, end: 100, height: 18, bottom: 40 },
      { type: 'inside' },
    ],
    series,
    animation: false,
  }
  chartInstance.setOption(option, true)
  chartInstance.resize()
}

function handleResize() { chartInstance?.resize() }

watch(chartMode, () => renderChart())

onMounted(() => {
  fetchAll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
  chartInstance = null
})
</script>

<style scoped>
.kc-page { background: #fff; padding: 16px; border-radius: 8px; }
.page-title { margin: 0 0 14px; font-size: 20px; }
.controls { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.symbol-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.symbol-slot { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.slot-badge { font-weight: 700; font-size: 13px; padding: 2px 6px; border-radius: 3px; }
.badge-a { background: #ffebee; color: #e53935; }
.badge-b { background: #e3f2fd; color: #1e88e5; }
.preset-sel { padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; }
.or-text { color: #999; font-size: 12px; }
.sym-input { padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; width: 120px; font-size: 13px; }
.watchlist-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wl-sel { padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; max-width: 160px; }
.date-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.date-row input[type="date"] { padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; }
.mode-row { display: flex; align-items: center; gap: 8px; }
.qr-label { font-size: 13px; color: #666; }
.stats-bar { display: flex; gap: 20px; padding: 8px 12px; background: #f8fafc; border-radius: 6px; margin-bottom: 10px; flex-wrap: wrap; align-items: center; }
.stat { font-size: 13px; font-weight: 600; }
.stat.up { color: #e53935; }
.stat.dn { color: #26a69a; }
.stat.corr { color: #5c6bc0; }
.stat.muted { color: #999; font-weight: 400; font-size: 12px; }
.kc-chart { width: 100%; height: 440px; border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 12px; }
.loading, .empty { padding: 40px; text-align: center; color: #555; }
.error-msg { padding: 10px 14px; background: #fff3f3; color: #c62828; border-radius: 6px; margin-bottom: 8px; font-size: 13px; }
</style>
