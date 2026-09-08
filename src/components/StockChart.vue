<template>
  <div class="stock-chart-anchor" :class="{ 'stock-chart-anchor--held': detailMaximized }">
    <Teleport to="body" :disabled="!detailMaximized">
      <div
        :class="['unified-chart-container', theme, { 'is-fullscreen': detailMaximized }]"
        ref="containerRef"
        :role="detailMaximized ? 'dialog' : undefined"
        :aria-modal="detailMaximized ? 'true' : undefined"
        :aria-label="detailMaximized ? `${props.symbol || ''} K线图` : undefined"
      >
    <!-- Header: Info & Basic Controls -->
    <div class="chart-header">
      <div class="stock-info">
        <span class="symbol-badge">{{ props.symbol }}</span>
        <span class="stock-name">{{ props.stockName || '' }}</span>
        <span class="data-count">{{ dataCountLabel }}</span>
        <span v-if="showGsToolbar && decisionGsEnabled && decisionGsSummary" class="gs-summary">{{ decisionGsSummary }}</span>
        <span v-if="showAdjustToolbar && adjDegradedHint" class="gs-summary">{{ adjDegradedHint }}</span>
      </div>
      
      <div class="header-actions">
        <!-- Theme Toggle -->
        <button @click="toggleTheme" class="btn-action theme-toggle" :title="theme === 'dark' ? '切换到亮色模式' : '切换到深色模式'">
          {{ theme === 'dark' ? '☀️' : '🌙' }}
        </button>
        <button
          type="button"
          class="btn-action"
          :title="detailMaximized ? '退出全屏' : '全屏查看 K 线'"
          @click="toggleDetailFullscreen"
        >
          {{ detailMaximized ? '退出全屏' : '全屏' }}
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

      <div class="toolbar-group" v-if="showDateRange">
        <input type="date" v-model="startDate" @change="drawChart" class="theme-input" />
        <span class="sep">至</span>
        <input type="date" v-model="endDate" @change="drawChart" class="theme-input" />
        <button type="button" class="interval-btn window-btn" title="显示当前缓存全部 K 线" @click="showFullCache">全部</button>
        <button v-if="showDailyPaging" type="button" class="interval-btn window-btn" title="向前扩展可见区间或加载更早历史" @click="shiftEarlier">再往前</button>
      </div>

      <div class="toolbar-group" v-else>
        <input type="date" v-model="selectedMinuteDate" @change="fetchMinuteData" class="theme-input" />
        <button @click="fetchMinuteData" :disabled="loading" class="btn-refresh">🔄</button>
      </div>

      <div class="toolbar-group" v-if="showAdjustToolbar">
        <div class="interval-selector" title="K线复权口径">
          <button
            v-for="opt in adjustOptions"
            :key="opt.value"
            type="button"
            :class="['interval-btn', { active: priceAdjust === opt.value }]"
            @click="emit('change-adjust', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="toolbar-group" v-if="showGsToolbar">
        <button
          type="button"
          :class="['interval-btn', { active: decisionGsEnabled }]"
          title="决策线 GS（近似 v1）"
          @click="decisionGsEnabled = !decisionGsEnabled"
        >
          决策线 GS
        </button>
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
      <div v-else-if="!loading && !dataLoading && isOneDayMinute && !minuteBars.length" class="chart-overlay empty">暂无分时数据</div>
      <div v-if="loading || dataLoading" class="chart-overlay loading"><div class="spinner"></div></div>
    </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onBeforeUnmount, nextTick } from 'vue'
import request from '../utils/request'
import { useDetailFullscreen } from '../composables/useDetailFullscreen'
import { buildDecisionGsChartSeries, collectDecisionGsMarkers, formatKlinePriceLabel, padKlinePriceAxis } from '../utils/echarts/shenwanKlineOption.js'
import {
  earliestTradeDate,
  fullCacheVisibleRange,
  nextVisibleRange,
  formatIntradayAxis,
  normalizeChartDate,
  shiftVisibleEarlier,
} from '../utils/chartVisibleWindow.js'
import { loadEcharts } from '../utils/echarts/loadEcharts.js'

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
  dateFrom: String,
  priceAdjust: { type: String, default: 'qfq' },
  dataLoading: { type: Boolean, default: false },
})

const emit = defineEmits(['go-back', 'load-more', 'change-adjust'])
const { detailMaximized, toggleDetailFullscreen } = useDetailFullscreen()

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
const theme = ref(localStorage.getItem('chart-theme') || 'dark')
const decisionGsEnabled = ref(true)

