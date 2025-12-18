<template>
  <div class="market-spectrum-page">
    <h3 class="page-title">市场阴阳谱</h3>
  <div class="controls flex-column gap-sm">
  <div class="date-range flex-row-center gap-sm wrap">
        <label>开始日期:</label>
        <input type="date" v-model="startDate" :max="today" />
        <label>结束日期:</label>
        <input type="date" v-model="endDate" :max="today" />
  <button @click="fetchSpectrum" :disabled="loading || !startDate || !endDate" class="btn-base btn-sm btn-gradient-blue">加载</button>
  <button @click="refreshCurrent" :disabled="loading" class="btn-base btn-sm btn-gradient-teal">刷新</button>
      </div>
<div class="quick-range flex-row-center gap-sm wrap">
        <span class="qr-label">快捷区间:</span>
        <button @click="setQuickRange(7)" :disabled="loading" class="btn-base btn-sm btn-gradient-orange">最近7天</button>
        <button @click="setQuickRange(30)" :disabled="loading" class="btn-base btn-sm btn-gradient-orange">最近30天</button>
        <button @click="setQuickRange(90)" :disabled="loading" class="btn-base btn-sm btn-gradient-orange">最近90天</button>
      </div>
      <div class="mode-toggle flex-row-center gap-sm wrap">
        <span class="qr-label">周期:</span>
        <button @click="setMode('daily')" :disabled="loading || mode === 'daily'" class="btn-base btn-sm btn-gradient-blue">日线</button>
        <button @click="setMode('minute')" :disabled="loading || mode === 'minute'" class="btn-base btn-sm btn-gradient-teal">分钟线</button>
      </div>
      <div v-if="mode === 'minute'" class="mode-toggle flex-row-center gap-sm wrap">
        <span class="qr-label">曲线:</span>
        <button @click="setCurveType('daily_realtime')" :disabled="loading || curveType === 'daily_realtime'" class="btn-base btn-xs btn-gradient-blue">日线实时</button>
        <button @click="setCurveType('minute')" :disabled="loading || curveType === 'minute'" class="btn-base btn-xs btn-gradient-orange">分钟MA</button>
      </div>
      <div class="hint">阳谱(yang_spectrum) 是上涨占比, 阴谱(yin_spectrum) 是下跌/未达标占比</div>
    </div>

  <!-- 折线图展示：使用 v-show 保持 DOM，避免 ref 在首次更新时不存在 -->
  <div ref="chartRef" class="spectrum-chart" v-show="records.length > 0"></div>

  <div v-if="loading" class="loading text-subtle">加载中...</div>
  <div v-else-if="records.length === 0" class="empty text-subtle">暂无数据, 请调整日期范围</div>

    <table v-else class="spectrum-table">
      <thead>
        <tr>
          <th>时间</th>
          <th>阳谱%</th>
          <th>阴谱%</th>
          <th>上涨股票数</th>
          <th>下跌股票数</th>
          <th>总股票数</th>
          <th>信号</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in displayRecords" :key="row.trade_date">
          <td>{{ formatDate(row.trade_date) }}</td>
          <td>{{ toPercent(row.yang_spectrum) }}</td>
          <td>{{ toPercent(row.yin_spectrum) }}</td>
          <td>{{ row.aboveCount }}</td>
          <td>{{ row.belowCount }}</td>
          <td>{{ row.total_stocks }}</td>
          <td>
            <span v-if="row.yang_spectrum <= 0.35" class="signal silver" title="阳谱低于35%: 银手指">🤍 银手指</span>
            <span v-else-if="row.yang_spectrum >= 0.50" class="signal gold" title="阳谱高于50%: 金手指">💛 金手指</span>
            <span v-else class="signal neutral" title="无强信号">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import axios from 'axios'
// Lazy-load ECharts to reduce initial bundle size
let echarts
import { chartColors } from '../theme/chartTheme.js'

// 默认展示最近30天，提升首次加载可视化体验
const todayDate = new Date()
const startDateObj = new Date()
startDateObj.setDate(startDateObj.getDate() - 30)
const today = todayDate.toISOString().slice(0,10)
const startDate = ref(startDateObj.toISOString().slice(0,10))
const endDate = ref(today)
const records = ref([])
const displayRecords = computed(() => {
  return records.value.map(r => ({
    ...r,
    aboveCount: r.above_ma5_count ?? r.above_ma_count,
    belowCount: r.below_ma5_count ?? r.below_ma_count,
  }))
})
const loading = ref(false)
const chartRef = ref(null)
let chartInstance = null


const mode = ref('daily')
const curveType = ref('daily_realtime')

function formatDate(ymd) {
  if (!ymd) return ''
  if (typeof ymd !== 'string') ymd = String(ymd)
  if (ymd.includes('-')) return ymd
  const datePart = `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`
  if (ymd.length > 8) {
    const timePart = `${ymd.slice(8,10)}:${ymd.slice(10,12)}`
    return `${datePart} ${timePart}`
  }
  return datePart
}
function toPercent(v) { return (v * 100).toFixed(2) + '%' }
function ymd(dateStr) { return dateStr.replace(/-/g,'') }

function buildMinuteRange() {
  const start = ymd(startDate.value) + '0930'
  const end = ymd(endDate.value) + '1500'
  return { start, end }
}

