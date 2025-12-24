<template>
  <div class="data-collection-monitor">
    <div class="monitor-header">
      <h2>📊 数据采集监控</h2>
      <button @click="refreshData" :disabled="loading" class="refresh-btn">
        {{ loading ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <!-- 统计卡片 -->
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

    <!-- 筛选器 -->
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

    <!-- 股票列表 -->
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
          <tr v-for="stock in paginatedStocks" :key="stock.symbol" 
              :class="{ 'active-row': stock.is_active_today }">
            <td class="symbol-cell">
              <strong>{{ stock.symbol }}</strong>
            </td>
            <td>
              <span v-if="stock.is_active_today" class="status-badge active">
                ✅ 活跃
              </span>
              <span v-else class="status-badge inactive">
                ⏸️ 静默
              </span>
            </td>
            <td>{{ formatNumber(stock.total_bars) }}</td>
            <td>{{ formatDateTime(stock.latest_date) }}</td>
            <td>
              <span v-if="stock.minutes_since_update !== null" 
                    :class="getUpdateStatusClass(stock.minutes_since_update)">
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
        <p>{{ loading ? '加载中...' : '暂无数据采集记录' }}</p>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination" v-if="totalPages > 1">
      <button @click="prevPage" :disabled="currentPage === 1">上一页</button>
      <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
      <button @click="nextPage" :disabled="currentPage === totalPages">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const loading = ref(false)
const summary = ref(null)
const stocks = ref([])
const searchSymbol = ref('')
const showActiveOnly = ref(false)
const currentPage = ref(1)
const pageSize = 20

// 获取数据
async function refreshData() {
  loading.value = true
  try {
    const response = await axios.get('/api/admin/data-collection/status')
    const data = response.data.data
    
    summary.value = data.summary
    stocks.value = data.stocks
    
    console.log(`数据采集监控: ${data.summary.total_stocks}只股票, ${data.summary.active_today}只今日活跃`)
  } catch (error) {
    console.error('获取数据采集状态失败:', error)
    alert('获取数据失败: ' + (error.response?.data?.detail || error.message))
  } finally {
    loading.value = false
  }
}

// 筛选后的股票列表
const filteredStocks = computed(() => {
  let result = stocks.value

  // 仅显示活跃
  if (showActiveOnly.value) {
    result = result.filter(s => s.is_active_today)
  }

  // 搜索过滤
  if (searchSymbol.value) {
    const search = searchSymbol.value.toLowerCase()
    result = result.filter(s => s.symbol.toLowerCase().includes(search))
  }

  return result
})

// 分页相关
const totalPages = computed(() => Math.ceil(filteredStocks.value.length / pageSize))

const paginatedStocks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return filteredStocks.value.slice(start, end)
})

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}

function nextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}

function applyFilters() {
  currentPage.value = 1  // 重置到第一页
}

// 格式化函数
function formatNumber(num) {
  return num?.toLocaleString() || '0'
}

function formatDateTime(dateStr) {
  if (!dateStr || dateStr.length < 12) return '-'
  // YYYYMMDDHHMM -> YYYY-MM-DD HH:MM
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  const hour = dateStr.substring(8, 10)
  const minute = dateStr.substring(10, 12)
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length < 8) return '-'
  // YYYYMMDD -> YYYY-MM-DD
  const year = dateStr.substring(0, 4)
  const month = dateStr.substring(4, 6)
  const day = dateStr.substring(6, 8)
  return `${year}-${month}-${day}`
}

function formatMinutesAgo(minutes) {
  if (minutes === null || minutes === undefined) return '-'
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

function getUpdateStatusClass(minutes) {
  if (minutes === null) return 'text-muted'
  if (minutes < 5) return 'update-fresh'
  if (minutes < 30) return 'update-recent'
  if (minutes < 1440) return 'update-old'
  return 'update-stale'
}

onMounted(() => {
  refreshData()
  
  // 每30秒自动刷新
  const interval = setInterval(refreshData, 30000)
  
  // 清理定时器
  return () => clearInterval(interval)
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
  margin-bottom: 20px;
}

.monitor-header h2 {
  margin: 0;
  color: #333;
}

.refresh-btn {
  padding: 8px 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.refresh-btn:hover:not(:disabled) {
  background: #1976D2;
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

.stat-content {
  flex: 1;
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

.filters label {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}

.search-input {
  flex: 1;
  max-width: 300px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.stocks-table-container {
  overflow-x: auto;
  margin-bottom: 20px;
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

.stocks-table tr:hover {
  background: #fafafa;
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
  padding: 40px;
  color: #999;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.pagination button {
  padding: 6px 16px;
  background: #2196F3;
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
