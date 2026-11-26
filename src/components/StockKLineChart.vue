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
            class="kline-measure-btn"
            :class="{ on: measureMode }"
            :title="measureMode ? '退出区间统计' : '拖拽选择区间'"
            @click.stop="toggleMeasure"
          >
            区间
          </button>
          <button
            type="button"
            class="kline-fib-btn"
            :class="{ on: fibEnabled }"
            :title="fibEnabled ? '隐藏斐波那契回撤位' : '显示斐波那契回撤位'"
            @click.stop="toggleFib"
          >
            斐波那契
          </button>
          <div v-if="fibEnabled" class="kline-fib-bar">
            <label class="kline-fib-field">
              <span>起点</span>
              <input v-model="fibStartInput" type="date" :min="fibDateMin" :max="fibDateMax" @change="onFibAnchorChange" />
            </label>
            <label class="kline-fib-field">
              <span>终点</span>
              <input v-model="fibEndInput" type="date" :min="fibDateMin" :max="fibDateMax" @change="onFibAnchorChange" />
            </label>
            <span class="kline-fib-info">{{ fibInfo }}</span>
            <button type="button" class="kline-fib-reset" @click.stop="resetFibAnchor">自动</button>
          </div>
          <div v-if="measureMode && measureStats" class="kline-range-stats">
            <div class="kline-range-stats__head">
              {{ formatRangeDate(measureStats.startDate) }} → {{ formatRangeDate(measureStats.endDate) }} · {{ measureStats.bars }} 根
            </div>
            <div>收盘 {{ formatNum2(measureStats.startClose) }} → {{ formatNum2(measureStats.endClose) }}</div>
            <div :class="measureStats.change >= 0 ? 'range-up' : 'range-dn'">
              涨跌 {{ measureStats.change >= 0 ? '+' : '' }}{{ formatNum2(measureStats.change) }}
              （{{ formatRangePct(measureStats.pct) }}）
            </div>
            <div>最高 {{ formatNum2(measureStats.high) }} · 最低 {{ formatNum2(measureStats.low) }} · 振幅 {{ formatRangePct(measureStats.amplitude) }}</div>
            <div v-if="measureStats.volume != null">量 {{ formatVolShow(measureStats.volume) }}</div>
            <div v-if="measureStats.amount != null">额 {{ formatAmountByUnit(measureStats.amount) }}</div>
          </div>
          <div v-else-if="measureMode" class="kline-range-hint">在图上拖拽选择区间</div>
          <button
            type="button"
            class="kline-fullscreen-btn"
            :title="maximized ? '退出全屏' : '全屏查看 K 线'"
            @click.stop="toggleDetailFullscreen"
          >
            {{ maximized ? '退出全屏' : '全屏' }}
          </button>
          <div ref="chartRef" class="stock-kline-chart__canvas" :style="canvasStyle"></div>
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
import { buildFibOverlay, formatAnchorDate, toDateInput } from '../utils/echarts/fibonacci'
import { computeRangeStats } from '../utils/echarts/rangeStats'
import { loadEcharts } from '../utils/echarts/loadEcharts'

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
  /**
   * 图表高度：数字 = px，字符串按 CSS 长度处理（如 'calc(100vh - 240px)'）。
   * 全屏时忽略，始终铺满。
   */
  height: {
    type: [Number, String],
    default: 380,
  },
})

const toneClass = computed(() => `stock-kline-chart--${props.tone}`)
const { detailMaximized: maximized, toggleDetailFullscreen, exitDetailFullscreen } = useDetailFullscreen()

const canvasStyle = computed(() => {
  if (maximized.value) return {}
  const height = props.height
  return { height: typeof height === 'number' ? `${height}px` : String(height) }
})

const containerRef = ref(null)
const chartRef = ref(null)
let echarts = null
let chart = null
let resizeObserver = null
let chartTone = null

const FIB_ON_KEY = 'kline-fib-on'

