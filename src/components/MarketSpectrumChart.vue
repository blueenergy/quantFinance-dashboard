<template>
  <v-card class="market-spectrum-chart-card mb-4" variant="outlined">
    <v-card-title class="d-flex align-center py-2">
      <span class="text-subtitle-1 font-weight-bold">📊 市场涨跌全景图 (Market Spectrum)</span>
      <v-spacer></v-spacer>
      <v-chip v-if="upDownRatio" size="small" color="primary" variant="flat" class="mr-2">
        涨跌比: {{ upDownRatio }}
      </v-chip>
      <v-btn icon size="x-small" variant="text" @click="fetchData">🔄</v-btn>
    </v-card-title>
    
    <v-divider></v-divider>
    
    <v-card-text class="pa-0 relative">
      <div v-if="loading" class="d-flex justify-center align-center" style="height: 300px;">
        <v-progress-circular indeterminate color="primary"></v-progress-circular>
      </div>
      
      <div v-else-if="!hasData" class="d-flex justify-center align-center text-grey" style="height: 300px;">
        暂无 {{ date }} 的分布数据
      </div>
      
      <div v-else class="chart-container">
        <!-- 汇总信息覆盖层 -->
        <div class="summary-overlay d-flex justify-space-around pa-2">
          <div class="summary-item">
            <span class="text-caption text-grey">情绪得分: </span>
            <span class="text-subtitle-2 font-weight-bold" :class="getSentimentColor(indicators?.sentiment_score)">
              {{ indicators?.sentiment_score || '--' }}
            </span>
          </div>
          <div class="summary-item">
            <span class="text-caption text-grey">高标数: </span>
            <span class="text-subtitle-2 font-weight-bold text-orange">
              {{ indicators?.high_tier_count || 0 }}
            </span>
          </div>
          <div class="summary-item">
            <span class="text-caption text-grey">晋级率: </span>
            <span class="text-subtitle-2 font-weight-bold text-purple">
              {{ formatPercent(indicators?.promotion_rate) }}
            </span>
          </div>
        </div>
        
        <div ref="chartRef" style="height: 260px; width: 100%;"></div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { getMarketSpectrum } from '../api/ladder'
import * as echarts from 'echarts'

const props = defineProps({
  date: {
    type: String,
    required: true
  },
  indicators: {
    type: Object,
    default: () => ({})
  }
})

const chartRef = ref(null)
const loading = ref(false)
const hasData = ref(false)
const spectrumData = ref(null)
let chartInstance = null

const upDownRatio = computed(() => {
  if (!spectrumData.value || !spectrumData.value.distribution) return null
  const d = spectrumData.value.distribution
  const up = (d.limit_up || 0) + (d.gt_7 || 0) + (d.p5_7 || 0) + (d.p2_5 || 0) + (d.p0_2 || 0)
  const down = (d.limit_down || 0) + (d.lt_m7 || 0) + (d.m7_5 || 0) + (d.m5_2 || 0) + (d.m2_0 || 0)
  return `${up} / ${down}`
})

async function fetchData() {
  if (!props.date) return
  loading.value = true
  try {
    const formattedDate = props.date.replace(/-/g, '')
    const res = await getMarketSpectrum(formattedDate)
    
    if (res.data && res.data.length > 0) {
      spectrumData.value = res.data[0]
      hasData.value = !!spectrumData.value.distribution
    } else {
      spectrumData.value = null
      hasData.value = false
    }
    
    // Wait for v-if block to render and chart div to be mounted
    await nextTick()
    
    if (hasData.value && chartRef.value) {
      initChart()
    } else if (hasData.value && !chartRef.value) {
      await nextTick()
      if (chartRef.value) {
        initChart()
      }
    }
  } catch (error) {
    hasData.value = false
  } finally {
    loading.value = false
  }
}

function initChart() {
  if (!chartRef.value || !spectrumData.value?.distribution) return
  
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
    window.addEventListener('resize', () => chartInstance?.resize())
  }
  
  const d = spectrumData.value.distribution
  // 11 bins: LimitUp -> ... -> LimitDown
  const categories = [
    '涨停', '>7%', '5~7%', '2~5%', '0~2%', '平盘', '-2~0%', '-5~-2%', '-7~-5%', '<-7%', '跌停'
  ]
  const values = [
    d.limit_up, d.gt_7, d.p5_7, d.p2_5, d.p0_2, d.flat, d.m2_0, d.m5_2, d.m7_5, d.lt_m7, d.limit_down
  ]
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    grid: {
      top: 40,
      left: '3%',
      right: '3%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 10,
        interval: 0,
        color: '#9e9e9e'
      },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } },
      axisLabel: { color: '#9e9e9e' }
    },
    series: [
      {
        name: '家数',
        type: 'bar',
        data: values,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: '#fff'
        },
        itemStyle: {
          color: (params) => {
            const index = params.dataIndex
            if (index < 5) return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#ff5252' },
              { offset: 1, color: '#b71c1c' }
            ])
            if (index === 5) return '#757575'
            return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#4caf50' },
              { offset: 1, color: '#1b5e20' }
            ])
          },
          borderRadius: [4, 4, 0, 0]
        },
        barWidth: '70%'
      }
    ]
  }
  
  chartInstance.setOption(option)
}

function getSentimentColor(score) {
  if (!score) return ''
  if (score >= 80) return 'text-red'
  if (score >= 60) return 'text-orange'
  if (score >= 40) return 'text-yellow'
  return 'text-green'
}

function formatPercent(val) {
  if (!val) return '0%'
  return (val * 100).toFixed(1) + '%'
}

watch(() => props.date, fetchData)

// Watch for chartRef to be available (for v-if controlled rendering)
watch(chartRef, (newVal) => {
  if (newVal && hasData.value && !chartInstance) {
    initChart()
  }
})

onMounted(() => {
  if (props.date) fetchData()
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
.market-spectrum-chart-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.chart-container {
  position: relative;
}

.summary-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background: rgba(20, 20, 30, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.summary-item {
  white-space: nowrap;
}

.relative {
  position: relative;
}
</style>
