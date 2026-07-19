<template>
  <div :class="['unified-chart-container', theme]" ref="containerRef">
    <!-- Header: Info & Basic Controls -->
    <div class="chart-header">
      <div class="stock-info">
        <span class="symbol-badge">{{ props.symbol }}</span>
        <span class="stock-name">{{ props.stockName || '' }}</span>
        <span class="data-count">{{ kType === 'minute' ? minuteBars.length + ' 条分时' : records?.length + ' 天数据' }}</span>
      </div>
      
      <div class="header-actions">
        <!-- Theme Toggle -->
        <button @click="toggleTheme" class="btn-action theme-toggle" :title="theme === 'dark' ? '切换到亮色模式' : '切换到深色模式'">
          {{ theme === 'dark' ? '☀️' : '🌙' }}
        </button>
        <button @click="goBack" class="btn-action">← 返回</button>
      </div>
    </div>

    <!-- Toolbar: Interval & Date -->
    <div class="chart-toolbar">
      <div class="toolbar-group">
        <div class="interval-selector">
          <button 
            v-for="opt in intervalOptions" 
            :key="opt.value"
            :class="['interval-btn', { active: kType === opt.value }]"
            @click="kType = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="toolbar-group" v-if="kType !== 'minute'">
        <input type="date" v-model="startDate" @change="drawChart" class="theme-input" />
        <span class="sep">至</span>
        <input type="date" v-model="endDate" @change="drawChart" class="theme-input" />
      </div>

      <div class="toolbar-group" v-else>
        <input type="date" v-model="selectedMinuteDate" @change="fetchMinuteData" class="theme-input" />
        <button @click="fetchMinuteData" :disabled="loading" class="btn-refresh">🔄</button>
      </div>

      <div class="toolbar-spacer"></div>

      <div class="nav-controls">
        <button @click="props.prevStock" :disabled="!props.hasPrev" class="btn-nav">▲</button>
        <button @click="props.nextStock" :disabled="!props.hasNext" class="btn-nav">▼</button>
      </div>
    </div>

    <!-- Main Chart -->
    <div class="chart-main-wrapper" ref="chartWrapperRef">
      <div ref="chartRef" class="chart-canvas"></div>
      <div v-if="error" class="chart-overlay error">{{ error }}</div>
      <div v-if="loading" class="chart-overlay loading"><div class="spinner"></div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import request from '../utils/request'

const props = defineProps({
  records: { type: Array, default: () => [] },
  symbol: String,
  stockName: String,
  moneyFlowRecords: { type: Array, default: () => [] },
  signalDates: { type: Array, default: () => [] },
  tradeMarkers: { type: Array, default: () => [] },
  prevStock: Function,
  nextStock: Function,
  hasPrev: Boolean,
  hasNext: Boolean,
  strategyFrom: String,
  presetFrom: String,
  dateFrom: String
})

const emit = defineEmits(['go-back', 'load-more'])

// Refs
const containerRef = ref(null)
const chartWrapperRef = ref(null)
const chartRef = ref(null)
const kType = ref('day')
const loading = ref(false)
const error = ref('')
const startDate = ref('')
const endDate = ref('')
const selectedMinuteDate = ref('')
const minuteBars = ref([])
const tradeSignals = ref([])
const theme = ref(localStorage.getItem('chart-theme') || 'dark')

let echarts = null
let chartInstance = null
let resizeObserver = null

const intervalOptions = [
  { label: '分时', value: 'minute' },
  { label: '日线', value: 'day' },
  { label: '周线', value: 'week' },
  { label: '月线', value: 'month' }
]