let echarts = null
let chartInstance = null
let resizeObserver = null

const intervalOptions = [
  { label: '分时', value: 'minute' },
  { label: '30分', value: '30m' },
  { label: '60分', value: '60m' },
  { label: '日线', value: 'day' },
  { label: '周线', value: 'week' },
  { label: '月线', value: 'month' }
]
const isOneDayMinute = computed(() => kType.value === 'minute')
const isIntradayGs = computed(() => kType.value === '30m' || kType.value === '60m')
const showDateRange = computed(() => !isOneDayMinute.value)
const showAdjustToolbar = computed(() => !isOneDayMinute.value && !isIntradayGs.value)
const showGsToolbar = computed(() => !isOneDayMinute.value)
const showDailyPaging = computed(() => showAdjustToolbar.value)
const kTypeLabel = computed(() => {
  if (kType.value === '30m') return '30分钟'
  if (kType.value === '60m') return '60分钟'
  if (kType.value === 'minute') return '分时'
  return '天'
})
const dataCountLabel = computed(() => {
  if (isOneDayMinute.value) return `${minuteBars.value.length} 条分时`
  if (isIntradayGs.value) return `${minuteBars.value.length} 根${kTypeLabel.value}`
  return `${props.records?.length || 0} 天数据`
})
const intradayCache = new Map()
const adjustOptions = [
  { label: '前复权', value: 'qfq' },
  { label: '不复权', value: 'none' },
  { label: '后复权', value: 'hfq' },
]

function activeKlineRows() {
  if (isIntradayGs.value) return Array.isArray(minuteBars.value) ? minuteBars.value : []
  return Array.isArray(props.records) ? props.records : []
}

function barOrderKey(row) {
  return String(row?.trade_date || '')
}

function formatGsWhen(row) {
  if (!row) return ''
  return isIntradayGs.value ? formatIntradayAxis(row.trade_date) : normalizeDate(row.trade_date)
}

const decisionGsSummary = computed(() => {
  if (isOneDayMinute.value || !decisionGsEnabled.value) return ''
  const rows = activeKlineRows()
  const visible = rows.filter((r) => {
    const day = normalizeDate(r.trade_date)
    if (startDate.value && day < normalizeDate(startDate.value)) return false
    if (endDate.value && day > normalizeDate(endDate.value)) return false
    return true
  })
  const signals = visible
    .filter((r) => r.gs_signal === 'g' || r.gs_signal === 's')
    .slice()
    .sort((a, b) => barOrderKey(a).localeCompare(barOrderKey(b)))
  const watchMarkers = collectDecisionGsMarkers(visible).filter((item) => item.kind === 's_watch')
  const latestClosed = [...visible]
    .sort((a, b) => barOrderKey(a).localeCompare(barOrderKey(b)))
    .reverse()
    .find((r) => !r.is_partial)
  const watchActive = latestClosed?.gs_watch === 's'
  if (signals.length || watchMarkers.length) {
    const g = signals.filter((r) => r.gs_signal === 'g').length
    const s = signals.filter((r) => r.gs_signal === 's').length
    const last = signals[signals.length - 1]
    const parts = [`G×${g} · S×${s}`]
    if (last) parts.push(`最近 ${String(last.gs_signal).toUpperCase()} ${formatGsWhen(last)}`)
    if (watchMarkers.length) parts.push(`S?×${watchMarkers.length}${watchActive ? ' 进行中' : ''}`)
    return `${parts.join(' · ')}　金三角=G/S　空心三角=S?　黄=决策线　红=牛线　绿=熊线`
  }
  if (visible.some((r) => r.mj20 != null)) {
    return '当前窗口没有 G/S 拐点（可拉长日期或拖动缩放）'
  }
  if (rows.length) {
    return '未拿到决策线字段，请刷新后重进 K 线'
  }
  return ''
})

const adjDegradedHint = computed(() => {
  if (isOneDayMinute.value || isIntradayGs.value) return ''
  const rows = Array.isArray(props.records) ? props.records : []
  if (rows.some((row) => row?.adj_degraded)) {
    return '复权因子不足，当前按未复权显示'
  }
  return ''
})

// --- Utils ---
const normalizeDate = normalizeChartDate

let prevSymbol = null
let prevRecords = []

function applyVisibleWindow(records) {
  const rows = Array.isArray(records) ? records : []
  const range = nextVisibleRange({
    symbol: props.symbol,
    prevSymbol,
    records: rows,
    prevRecords,
    startDate: startDate.value,
    endDate: endDate.value,
  })
  startDate.value = range.start
  endDate.value = range.end
  prevSymbol = props.symbol
  prevRecords = rows
}

