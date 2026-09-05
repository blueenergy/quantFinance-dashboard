<template>
  <div class="futures-kline-page">
    <h3 class="page-title">期货 K 线</h3>
    <div class="futures-layout">
      <aside class="futures-sidebar">
        <h4 class="sidebar-title">品种</h4>
        <div v-if="loadingVarieties" class="muted">加载品种…</div>
        <div v-else-if="varietiesError" class="error-msg">{{ varietiesError }}</div>
        <template v-else>
          <section v-if="indexVarieties.length" class="variety-group">
            <h5>股指期货</h5>
            <button
              v-for="item in indexVarieties"
              :key="item.ts_code"
              type="button"
              class="variety-btn"
              :class="{ active: activeCode === item.ts_code }"
              @click="selectVariety(item)"
            >
              <span class="name">{{ item.name }}</span>
              <code>{{ item.ts_code }}</code>
            </button>
          </section>
          <section v-if="commodityVarieties.length" class="variety-group">
            <h5>商品期货</h5>
            <button
              v-for="item in commodityVarieties"
              :key="item.ts_code"
              type="button"
              class="variety-btn"
              :class="{ active: activeCode === item.ts_code }"
              @click="selectVariety(item)"
            >
              <span class="name">{{ item.name }}</span>
              <code>{{ item.ts_code }}</code>
            </button>
          </section>
        </template>
        <p v-if="activeSpotCode" class="spot-hint">
          现货对照：<code>{{ activeSpotCode }}</code>
        </p>
      </aside>

      <section class="futures-main">
        <div class="toolbar">
          <div class="meta-line">
            <code v-if="activeCode">{{ activeCode }}</code>
            <span v-if="activeName" class="active-name">{{ activeName }}</span>
            <span v-if="latestContract" class="muted">主力合约 {{ latestContract }}</span>
          </div>
          <div class="date-row">
            <label>开始 <input v-model="startDate" type="date" :max="today" /></label>
            <label>结束 <input v-model="endDate" type="date" :max="today" /></label>
            <button class="btn-base btn-sm btn-gradient-blue" :disabled="!activeCode || klineLoading" @click="loadKline">
              加载
            </button>
          </div>
        </div>

        <div v-if="klineError" class="error-msg">{{ klineError }}</div>
        <div v-else-if="klineLoading" class="muted">加载 K 线…</div>
        <StockKLineChart
          v-else
          :records="klineRows"
          :tf="'1d'"
          tone="on-light"
          :chart-meta="{ showDecisionGs: false, showMa: true }"
        />
        <p v-if="!activeCode && !loadingVarieties" class="muted empty-hint">请在左侧选择期货品种。</p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import request from '../utils/request'
import StockKLineChart from '../components/StockKLineChart.vue'

const today = new Date().toISOString().slice(0, 10)
const startDate = ref((() => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().slice(0, 10)
})())
const endDate = ref(today)

const loadingVarieties = ref(false)
const varietiesError = ref('')
const indexVarieties = ref([])
const commodityVarieties = ref([])

const activeCode = ref('')
const activeName = ref('')
const activeSpotCode = ref('')
const klineRows = ref([])
const klineLoading = ref(false)
const klineError = ref('')

const latestContract = computed(() => {
  const last = klineRows.value[klineRows.value.length - 1]
  return last?.contract || ''
})

async function loadVarieties() {
  loadingVarieties.value = true
  varietiesError.value = ''
  try {
    const body = await request({ method: 'get', url: '/futures/varieties' })
    indexVarieties.value = body?.data?.index || []
    commodityVarieties.value = body?.data?.commodity || []
    const first = indexVarieties.value[0]
    if (first) {
      selectVariety(first)
    }
  } catch (e) {
    varietiesError.value = e?.response?.data?.detail || e.message || '品种列表加载失败'
  } finally {
    loadingVarieties.value = false
  }
}

function selectVariety(item) {
  activeCode.value = item.ts_code
  activeName.value = item.name
  activeSpotCode.value = item.spot_ts_code || ''
  loadKline()
}

async function loadKline() {
  if (!activeCode.value) return
  klineLoading.value = true
  klineError.value = ''
  try {
    const sd = startDate.value.replace(/-/g, '')
    const ed = endDate.value.replace(/-/g, '')
    const body = await request({
      method: 'get',
      url: `/kline-series?symbol=${encodeURIComponent(activeCode.value)}&start_date=${sd}&end_date=${ed}&limit=2000`,
    })
    klineRows.value = body?.data || []
    if (!klineRows.value.length) {
      klineError.value = '暂无 K 线数据，请确认数据引擎已同步 fut_daily'
    }
  } catch (e) {
    klineError.value = e?.response?.data?.detail || e.message || 'K 线加载失败'
    klineRows.value = []
  } finally {
    klineLoading.value = false
  }
}

onMounted(() => {
  loadVarieties()
})
</script>

<style scoped>
.futures-kline-page {
  background: var(--surface-bg, #fff);
  border-radius: 12px;
  color: var(--text-primary, #1e293b);
  padding: 16px 18px 20px;
}

.page-title {
  margin: 0 0 14px;
}

.futures-layout {
  display: grid;
  gap: 16px;
  grid-template-columns: 240px minmax(0, 1fr);
}

.futures-sidebar {
  background: var(--surface-bg-muted, #f8fafc);
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 10px;
  max-height: 72vh;
  overflow: auto;
  padding: 12px;
}

.sidebar-title {
  margin: 0 0 10px;
}

.variety-group {
  margin-bottom: 14px;
}

.variety-group h5 {
  color: var(--text-muted, #64748b);
  font-size: 12px;
  margin: 0 0 6px;
}

.variety-btn {
  align-items: flex-start;
  background: #fff;
  border: 1px solid var(--border-subtle, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
  padding: 8px 10px;
  text-align: left;
  width: 100%;
}

.variety-btn.active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6 inset;
}

.variety-btn .name {
  font-weight: 600;
}

.variety-btn code {
  color: var(--text-muted, #64748b);
  font-size: 11px;
}

.spot-hint {
  color: var(--text-muted, #64748b);
  font-size: 12px;
  margin: 8px 0 0;
}

.futures-main {
  min-width: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.meta-line {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.active-name {
  font-weight: 600;
}

.date-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.date-row label {
  align-items: center;
  display: flex;
  gap: 4px;
}

.error-msg {
  color: #dc2626;
  margin-bottom: 8px;
}

.muted {
  color: var(--text-muted, #64748b);
}

.empty-hint {
  margin-top: 12px;
}

@media (max-width: 960px) {
  .futures-layout {
    grid-template-columns: 1fr;
  }
}
</style>
