<template>
  <div class="shenwan-wrap">
    <div class="shenwan-layout">
      <aside class="shenwan-tree">
        <h3 class="panel-title">行业层级</h3>
        <div v-if="treeError" class="err-msg">{{ treeError }}</div>
        <div v-else-if="l1Loading" class="skeleton">加载 L1 行业…</div>
        <div v-else class="columns">
          <ul class="col" aria-label="一级行业 L1">
            <li
              v-for="it in l1List"
              :key="it.index_code"
              :class="{ active: selectedL1?.index_code === it.index_code }"
              @click="onPickL1(it)"
            >{{ it.name || it.index_code }}</li>
          </ul>
          <ul v-if="selectedL1" class="col" aria-label="二级行业 L2">
            <li v-if="l2Loading" class="muted">加载中…</li>
            <li
              v-for="it in l2List"
              v-else
              :key="it.index_code"
              :class="{ active: selectedL2?.index_code === it.index_code }"
              @click="onPickL2(it)"
            >{{ it.name || it.index_code }}</li>
            <li v-if="!l2Loading && l2List.length === 0" class="muted">无子级</li>
          </ul>
          <ul v-if="selectedL2" class="col" aria-label="三级行业 L3">
            <li v-if="l3Loading" class="muted">加载中…</li>
            <li
              v-for="it in l3List"
              v-else
              :key="it.index_code"
              :class="{ active: selectedL3?.index_code === it.index_code }"
              @click="onPickL3(it)"
            >{{ it.name || it.index_code }}</li>
            <li v-if="!l3Loading && l3List.length === 0" class="muted">无子级</li>
          </ul>
        </div>
        <p class="hint">数据来源：Tushare 申万 <code>SW2021</code>（可扩展版本）。</p>
      </aside>

      <section class="shenwan-main">
        <div class="meta">
          <div v-if="chartTitle" class="crumb">
            <span v-if="crumb1">{{ crumb1 }}</span>
            <span v-if="crumb2" class="sep">›</span>
            <span v-if="crumb2">{{ crumb2 }}</span>
            <span v-if="crumb3" class="sep">›</span>
            <span v-if="crumb3">{{ crumb3 }}</span>
          </div>
          <div v-if="activeCode" class="code-line">
            <code>{{ activeCode }}</code>
            <span v-if="activeName" class="name">{{ activeName }}</span>
          </div>
          <div v-else class="muted">请在左侧点选行业指数，下方将显示 K 线。</div>
        </div>

        <div class="toolbar">
          <div class="tf-btns">
            <button type="button" :class="{ on: tf === '1d' }" @click="tf = '1d'">日 K</button>
            <button type="button" :class="{ on: tf === '1w' }" @click="tf = '1w'">周 K</button>
            <button type="button" :class="{ on: tf === '1m' }" @click="tf = '1m'">月 K</button>
          </div>
          <div class="dates">
            <label>开始             <input v-model="startD" class="d-inp" type="date" /></label>
            <label>结束 <input v-model="endD" class="d-inp" type="date" /></label>
            <span class="muted sm">不填起止则由服务端拉足够长的日线后截断到最近 {{ klineLimit }} 根</span>
          </div>
        </div>

        <div class="chart-box" ref="chartBoxRef">
          <div v-if="klineLoading" class="overlay">加载 K 线…</div>
          <div v-else-if="klineError" class="overlay err">{{ klineError }}</div>
          <div v-else-if="klineMsg && !klineData.length" class="overlay hint">{{ klineMsg }}</div>
          <div
            v-show="klineData.length && !klineLoading"
            ref="chartElRef"
            class="chart-canvas"
          />
        </div>
        <p class="footer-hint">
          若分类或走势为空，请在服务器执行 <code>quant_data_engine</code> 的
          <code>run_sw_industry_backfill</code> 回补 <code>sw_index_classify</code> 与
          <code>sw_daily</code> 后再试。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import axios from 'axios'

const SRC = 'SW2021'
const klineLimit = 800

const l1List = ref([])
const l2List = ref([])
const l3List = ref([])
const l1Loading = ref(true)
const l2Loading = ref(false)
const l3Loading = ref(false)
const treeError = ref('')

const selectedL1 = ref(null)
const selectedL2 = ref(null)
const selectedL3 = ref(null)

const tf = ref('1d')
const startD = ref('')
const endD = ref('')
const klineData = ref([])
const klineLoading = ref(false)
const klineError = ref('')
const klineMsg = ref('')

const chartBoxRef = ref(null)
const chartElRef = ref(null)
let echarts = null
let chartInstance = null
let ro = null

