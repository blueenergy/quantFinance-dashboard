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
    </div>
    <div v-if="loading" class="gmc-loading">加载中…</div>
    <div v-else-if="error" class="gmc-error">{{ error }}</div>
    <div v-else-if="!records.length" class="gmc-empty">暂无数据</div>
    <div ref="chartRef" class="gmc-chart" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import request from '../utils/request'

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
const chartRef = ref(null)
const containerRef = ref(null)

let chartInstance = null
let resizeObs = null

async function loadData() {
  if (!props.symbol) return
  loading.value = true
  error.value = null
  try {
    const res = await request({
      method: 'get',
      url: `/global-market/${encodeURIComponent(props.symbol)}/kline`,
      params: { tf: tf.value, limit: 500 },
    })
    // request.js interceptor returns response.data directly
    if (res?.success) {
      records.value = (res.data || []).slice().reverse() // ascending for echarts
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
    }

    const dates = records.value.map(r => r.trade_date)
    const ohlcv = records.value.map(r => [r.open, r.close, r.low, r.high])
    const volumes = records.value.map((r, i) => {
      const up = r.close >= r.open
      return { value: r.volume, itemStyle: { color: up ? '#ef232a' : '#14b143' } }
    })

    const hasVolume = records.value.some(r => r.volume > 0)

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
          const date = String(r.trade_date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
          const fmt = n => (n == null ? '-' : Number(n).toFixed(2))
          const prev = k.dataIndex > 0 ? records.value[k.dataIndex - 1] : null
          const pct = (prev && prev.close > 0) ? ((r.close - prev.close) / prev.close * 100) : null
          const pctStr = pct == null ? '' : (pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`)
          const pctColor = pct == null ? '#aaa' : (pct >= 0 ? '#ef232a' : '#14b143')
          let html = `<div style="font-size:11px;line-height:1.8">`
          html += `<b>${date}</b>`
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
      dataZoom: [
        { type: 'inside', xAxisIndex: hasVolume ? [0, 1] : [0], start: 60, end: 100 },
        { type: 'slider', xAxisIndex: hasVolume ? [0, 1] : [0], start: 60, end: 100,
          bottom: 8, height: 20,
          fillerColor: 'rgba(80,80,180,0.2)', borderColor: '#333',
          handleStyle: { color: '#5555cc' },
          textStyle: { color: '#888', fontSize: 10 } },
      ],
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
        },
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
</script>

<style scoped>
.gmc-wrapper {
  width: 100%;
  height: 460px;
  background: #1a1a1a;
  display: flex;
  flex-direction: column;
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
