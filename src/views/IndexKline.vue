<template>
  <div class="index-kline-page">
    <h3 class="page-title">📊 指数 K 线</h3>

    <div class="index-layout">
      <aside class="index-sidebar" :style="{ maxHeight: `${chartHeight}px` }">
        <section v-for="group in INDEX_GROUPS" :key="group.label" class="index-group">
          <h5>{{ group.label }}</h5>
          <button
            v-for="item in group.items"
            :key="item.code"
            type="button"
            class="index-btn"
            :class="{ active: activeCode === item.code }"
            @click="selectIndex(item)"
          >
            <span class="name">{{ item.name }}</span>
            <code>{{ item.code }}</code>
          </button>
        </section>
      </aside>

      <section class="index-main">
        <div class="toolbar">
          <div class="meta-line">
            <code v-if="activeCode">{{ activeCode }}</code>
            <span v-if="activeName" class="active-name">{{ activeName }}</span>
            <span class="muted">{{ scopeLabel }}</span>
          </div>
          <div class="period-row">
            <span class="muted">周期</span>
            <button
              v-for="opt in TF_OPTIONS"
              :key="opt.value"
              type="button"
              class="period-btn"
              :class="{ active: tf === opt.value }"
              @click="tf = opt.value"
            >{{ opt.label }}</button>
          </div>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>
        <div v-else-if="loading" class="muted">加载中…</div>
        <StockKLineChart
          v-else-if="bars.length"
          :records="bars"
          :tf="tf"
          :height="chartHeight"
          tone="on-light"
          :chart-meta="{ showDecisionGs: false, showMa: true }"
        />
        <p v-else class="muted empty-hint">该指数暂无数据。</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import request from '../utils/request'
import StockKLineChart from '../components/StockKLineChart.vue'
import { resampleBars } from '../utils/klineResample'

const INDEX_GROUPS = [
  {
    label: '宽基',
    items: [
      { code: '000001.SH', name: '上证指数' },
      { code: '399001.SZ', name: '深证成指' },
      { code: '000300.SH', name: '沪深300' },
      { code: '000016.SH', name: '上证50' },
      { code: '000905.SH', name: '中证500' },
      { code: '000852.SH', name: '中证1000' },
      { code: '932000.CSI', name: '中证2000' },
    ],
  },
  {
    label: '成长',
    items: [
      { code: '399006.SZ', name: '创业板指' },
      { code: '000688.SH', name: '科创50' },
    ],
  },
]

const ALL_ITEMS = INDEX_GROUPS.flatMap((group) => group.items)
const TF_OPTIONS = [
  { value: '1d', label: '日' },
  { value: '1w', label: '周' },
  { value: '1m', label: '月' },
]
const TF_LABEL = { '1d': '日线', '1w': '周线', '1m': '月线' }

const SYMBOL_KEY = 'index-kline:last-symbol'
const TF_KEY = 'index-kline:tf'

function readStoredValue(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

const initialCode = readStoredValue(SYMBOL_KEY, '399006.SZ')
const activeCode = ref(ALL_ITEMS.some((item) => item.code === initialCode) ? initialCode : '399006.SZ')
const tf = ref(TF_OPTIONS.some((opt) => opt.value === readStoredValue(TF_KEY, '1m')) ? readStoredValue(TF_KEY, '1m') : '1m')
const rows = ref([])
const loading = ref(false)
const error = ref('')

const viewportHeight = ref(typeof window === 'undefined' ? 900 : window.innerHeight)
const chartHeight = computed(() => Math.max(520, Math.min(900, viewportHeight.value - 240)))

function onViewportResize() {
  viewportHeight.value = window.innerHeight
}

const activeName = computed(() => ALL_ITEMS.find((item) => item.code === activeCode.value)?.name || '')
const bars = computed(() => resampleBars(rows.value, tf.value))
const scopeLabel = computed(() => {
  if (!rows.value.length) return ''
  return `${rows.value.length} 根日线 → ${bars.value.length} 根${TF_LABEL[tf.value] || 'K线'}`
})

async function fetchIndex() {
  loading.value = true
  error.value = ''
  try {
    const body = await request({
      method: 'get',
      url: `/kline-series?symbol=${activeCode.value}&limit=5000`,
      timeout: 15000,
    })
    rows.value = Array.isArray(body?.data) ? body.data : []
    if (!rows.value.length) error.value = `${activeName.value}（${activeCode.value}）暂无数据`
  } catch (e) {
    error.value = `加载失败: ${e?.response?.data?.detail || e.message}`
    rows.value = []
  } finally {
    loading.value = false
  }
}

function selectIndex(item) {
  if (item.code === activeCode.value) return
  activeCode.value = item.code
}

watch(activeCode, (code) => {
  try {
    localStorage.setItem(SYMBOL_KEY, code)
  } catch {
    // ignore quota / private-mode failures
  }
  void fetchIndex()
})

watch(tf, (value) => {
  try {
    localStorage.setItem(TF_KEY, value)
  } catch {
    // ignore quota / private-mode failures
  }
})

onMounted(() => {
  window.addEventListener('resize', onViewportResize)
  void fetchIndex()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onViewportResize)
})
</script>

<style scoped>
.index-kline-page {
  padding: 4px 2px 16px;
}

.page-title {
  margin: 0 0 12px;
}

.index-layout {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  gap: 14px;
}

.index-sidebar {
  background: var(--surface-bg-muted, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 10px;
  max-height: 72vh;
  overflow: auto;
  padding: 10px;
}

.index-group + .index-group {
  margin-top: 14px;
}

.index-group h5 {
  color: var(--text-muted, #64748b);
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 6px;
}

.index-btn {
  align-items: flex-start;
  background: #fff;
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
  padding: 7px 9px;
  text-align: left;
  width: 100%;
}

.index-btn:hover {
  border-color: #93c5fd;
}

.index-btn.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6 inset;
}

.index-btn .name {
  font-weight: 600;
}

.index-btn code {
  color: var(--text-muted, #64748b);
  font-size: 11px;
}

.index-main {
  min-width: 0;
}

.toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 18px;
  justify-content: space-between;
  margin-bottom: 8px;
}

.meta-line {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.active-name {
  font-weight: 600;
}

.period-row {
  align-items: center;
  display: flex;
  gap: 6px;
}

.period-btn {
  background: #fff;
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 12px;
}

.period-btn.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.muted {
  color: var(--text-muted, #64748b);
  font-size: 12px;
}

.empty-hint {
  padding: 30px;
  text-align: center;
}

.error-msg {
  background: #fff3f3;
  border-radius: 6px;
  color: #c62828;
  font-size: 13px;
  padding: 10px 14px;
}

@media (max-width: 900px) {
  .index-layout {
    grid-template-columns: 1fr;
  }
}
</style>
