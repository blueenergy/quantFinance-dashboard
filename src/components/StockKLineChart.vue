<template>
  <div
    class="stock-kline-chart-anchor"
    :class="{ 'stock-kline-chart-anchor--held': maximized }"
  >
    <Teleport to="body" :disabled="!maximized">
      <div :class="maximized ? 'kline-fullscreen-shell' : 'kline-inline-shell'">
        <div
          v-if="maximized"
          class="kline-fullscreen-backdrop"
          aria-hidden="true"
          @click="exitDetailFullscreen"
        />
        <div
          ref="containerRef"
          class="stock-kline-chart"
          :class="[toneClass, { 'stock-kline-chart--fullscreen': maximized }]"
          :role="maximized ? 'dialog' : undefined"
          :aria-modal="maximized ? 'true' : undefined"
          aria-label="K线图"
        >
          <button
            type="button"
            class="kline-fullscreen-btn"
            :title="maximized ? '退出全屏' : '全屏查看 K 线'"
            @click.stop="toggleDetailFullscreen"
          >
            {{ maximized ? '退出全屏' : '全屏' }}
          </button>
          <div ref="chartRef" class="stock-kline-chart__canvas"></div>
          <div v-if="!records.length" class="stock-kline-chart__empty">暂无 K 线数据</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDetailFullscreen } from '../composables/useDetailFullscreen'
import { waitForChartDom } from '../utils/chartDom'
import { buildShenwanKlineOption, collectDecisionGsMarkers } from '../utils/echarts/shenwanKlineOption'

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
  tone: {
    type: String,
    default: 'on-dark',
    validator: (value) => ['on-dark', 'on-light'].includes(value),
  },
  chartMeta: {
    type: Object,
    default: () => ({}),
  },
})

const toneClass = computed(() => `stock-kline-chart--${props.tone}`)
const { detailMaximized: maximized, toggleDetailFullscreen, exitDetailFullscreen } = useDetailFullscreen()

const containerRef = ref(null)
const chartRef = ref(null)
let echarts = null
let chart = null
let resizeObserver = null
let chartTone = null

onMounted(async () => {
  await nextTick()
  await renderChart()
  if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
    resizeObserver = new ResizeObserver(() => chart?.resize())
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  disposeChart()
})

watch(
  () => [props.records, props.markers, props.tf, props.chartMeta, props.tone],
  () => {
    nextTick(() => {
      void renderChart()
    })
  },
  { deep: true },
)

watch(maximized, async () => {
  await nextTick()
  chart?.resize()
})

function disposeChart() {
  if (chart) {
    chart.dispose()
    chart = null
    chartTone = null
  }
}

async function ensureChart() {
  if (!chartRef.value) return null
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (chart && chartTone !== props.tone) {
    disposeChart()
  }
  if (!chart) {
    const ready = await waitForChartDom(chartRef.value)
    if (!ready || !chartRef.value) return null
    chartTone = props.tone
    chart = echarts.init(chartRef.value, props.tone === 'on-light' ? undefined : 'dark')
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

  const markers = Array.isArray(props.markers) && props.markers.length
    ? props.markers
    : collectDecisionGsMarkers(rows)

  instance.setOption(
    buildShenwanKlineOption(rows, {
      fmtAxis,
      formatNum2,
      toNumOrNull,
      formatVolShow,
      formatAmount: formatAmountByUnit,
      formatMvWan,
      markers,
    }, { tf: props.tf, tone: props.tone, ...(props.chartMeta || {}) }),
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
.stock-kline-chart-anchor--held {
  min-height: 380px;
}

.kline-inline-shell {
  display: contents;
}

.kline-fullscreen-shell {
  position: fixed;
  z-index: 3000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.kline-fullscreen-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.56);
}

.stock-kline-chart {
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  min-height: 380px;
  overflow: hidden;
  position: relative;
}

.stock-kline-chart--fullscreen {
  position: relative;
  z-index: 1;
  width: min(98vw, 100%);
  height: calc(100vh - 32px);
  max-height: calc(100vh - 32px);
  min-height: 0;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.32);
}

.stock-kline-chart--on-dark {
  background: rgba(2, 6, 23, .38);
  border: 1px solid rgba(148, 163, 184, .14);
}

.stock-kline-chart--on-light {
  background: #fff;
  border: 1px solid var(--border-subtle, #e2e8f0);
}

.stock-kline-chart__canvas {
  flex: 1;
  height: 380px;
  min-height: 0;
  width: 100%;
}

.stock-kline-chart--fullscreen .stock-kline-chart__canvas {
  height: 100%;
}

.kline-fullscreen-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 5;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 6px 10px;
}

.kline-fullscreen-btn:hover {
  background: rgba(30, 41, 59, 0.92);
  color: #fff;
}

.stock-kline-chart--on-light .kline-fullscreen-btn {
  background: rgba(255, 255, 255, 0.88);
  border-color: #cbd5e1;
  color: #334155;
}

.stock-kline-chart--on-light .kline-fullscreen-btn:hover {
  background: #fff;
  color: #0f172a;
}

.stock-kline-chart__empty {
  align-items: center;
  display: flex;
  inset: 0;
  justify-content: center;
  pointer-events: none;
  position: absolute;
}

.stock-kline-chart--on-dark .stock-kline-chart__empty {
  color: #94a3b8;
}

.stock-kline-chart--on-light .stock-kline-chart__empty {
  color: var(--text-muted, #64748b);
}
</style>