function showFullCache() {
  const range = fullCacheVisibleRange(activeKlineRows())
  startDate.value = range.start
  endDate.value = range.end
  drawChart()
}

function shiftEarlier() {
  const result = shiftVisibleEarlier({
    records: props.records,
    startDate: startDate.value,
    endDate: endDate.value,
  })
  if (result.action === 'shift') {
    startDate.value = result.start
    endDate.value = result.end
    drawChart()
    return
  }
  if (result.action === 'load-more') {
    const earliest = earliestTradeDate(props.records)
    if (!earliest || isPaging) return
    isPaging = true
    emit('load-more', earliest)
    setTimeout(() => { isPaging = false }, 2500)
  }
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
function barsFromMinuteResponse(res) {
  return Array.isArray(res?.data) ? res.data : []
}

function compactYmd(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 8 ? digits.slice(0, 8) : ''
}

function applyMinuteDay(res, bars) {
  const ymd = compactYmd(res?.day) || compactYmd(bars[0]?.trade_date)
  if (ymd) selectedMinuteDate.value = normalizeDate(ymd)
}

function minuteAxisLabel(tradeDate) {
  const digits = String(tradeDate || '').replace(/\D/g, '')
  if (digits.length >= 12) {
    return `${digits.slice(8, 10)}:${digits.slice(10, 12)}`
  }
  return String(tradeDate || '')
}

async function requestMinuteBars({ startDate, endDate } = {}) {
  const params = { symbol: props.symbol, tf: '1m', limit: 1000 }
  if (startDate && endDate) {
    params.start_date = String(startDate).replace(/-/g, '')
    params.end_date = String(endDate).replace(/-/g, '')
  }
  return request({ method: 'get', url: '/minute-bars/', params })
}

async function fetchMinuteData() {
  if (!props.symbol) return
  loading.value = true
  error.value = ''
  try {
    const dated = Boolean(selectedMinuteDate.value)
    let res = await requestMinuteBars(
      dated
        ? { startDate: selectedMinuteDate.value, endDate: selectedMinuteDate.value }
        : {}
    )
    let rows = barsFromMinuteResponse(res)
    if (!rows.length && dated) {
      res = await requestMinuteBars({})
      rows = barsFromMinuteResponse(res)
    }
    minuteBars.value = rows
    applyMinuteDay(res, rows)
    drawChart()
  } catch (e) {
    error.value = '加载失败'
  } finally {
    loading.value = false
  }
}

function intradayCacheKey(symbol, tf) {
  return `${symbol || ''}|${tf || ''}`
}

async function fetchIntradayGsBars() {
  if (!props.symbol || !isIntradayGs.value) return
  const key = intradayCacheKey(props.symbol, kType.value)
  if (intradayCache.has(key)) {
    minuteBars.value = intradayCache.get(key)
    applyVisibleWindow(minuteBars.value)
    drawChart()
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await request({
      method: 'get',
      url: '/minute-bars/',
      params: { symbol: props.symbol, tf: kType.value, limit: 800 },
    })
    const rows = Array.isArray(res?.data) ? res.data : []
    minuteBars.value = rows
    intradayCache.set(key, rows)
    applyVisibleWindow(rows)
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
    echarts = await loadEcharts()
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
  const times = minuteBars.value.map(b => minuteAxisLabel(b.trade_date))
  const data = minuteBars.value.map(b => [b.open, b.close, b.low, b.high])
  
  const option = getBaseOption(times)
  option.series = [{
    name: 'K线', type: 'candlestick', data,
    legendHoverLink: false,
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
  const source = activeKlineRows()
  if (!source.length) { chartInstance.clear(); return; }
  
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
  let data = [...source].sort((a, b) => barOrderKey(a).localeCompare(barOrderKey(b)))
  if (startDate.value) data = data.filter(r => normalizeDate(r.trade_date) >= normalizeDate(startDate.value))
  if (endDate.value) data = data.filter(r => normalizeDate(r.trade_date) <= normalizeDate(endDate.value))
  
  const axisFmt = isIntradayGs.value ? formatIntradayAxis : normalizeDate
  const times = data.map(r => axisFmt(r.trade_date))
  const closes = data.map(r => Number.isFinite(Number(r.close)) ? Number(r.close) : null)
  const showGs = decisionGsEnabled.value && data.some((r) => r.mj20 != null)
  const gsSeries = showGs ? buildDecisionGsChartSeries(data, axisFmt) : []
  const option = getBaseOption(times, {
    legendData: showGs ? ['决策线', '牛线', '熊线'] : ['MA55', 'MA233'],
  })
  
  option.series = [
    {
      name: 'K线', type: 'candlestick', data: data.map(r => [r.open, r.close, r.low, r.high]),
      legendHoverLink: false,
      itemStyle: {
        color: theme.value === 'dark' ? '#ef5350' : '#eb4444',
        color0: theme.value === 'dark' ? '#26a69a' : '#22ab94',
        borderColor: theme.value === 'dark' ? '#ef5350' : '#eb4444',
        borderColor0: theme.value === 'dark' ? '#26a69a' : '#22ab94'
      }
    }
  ]
  if (gsSeries.length) {
    option.series.push(...gsSeries)
    option.yAxis = padKlinePriceAxis(option.yAxis)
  } else {
    option.series.push(
      {
        name: 'MA55',
        type: 'line',
        color: '#facc15',
        data: movingAverage(closes, 55),
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        itemStyle: { color: '#facc15' },
        lineStyle: { width: 1.2, color: '#facc15' },
        emphasis: { focus: 'series' },
        z: 3
      },
      {
        name: 'MA233',
        type: 'line',
        color: '#a855f7',
        data: movingAverage(closes, 233),
        symbol: 'none',
        showSymbol: false,
        connectNulls: false,
        itemStyle: { color: '#a855f7' },
        lineStyle: { width: 1.2, color: '#a855f7' },
        emphasis: { focus: 'series' },
        z: 2
      }
    )
  }

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
    option.dataZoom[0].start = 0
    option.dataZoom[0].end = 100
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

function formatChartNum2(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '-'
}

function formatStockChartTooltip(params) {
  if (!params?.length) return ''
  const date = params[0].axisValue ?? params[0].name ?? ''
  const lines = []
  for (const p of params) {
    if (p.seriesName === 'K线') {
      const arr = Array.isArray(p.data) ? p.data : p.value
      if (Array.isArray(arr) && arr.length >= 4) {
        lines.push(`开 ${formatChartNum2(arr[0])}　收 ${formatChartNum2(arr[1])}<br/>低 ${formatChartNum2(arr[2])}　高 ${formatChartNum2(arr[3])}`)
      }
      continue
    }
    if (p.seriesName === 'G' || p.seriesName === 'S' || p.seriesName === 'S?') {
      const price = p.data && typeof p.data === 'object' && !Array.isArray(p.data) ? p.data.price : null
      if (price != null) lines.push(`${p.seriesName} ${formatChartNum2(price)}`)
      continue
    }
    if (
      p.data != null &&
      (p.seriesName === '决策线' || p.seriesName === '牛线' || p.seriesName === '熊线'
        || (typeof p.seriesName === 'string' && /^MA\d+$/.test(p.seriesName)))
    ) {
      lines.push(`${p.seriesName} ${formatChartNum2(p.data)}`)
    }
  }
  return `<div class="k-tip"><strong>${date}</strong><br/>${lines.join('<br/>')}</div>`
}

function getBaseOption(xData, { legendData } = {}) {
  const isDark = theme.value === 'dark'
  const names = Array.isArray(legendData) ? legendData.filter(Boolean) : []
  return {
    backgroundColor: 'transparent',
    title: { show: false },
    legend: {
      show: names.length > 0,
      top: 8,
      left: 'center',
      icon: 'rect',
      itemWidth: 18,
      itemHeight: 3,
      itemGap: 16,
      data: names,
      textStyle: { color: isDark ? '#adbac7' : '#444d56', fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: {
        type: 'cross',
        label: {
          formatter (params) {
            if (params?.axisDimension === 'x') return String(params.value ?? '')
            return formatKlinePriceLabel(params?.value)
          }
        }
      },
      formatter: formatStockChartTooltip
    },
    grid: { left: '50', right: '20', top: names.length ? 36 : 16, bottom: '20' },
    xAxis: { 
      type: 'category', 
      data: xData, 
      axisLine: { lineStyle: { color: isDark ? '#444c56' : '#d1d5da' } }, 
      axisLabel: { color: isDark ? '#768390' : '#586069', fontSize: 11 } 
    },
    yAxis: { 
      scale: true, 
      splitLine: { lineStyle: { color: isDark ? '#2d333b' : '#eaecef' } }, 
      axisLabel: { color: isDark ? '#768390' : '#586069', fontSize: 11, formatter: formatKlinePriceLabel },
      axisPointer: { label: { formatter: (p) => formatKlinePriceLabel(p?.value) } }
    },
    dataZoom: [{ type: 'inside' }],
    animation: false
  }
}

// --- Data Zoom / Infinite Scroll ---
let isPaging = false
function handleDataZoom(params) {
  if (isPaging || isOneDayMinute.value || isIntradayGs.value) return
  
  // Get the start percentage of the zoom scale
  let start = 100
  if (params.batch && params.batch.length > 0) {
    start = params.batch[0].start
  } else if (params.start !== undefined) {
    start = params.start
  }

  if (start <= 1 && props.records?.length > 0) {
    const result = shiftVisibleEarlier({
      records: props.records,
      startDate: startDate.value,
      endDate: endDate.value,
    })
    if (result.action === 'shift') {
      startDate.value = result.start
      endDate.value = result.end
      drawChart()
      return
    }
    if (result.action === 'load-more') {
      const earliestDate = earliestTradeDate(props.records)
      if (!earliestDate) return
      isPaging = true
      emit('load-more', earliestDate)
      setTimeout(() => { isPaging = false }, 2500)
    }
  }
}

// --- Lifecycle ---
onMounted(async () => {
  if (props.records?.length && kType.value !== 'minute') {
    applyVisibleWindow(props.records)
  }
  if (kType.value === 'minute') {
    fetchMinuteData()
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

watch(() => kType.value, (t) => {
  if (t === 'minute') {
    fetchMinuteData()
    return
  }
  if (t === '30m' || t === '60m') {
    fetchIntradayGsBars()
    return
  }
  startDate.value = ''
  if (props.records?.length) applyVisibleWindow(props.records)
  drawChart()
})
watch(() => decisionGsEnabled.value, () => drawChart())

watch(() => props.symbol, (sym, prev) => {
  if (sym === prev || prev === undefined) return
  startDate.value = ''
  endDate.value = ''
  prevRecords = []
  prevSymbol = sym
  if (kType.value === 'minute') {
    fetchMinuteData()
  } else if (isIntradayGs.value) {
    fetchIntradayGsBars()
  }
})

watch(() => props.records, (newRecs) => {
  if (isOneDayMinute.value || isIntradayGs.value) return
  if (newRecs?.length) {
    applyVisibleWindow(newRecs)
  }
  drawChart()
}, { deep: true })

watch(detailMaximized, async () => {
  await nextTick()
  chartInstance?.resize()
})

const goBack = () => emit('go-back', { strategy: props.strategyFrom, preset: props.presetFrom })
</script>

<style scoped>
.stock-chart-anchor--held {
  height: 600px;
}

.unified-chart-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  border-radius: 6px;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
  overflow: hidden;
  border: 1px solid transparent;
}

.unified-chart-container.is-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 3000;
  height: 100vh;
  width: 100vw;
  max-height: none;
  border-radius: 0;
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
  padding: 8px 15px 10px;
  align-items: flex-start;
  gap: 12px;
}

.stock-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
  flex: 1;
  row-gap: 4px;
}

.header-actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  align-items: center;
}

.symbol-badge {
  color: #fff;
  background: #2ea44f;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: bold;
  margin-right: 10px;
  font-size: 13px;
  line-height: 1.3;
}
.stock-name { font-size: 16px; font-weight: 600; }
.data-count { color: #768390; font-size: 11px; margin-left: 10px; }
.gs-summary { color: #768390; font-size: 11px; margin-left: 10px; }
.light .data-count { color: #586069; }
.light .gs-summary { color: #586069; }

.chart-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  padding: 8px 15px;
  align-items: center;
}

.interval-selector { display: flex; border-radius: 4px; padding: 2px; }
.interval-btn { padding: 3px 10px; border: none; background: transparent; font-size: 12px; cursor: pointer; border-radius: 3px; font-weight: 500; }
.window-btn { margin-left: 4px; }

.theme-input { border: 1px solid; padding: 3px 6px; border-radius: 3px; font-size: 12px; outline: none; transition: border-color 0.2s; }
.theme-input:focus { border-color: #0366d6; }

.nav-controls { display: flex; gap: 4px; flex-shrink: 0; margin-left: auto; }
.btn-nav, .btn-action { border: 1px solid; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; font-weight: 500; transition: background 0.2s; }
.btn-nav:disabled, .btn-action:disabled { opacity: 0.4; cursor: not-allowed; }

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