const fibEnabled = ref(readStoredFibEnabled())
const fibStartInput = ref('')
const fibEndInput = ref('')
const measureMode = ref(false)
const measureStats = ref(null)

const sortedRows = computed(() => [...props.records]
  .sort((a, b) => String(a.trade_date || '').localeCompare(String(b.trade_date || ''))))

const fibDateMin = computed(() => toDateInput(sortedRows.value[0]?.trade_date))
const fibDateMax = computed(() => toDateInput(sortedRows.value[sortedRows.value.length - 1]?.trade_date))

const fibOverlay = computed(() => buildFibOverlay(sortedRows.value, {
  startDate: fibStartInput.value,
  endDate: fibEndInput.value,
}))

const fibInfo = computed(() => {
  const overlay = fibOverlay.value
  if (!overlay) return '数据不足，无法计算'
  const suffix = overlay.auto ? ' · 自动' : ''
  return `${overlay.low.toFixed(2)} (${formatAnchorDate(overlay.startDate)}) → ${overlay.high.toFixed(2)} (${formatAnchorDate(overlay.endDate)})${suffix}`
})

const fibStorageKey = computed(() => {
  const first = sortedRows.value[0]
  const code = first?.symbol || first?.ts_code || 'default'
  return `kline-fib-anchors:${code}:${props.tf || '1d'}`
})

watch(fibStorageKey, () => loadFibAnchors(), { immediate: true })

function readStoredFibEnabled() {
  try {
    return localStorage.getItem(FIB_ON_KEY) === '1'
  } catch {
    return false
  }
}

function loadFibAnchors() {
  try {
    const raw = localStorage.getItem(fibStorageKey.value)
    const parsed = raw ? JSON.parse(raw) : null
    fibStartInput.value = typeof parsed?.start === 'string' ? parsed.start : ''
    fibEndInput.value = typeof parsed?.end === 'string' ? parsed.end : ''
  } catch {
    fibStartInput.value = ''
    fibEndInput.value = ''
  }
}

function persistFibAnchors() {
  try {
    localStorage.setItem(fibStorageKey.value, JSON.stringify({
      start: fibStartInput.value,
      end: fibEndInput.value,
    }))
  } catch {
    // ignore quota / private-mode failures
  }
}

function onFibAnchorChange() {
  persistFibAnchors()
}

function resetFibAnchor() {
  fibStartInput.value = ''
  fibEndInput.value = ''
  persistFibAnchors()
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
  nextTick(() => {
    void renderChart()
  })
}

function onBrushSelected(params) {
  if (!measureMode.value) return
  const areas = params?.batch?.[0]?.areas || []
  const range = areas[0]?.coordRange
  if (!Array.isArray(range) || range.length < 2) {
    measureStats.value = null
    return
  }
  measureStats.value = computeRangeStats(sortedRows.value, range[0], range[1])
}

function formatRangeDate(value) {
  const s = String(value || '')
  if (s.length === 8 && /^\d+$/.test(s)) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  }
  return s.slice(0, 10)
}

