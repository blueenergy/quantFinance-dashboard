<template>
  <div class="unified-chart-container dark" ref="containerRef">
    <div class="chart-header">
      <div class="stock-info">
        <span class="symbol-badge">{{ props.symbol }}</span>
        <span class="stock-name">{{ props.name || '' }}</span>
        <span class="data-count">{{ records?.length || 0 }} 天数据</span>
      </div>
    </div>

    <!-- Main Chart -->
    <div class="chart-main-wrapper" ref="chartWrapperRef">
      <div ref="chartRef" class="chart-canvas"></div>
      <div v-if="loading" class="chart-overlay loading"><div class="spinner"></div></div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  symbol: String,
  name: String,
  records: { type: Array, default: () => [] }
})

const containerRef = ref(null)
const chartWrapperRef = ref(null)
const chartRef = ref(null)
const loading = ref(false)
let chartInstance = null

onMounted(() => {
  if (chartRef.value) {
    chartInstance = echarts.init(chartRef.value)
    
    // Resize observer
    const resizeOb = new ResizeObserver(() => {
      if (chartInstance) chartInstance.resize()
    })
    resizeOb.observe(containerRef.value)
    
    if (props.records && props.records.length > 0) {
      drawChart()
    }
  }
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})

watch(() => props.records, () => {
  drawChart()
}, { deep: true })

function drawChart() {
  if (!chartInstance || !props.records.length) return
  
  // Sort data ascending for echarts
  // The records from API are descending, so reverse a copy
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
    backgroundColor: '#1a1a1a',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' }
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
        axisLine: { onZero: false, lineStyle: { color: '#8392A5' } },
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
        splitLine: { show: true, lineStyle: { color: '#2a2a2a' } },
        axisLine: { lineStyle: { color: '#8392A5' } }
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
        axisLabel: { show: true, color: '#ff9800', formatter: '{value}万' },
        axisLine: { show: false }
      }
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1, 2], start: 50, end: 100 },
      { type: 'slider', xAxisIndex: [0, 1, 2], start: 50, end: 100, bottom: '2%', textStyle: { color: '#8392A5' } }
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
  background: #1a1a1a;
  color: #fff;
}

.chart-header {
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #2a2a2a;
}

.stock-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.symbol-badge {
  background: #1890ff;
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
  color: #888;
  font-size: 0.85em;
  background: #2a2a2a;
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
  background: rgba(26, 26, 26, 0.7);
  z-index: 10;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  border-top-color: #1890ff;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
