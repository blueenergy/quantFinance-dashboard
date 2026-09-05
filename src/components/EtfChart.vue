<template>
  <div class="unified-chart-container" ref="containerRef">
    <div class="chart-header">
      <div class="stock-info">
        <span class="symbol-badge">{{ props.symbol }}</span>
        <span class="stock-name">{{ props.name || '' }}</span>
        <span class="data-count">{{ klineCountLabel }}</span>
      </div>
    </div>

    <!-- Main Chart -->
    <div class="chart-main-wrapper" ref="chartWrapperRef">
      <div ref="chartRef" class="chart-canvas"></div>
      <div v-if="props.loading" class="chart-overlay loading"><div class="spinner"></div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { formatAssetPrice } from '../utils/assetPriceFormat.js'

const props = defineProps({
  symbol: String,
  name: String,
  /** 1d | 1w | 1m — matches API /api/etf/.../kline?tf= */
  tf: { type: String, default: '1d' },
  /** True while parent fetches kline (especially weekly / monthly aggregate). */
  loading: { type: Boolean, default: false },
  records: { type: Array, default: () => [] }
})

const tfLabel = computed(() => {
  const t = (props.tf || '1d').toLowerCase()
  if (t === '1w' || t === 'w') return '周K'
  if (t === '1m' || t === 'm') return '月K'
  return '日K'
})

const klineCountLabel = computed(() => {
  if (props.loading) {
    return `加载中… · ${tfLabel.value}`
  }
  return `${props.records?.length || 0} 根 · ${tfLabel.value}`
})

const containerRef = ref(null)
const chartWrapperRef = ref(null)
const chartRef = ref(null)
/** 懒加载，避免把整包 echarts 打进主 chunk */
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
    if (containerRef.value) {
      resizeOb.observe(containerRef.value)
    }
  }
  return chartInstance
}

onMounted(async () => {
  await nextTick()
  if (!chartRef.value) return
  await ensureEchartsAndInit()
  if (props.records?.length) {
    await drawChart()
  }
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
  () => [props.records, props.loading, props.tf],
  () => {
    if (props.loading && (!props.records || !props.records.length)) {
      if (chartInstance) {
        try { chartInstance.clear() } catch (e) { /* noop */ }
      }
      return
    }
    if (!props.records || !props.records.length) {
      if (chartInstance) {
        try { chartInstance.clear() } catch (e) { /* noop */ }
      }
      return
    }
    nextTick(() => {
      void drawChart()
    })
  },
  { deep: true }
)

async function drawChart() {
  await ensureEchartsAndInit()
  if (!chartInstance || !props.records.length) return

  // Sort data ascending for echarts
  // The records from the API are descending, so reverse a copy
  const dataList = [...props.records].reverse()
  
  const dates = dataList.map(r => r.trade_date)
  const klineData = dataList.map(r => [
    r.pre_adj_open, 
    r.pre_adj_close, 
    r.pre_adj_low, 
    r.pre_adj_high
  ])
  
  const volumes = dataList.map(r => ({
    value: r.vol,
    itemStyle: {
      color: r.pre_adj_close >= r.pre_adj_open ? '#ef232a' : '#14b143'
    }
  }))
  
  const shares = dataList.map(r => r.fd_share || 0)

  const option = {
    backgroundColor: '#ffffff',
    textStyle: { color: '#475569' },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params) => {
        if (!Array.isArray(params) || !params.length) return ''
        const lines = [String(params[0].axisValue ?? '')]
        for (const p of params) {
          if (p.seriesType === 'candlestick') {
            const arr = Array.isArray(p.data) ? p.data : p.value
            if (Array.isArray(arr) && arr.length >= 4) {
              lines.push(
                `开 ${formatAssetPrice(arr[0], 'etf')}　收 ${formatAssetPrice(arr[1], 'etf')}<br/>`
                + `低 ${formatAssetPrice(arr[2], 'etf')}　高 ${formatAssetPrice(arr[3], 'etf')}`
              )
            }
            continue
          }
          if (p.seriesName) {
            const raw = Array.isArray(p.data) ? p.data : p.value
            const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw.value : raw
            lines.push(`${p.marker || ''}${p.seriesName}: ${value ?? '-'}`)
          }
        }
        return lines.filter(Boolean).join('<br/>')
      },
    },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: '8%', right: '8%', top: '5%', height: '50%' },     // K-line
      { left: '8%', right: '8%', top: '60%', height: '15%' },    // Volume
      { left: '8%', right: '8%', top: '80%', height: '15%' }     // Shares
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        gridIndex: 0,
        axisLabel: { color: '#64748b' },
        axisLine: { onZero: false, lineStyle: { color: '#94a3b8' } },
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 1,
        axisLabel: { show: false },
        axisLine: { show: false }
      },
      {
        type: 'category',
        data: dates,
        gridIndex: 2,
        axisLabel: { show: false },
        axisLine: { show: false }
      }
    ],
    yAxis: [
      {
        scale: true,
        gridIndex: 0,
        splitLine: { show: true, lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#64748b', formatter: (v) => formatAssetPrice(v, 'etf') },
        axisLine: { lineStyle: { color: '#94a3b8' } },
        axisPointer: { label: { formatter: (p) => formatAssetPrice(p?.value, 'etf') } },
      },
      {
        scale: true,
        gridIndex: 1,
        splitLine: { show: false },
        axisLabel: { show: false },
        axisLine: { show: false }
      },
      {
        scale: true,
        gridIndex: 2,
        splitLine: { show: false },
        axisLabel: { show: true, color: '#b45309', formatter: '{value}万' },
        axisLine: { show: false }
      }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2], start: 50, end: 100 },
      { type: 'slider', xAxisIndex: [0, 1, 2], start: 50, end: 100, bottom: '2%', textStyle: { color: '#64748b' } }
    ],
    series: [
      {
        name: '前复权K线',
        type: 'candlestick',
        data: klineData,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: {
          color: '#ef232a',
          color0: '#14b143',
          borderColor: '#ef232a',
          borderColor0: '#14b143'
        }
      },
      {
        name: '成交量',
        type: 'bar',
        data: volumes,
        xAxisIndex: 1,
        yAxisIndex: 1
      },
      {
        name: 'ETF份额(万份)',
        type: 'line',
        data: shares,
        xAxisIndex: 2,
        yAxisIndex: 2,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2, color: '#ff9800' },
        areaStyle: {
          opacity: 0.2,
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#ff9800' },
            { offset: 1, color: 'transparent' }
          ])
        }
      }
    ]
  }

  chartInstance.setOption(option, true)
}
</script>

<style scoped>
.unified-chart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  background: #ffffff;
  color: #172033;
}

.chart-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e2e8f0;
}

.stock-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.symbol-badge {
  background: #0466c8;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.9em;
}

.stock-name {
  font-size: 1.1em;
  font-weight: 500;
}

.data-count {
  color: #64748b;
  font-size: 0.85em;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 10px;
}

.chart-main-wrapper {
  flex: 1;
  position: relative;
  min-height: 400px;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.chart-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  z-index: 10;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #dbeafe;
  border-radius: 50%;
  border-top-color: #0466c8;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