function formatRangePct(value) {
  if (!Number.isFinite(value)) return '-'
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`
}

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
  () => [props.records, props.markers, props.tf, props.chartMeta, props.tone, fibEnabled.value, fibStartInput.value, fibEndInput.value],
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
    echarts = await loadEcharts()
  }
  if (chart && chartTone !== props.tone) {
    disposeChart()
  }
  if (!chart) {
    const ready = await waitForChartDom(chartRef.value)
    if (!ready || !chartRef.value) return null
    chartTone = props.tone
    chart = echarts.init(chartRef.value, props.tone === 'on-light' ? undefined : 'dark')
    chart.on('brushSelected', onBrushSelected)
  }
  return chart
}

async function renderChart() {
  const instance = await ensureChart()
  if (!instance) return
  // 全量重建会清掉 brush 选区，统计面板跟着重置
  if (measureMode.value) measureStats.value = null
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
    }, {
      tf: props.tf,
      tone: props.tone,
      ...(props.chartMeta || {}),
      fib: fibEnabled.value ? fibOverlay.value : null,
      measureMode: measureMode.value,
    }),
    true,
  )
  if (measureMode.value) {
    instance.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: { brushType: 'lineX', brushMode: 'single' },
    })
  }
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

.kline-measure-btn {
  position: absolute;
  top: 8px;
  right: 136px;
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

.kline-measure-btn:hover {
  background: rgba(30, 41, 59, 0.92);
  color: #fff;
}

.kline-measure-btn.on {
  background: rgba(56, 189, 248, 0.24);
  border-color: rgba(56, 189, 248, 0.72);
  color: #7dd3fc;
}

.stock-kline-chart--on-light .kline-measure-btn {
  background: rgba(255, 255, 255, 0.88);
  border-color: #cbd5e1;
  color: #334155;
}

.stock-kline-chart--on-light .kline-measure-btn.on {
  background: rgba(14, 165, 233, 0.12);
  border-color: #38bdf8;
  color: #0284c7;
}

.kline-fib-btn {
  position: absolute;
  top: 8px;
  right: 60px;
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

.kline-fib-btn:hover {
  background: rgba(30, 41, 59, 0.92);
  color: #fff;
}

.kline-fib-btn.on {
  background: rgba(56, 189, 248, 0.24);
  border-color: rgba(56, 189, 248, 0.72);
  color: #7dd3fc;
}

.stock-kline-chart--on-light .kline-fib-btn {
  background: rgba(255, 255, 255, 0.88);
  border-color: #cbd5e1;
  color: #334155;
}

.stock-kline-chart--on-light .kline-fib-btn.on {
  background: rgba(14, 165, 233, 0.12);
  border-color: #38bdf8;
  color: #0284c7;
}

.kline-fib-bar {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 190px;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 5px 8px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.24);
  color: #cbd5e1;
  font-size: 11px;
  line-height: 1.2;
}

.kline-fib-field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.kline-fib-field input {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
  padding: 2px 4px;
}

.kline-fib-info {
  color: #7dd3fc;
  font-variant-numeric: tabular-nums;
}

.kline-fib-reset {
  background: transparent;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 4px;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 11px;
  padding: 2px 6px;
}

.kline-fib-reset:hover {
  border-color: #38bdf8;
  color: #7dd3fc;
}

.stock-kline-chart--on-light .kline-fib-bar {
  background: rgba(255, 255, 255, 0.92);
  border-color: #e2e8f0;
  color: #475569;
}

.stock-kline-chart--on-light .kline-fib-field input {
  background: #fff;
  border-color: #cbd5e1;
  color: #0f172a;
}

.stock-kline-chart--on-light .kline-fib-info {
  color: #0284c7;
}

.stock-kline-chart--on-light .kline-fib-reset {
  border-color: #cbd5e1;
  color: #475569;
}

.kline-range-stats {
  position: absolute;
  bottom: 34px;
  left: 8px;
  z-index: 6;
  min-width: 210px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.86);
  border: 1px solid rgba(56, 189, 248, 0.45);
  color: #cbd5e1;
  font-size: 11px;
  line-height: 1.55;
  pointer-events: none;
}

.kline-range-stats__head {
  color: #7dd3fc;
  font-weight: 600;
  margin-bottom: 2px;
}

.kline-range-stats .range-up {
  color: #ef5350;
}

.kline-range-stats .range-dn {
  color: #26a69a;
}

.kline-range-hint {
  position: absolute;
  bottom: 34px;
  left: 8px;
  z-index: 6;
  padding: 5px 9px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.72);
  color: #94a3b8;
  font-size: 11px;
  pointer-events: none;
}

.stock-kline-chart--on-light .kline-range-stats {
  background: rgba(255, 255, 255, 0.95);
  border-color: #7dd3fc;
  color: #334155;
}

.stock-kline-chart--on-light .kline-range-stats__head {
  color: #0284c7;
}

.stock-kline-chart--on-light .kline-range-hint {
  background: rgba(255, 255, 255, 0.9);
  color: #64748b;
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