const activeItem = computed(() => selectedL3.value || selectedL2.value || selectedL1.value)
const activeCode = computed(() => activeItem.value?.index_code || '')
const activeName = computed(() => activeItem.value?.name || '')

const crumb1 = computed(() => selectedL1.value?.name || selectedL1.value?.index_code || '')
const crumb2 = computed(() => (selectedL2.value ? (selectedL2.value.name || selectedL2.value.index_code) : ''))
const crumb3 = computed(() => (selectedL3.value ? (selectedL3.value.name || selectedL3.value.index_code) : ''))
const chartTitle = computed(() => activeCode.value)

function ymdFromInput (s) {
  if (!s) return ''
  return String(s).replace(/-/g, '')
}

function fmtAxis (d) {
  if (!d) return ''
  const t = String(d)
  if (t.length === 8 && /^\d{8}$/.test(t)) return `${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`
  if (t.includes('T')) return t.slice(0, 10)
  if (t.includes('-')) return t.slice(0, 10)
  return t
}

function disposeChart () {
  if (chartInstance) {
    try { chartInstance.dispose() } catch (e) { /* noop */ }
    chartInstance = null
  }
}

function ensureChart () {
  if (!echarts) return
  if (!chartElRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartElRef.value, 'dark')
    if (ro == null && chartBoxRef.value && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => { if (chartInstance) chartInstance.resize() })
      ro.observe(chartBoxRef.value)
    }
  }
  return chartInstance
}

async function drawCandles () {
  if (!klineData.value.length) {
    if (chartInstance) chartInstance.clear()
    return
  }
  // v-show 由隐藏切到显示时，同一微任务内 clientWidth 可能仍为 0
  await nextTick()
  await new Promise((r) => requestAnimationFrame(r))
  await new Promise((r) => requestAnimationFrame(r))
  if (!chartElRef.value) return
  if (chartElRef.value.clientWidth < 2 || chartElRef.value.clientHeight < 2) {
    await new Promise((res) => setTimeout(res, 50))
  }
  const c = ensureChart()
  if (!c) return
  const data = klineData.value
  const times = data.map((r) => fmtAxis(r.trade_date))
  const ohlc = data.map((r) => {
    const o = Number(r.open) || 0
    const cl = Number(r.close) || 0
    const l = Number(r.low) != null ? Number(r.low) : Math.min(o, cl)
    const h = Number(r.high) != null ? Number(r.high) : Math.max(o, cl)
    return [o, cl, l, h]
  })
  c.setOption({
    backgroundColor: 'transparent',
    textStyle: { color: '#ccc' },
    grid: { left: 48, right: 20, top: 36, bottom: 56 },
    xAxis: { type: 'category', data: times, axisLine: { lineStyle: { color: '#666' } } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: '#333' } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 6 }],
    series: [{
      name: 'K',
      type: 'candlestick',
      data: ohlc,
      itemStyle: {
        color: '#ef5350',
        color0: '#26a69a',
        borderColor: '#ef5350',
        borderColor0: '#26a69a'
      }
    }],
    tooltip: { trigger: 'axis' }
  }, true)
  c.resize()
}

function clearKlineState () {
  klineData.value = []
  klineMsg.value = ''
  klineError.value = ''
  disposeChart()
}

async function reloadKline () {
  if (!activeCode.value) {
    clearKlineState()
    return
  }
  klineLoading.value = true
  klineError.value = ''
  klineMsg.value = ''
  try {
    const params = {
      ts_code: activeCode.value,
      tf: tf.value,
      limit: klineLimit
    }
    const sd = ymdFromInput(startD.value)
    const ed = ymdFromInput(endD.value)
    if (sd) params.start = sd
    if (ed) params.end = ed
    const { data } = await axios.get('/api/shenwan-index/kline', { params })
    if (data && data.data) {
      klineData.value = data.data
      if (data.message) klineMsg.value = data.message
      if (!klineData.value.length && data.message) {
        klineMsg.value = data.message
      }
    } else {
      klineData.value = []
      klineMsg.value = '无数据'
    }
  } catch (e) {
    klineData.value = []
    const d = e && e.response && e.response.data
    klineError.value = (d && d.detail) || (typeof d === 'string' ? d : '') || (e && e.message) || 'K 线加载失败'
  } finally {
    klineLoading.value = false
  }
  await nextTick()
  if (!echarts) {
    const mod = await import('echarts')
    echarts = mod.default || mod
  }
  if (klineData.value.length) {
    if (!klineError.value) klineMsg.value = ''
    await drawCandles()
  } else {
    disposeChart()
  }
}

