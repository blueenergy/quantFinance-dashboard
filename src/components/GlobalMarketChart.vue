<template>
  <div ref="containerRef" class="gmc-wrapper">
    <div class="gmc-toolbar">
      <button
        v-for="b in TF_BUTTONS"
        :key="b.value"
        class="tf-btn"
        :class="{ active: tf === b.value }"
        @click="setTf(b.value)"
      >{{ b.label }}</button>
      <button
        class="tf-btn"
        :class="{ active: measureMode }"
        title="拖拽选择区间"
        @click="toggleMeasure"
      >区间</button>
      <button
        class="tf-btn"
        :class="{ active: fibEnabled }"
        title="斐波那契回撤位"
        @click="toggleFib"
      >斐波那契</button>
      <span v-if="formingNote" class="gmc-live-note">{{ formingNote }}</span>
    </div>
    <div v-if="loading" class="gmc-loading">加载中…</div>
    <div v-else-if="error" class="gmc-error">{{ error }}</div>
    <div v-else-if="!records.length" class="gmc-empty">暂无数据</div>
    <div ref="chartRef" class="gmc-chart" />
    <div v-if="measureMode && measureStats" class="gmc-range-stats">
      <div class="gmc-range-stats__head">
        {{ fmtRangeDate(measureStats.startDate) }} → {{ fmtRangeDate(measureStats.endDate) }} · {{ measureStats.bars }} 根
      </div>
      <div>收盘 {{ fmtNum(measureStats.startClose) }} → {{ fmtNum(measureStats.endClose) }}</div>
      <div :class="measureStats.change >= 0 ? 'range-up' : 'range-dn'">
        涨跌 {{ measureStats.change >= 0 ? '+' : '' }}{{ fmtNum(measureStats.change) }}
        （{{ fmtPct(measureStats.pct) }}）
      </div>
      <div>最高 {{ fmtNum(measureStats.high) }} · 最低 {{ fmtNum(measureStats.low) }} · 振幅 {{ fmtPct(measureStats.amplitude) }}</div>
      <div v-if="measureStats.volume != null">量 {{ fmtVol(measureStats.volume) }}</div>
    </div>
    <div v-else-if="measureMode" class="gmc-range-hint">在图上拖拽选择区间</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import request from '../utils/request'
import { buildFibMarkLineData, buildFibOverlay } from '../utils/echarts/fibonacci'
import { computeRangeStats } from '../utils/echarts/rangeStats'

const FIB_ON_KEY = 'global-chart-fib-on'

// 均线口径按周期换算成相近的时间跨度（全球历史通常只有 2 年）
const MA_PERIODS = {
  '1d': { fast: 50, slow: 200 },
  '1w': { fast: 10, slow: 30 },
  '1m': { fast: 6, slow: 12 },
}

const props = defineProps({
  symbol: { type: String, required: true },
  name:   { type: String, default: '' },
})

const TF_BUTTONS = [
  { value: '1d', label: '日K' },
  { value: '1w', label: '周K' },
  { value: '1m', label: '月K' },
]

const tf = ref('1d')
const loading = ref(false)
const error = ref(null)
const records = ref([])
const formingDate = ref('')
const chartRef = ref(null)
const containerRef = ref(null)

let chartInstance = null
let resizeObs = null

const fibEnabled = ref(readStoredFibOn())
const measureMode = ref(false)
const measureStats = ref(null)

function readStoredFibOn() {
  try {
    return localStorage.getItem(FIB_ON_KEY) === '1'
  } catch {
    return false
  }
}

function toggleFib() {
  fibEnabled.value = !fibEnabled.value
  try {
    localStorage.setItem(FIB_ON_KEY, fibEnabled.value ? '1' : '0')
  } catch {
    // ignore quota / private-mode failures
  }
}

function toggleMeasure() {
  measureMode.value = !measureMode.value
  measureStats.value = null
  nextTick(() => renderChart())
}

function onBrushSelected(params) {
  if (!measureMode.value) return
  const areas = params?.batch?.[0]?.areas || []
  const range = areas[0]?.coordRange
  if (!Array.isArray(range) || range.length < 2) {
    measureStats.value = null
    return
  }
  measureStats.value = computeRangeStats(records.value, range[0], range[1])
}

function fmtNum(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '-'
}

