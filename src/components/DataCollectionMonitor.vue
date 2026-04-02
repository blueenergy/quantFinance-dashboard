<template>
  <div class="data-collection-monitor">
    <div class="monitor-header">
      <h2>📊 数据采集监控</h2>
      <button @click="refreshAll" :disabled="loading || loadingOverview" class="refresh-btn">
        {{ loading || loadingOverview ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        :class="['tab', { active: activeTab === t.id }]"
        @click="activeTab = t.id"
      >
        {{ t.icon }} {{ t.label }}
      </button>
    </div>

    <!-- Tab: 管线健康 -->
    <div v-show="activeTab === 'pipelines'" class="tab-panel">
      <p v-if="expectedHint" class="hint">参考交易日（工作日近似）: {{ expectedHint }}</p>
      <div v-if="syncHealth" class="health-summary">
        <strong>{{ syncHealth.healthy }}</strong> / {{ syncHealth.total_pipelines }} 管线最近一次为成功（complete）
      </div>
      <div class="table-wrap" v-if="pipelinesRows.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>管线</th>
              <th>调度</th>
              <th>运行日</th>
              <th>状态</th>
              <th>记录数</th>
              <th>完成时间</th>
              <th>错误</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in pipelinesRows" :key="row.job_type">
              <td>{{ row.label }}</td>
              <td class="muted small">{{ row.schedule_hint || '—' }}</td>
              <td class="mono">{{ row.date || '—' }}</td>
              <td><span :class="statusClass(row.status)">{{ row.status }}</span></td>
              <td>{{ row.records_changed ?? '—' }}</td>
              <td class="mono small">{{ row.completed_at || '—' }}</td>
              <td class="err-cell">{{ row.error || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!loadingOverview" class="empty-state">暂无管线数据</p>
    </div>

    <!-- Tab: 数据新鲜度 -->
    <div v-show="activeTab === 'freshness'" class="tab-panel">
      <div class="table-wrap" v-if="freshnessRows.length">
        <table class="data-table">
          <thead>
            <tr>
              <th>管线</th>
              <th>库</th>
              <th>集合</th>
              <th>字段</th>
              <th>最新值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="fr in freshnessRows" :key="fr.pipeline_id + fr.collection">
              <td>{{ fr.label }}</td>
              <td class="mono">{{ fr.database }}</td>
              <td class="mono">{{ fr.collection }}</td>
              <td class="mono">{{ fr.field }}</td>
              <td class="mono">{{ fr.latest_value || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="!loadingOverview" class="empty-state">暂无新鲜度数据</p>
    </div>

    <!-- Tab: 分钟线明细（原有） -->
    <div v-show="activeTab === 'minute'" class="tab-panel">
      <div class="stats-cards" v-if="summary">
        <div class="stat-card">
          <div class="stat-icon">📈</div>
          <div class="stat-content">
            <div class="stat-label">总股票数</div>
            <div class="stat-value">{{ summary.total_stocks }}</div>
          </div>
        </div>
        <div class="stat-card active">
          <div class="stat-icon">✅</div>
          <div class="stat-content">
            <div class="stat-label">今日活跃</div>
            <div class="stat-value">{{ summary.active_today }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-content">
            <div class="stat-label">总K线数</div>
            <div class="stat-value">{{ formatNumber(summary.total_bars) }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔥</div>
          <div class="stat-content">
            <div class="stat-label">今日K线</div>
            <div class="stat-value">{{ formatNumber(summary.today_bars) }}</div>
          </div>
        </div>
      </div>

      <div class="filters">
        <label>
          <input type="checkbox" v-model="showActiveOnly" @change="applyFilters" />
          仅显示今日活跃
        </label>
        <input
          type="text"
          v-model="searchSymbol"
          placeholder="搜索股票代码..."
          @input="applyFilters"
          class="search-input"
        />
      </div>

      <div class="stocks-table-container">
        <table class="stocks-table" v-if="filteredStocks.length > 0">
          <thead>
            <tr>
              <th>股票代码</th>
              <th>状态</th>
              <th>总K线数</th>
              <th>最新时间</th>
              <th>更新间隔</th>
              <th>数据范围</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="stock in paginatedStocks"
              :key="stock.symbol"
              :class="{ 'active-row': stock.is_active_today }"
            >
              <td class="symbol-cell">
                <strong>{{ stock.symbol }}</strong>
              </td>
              <td>
                <span v-if="stock.is_active_today" class="status-badge active">✅ 活跃</span>
                <span v-else class="status-badge inactive">⏸️ 静默</span>
              </td>
              <td>{{ formatNumber(stock.total_bars) }}</td>
              <td>{{ formatDateTime(stock.latest_date) }}</td>
              <td>
                <span
                  v-if="stock.minutes_since_update !== null"
                  :class="getUpdateStatusClass(stock.minutes_since_update)"
                >
                  {{ formatMinutesAgo(stock.minutes_since_update) }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="date-range">
                {{ formatDate(stock.earliest_date) }} ~ {{ formatDate(stock.latest_date) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-else class="empty-state">
          <p>{{ loading ? '加载中...' : '暂无分钟线采集记录' }}</p>
        </div>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button @click="prevPage" :disabled="currentPage === 1">上一页</button>
        <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
        <button @click="nextPage" :disabled="currentPage === totalPages">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const loading = ref(false)
const loadingOverview = ref(false)
const summary = ref(null)
const stocks = ref([])
const searchSymbol = ref('')
const showActiveOnly = ref(false)
const currentPage = ref(1)
const pageSize = 20

const activeTab = ref('pipelines')
const tabs = [
  { id: 'pipelines', label: '管线健康', icon: '⚡' },
  { id: 'freshness', label: '数据新鲜度', icon: '📅' },
  { id: 'minute', label: '分钟线明细', icon: '📈' },
]

const overviewData = ref(null)

const pipelinesRows = computed(() => overviewData.value?.pipelines || [])
const freshnessRows = computed(() => overviewData.value?.freshness || [])
const syncHealth = computed(() => overviewData.value?.sync_health || null)
const expectedHint = computed(() => overviewData.value?.expected_trade_date_hint || null)

async function loadOverview() {
  loadingOverview.value = true
  try {
    const response = await axios.get('/api/admin/data-monitoring/overview')
    overviewData.value = response.data.data
  } catch (error) {
    console.error('获取数据监控总览失败:', error)
  } finally {
    loadingOverview.value = false
  }
}

async function refreshData() {
  loading.value = true
  try {
    const response = await axios.get('/api/admin/data-collection/status')
    const data = response.data.data
    summary.value = data.summary
    stocks.value = data.stocks
  } catch (error) {
    console.error('获取数据采集状态失败:', error)
    alert('获取分钟线数据失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadOverview(), refreshData()])
}

function statusClass(status) {
  if (status === 'complete') return 'st-ok'
  if (status === 'no_record') return 'st-miss'
  if (status === 'skipped') return 'st-skip'
  if (status === 'failed') return 'st-fail'
  return 'st-warn'
}

const filteredStocks = computed(() => {
  let result = stocks.value
  if (showActiveOnly.value) result = result.filter((s) => s.is_active_today)
  if (searchSymbol.value) {
    const search = searchSymbol.value.toLowerCase()
    result = result.filter((s) => s.symbol.toLowerCase().includes(search))
  }
  return result
})

const totalPages = computed(() => Math.ceil(filteredStocks.value.length / pageSize))

const paginatedStocks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredStocks.value.slice(start, start + pageSize)
})

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}
function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}
function applyFilters() {
  currentPage.value = 1
}

function formatNumber(num) {
  return num?.toLocaleString() || '0'
}
function formatDateTime(dateStr) {
  if (!dateStr || dateStr.length < 12) return '-'
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  const hour = dateStr.substring(8, 10)
  const minute = dateStr.substring(10, 12)
  return `${year}-${month}-${day} ${hour}:${minute}`
}
function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 8) return '-'
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
}
function formatMinutesAgo(minutes) {
  if (minutes === null || minutes === undefined) return '-'
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}
function getUpdateStatusClass(minutes) {
  if (minutes === null) return 'text-muted'
  if (minutes < 5) return 'update-fresh'
  if (minutes < 30) return 'update-recent'
  if (minutes < 1440) return 'update-old'
  return 'update-stale'
}

let intervalId = null
onMounted(() => {
  refreshAll()
  intervalId = setInterval(refreshAll, 30000)
})
onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.data-collection-monitor {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}

.monitor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.monitor-header h2 {
  margin: 0;
  color: #333;
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 1px solid #eee;
  padding-bottom: 8px;
}

.tab {
  padding: 8px 14px;
  border: none;
  background: #f5f5f5;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #555;
}

.tab.active {
  background: #2196f3;
  color: #fff;
}

.tab-panel {
  min-height: 120px;
}

.hint {
  font-size: 12px;
  color: #666;
  margin: 0 0 8px 0;
}

.health-summary {
  margin-bottom: 12px;
  font-size: 14px;
}

.table-wrap {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th,
.data-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: top;
}

.data-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.mono {
  font-family: 'Roboto Mono', monospace;
  font-size: 12px;
}

.small {
  font-size: 11px;
}

.muted {
  color: #888;
  max-width: 220px;
}

.err-cell {
  max-width: 200px;
  word-break: break-word;
  color: #c62828;
  font-size: 12px;
}

.st-ok {
  color: #2e7d32;
  font-weight: 600;
}
.st-miss {
  color: #757575;
}
.st-skip {
  color: #f57c00;
}
.st-fail {
  color: #c62828;
  font-weight: 600;
}
.st-warn {
  color: #f9a825;
}

.refresh-btn {
  padding: 8px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
.refresh-btn:hover:not(:disabled) {
  background: #1976d2;
}
.refresh-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}
.stat-card {
  display: flex;
  align-items: center;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  gap: 15px;
}
.stat-card.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}
.stat-icon {
  font-size: 32px;
}
.stat-label {
  font-size: 13px;
  opacity: 0.8;
  margin-bottom: 5px;
}
.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.filters {
  display: flex;
  gap: 15px;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 4px;
}
.search-input {
  flex: 1;
  max-width: 300px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.stocks-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.stocks-table th {
  background: #f5f5f5;
  padding: 12px 8px;
  text-align: left;
  font-weight: 600;
  border-bottom: 2px solid #ddd;
}
.stocks-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #eee;
}
.stocks-table tr.active-row {
  background: #f0f9ff;
}
.symbol-cell {
  font-family: 'Courier New', monospace;
  font-size: 15px;
}
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
.status-badge.active {
  background: #4caf50;
  color: white;
}
.status-badge.inactive {
  background: #e0e0e0;
  color: #666;
}
.update-fresh {
  color: #4caf50;
  font-weight: 600;
}
.update-recent {
  color: #ff9800;
}
.update-old {
  color: #f44336;
}
.update-stale {
  color: #999;
}
.text-muted {
  color: #999;
}
.date-range {
  font-size: 12px;
  color: #666;
}
.empty-state {
  text-align: center;
  padding: 24px;
  color: #999;
}
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
  margin-top: 16px;
}
.pagination button {
  padding: 6px 16px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.pagination button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.page-info {
  color: #666;
  font-size: 14px;
}
</style>