async function loadL1 () {
  l1Loading.value = true
  treeError.value = ''
  try {
    const { data } = await axios.get('/api/shenwan-index/tree', { params: { src: SRC, level: 'L1' } })
    l1List.value = (data && data.data) || []
    if (data && data.message && !l1List.value.length) {
      treeError.value = data.message
    }
  } catch (e) {
    treeError.value = '加载 L1 失败: ' + (e.message || '')
    l1List.value = []
  } finally {
    l1Loading.value = false
  }
}

async function loadChildren (parent) {
  const { data } = await axios.get('/api/shenwan-index/children', {
    params: { src: SRC, parent_code: parent }
  })
  return (data && data.data) || []
}

function onPickL1 (it) {
  selectedL1.value = it
  selectedL2.value = null
  selectedL3.value = null
  l2List.value = []
  l3List.value = []
  l2Loading.value = true
  l3Loading.value = false
  clearKlineState()
  loadChildren(it.index_code)
    .then((rows) => { l2List.value = rows })
    .catch(() => { l2List.value = [] })
    .finally(() => { l2Loading.value = false })
}

function onPickL2 (it) {
  selectedL2.value = it
  selectedL3.value = null
  l3List.value = []
  l3Loading.value = true
  clearKlineState()
  loadChildren(it.index_code)
    .then((rows) => { l3List.value = rows })
    .catch(() => { l3List.value = [] })
    .finally(() => { l3Loading.value = false })
}

function onPickL3 (it) {
  selectedL3.value = it
  clearKlineState()
}

watch([tf, activeCode, startD, endD], () => {
  if (activeCode.value) reloadKline()
})

onMounted(() => {
  const t = new Date()
  const ed = t.toISOString().slice(0, 10)
  t.setFullYear(t.getFullYear() - 3)
  const sd = t.toISOString().slice(0, 10)
  endD.value = ed
  startD.value = sd
  loadL1()
})

onBeforeUnmount(() => {
  if (ro && chartBoxRef.value) {
    try { ro.unobserve(chartBoxRef.value) } catch (e) { /* */ }
  }
  ro = null
  disposeChart()
})
</script>

<style scoped>
.shenwan-wrap { padding: 0.75rem 1rem; }
.shenwan-layout {
  display: flex;
  gap: 1rem;
  min-height: 60vh;
  flex-wrap: wrap;
}
.shenwan-tree {
  flex: 0 0 320px;
  min-width: 240px;
  background: #1e1e1e;
  border-radius: 8px;
  padding: 0.75rem;
  border: 1px solid #333;
}
.panel-title { font-size: 1rem; margin: 0 0 0.5rem; color: #eee; }
.columns { display: flex; gap: 0.5rem; }
.col {
  list-style: none; margin: 0; padding: 0; flex: 1;
  max-height: 420px; overflow: auto; font-size: 12px; border: 1px solid #2a2a2a; border-radius: 4px;
  background: #111;
}
.col li { padding: 4px 6px; cursor: pointer; color: #ccc; }
.col li:hover { background: #2a2a2a; }
.col li.active { background: #1565c0; color: #fff; }
.muted { color: #888; }
.err-msg { color: #f88; font-size: 12px; }
.skeleton { color: #999; }
.hint, .footer-hint { font-size: 11px; color: #888; margin-top: 0.5rem; }
.shenwan-main { flex: 1; min-width: 280px; }
.meta { margin-bottom: 0.5rem; }
.crumb { color: #bbb; font-size: 14px; }
.sep { margin: 0 4px; color: #666; }
.code-line { margin-top: 4px; }
.code-line code { color: #ffcc80; }
.name { margin-left: 8px; color: #eee; }
.toolbar { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin: 0.5rem 0; }
.tf-btns button {
  background: #333; color: #ccc; border: 1px solid #555; padding: 4px 10px; margin-right: 4px; border-radius: 4px; cursor: pointer;
}
.tf-btns button.on { background: #1565c0; color: #fff; border-color: #42a5f5; }
.dates label { color: #aaa; font-size: 12px; margin-right: 0.5rem; }
.d-inp { background: #222; color: #ddd; border: 1px solid #444; border-radius: 4px; }
.sm { font-size: 11px; }
.chart-box {
  position: relative;
  width: 100%;
  height: 420px;
  min-height: 400px;
  background: #121212;
  border: 1px solid #2a2a2a;
  border-radius: 6px;
}
/* 空 div 不设高度时 ECharts 会报 clientWidth/Height 为 0，导致「有数据但不出图」 */
.chart-canvas {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  min-width: 100px;
  min-height: 380px;
}
.chart-box > :deep(.echarts) { width: 100% !important; height: 100% !important; min-height: 380px; }
.overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #aaa; background: rgba(0,0,0,0.35);
}
.overlay.err { color: #f88; }
.overlay.hint { color: #fb8; padding: 1rem; text-align: center; }
</style>
