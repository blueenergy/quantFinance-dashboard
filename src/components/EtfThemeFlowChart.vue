<template>
  <div class="theme-flow-chart" ref="containerRef">
    <div class="chart-header">
      <span class="title">{{ title }}</span>
      <span class="meta">{{ series.length }} 个交易日</span>
    </div>
    <div class="chart-main-wrapper" ref="chartWrapperRef">
      <div ref="chartRef" class="chart-canvas"></div>
      <div v-if="loading" class="chart-overlay loading"><div class="spinner"></div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  series: { type: Array, default: () => [] },
  flagshipCode: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const containerRef = ref(null)
const chartWrapperRef = ref(null)
const chartRef = ref(null)
let echarts = null
let chartInstance = null
let resizeOb = null

async function ensureEchartsAndInit() {
  if (!chartRef.value) return null
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
    resizeOb = new ResizeObserver(() => {
      if (chartInstance) chartInstance.resize()
    })
    if (containerRef.value) resizeOb.observe(containerRef.value)
  }
  return chartInstance
}

onMounted(async () => {
  await nextTick()
  if (!chartRef.value) return
  await ensureEchartsAndInit()
  if (props.series?.length) await drawChart()
})

onBeforeUnmount(() => {
  if (resizeOb) {
    try { resizeOb.disconnect() } catch (e) { /* noop */ }
    resizeOb = null
  }
  if (chartInstance) {
    try { chartInstance.dispose() } catch (e) { /* noop */ }
    chartInstance = null
  }
  echarts = null
})

watch(
  () => [props.series, props.loading],
  () => {
    if (props.loading && (!props.series || !props.series.length)) {
      if (chartInstance) {
        try { chartInstance.clear() } catch (e) { /* noop */ }
      }
      return
    }
    if (!props.series?.length) return
    nextTick(() => { void drawChart() })
  },
  { deep: true },
)

async function drawChart() {
  await ensureEchartsAndInit()
  if (!chartInstance || !props.series.length) return

  const dataList = [...props.series]
  const dates = dataList.map((r) => r.trade_date)
  const prices = dataList.map((r) => r.flagship_close ?? null)
  const shares = dataList.map((r) => r.total_share ?? 0)
  const flows = dataList.map((r) => ({
    value: r.net_inflow ?? 0,
    itemStyle: {
      color: (r.net_inflow ?? 0) >= 0 ? '#ef232a' : '#14b143',
    },
  }))

  const option = {
    backgroundColor: '#ffffff',
    textStyle: { color: '#475569' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: '8%', right: '8%', top: '6%', height: '38%' },
      { left: '8%', right: '8%', top: '50%', height: '18%' },
      { left: '8%', right: '8%', top: '74%', height: '18%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        gridIndex: 0,
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#94a3b8' } },
      },
      { type: 'category', data: dates, gridIndex: 1, axisLabel: { show: false }, axisLine: { show: false } },
      { type: 'category', data: dates, gridIndex: 2, axisLabel: { show: false }, axisLine: { show: false } },
    ],
    yAxis: [
      {
        scale: true,
        gridIndex: 0,
        name: '旗舰价',
        nameTextStyle: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#94a3b8' } },
      },
      {
        scale: true,
        gridIndex: 1,
        name: '份额(万)',
        nameTextStyle: { color: '#b45309' },
        splitLine: { show: false },
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#f59e0b' } },
      },
      {
        scale: true,
        gridIndex: 2,
        name: '净申购(万)',
        nameTextStyle: { color: '#64748b' },
        splitLine: { show: false },
        axisLabel: { color: '#64748b' },
        axisLine: { lineStyle: { color: '#94a3b8' } },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2], start: 0, end: 100 },
      { type: 'slider', xAxisIndex: [0, 1, 2], start: 0, end: 100, bottom: '1%', textStyle: { color: '#64748b' } },
    ],
    series: [
      {
        name: props.flagshipCode ? `${props.flagshipCode} 收盘` : '旗舰价格',
        type: 'line',
        data: prices,
        xAxisIndex: 0,
        yAxisIndex: 0,
        showSymbol: false,
        lineStyle: { width: 2, color: '#1890ff' },
      },
      {
        name: '合计份额',
        type: 'line',
        data: shares,
        xAxisIndex: 1,
        yAxisIndex: 1,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 2, color: '#ff9800' },
        areaStyle: { opacity: 0.15, color: '#ff9800' },
      },
      {
        name: '净申购',
        type: 'bar',
        data: flows,
        xAxisIndex: 2,
        yAxisIndex: 2,
      },
    ],
  }

  chartInstance.setOption(option, true)
}
</script>

<style scoped>
.theme-flow-chart {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  min-height: 420px;
}
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  color: #172033;
}
.title { font-weight: 600; }
.meta { font-size: 12px; color: #64748b; }
.chart-main-wrapper { position: relative; height: 420px; }
.chart-canvas { width: 100%; height: 100%; }
.chart-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #dbeafe;
  border-top-color: #0466c8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