// --- Utils ---
const normalizeDate = (d) => {
  if (!d) return ''
  if (d.includes('T')) return d.split('T')[0]
  if (d.length === 8 && !d.includes('-')) return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`
  return d
}

const toggleTheme = () => {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  localStorage.setItem('chart-theme', theme.value)
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
    nextTick(() => {
      initECharts().then(() => drawChart())
    })
  }
}

// --- Data Fetching ---
async function fetchMinuteData() {
  if (!props.symbol || !selectedMinuteDate.value) return
  loading.value = true
  try {
    const dStr = selectedMinuteDate.value.replace(/-/g, '')
    const [bRes, sRes] = await Promise.all([
      request({ method: 'get', url: '/minute-bars/', params: { symbol: props.symbol, start_date: dStr, end_date: dStr, limit: 1000 } }),
      request({ method: 'get', url: '/trade-signals/', params: { symbol: props.symbol, start_date: selectedMinuteDate.value, end_date: selectedMinuteDate.value } })
    ])
    minuteBars.value = bRes.data || []
    tradeSignals.value = sRes.data || []
    drawChart()
  } catch (e) {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

// --- Chart Rendering ---
async function initECharts() {
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (!chartInstance && chartRef.value) {
    // We use null for light theme to use ECharts default, 
    // but we'll customize colors in getBaseOption for 'soft' look
    chartInstance = echarts.init(chartRef.value, theme.value === 'dark' ? 'dark' : null)
    
    // Register datazoom event for infinite scrolling
    chartInstance.on('datazoom', handleDataZoom)
  }
}

function drawChart() {
  if (!chartInstance) return
  if (kType.value === 'minute') renderMinute()
  else renderDaily()
}

function renderMinute() {
  if (!minuteBars.value.length) { chartInstance.clear(); return; }
  const times = minuteBars.value.map(b => b.trade_date.slice(8, 12).replace(/(\d{2})(\d{2})/, '$1:$2'))
  const data = minuteBars.value.map(b => [b.open, b.close, b.low, b.high])
  
  const option = getBaseOption(`${props.symbol} 分时`, times)
  option.series = [{
    name: 'K线', type: 'candlestick', data,
    itemStyle: { 
      color: theme.value === 'dark' ? '#ef5350' : '#eb4444', 
      color0: theme.value === 'dark' ? '#26a69a' : '#22ab94', 
      borderColor: theme.value === 'dark' ? '#ef5350' : '#eb4444', 
      borderColor0: theme.value === 'dark' ? '#26a69a' : '#22ab94' 
    }
  }]
  chartInstance.setOption(option, true)
}

function renderDaily() {
  if (!props.records.length) { chartInstance.clear(); return; }
  
  // 1. Get current dataZoom state if it exists
  let currentZoomStart = null;
  let currentZoomEnd = null;
  let previousDataLength = chartInstance.getOption()?.series?.[0]?.data?.length || 0;
  
  if (previousDataLength > 0 && isPaging) {
    const option = chartInstance.getOption();
    if (option && option.dataZoom && option.dataZoom.length > 0) {
      currentZoomStart = option.dataZoom[0].start;
      currentZoomEnd = option.dataZoom[0].end;
    }
  }
  
  // 2. Prepare and filter data
  let data = [...props.records].sort((a,b) => new Date(normalizeDate(a.trade_date)) - new Date(normalizeDate(b.trade_date)))
  if (startDate.value) data = data.filter(r => normalizeDate(r.trade_date) >= normalizeDate(startDate.value))
  if (endDate.value) data = data.filter(r => normalizeDate(r.trade_date) <= normalizeDate(endDate.value))
  
  const times = data.map(r => normalizeDate(r.trade_date))
  const option = getBaseOption(`${props.symbol} ${kType.value}`, times)
  const closes = data.map(r => Number.isFinite(Number(r.close)) ? Number(r.close) : null)
  const ma55 = movingAverage(closes, 55)
  const ma233 = movingAverage(closes, 233)
  
  option.series = [
    {
      name: 'K线', type: 'candlestick', data: data.map(r => [r.open, r.close, r.low, r.high]),
      itemStyle: {
        color: theme.value === 'dark' ? '#ef5350' : '#eb4444',
        color0: theme.value === 'dark' ? '#26a69a' : '#22ab94',
        borderColor: theme.value === 'dark' ? '#ef5350' : '#eb4444',
        borderColor0: theme.value === 'dark' ? '#26a69a' : '#22ab94'
      }
    },
    {
      name: 'MA55',
      type: 'line',
      data: ma55,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.2, color: '#facc15' },
      emphasis: { focus: 'series' },
      z: 3
    },
    {
      name: 'MA233',
      type: 'line',
      data: ma233,
      showSymbol: false,
      connectNulls: false,
      lineStyle: { width: 1.2, color: '#a855f7' },
      emphasis: { focus: 'series' },
      z: 2
    }
  ]

  // 3. Restore or calculate new dataZoom state
  const newDataLength = data.length;
  // Initialize dataZoom if it wasn't present
  if (!option.dataZoom) option.dataZoom = [{ type: 'inside', start: 0, end: 100 }];

  if (isPaging && previousDataLength > 0 && newDataLength > previousDataLength && currentZoomStart !== null) {
      // Calculate how much new data was added relative to the total new dataset
      // Because we fetched *older* data, these are prepended to the array.
      const addedDataCount = newDataLength - previousDataLength;
      
      // Calculate the new percentage that corresponds to the old window
      // The old 'start' (0%) is now at index `addedDataCount`
      const newStartVal = (addedDataCount / newDataLength) * 100;
      
      // We know the old window showed N points out of previousDataLength
      const oldVisiblePoints = previousDataLength * ((currentZoomEnd - currentZoomStart) / 100);
      
      // The new end should cover the same number of points starting from newStartVal
      const newEndVal = newStartVal + ((oldVisiblePoints / newDataLength) * 100);
      
      option.dataZoom[0].start = newStartVal;
      option.dataZoom[0].end = newEndVal;
      
      // We reset isPaging *after* we successfully render the new data
      // so we don't accidentally fall into the 'default' zoom logic.
      isPaging = false; 
  } else if (!isPaging) {
     // Default zoom for first load: show the most recent 100 points
     if (newDataLength > 100) {
         option.dataZoom[0].start = ((newDataLength - 100) / newDataLength) * 100;
         option.dataZoom[0].end = 100;
     } else {
         option.dataZoom[0].start = 0;
         option.dataZoom[0].end = 100;
     }
  }

  chartInstance.setOption(option, true)
}

function movingAverage(values, windowSize) {
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

function getBaseOption(title, xData) {
  const isDark = theme.value === 'dark'
  return {
    backgroundColor: 'transparent',
    title: { text: title, left: 'center', textStyle: { color: isDark ? '#adbac7' : '#444d56', fontSize: 14 } },
    legend: { top: 22, textStyle: { color: isDark ? '#adbac7' : '#444d56', fontSize: 11 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: { left: '50', right: '20', top: '50', bottom: '20' },
    xAxis: { 
      type: 'category', 
      data: xData, 
      axisLine: { lineStyle: { color: isDark ? '#444c56' : '#d1d5da' } }, 
      axisLabel: { color: isDark ? '#768390' : '#586069', fontSize: 11 } 
    },
    yAxis: { 
      scale: true, 
      splitLine: { lineStyle: { color: isDark ? '#2d333b' : '#eaecef' } }, 
      axisLabel: { color: isDark ? '#768390' : '#586069', fontSize: 11 } 
    },
    dataZoom: [{ type: 'inside' }],
    animation: false
  }
}

// --- Data Zoom / Infinite Scroll ---
let isPaging = false
function handleDataZoom(params) {
  if (isPaging || kType.value === 'minute') return
  
  // Get the start percentage of the zoom scale
  let start = 100
  if (params.batch && params.batch.length > 0) {
    start = params.batch[0].start
  } else if (params.start !== undefined) {
    start = params.start
  }

  // If scrolled to the left (start <= 1% is the threshold)
  if (start <= 1 && props.records?.length > 0) {
    // Collect all unique dates and sort them to find the earliest
    const dates = props.records.map(r => normalizeDate(r.trade_date)).sort()
    const earliestDate = dates[0]
    
    isPaging = true
    emit('load-more', earliestDate)
    
    // Throttling to prevent multiple calls for the same event
    setTimeout(() => { isPaging = false }, 2500)
  }
}

// --- Lifecycle ---
onMounted(async () => {
  if (props.records?.length) {
    const dates = props.records.map(r => normalizeDate(r.trade_date)).sort()
    endDate.value = dates[dates.length - 1]
    const s = new Date(endDate.value); s.setMonth(s.getMonth() - 2)
    startDate.value = s.toISOString().split('T')[0]
    selectedMinuteDate.value = (props.signalDates?.length) ? normalizeDate(props.signalDates[0]) : endDate.value
  }

  resizeObserver = new ResizeObserver(async (entries) => {
    for (let entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        await initECharts()
        chartInstance?.resize()
        drawChart()
      }
    }
  })
  
  if (chartWrapperRef.value) {
    resizeObserver.observe(chartWrapperRef.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  chartInstance?.dispose()
})

watch(() => kType.value, (t) => t === 'minute' ? fetchMinuteData() : drawChart())
watch(() => props.symbol, () => kType.value === 'minute' ? fetchMinuteData() : drawChart())

watch(() => props.records, (newRecs) => {
  if (newRecs?.length > 0) {
    // If our current startDate is later than the earliest record, 
    // it means more historical data was loaded, so we should expand the view.
    const dates = newRecs.map(r => normalizeDate(r.trade_date)).sort()
    const earliest = dates[0]
    if (!startDate.value || earliest < startDate.value) {
      startDate.value = earliest
    }
  }
  drawChart()
}, { deep: true })

const goBack = () => emit('go-back', { strategy: props.strategyFrom, preset: props.presetFrom })
</script>

<style scoped>
.unified-chart-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  border-radius: 6px;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
  overflow: hidden;
  border: 1px solid transparent;
}

/* Soft Dark (Dimmed) Theme */
.unified-chart-container.dark {
  background: #22272e;
  color: #adbac7;
  border-color: #444c56;
}
.dark .chart-header { background: #2d333b; border-bottom: 1px solid #444c56; }
.dark .chart-toolbar { background: #22272e; border-bottom: 1px solid #444c56; }
.dark .interval-selector { background: #2d333b; border: 1px solid #444c56; }
.dark .interval-btn { color: #768390; }
.dark .interval-btn.active { background: #444c56; color: #adbac7; }
.dark .theme-input { background: #2d333b; border-color: #444c56; color: #adbac7; }
.dark .btn-nav, .dark .btn-action { background: #2d333b; border-color: #444c56; color: #adbac7; }
.dark .btn-action:hover { background: #444c56; }

/* Soft Light Theme */
.unified-chart-container.light {
  background: #f6f8fa;
  color: #24292e;
  border-color: #d1d5da;
}
.light .chart-header { background: #e1e4e8; border-bottom: 1px solid #d1d5da; }
.light .chart-toolbar { background: #f6f8fa; border-bottom: 1px solid #d1d5da; }
.light .interval-selector { background: #e1e4e8; border: 1px solid #d1d5da; }
.light .interval-btn { color: #586069; }
.light .interval-btn.active { background: #ffffff; color: #0366d6; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.light .theme-input { background: #ffffff; border-color: #d1d5da; color: #24292e; }
.light .btn-nav, .light .btn-action { background: #ffffff; border-color: #d1d5da; color: #24292e; }
.light .btn-action:hover { background: #f3f4f6; }
.light .symbol-badge { background: #2ea44f; }
.light .sep { color: #6a737d; font-size: 12px; }

.chart-header {
  display: flex;
  justify-content: space-between;
  padding: 10px 15px;
  align-items: center;
}

.symbol-badge { color: #fff; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-right: 10px; font-size: 13px; }
.stock-name { font-size: 16px; font-weight: 600; }
.data-count { color: #768390; font-size: 11px; margin-left: 10px; }
.light .data-count { color: #586069; }

.chart-toolbar {
  display: flex;
  gap: 15px;
  padding: 8px 15px;
  align-items: center;
}

.interval-selector { display: flex; border-radius: 4px; padding: 2px; }
.interval-btn { padding: 3px 10px; border: none; background: transparent; font-size: 12px; cursor: pointer; border-radius: 3px; font-weight: 500; }

.theme-input { border: 1px solid; padding: 3px 6px; border-radius: 3px; font-size: 12px; outline: none; transition: border-color 0.2s; }
.theme-input:focus { border-color: #0366d6; }

.nav-controls { display: flex; gap: 4px; }
.btn-nav, .btn-action { border: 1px solid; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s; }

.theme-toggle { font-size: 14px; margin-right: 5px; }

.toolbar-spacer { flex-grow: 1; }

.chart-main-wrapper {
  flex-grow: 1;
  position: relative;
  width: 100%;
}

.chart-canvas { width: 100%; height: 100%; }

.chart-overlay {
  position: absolute; top: 0; left: 0; width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  background: rgba(246, 248, 250, 0.7); font-size: 14px; z-index: 10;
}
.dark .chart-overlay { background: rgba(34, 39, 46, 0.7); }

.spinner {
  width: 24px; height: 24px; border: 2px solid rgba(0,0,0,0.05); border-top-color: #0366d6; border-radius: 50%;
  animation: spin 1s linear infinite;
}
.dark .spinner { border-color: #444c56; border-top-color: #539bf5; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>