<template>
  <div class="market-spectrum-page">
    <h3 class="page-title">市场阴阳谱</h3>
    <div class="controls">
      <div class="date-range">
        <label>开始日期:</label>
        <input type="date" v-model="startDate" :max="today" />
        <label>结束日期:</label>
        <input type="date" v-model="endDate" :max="today" />
        <button @click="fetchSpectrum" :disabled="loading || !startDate || !endDate">加载</button>
        <button @click="refreshCurrent" :disabled="loading">刷新</button>
      </div>
      <div class="quick-range">
        <span class="qr-label">快捷区间:</span>
        <button @click="setQuickRange(7)" :disabled="loading">最近7天</button>
        <button @click="setQuickRange(30)" :disabled="loading">最近30天</button>
        <button @click="setQuickRange(90)" :disabled="loading">最近90天</button>
      </div>
      <div class="hint">阳谱(yang_spectrum) 是上涨占比, 阴谱(yin_spectrum) 是下跌/未达标占比</div>
    </div>

  <!-- 折线图展示：使用 v-show 保持 DOM，避免 ref 在首次更新时不存在 -->
  <div ref="chartRef" class="spectrum-chart" v-show="records.length > 0"></div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="records.length === 0" class="empty">暂无数据, 请调整日期范围</div>

    <table v-else class="spectrum-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>阳谱%</th>
          <th>阴谱%</th>
          <th>上涨股票数</th>
          <th>下跌股票数</th>
          <th>总股票数</th>
          <th>信号</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in records" :key="row.trade_date">
          <td>{{ formatDate(row.trade_date) }}</td>
          <td>{{ toPercent(row.yang_spectrum) }}</td>
          <td>{{ toPercent(row.yin_spectrum) }}</td>
          <td>{{ row.above_ma5_count }}</td>
          <td>{{ row.below_ma5_count }}</td>
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
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'

// 默认展示最近30天，提升首次加载可视化体验
const todayDate = new Date()
const startDateObj = new Date()
startDateObj.setDate(startDateObj.getDate() - 30)
const today = todayDate.toISOString().slice(0,10)
const startDate = ref(startDateObj.toISOString().slice(0,10))
const endDate = ref(today)
const records = ref([])
const loading = ref(false)
const chartRef = ref(null)
let chartInstance = null


function formatDate(ymd) {
  if (!ymd) return ''
  if (ymd.includes('-')) return ymd
  return `${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}`
}
function toPercent(v) { return (v * 100).toFixed(2) + '%' }
function ymd(dateStr) { return dateStr.replace(/-/g,'') }

async function fetchSpectrum() {
  if (!startDate.value || !endDate.value) return
  loading.value = true
  try {
    const url = `/api/market-spectrum?start_date=${ymd(startDate.value)}&end_date=${ymd(endDate.value)}`
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


function updateChart() {
  if (!chartRef.value) return
  if (!chartInstance) {
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
      splitLine: { lineStyle: { color: '#e2e8f0' } }
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
        lineStyle: { width: 2, color: '#ffb300' },
        areaStyle: { opacity: 0.15, color: '#ffe082' },
  // 已移除首次银/金手指标记，保留阈值虚线
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', color: '#999' },
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
        lineStyle: { width: 2, color: '#1e88e5' },
        areaStyle: { opacity: 0.10, color: '#90caf9' }
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
.date-range button { padding:6px 14px; background:#0466c8; color:#fff; border:none; border-radius:4px; cursor:pointer; }
.date-range button:disabled { background:#9aa7b4; cursor:not-allowed; }
.hint { font-size:12px; color:#666; }
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
