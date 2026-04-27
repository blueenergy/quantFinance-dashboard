<template>
  <div class="etf-view">
    <div class="header-section">
      <h2>💰 ETF淘金</h2>
      <div class="header-meta" v-if="listTradeDate && !searchQuery.trim()">
        规模数据日：<strong>{{ listTradeDate }}</strong> · 已加载 {{ etfList.length }} / {{ listTotal }} 只 · 默认按<strong>基金份额（万份）</strong>降序
      </div>
      <div class="search-box">
        <input
          v-model="searchQuery"
          @keyup.enter="handleSearch"
          :placeholder="searchPlaceholder"
          class="search-input"
          :disabled="switchingEtf"
        />
        <button
          type="button"
          class="search-button"
          :disabled="switchingEtf || (selectedEtf && !searchQuery.trim())"
          @click="handleSearch"
        >
          {{ switchingEtf ? '切换中…' : searchActionLabel }}
        </button>
        <button v-if="searchQuery.trim()" type="button" class="search-button ghost" @click="clearSearch">
          清除搜索
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">正在加载数据...</div>

    <div v-else-if="error" class="error-state">{{ error }}</div>

    <div v-else class="content-section">
      <div class="list-section" v-if="!selectedEtf">
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>管理人</th>
                <th>基准</th>
                <th class="num">基金份额（万份）</th>
                <th class="num">基金规模（万元）</th>
                <th>交易所</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="etf in etfList"
                :key="etf.ts_code"
                class="etf-row"
                @click="selectEtf(etf)"
              >
                <td>
                  <span class="code-link">{{ etf.ts_code }}</span>
                </td>
                <td class="name-cell">{{ etf.name || '—' }}</td>
                <td class="ellipsis">{{ etf.management || '—' }}</td>
                <td class="ellipsis benchmark">{{ etf.benchmark || '—' }}</td>
                <td class="num">{{ formatNum(etf.total_share) }}</td>
                <td class="num">{{ formatNum(etf.total_size) }}</td>
                <td>{{ etf.exchange || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="showLoadMore" class="load-more">
          <button type="button" class="search-button" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中…' : '加载更多' }}
          </button>
        </div>
      </div>

      <div class="detail-section" v-else>
        <div class="detail-toolbar">
          <button type="button" class="back-button" @click="selectedEtf = null">← 返回列表</button>
          <span class="detail-search-hint">在上方搜索框输入代码或名称后点「切换」即可换到其它 ETF</span>
        </div>
        <div class="detail-header">
          <h3>{{ selectedEtf.name }} ({{ selectedEtf.ts_code }})</h3>
          <button class="analysis-btn" @click="triggerAnalysis" :disabled="analyzing">
            {{ analyzing ? 'AI分析中...' : '生成最新 AI 诊断' }}
          </button>
        </div>

        <div class="analysis-panel" v-if="analysisResult">
          <div class="score-ring">
            <span class="score">{{ analysisResult.actionable_score }}</span>
            <span class="label">综合分</span>
          </div>
          <div class="analysis-content">
            <p class="core-logic"><strong>核心逻辑：</strong>{{ analysisResult.core_logic }}</p>
            <div class="views">
              <div class="view-card short-term">
                <h4>近两周短线博弈</h4>
                <p>{{ analysisResult.short_term_view }}</p>
              </div>
              <div class="view-card mid-long-term">
                <h4>中长线投资价值</h4>
                <p>{{ analysisResult.mid_long_term_view }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="chart-container">
          <div class="kline-tf-bar">
            <span class="kline-tf-label">K 线周期</span>
            <button
              v-for="opt in klineTfOptions"
              :key="opt.value"
              type="button"
              class="tf-pill"
              :class="{ on: klineTf === opt.value, busy: klineLoading }"
              @click="klineTf = opt.value"
            >
              {{ opt.label }}
            </button>
            <span v-if="klineLoading" class="kline-loading-hint" aria-live="polite">加载中（周/月 K 需聚合较多日线，请稍候）…</span>
          </div>
          <EtfChart
            v-if="selectedEtf && (chartRecords.length > 0 || klineLoading)"
            :key="selectedEtf.ts_code"
            :symbol="selectedEtf.ts_code"
            :name="selectedEtf.name"
            :tf="klineTf"
            :loading="klineLoading"
            :records="chartRecords"
          />
          <div
            v-else-if="selectedEtf"
            class="skeleton-chart"
          >K线及资金流图表加载中...</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import axios from 'axios'
import EtfChart from '../components/EtfChart.vue'

/** 与 .env 的 VITE_API_BASE 一致时，可直连后端便于排查；默认 /api 走 Vite 代理到 localhost:3001 */
const etfApiBase = (import.meta.env.VITE_API_BASE || '/api').toString().replace(/\/$/, '') || '/api'

const PAGE_SIZE = 2000

const etfList = ref([])
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const searchQuery = ref('')
const selectedEtf = ref(null)
const listTradeDate = ref(null)
const listTotal = ref(0)
const switchingEtf = ref(false)

const searchPlaceholder = computed(() =>
  selectedEtf.value
    ? '切换到其它 ETF，如 510330.SH 或 510330'
    : '搜索 ETF 代码或名称...',
)
const searchActionLabel = computed(() => (selectedEtf.value ? '切换' : '搜索'))

const analysisResult = ref(null)
const analyzing = ref(false)
const pollingTimer = ref(null)
const chartRecords = ref([])
const klineLoading = ref(false)
let klineLoadGen = 0
let klineAbort = null

const klineTf = ref('1d')
const klineTfOptions = [
  { value: '1d', label: '日K' },
  { value: '1w', label: '周K' },
  { value: '1m', label: '月K' },
]

const showLoadMore = computed(() => {
  if (searchQuery.value.trim()) return false
  return listTotal.value > 0 && etfList.value.length < listTotal.value
})

function formatNum(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

async function fetchList({ append = false } = {}) {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }
  error.value = ''
  try {
    const q = searchQuery.value.trim()
    if (q) {
      const res = await axios.get(`${etfApiBase}/etf/list`, {
        params: { q, limit: 200 },
      })
      etfList.value = res.data.data || []
      listTradeDate.value = null
      listTotal.value = res.data.count || etfList.value.length
    } else {
      const offset = append ? etfList.value.length : 0
      const res = await axios.get(`${etfApiBase}/etf/list`, {
        params: {
          sort: 'total_share',
          limit: PAGE_SIZE,
          offset,
        },
      })
      const rows = res.data.data || []
      etfList.value = append ? [...etfList.value, ...rows] : rows
      listTradeDate.value = res.data.trade_date || null
      listTotal.value = res.data.total != null ? res.data.total : rows.length
    }
  } catch (e) {
    error.value = '获取ETF列表失败: ' + (e.message || String(e))
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

async function handleSearch() {
  if (selectedEtf.value) {
    await switchToEtfFromSharedSearch()
    return
  }
  await fetchList({ append: false })
}

function clearSearch() {
  searchQuery.value = ''
  if (!selectedEtf.value) {
    fetchList({ append: false })
  }
}

function loadMore() {
  if (!showLoadMore.value || loadingMore.value) return
  fetchList({ append: true })
}

onMounted(() => {
  fetchList({ append: false })
})

function _normTs(s) {
  return (s || '').toString().trim().toUpperCase()
}

function _pickEtfRow(rows, queryRaw) {
  const rowsOk = rows || []
  if (!rowsOk.length) return null
  const q = _normTs(queryRaw)
  if (!q) return null
  const exact = rowsOk.find((r) => _normTs(r.ts_code) === q)
  if (exact) return exact
  // 北交所 ETF 很少；6 位数字时最后尝试 .BJ，多数时候不会命中
  if (/^\d{6}$/.test(q)) {
    const sh = rowsOk.find((r) => _normTs(r.ts_code) === `${q}.SH`)
    if (sh) return sh
    const sz = rowsOk.find((r) => _normTs(r.ts_code) === `${q}.SZ`)
    if (sz) return sz
    const bj = rowsOk.find((r) => _normTs(r.ts_code) === `${q}.BJ`)
    if (bj) return bj
  }
  return rowsOk[0]
}

/** Detail mode: same box as list search; uses /api/etf/list?q=… */
async function switchToEtfFromSharedSearch() {
  const raw = searchQuery.value.trim()
  if (!raw || switchingEtf.value) return
  switchingEtf.value = true
  try {
    const res = await axios.get(`${etfApiBase}/etf/list`, { params: { q: raw, limit: 30 } })
    const pick = _pickEtfRow(res.data.data, raw)
    if (!pick || !pick.ts_code) {
      alert('未找到该 ETF，请检查代码或名称后重试')
      return
    }
    searchQuery.value = ''
    await selectEtf(pick)
  } catch (e) {
    alert('切换失败: ' + (e.message || String(e)))
  } finally {
    switchingEtf.value = false
  }
}

async function loadEtfKline (tsCode, tfForRequest) {
  if (!tsCode) return
  const tf = tfForRequest != null && tfForRequest !== '' ? tfForRequest : klineTf.value
  if (klineAbort) {
    try { klineAbort.abort() } catch (e) { /* noop */ }
  }
  klineAbort = new AbortController()
  const signal = klineAbort.signal
  const myGen = ++klineLoadGen
  klineLoading.value = true
  try {
    const res = await axios.get(`${etfApiBase}/etf/${tsCode}/kline`, {
      params: { limit: 250, tf },
      signal,
    })
    if (myGen !== klineLoadGen) return
    if (res.data?.success) {
      chartRecords.value = res.data.data || []
    } else {
      chartRecords.value = []
    }
  } catch (e) {
    if (
      e?.code === 'ERR_CANCELED' ||
      e?.name === 'CanceledError' ||
      e?.name === 'AbortError'
    ) {
      return
    }
    console.error('Failed to fetch ETF K-line data', e)
    if (myGen === klineLoadGen) {
      chartRecords.value = []
    }
  } finally {
    if (myGen === klineLoadGen) {
      klineLoading.value = false
    }
  }
}

const selectEtf = async (etf) => {
  selectedEtf.value = etf
  analysisResult.value = null
  chartRecords.value = []
  klineTf.value = '1d'
  fetchLatestAnalysis(etf.ts_code)
}

/** 单次调度：同 tick 内同时改 selectedEtf + klineTf 时只产生一次监听器触发，避免连打两次 K 线。 */
const klineRequestSig = computed(() => {
  const c = selectedEtf.value?.ts_code
  if (!c) return null
  return { tsCode: c, tf: klineTf.value }
})

watch(
  klineRequestSig,
  async (sig) => {
    if (!sig?.tsCode) {
      if (klineAbort) {
        try { klineAbort.abort() } catch (e) { /* noop */ }
      }
      return
    }
    await loadEtfKline(sig.tsCode, sig.tf)
  }
)

const fetchLatestAnalysis = async (symbol) => {
  try {
    const res = await axios.get(`${etfApiBase}/etf/${symbol}/analysis`)
    if (res.data.success && res.data.analysis) {
      analysisResult.value = res.data.analysis
    }
  } catch (e) {
    console.error('No cached analysis found', e)
  }
}

const triggerAnalysis = async () => {
  if (!selectedEtf.value) return

  analyzing.value = true
  try {
    const res = await axios.post(`${etfApiBase}/etf/analyze`, {
      symbol: selectedEtf.value.ts_code,
      force: true,
    })

    if (res.data.success && res.data.task_id) {
      pollTaskStatus(res.data.task_id)
    }
  } catch (e) {
    alert('触发分析失败: ' + e.message)
    analyzing.value = false
  }
}

const pollTaskStatus = (taskId) => {
  if (pollingTimer.value) clearInterval(pollingTimer.value)

  pollingTimer.value = setInterval(async () => {
    try {
      const res = await axios.get(`${etfApiBase}/etf/task/${taskId}`)
      if (res.data.status === 'completed') {
        clearInterval(pollingTimer.value)
        analysisResult.value = res.data.analysis
        analyzing.value = false
      } else if (res.data.status === 'failed') {
        clearInterval(pollingTimer.value)
        alert('分析任务失败: ' + res.data.error)
        analyzing.value = false
      }
    } catch (e) {
      clearInterval(pollingTimer.value)
      analyzing.value = false
    }
  }, 2000)
}

onBeforeUnmount(() => {
  if (pollingTimer.value) {
    clearInterval(pollingTimer.value)
    pollingTimer.value = null
  }
  if (klineAbort) {
    try { klineAbort.abort() } catch (e) { /* noop */ }
  }
})
</script>

<style scoped>
.etf-view {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header-section {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;
  margin-bottom: 20px;
}

.header-section h2 {
  margin: 0;
}

.header-meta {
  flex: 1 1 280px;
  font-size: 13px;
  color: var(--text-color, #555);
  line-height: 1.5;
}

.search-box {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #e0e0e0);
  border-radius: 6px;
  width: 260px;
  max-width: 100%;
  background-color: var(--bg-color, #fff);
  color: var(--text-color, #333);
}

.search-button {
  padding: 8px 16px;
  background: var(--primary-color, #1890ff);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.search-button.ghost {
  background: transparent;
  color: var(--primary-color, #1890ff);
  border: 1px solid var(--primary-color, #1890ff);
}

.table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--border-color, #eee);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card-bg, #fff);
  min-width: 900px;
}

.data-table th,
.data-table td {
  padding: 10px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border-color, #eee);
  color: var(--text-color, #333);
  font-size: 14px;
}

.data-table th {
  background: var(--hover-bg, #f5f5f5);
  font-weight: 600;
  white-space: nowrap;
}

.data-table th.num,
.data-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.etf-row {
  cursor: pointer;
  transition: background 0.15s ease;
}

.etf-row:hover {
  background: rgba(24, 144, 255, 0.06);
}

.code-link {
  color: var(--primary-color, #1890ff);
  font-weight: 600;
}

.name-cell {
  font-weight: 500;
  max-width: 200px;
}

.ellipsis {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.benchmark {
  max-width: 220px;
}

.load-more {
  margin-top: 16px;
  text-align: center;
}

.detail-section {
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.detail-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}

.back-button {
  background: none;
  border: none;
  color: var(--primary-color, #1890ff);
  font-size: 1em;
  cursor: pointer;
  padding: 0;
}

.detail-search-hint {
  font-size: 0.9em;
  color: var(--text-secondary, #666);
  flex: 1;
  min-width: 200px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color, #eee);
}

.analysis-btn {
  background: linear-gradient(135deg, #1890ff, #722ed1);
  color: white;
  border: none;
  padding: 8px 20px;
  border-radius: 20px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.3s;
}

.analysis-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.analysis-panel {
  display: flex;
  gap: 24px;
  background: var(--hover-bg, #fafafa);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.score-ring {
  flex-shrink: 0;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 4px solid var(--primary-color, #1890ff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: white;
}

.score-ring .score {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary-color, #1890ff);
  line-height: 1;
}

.score-ring .label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.analysis-content {
  flex-grow: 1;
}

.core-logic {
  font-size: 16px;
  margin-bottom: 16px;
  background: rgba(24, 144, 255, 0.1);
  padding: 12px;
  border-left: 4px solid var(--primary-color, #1890ff);
  border-radius: 0 4px 4px 0;
}

.views {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.view-card {
  background: white;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color, #eee);
}

.view-card h4 {
  margin: 0 0 8px 0;
  color: var(--text-color, #333);
}

.view-card p {
  margin: 0;
  color: #555;
  font-size: 14px;
  line-height: 1.5;
}

.chart-container {
  min-height: 600px;
  height: 600px;
  border: 1px dashed var(--border-color, #ccc);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  color: #888;
  box-sizing: border-box;
  padding: 0.5rem 0.5rem 0.25rem;
  gap: 0.5rem;
}

.kline-tf-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  font-size: 12px;
  color: #666;
}

.kline-tf-label {
  margin-right: 0.25rem;
  color: #888;
}

.tf-pill {
  background: #f0f0f0;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
}

.tf-pill.on {
  background: #e6f7ff;
  border-color: #1890ff;
  color: #096dd9;
  font-weight: 600;
}

.tf-pill.on.busy {
  opacity: 0.9;
}

.kline-loading-hint {
  color: #1890ff;
  font-size: 12px;
  margin-left: 0.25rem;
}

.chart-container :deep(.unified-chart-container) {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 40px;
  color: #666;
  background: var(--card-bg, #fff);
  border-radius: 8px;
}

.error-state {
  color: #cf1322;
  background: #fff1f0;
}
</style>