async function fetchSpectrum() {
  if (!startDate.value || !endDate.value) return
  loading.value = true
  try {
    let url
    if (mode.value === 'daily') {
      url = `/api/market-spectrum?start_date=${ymd(startDate.value)}&end_date=${ymd(endDate.value)}`
    } else {
      const { start, end } = buildMinuteRange()
      url = `/api/market-spectrum-minute?start_time=${start}&end_time=${end}&ma_period=5&type=${curveType.value}`
    }
    const resp = await axios.get(url)
    const arr = Array.isArray(resp.data?.data) ? resp.data.data : []
    // 按日期升序排序，确保图表顺序
    arr.sort((a,b) => a.trade_date.localeCompare(b.trade_date))
    records.value = arr
    await nextTick() // 确保 chartRef 已渲染
    updateChart()
  } catch (e) {
    console.error('获取阴阳谱失败', e)
    records.value = []
    await nextTick()
    updateChart()
  } finally {
    loading.value = false
  }
}

function refreshCurrent() {
  if (!startDate.value || !endDate.value) return
  fetchSpectrum().catch(err => console.error('刷新失败', err))
}

function setQuickRange(days) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days + 1) // 包含今天在内的最近 N 天
  startDate.value = start.toISOString().slice(0,10)
  endDate.value = end.toISOString().slice(0,10)
  refreshCurrent()
}

function setMode(m) {
  if (mode.value === m) return
  mode.value = m
  // 切换模式后自动刷新当前选择区间
  refreshCurrent()
}

function setCurveType(t) {
  if (curveType.value === t) return
  curveType.value = t
  if (mode.value === 'minute') {
    refreshCurrent()
  }
}


async function updateChart() {
  if (!chartRef.value) return
  if (!chartInstance) {
    if (!echarts) {
      const mod = await import('echarts')
      echarts = mod.default || mod
    }
    chartInstance = echarts.init(chartRef.value)
    window.addEventListener('resize', handleResize)
  }
  if (!records.value || records.value.length === 0) {
    chartInstance.clear()
    return
  }
  const dates = records.value.map(r => formatDate(r.trade_date))
  const yangVals = records.value.map(r => r.yang_spectrum)
  const yinVals = records.value.map(r => r.yin_spectrum)
  const option = {
    backgroundColor: '#ffffff',
    tooltip: {
      trigger: 'axis',
      valueFormatter: v => (v * 100).toFixed(2) + '%'
    },
    legend: { data: ['阳谱', '阴谱'] },
    grid: { left: '6%', right: '4%', top: 50, bottom: 70 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLabel: { rotate: dates.length > 14 ? 45 : 0 }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      axisLabel: { formatter: v => (v * 100).toFixed(0) + '%' },
  splitLine: { lineStyle: { color: chartColors.gridLine } }
    },
    dataZoom: [
      { type: 'slider', start: 0, end: 100, height: 18, bottom: 40 },
      { type: 'inside' }
    ],
    series: [
      {
        name: '阳谱',
        type: 'line',
        smooth: true,
        data: yangVals,
  lineStyle: { width: 2, color: chartColors.yangLine },
  areaStyle: { opacity: 0.15, color: chartColors.yangArea },
  // 已移除首次银/金手指标记，保留阈值虚线
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: chartColors.thresholdLine },
          data: [
            { yAxis: 0.35, name: '银手指阈值 35%' },
            { yAxis: 0.50, name: '金手指阈值 50%' }
          ],
          label: { formatter: ({ value }) => (value * 100) + '%', position: 'end' }
        }
      },
      {
        name: '阴谱',
        type: 'line',
        smooth: true,
        data: yinVals,
  lineStyle: { width: 2, color: chartColors.yinLine },
  areaStyle: { opacity: 0.10, color: chartColors.yinArea }
      }
    ]
  }
  chartInstance.setOption(option, true)
  chartInstance.resize() // 强制适配宽度
}

function handleResize() {
  if (chartInstance) chartInstance.resize()
}

watch(records, () => {
  updateChart()
}, { deep: true })

onMounted(() => {
  // 首次自动加载默认区间数据
  fetchSpectrum().catch(err => console.error('首次加载失败', err))
})

onBeforeUnmount(() => {
  if (chartInstance) {
    window.removeEventListener('resize', handleResize)
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.market-spectrum-page { background:#fff; padding:16px; border-radius:8px; }
.page-title { margin:0 0 16px; font-size:20px; }
.controls { margin-bottom:12px; display:flex; flex-direction:column; gap:8px; }
.date-range { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.date-range input { padding:6px 8px; border:1px solid #ccc; border-radius:4px; }
/* buttons now use global utilities; keep disabled override */
.date-range button:disabled { opacity:.55; cursor:not-allowed; }
.quick-range { margin-top:4px; }
.mode-toggle { margin-top:4px; }
.hint { font-size:12px; color:#666; }
.mode-toggle .btn-xs { padding:2px 6px; font-size:11px; }
.loading, .empty { padding:20px; text-align:center; color:#555; }
.spectrum-chart { width:100%; height:320px; margin-bottom:16px; border:1px solid #e2e8f0; border-radius:6px; }
.spectrum-table { width:100%; border-collapse:collapse; }
.spectrum-table th, .spectrum-table td { border:1px solid #e2e8f0; padding:6px 8px; font-size:13px; text-align:center; }
.spectrum-table th { background:#f1f5f9; }
.signal { font-weight:700; display:inline-flex; align-items:center; gap:4px; }
.signal.gold { color:#d4af37; }
.signal.silver { color:#a9a9a9; }
.signal.neutral { color:#666; font-weight:400; }
</style>
