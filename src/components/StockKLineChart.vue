<template>
  <div class="stock-kline-chart">
    <div ref="chartRef" class="stock-kline-chart__canvas"></div>
    <div v-if="!records.length" class="stock-kline-chart__empty">暂无 K 线数据</div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { waitForChartDom } from '../utils/chartDom'
import { buildShenwanKlineOption } from '../utils/echarts/shenwanKlineOption'

const props = defineProps({
  records: {
    type: Array,
    default: () => [],
  },
  markers: {
    type: Array,
    default: () => [],
  },
  tf: {
    type: String,
    default: '1d',
  },
})

const chartRef = ref(null)
let echarts = null
let chart = null
let resizeObserver = null

onMounted(async () => {
  await nextTick()
  await renderChart()
  if (typeof ResizeObserver !== 'undefined' && chartRef.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(chartRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (chart) {
    chart.dispose()
    chart = null
  }
})

watch(
  () => [props.records, props.markers, props.tf],
  () => {
    nextTick(() => {
      void renderChart()
    })
  },
  { deep: true },
)

async function ensureChart() {
  if (!chartRef.value) return null
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (!chart) {
    const ready = await waitForChartDom(chartRef.value)
    if (!ready || !chartRef.value) return null
    chart = echarts.init(chartRef.value, 'dark')
  }
  return chart
}

async function renderChart() {
  const instance = await ensureChart()
  if (!instance) return
  if (!props.records.length) {
    instance.clear()
    return
  }

  const rows = [...props.records]
    .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || '')))
    .map((row) => ({
      ...row,
      pct_change: row.pct_change ?? row.pct_chg,
      vol: row.vol ?? row.volume,
    }))

  instance.setOption(
    buildShenwanKlineOption(rows, {
      fmtAxis,
      formatNum2,
      toNumOrNull,
      formatVolShow,
      formatAmount: formatAmountByUnit,
      formatMvWan,
      markers: props.markers,
    }, { tf: props.tf }),
    true,
  )
  instance.resize()
}

function fmtAxis(value) {
  const s = String(value || '')
  if (s.length === 8 && /^\d+$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s.slice(0, 10)
}

function toNumOrNull(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatNum2(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '-'
}

function formatVolShow(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(2)}亿手`
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万手`
  return `${n.toFixed(0)}手`
}

function formatAmountByUnit(value, unit = 'qian_yuan') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  const normalized = String(unit || 'qian_yuan').toLowerCase()
  if (normalized === 'yuan') return `${(n / 100000000).toFixed(2)}亿`
  if (normalized === 'wan_yuan') return `${(n / 10000).toFixed(2)}亿`
  return `${(n / 100000).toFixed(2)}亿`
}

function formatMvWan(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${(n / 10000).toFixed(2)}亿`
}
</script>

<style scoped>
.stock-kline-chart {
  background: rgba(2, 6, 23, .38);
  border: 1px solid rgba(148, 163, 184, .14);
  border-radius: 14px;
  min-height: 380px;
  overflow: hidden;
  position: relative;
}

.stock-kline-chart__canvas {
  height: 380px;
  width: 100%;
}

.stock-kline-chart__empty {
  align-items: center;
  color: #94a3b8;
  display: flex;
  inset: 0;
  justify-content: center;
  position: absolute;
}
</style>