function fmtPct(value) {
  if (!Number.isFinite(value)) return '-'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

function fmtRangeDate(value) {
  const s = String(value || '')
  if (s.length === 8 && /^\d+$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  return s.slice(0, 10)
}

function fmtVol(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return n >= 1e8 ? `${(n / 1e8).toFixed(2)}亿股` : `${(n / 1e4).toFixed(2)}万股`
}

function movingAverage(values, windowSize) {
  const out = []
  let sum = 0
  let count = 0
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (Number.isFinite(value)) {
      sum += value
      count += 1
    }
    if (i >= windowSize) {
      const dropped = values[i - windowSize]
      if (Number.isFinite(dropped)) {
        sum -= dropped
        count -= 1
      }
    }
    out.push(i >= windowSize - 1 && count === windowSize ? Number((sum / windowSize).toFixed(4)) : null)
  }
  return out
}

// 未收盘的那根：日线库只存已收盘交易日，盘中这根来自实时行情
const formingNote = computed(() => {
  if (!formingDate.value) return ''
  const d = String(formingDate.value).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
  return `${d} 未收盘`
})

async function loadData() {
  if (!props.symbol) return
  loading.value = true
  error.value = null
  formingDate.value = ''
  measureStats.value = null
  try {
    const res = await request({
      method: 'get',
      url: `/global-market/${encodeURIComponent(props.symbol)}/kline`,
      params: { tf: tf.value, limit: 500 },
    })
    // request.js interceptor returns response.data directly
    if (res?.success) {
      records.value = (res.data || []).slice().reverse() // ascending for echarts
      formingDate.value = res.forming_trade_date || ''
    } else {
      error.value = res?.error || '获取数据失败'
    }
  } catch (e) {
    error.value = e?.message || '请求失败'
  } finally {
    loading.value = false
  }
  await nextTick()
  renderChart()
}

function setTf(val) {
  if (tf.value === val) return
  tf.value = val
  loadData()
}

function renderChart() {
  if (!chartRef.value || !records.value.length) return
  // Skip if the DOM isn't laid out yet (e.g. dialog animation still in progress)
  if (!chartRef.value.clientWidth || !chartRef.value.clientHeight) return

  import('echarts').then(echarts => {
    if (!chartInstance) {
      chartInstance = echarts.init(chartRef.value, null, { renderer: 'canvas' })
      chartInstance.on('brushSelected', onBrushSelected)
    }

    const dates = records.value.map(r => r.trade_date)
    // 未收盘的那根永远是最后一根（日线是当天那根，周/月线是含它的当周/当月），
    // 画成空心，一眼能和已收盘的 K 线分开
    const formingIdx = formingDate.value ? records.value.length - 1 : -1
    // 着色口径 = 收盘 vs 前一交易日收盘，与 tooltip 的涨跌幅保持一致。
    // 跳空日两种口径会背离：11/23 纳指高开低走（open > close，蜡烛是阴线），
    // 但相对前收涨 6.5% —— 按阴阳画成绿色会和 tooltip 的 +6.5% 自相矛盾。
    const isUp = (r, i) => {
      const prev = i > 0 ? records.value[i - 1] : null
      return prev && prev.close > 0 ? r.close >= prev.close : r.close >= r.open
    }
    const ohlcv = records.value.map((r, i) => {
      const color = isUp(r, i) ? '#ef232a' : '#14b143'
      // color 与 color0 同色：ECharts 按阴阳在两者间取值，同色才能让
      // 「高开低走但仍高于前收」的蜡烛显示上涨色
      const itemStyle = {
        color,
        color0: color,
        borderColor: color,
        borderColor0: color,
      }
      if (i === formingIdx) {
        itemStyle.color = 'transparent'
        itemStyle.color0 = 'transparent'
        itemStyle.borderWidth = 2
      }
      return { value: [r.open, r.close, r.low, r.high], itemStyle }
    })
    const volumes = records.value.map((r, i) => ({
      value: r.volume,
      itemStyle: {
        color: isUp(r, i) ? '#ef232a' : '#14b143',
        opacity: i === formingIdx ? 0.55 : 1,
      },
    }))

    const hasVolume = records.value.some(r => r.volume > 0)

    const closes = records.value.map((r) => Number(r.close))
    const maPeriods = MA_PERIODS[tf.value] || MA_PERIODS['1d']
    const maSeries = [
      { period: maPeriods.fast, color: '#facc15' },
      { period: maPeriods.slow, color: '#a855f7' },
    ].map(({ period, color }) => ({
      name: `MA${period}`,
      type: 'line',
      data: movingAverage(closes, period),
      xAxisIndex: 0,
      yAxisIndex: 0,
      symbol: 'none',
      showSymbol: false,
      connectNulls: false,
      itemStyle: { color },
      lineStyle: { width: 1.2, color },
      emphasis: { focus: 'none' },
      z: 3,
    }))
    const overlay = fibEnabled.value ? buildFibOverlay(records.value) : null
    const fibMarkLines = overlay?.levels?.length ? buildFibMarkLineData(overlay.levels) : []

    const option = {
      backgroundColor: '#1a1a1a',
      animation: false,
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', crossStyle: { color: '#555' } },
        backgroundColor: '#2a2a2a',
        borderColor: '#444',
        textStyle: { color: '#ddd', fontSize: 12 },
        formatter(params) {
          const k = params.find(p => p.seriesType === 'candlestick')
          if (!k) return ''
          // Use dataIndex to read directly from our records array — no ambiguity
          const r = records.value[k.dataIndex]
          if (!r) return ''
          const isForming = k.dataIndex === formingIdx
          const date = String(r.trade_date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
          const fmt = n => (n == null ? '-' : Number(n).toFixed(2))
          const prev = k.dataIndex > 0 ? records.value[k.dataIndex - 1] : null
          const pct = (prev && prev.close > 0) ? ((r.close - prev.close) / prev.close * 100) : null
          const pctStr = pct == null ? '' : (pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`)
          const pctColor = pct == null ? '#aaa' : (pct >= 0 ? '#ef232a' : '#14b143')
          let html = `<div style="font-size:11px;line-height:1.8">`
          html += `<b>${date}</b>`
          if (isForming) html += ` <span style="color:#e8a33d">未收盘</span>`
          if (pctStr) html += ` <span style="color:${pctColor};font-weight:bold">${pctStr}</span>`
          html += `<br/>开 <b>${fmt(r.open)}</b> &nbsp; 收 <b>${fmt(r.close)}</b><br/>`
          html += `高 <b>${fmt(r.high)}</b> &nbsp; 低 <b>${fmt(r.low)}</b>`
          if (r.volume > 0) html += `<br/>股数 <b>${(r.volume / 1e8).toFixed(2)}亿股</b>`
          html += '</div>'
          return html
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      grid: hasVolume
        ? [{ top: 30, bottom: 90, left: 55, right: 8, height: '58%' },
           { top: '72%', bottom: 55, left: 55, right: 8 }]
        : [{ top: 30, bottom: 55, left: 55, right: 8 }],
      xAxis: hasVolume
        ? [
            { type: 'category', data: dates, gridIndex: 0, scale: true,
              axisLabel: { color: '#888', fontSize: 10 }, axisLine: { lineStyle: { color: '#444' } },
              splitLine: { show: false }, axisTick: { show: false } },
            { type: 'category', data: dates, gridIndex: 1, scale: true,
              axisLabel: { show: false }, axisLine: { lineStyle: { color: '#444' } },
              splitLine: { show: false }, axisTick: { show: false } },
          ]
        : [{ type: 'category', data: dates, gridIndex: 0, scale: true,
             axisLabel: { color: '#888', fontSize: 10 }, axisLine: { lineStyle: { color: '#444' } },
             splitLine: { show: false }, axisTick: { show: false } }],
      yAxis: hasVolume
        ? [
            { type: 'value', gridIndex: 0, scale: true, splitNumber: 5,
              axisLabel: { color: '#888', fontSize: 10 }, axisLine: { show: false },
              splitLine: { lineStyle: { color: '#2a2a2a' } } },
            { type: 'value', gridIndex: 1, scale: true, splitNumber: 3,
              axisLabel: { color: '#888', fontSize: 10 }, axisLine: { show: false },
              splitLine: { lineStyle: { color: '#2a2a2a' } } },
          ]
        : [{ type: 'value', gridIndex: 0, scale: true, splitNumber: 5,
             axisLabel: { color: '#888', fontSize: 10 }, axisLine: { show: false },
             splitLine: { lineStyle: { color: '#2a2a2a' } } }],
      ...(measureMode.value ? {
        brush: {
          xAxisIndex: 'all',
          brushType: 'lineX',
          brushMode: 'single',
          throttleType: 'debounce',
          throttleDelay: 120,
          brushStyle: {
            color: 'rgba(56,189,248,0.12)',
            borderColor: 'rgba(56,189,248,0.75)',
            borderWidth: 1,
          },
        },
      } : {}),
      dataZoom: [
        { type: 'inside', xAxisIndex: hasVolume ? [0, 1] : [0], start: 60, end: 100, moveOnMouseMove: !measureMode.value },
        { type: 'slider', xAxisIndex: hasVolume ? [0, 1] : [0], start: 60, end: 100,
          bottom: 8, height: 20,
          fillerColor: 'rgba(80,80,180,0.2)', borderColor: '#333',
          handleStyle: { color: '#5555cc' },
          textStyle: { color: '#888', fontSize: 10 } },
      ],
      legend: {
        data: maSeries.map((s) => s.name),
        top: 4,
        right: 10,
        itemWidth: 14,
        itemHeight: 3,
        itemGap: 10,
        icon: 'roundRect',
        textStyle: { color: '#999', fontSize: 10 },
      },
      series: [
        {
          type: 'candlestick',
          data: ohlcv,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: {
            color: '#ef232a',        // up candle body fill
            color0: '#14b143',       // down candle body fill
            borderColor: '#ef232a',  // up border
            borderColor0: '#14b143', // down border
          },
          ...(fibMarkLines.length
            ? { markLine: { symbol: 'none', silent: true, data: fibMarkLines } }
            : {}),
        },
        ...maSeries,
        ...(hasVolume ? [{
          name: 'vol',
          type: 'bar',
          data: volumes,
          xAxisIndex: 1,
          yAxisIndex: 1,
          barMaxWidth: 6,
        }] : []),
      ],
    }

    chartInstance.setOption(option, true)
    if (measureMode.value) {
      chartInstance.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: { brushType: 'lineX', brushMode: 'single' },
      })
    }
  })
}

// Responsive resize — also triggers first render when dialog animation gives us real dimensions
function setupResizeObserver() {
  if (!containerRef.value) return
  resizeObs = new ResizeObserver(() => {
    if (chartInstance) {
      chartInstance.resize()
    } else if (records.value.length) {
      // DOM just became visible (dialog opened); now we can init ECharts
      renderChart()
    }
  })
  resizeObs.observe(containerRef.value)
}

onMounted(() => {
  setupResizeObserver()
  loadData()
})

onBeforeUnmount(() => {
  resizeObs?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})

watch(() => props.symbol, () => {
  tf.value = '1d'
  loadData()
})

watch(fibEnabled, () => renderChart())
</script>

<style scoped>
.gmc-wrapper {
  width: 100%;
  height: 460px;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
  position: relative;
}

.gmc-range-stats {
  position: absolute;
  left: 12px;
  bottom: 40px;
  z-index: 5;
  min-width: 210px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(20, 20, 20, 0.92);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #ccc;
  font-size: 11px;
  line-height: 1.55;
  pointer-events: none;
}

.gmc-range-stats__head {
  color: #7dd3fc;
  font-weight: 600;
  margin-bottom: 2px;
}

.gmc-range-stats .range-up {
  color: #ef232a;
}

.gmc-range-stats .range-dn {
  color: #14b143;
}

.gmc-range-hint {
  position: absolute;
  left: 12px;
  bottom: 40px;
  z-index: 5;
  padding: 5px 9px;
  border-radius: 6px;
  background: rgba(20, 20, 20, 0.85);
  color: #888;
  font-size: 11px;
  pointer-events: none;
}
.gmc-toolbar {
  display: flex;
  gap: 4px;
  padding: 6px 12px 4px;
  flex-shrink: 0;
}
.tf-btn {
  background: #2a2a2a;
  border: 1px solid #444;
  color: #aaa;
  border-radius: 3px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.tf-btn:hover { background: #3a3a3a; color: #ddd; }
.tf-btn.active { background: #4a4aaa; border-color: #6666cc; color: #fff; }
.gmc-live-note {
  margin-left: auto;
  align-self: center;
  font-size: 11px;
  color: #e8a33d;
  white-space: nowrap;
}
.gmc-chart {
  flex: 1;
  min-height: 360px;
}
.gmc-loading,
.gmc-error,
.gmc-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-size: 13px;
}
.gmc-error { color: #e66; }
</style>
