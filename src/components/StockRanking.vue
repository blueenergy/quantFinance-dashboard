<!-- dashboard/src/components/StockRanking.vue -->
<template>
  <div>
  <h3 class="ranking-title">股票评分排行榜</h3>
    <div style="margin-bottom: 20px;">
      <!-- ✅ 合并日期选择和显示模式设置到同一行 -->
      <div class="control-section">
        <div class="control-group" style="gap: 32px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label>显示模式：</label>
            <select v-model="viewMode" @change="onViewModeChange">
              <option value="ranking">排行榜模式</option>
              <option value="selected">指定股票模式</option>
              <option value="watchlist">自选股模式</option>
            </select>
          </div>
            <div v-if="viewMode !== 'selected'" style="display: flex; align-items: center; gap: 10px;">
            <label>选择日期：</label>
            <input type="date" v-model="selectedDate" @change="onDateChange" class="date-input" :max="maxDate" @click="maybeOpenAvailableDatesForTop" />
          </div>
        </div>

        <!-- ✅ 排行榜 / 自选股 模式控制 -->
        <div v-if="viewMode === 'ranking' || viewMode === 'watchlist'" class="control-group">
          <label v-if="viewMode === 'ranking'">显示数量：</label>
          <select v-if="viewMode === 'ranking'" v-model="displayLimit" @change="fetchRankings">
            <option value="10">Top 10</option>
            <option value="50">Top 50</option>
            <option value="100">Top 100</option>
            <option value="200">Top 200</option>
          </select>
          <label style="margin-left: 24px;">排名策略：</label>
          <select v-model="rankingStrategy" @change="onRankingStrategyChange">
            <option value="balanced">均衡</option>
            <option value="aggressive">激进</option>
            <option value="conservative">保守</option>
            <option value="defensive">防御</option>
            <option value="value_oriented">价值型</option>
            <option value="trading_oriented">交易型</option>
            <option value="growth_oriented">成长型</option>
            <option value="cycle_oriented">周期型</option>
          </select>
        </div>

        <!-- ✅ 指定股票模式控制 -->
        <div v-if="viewMode === 'selected'" class="control-group">
          <div class="stock-input-area">
            <label>选择股票：</label>
            <div class="input-row">
              <input 
                v-model="stockInput" 
                @keyup.enter="addStockToQuery"
                @input="onStockInputChange"
                placeholder="输入股票代码，如: 000001, 002129..."
                class="stock-input"
              />
              <button @click="addStockToQuery" class="btn-add">添加</button>
              <button @click="clearSelectedStocks" class="btn-clear">清空</button>
            </div>
            
            <!-- ✅ 股票代码提示 -->
            <div v-if="stockSuggestions.length > 0" class="suggestions-list">
              <div 
                v-for="suggestion in stockSuggestions" 
                :key="suggestion.symbol"
                @click="selectSuggestion(suggestion)"
                class="suggestion-item"
              >
                {{ suggestion.symbol }} - {{ suggestion.name }}
              </div>
            </div>
            
            <!-- ✅ 已选择的股票标签 -->
            <div v-if="selectedStocks.length > 0" class="selected-stocks">
              <span 
                v-for="symbol in selectedStocks" 
                :key="symbol"
                class="stock-tag"
              >
                {{ symbol }}
                <button @click="removeStockFromQuery(symbol)" class="tag-remove">×</button>
              </span>
            </div>
            <!-- 策略选择（与排行榜/自选股模式一致） -->
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
              <label>策略：</label>
              <select v-model="rankingStrategy" @change="onRankingStrategyChange" style="padding:6px; font-size:14px;">
                <option value="balanced">均衡</option>
                <option value="aggressive">激进</option>
                <option value="conservative">保守</option>
                <option value="defensive">防御</option>
                <option value="value_oriented">价值型</option>
                <option value="trading_oriented">交易型</option>
                <option value="growth_oriented">成长型</option>
                <option value="cycle_oriented">周期型</option>
              </select>
            </div>
            <!-- ✅ 多日期选择：允许在指定股票模式下选择多个评分日期 -->
            <div class="multi-date-area" style="margin-top:12px; width:100%;">
              <!-- Consolidated date control: open backend-driven modal to pick available dates for a selected symbol -->
              <div style="display:flex; gap:8px; align-items:center;">
                <button @click="openAvailableDatesPicker" class="btn-add">查看可用评分日期</button>
                <button @click="clearSelectedDates" class="btn-clear">清空已选日期</button>
              </div>
              <div class="helper-text" style="margin-top:6px;">先选中单只股票后点击查看该股票的评分日期</div>

              <div v-if="selectedDates.length > 0" class="selected-dates" style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
                <div v-for="date in selectedDates" :key="date" class="date-chip" style="background:#fff; border:1px solid #ddd; padding:6px 8px; border-radius:6px; display:flex; align-items:center; gap:8px;">
                  <strong>{{ formatDateDisplay(date) }}</strong>
                  <button @click="removeDateFromSelection(date)" class="tag-remove">×</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ✅ 自选股模式提示 -->
        <div v-if="viewMode === 'watchlist'" class="control-group">
          <span class="watchlist-info">
            📋 显示您的自选股评分 ({{ watchlist.length }} 只)
          </span>
          <button @click="viewWatchlistStocks" class="btn-manage-watchlist">查看自选股详情</button>
          <button @click="clearWatchlist" class="btn-clear-watchlist">清空自选股</button>
        </div>

        <!-- ✅ 通用控制按钮 -->
        <div class="control-group">
          <button @click="exportScores" class="btn-export">导出数据</button>
          
          <span class="last-update">
            最后更新: {{ lastUpdateTime }}
          </span>
        </div>
      </div>
    </div>

    <!-- ✅ 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>{{ loadingMessage }}</span>
    </div>

    <!-- ✅ 无数据提示 -->
    <div v-else-if="rankings.length === 0" class="no-data-container">
      <div class="no-data-icon">📊</div>
      <h4>{{ getNoDataMessage() }}</h4>
      <p>{{ getNoDataSubMessage() }}</p>
      <button v-if="viewMode === 'selected'" @click="showQuickSelectModal" class="btn-quick-select">
        快速选择热门股票
      </button>
    </div>

    <!-- ✅ 数据表格 -->
    <div v-else>
      <!-- 显示模式标题 -->
      <div class="mode-header">
        <h4>{{ getModeTitle() }}</h4>
  <span class="stock-count">共 {{ (viewMode === 'selected' && selectedDates.length > 0) ? displayRows.length : rankings.length }} 只股票</span>
      </div>

      <table class="ranking-table">
        <thead>
          <tr class="table-header">
            <th class="th-rank">{{ viewMode === 'ranking' ? '排名' : '序号' }}</th>
            <th class="th-symbol">股票代码</th>
            <th class="th-name">股票名称</th>
            <th class="th-date">日期</th>
            <th class="th-score">总分</th>
            <th class="th-cycle">周期</th>
            <th class="th-growth">成长</th>
            <th class="th-value">基本面</th>
            <th class="th-value">价值</th>
            <th class="th-technical">技术</th>
            <th class="th-money">资金</th>
            <th class="th-action">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in displayRows" :key="row.symbol + '_' + (row.display_date || row.score_date || index)" class="table-row" :class="getRowClass(row, index + 1)">
            <td class="td-rank">
              <span :style="getRankStyle(row, index + 1)" class="rank-badge">
                {{ viewMode === 'ranking' ? (index + 1) : (index + 1) }}
              </span>
            </td>
            <td class="td-symbol">
              <span class="symbol-text">{{ row.symbol }}</span>
            </td>
            <td class="td-name">
              <span class="name-text" :title="row.name">{{ row.name || '-' }}</span>
            </td>
            <td class="td-date">
              <span>{{ formatDateDisplay(row.display_date || row.score_date) }}</span>
            </td>
            <td class="td-score" @click="showScoreDetailModal(row._origin || row)">
              <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
                <span :style="getScoreStyle(row.display_composite_score)" class="score-badge clickable">
                  {{ row.display_composite_score }}
                </span>
                <!-- （已移除）策略选择已上移至顶部控制区域，作为全局参数应用于所有显示日期 -->
              </div>
            </td>
            <td class="td-cycle">
              <span class="cycle-score">{{ row.cycle_score }}</span>
            </td>
            <td class="td-growth">
              <span class="growth-score">{{ row.growth_score }}</span>
            </td>
            <td class="td-fundamental">
              <span class="fundamental-score">{{ row.fundamental_score }}</span>
            </td>
            <td class="td-value">
              <span class="value-score">{{ row.value_score }}</span>
            </td>
            <td class="td-technical">
              <span class="technical-score">{{ row.technical_score }}</span>
            </td>
            <td class="td-money">
              <span class="money-score">{{ row.money_flow_score }}</span>
            </td>
            <td class="td-action">
              <button @click="viewChart(row.symbol)" class="btn-chart" title="查看图表">📊</button>
              <button 
                @click="toggleWatchlist(row.symbol)" 
                :class="isInWatchlist(row.symbol) ? 'btn-watch-active' : 'btn-watch'"
                :title="isInWatchlist(row.symbol) ? '从自选股移除' : '添加到自选股'"
              >
                {{ isInWatchlist(row.symbol) ? '★' : '⭐' }}
              </button>
              <button 
                v-if="viewMode === 'selected'" 
                @click="removeStockFromQuery(row.symbol)" 
                class="btn-remove"
                title="从查询中移除"
              >
                🗑️
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ✅ 快速选择模态框 -->
    <div v-if="showQuickSelect" class="modal-overlay" @click="closeQuickSelect">
      <div class="modal-content quick-select-modal" @click.stop>
        <h4>快速选择热门股票</h4>
        <div class="quick-select-tabs">
          <button 
            v-for="category in quickSelectCategories" 
            :key="category.key"
            @click="selectedCategory = category.key"
            :class="['tab-btn', { active: selectedCategory === category.key }]"
          >
            {{ category.name }}
          </button>
        </div>
        <div class="quick-select-content">
          <div 
            v-for="stock in getCurrentCategoryStocks()" 
            :key="stock.symbol"
            @click="toggleQuickSelectStock(stock.symbol)"
            :class="['quick-stock-item', { selected: selectedStocks.includes(stock.symbol) }]"
          >
            <span class="quick-stock-symbol">{{ stock.symbol }}</span>
            <span class="quick-stock-name">{{ stock.name }}</span>
            <span v-if="selectedStocks.includes(stock.symbol)" class="selected-indicator">✓</span>
          </div>
        </div>
        <div class="quick-select-actions">
          <button @click="applyQuickSelection" class="btn-apply">应用选择 ({{ selectedStocks.length }})</button>
          <button @click="closeQuickSelect" class="btn-cancel">取消</button>
        </div>
      </div>
    </div>

    <!-- ✅ 可用评分日期模态框（在指定股票模式且选择单只股票时弹出） -->
    <div v-if="showAvailableDatesModal" class="modal-overlay" @click="closeAvailableDatesModal">
      <div class="modal-content" @click.stop style="max-width:520px;">
        <h4>选择 {{ pickingForSymbol }} 的可用评分日期</h4>
        <div style="max-height:320px; overflow:auto; border:1px solid #eee; padding:8px; margin-top:8px;">
            <div v-if="availableDatesForSymbol.length === 0">未找到可用日期。</div>
            <div v-else>
              <div style="display:flex; gap:8px; margin-bottom:8px;">
                <button @click="selectAllAvailableDates" class="btn-apply">全选</button>
                <button @click="deselectAllAvailableDates" class="btn-cancel">全不选</button>
              </div>
              <label v-for="d in availableDatesForSymbol" :key="d" style="display:flex; align-items:center; gap:8px; padding:6px 4px;">
                <input type="checkbox" :value="d" v-model="availableDatesSelection" />
                <span>{{ formatDateDisplay(d) }}</span>
              </label>
            </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
          <button @click="applyAvailableDatesSelection(availableDatesSelection || [])" class="btn-apply">应用 ({{ (availableDatesSelection || []).length }})</button>
          <button @click="closeAvailableDatesModal" class="btn-cancel">取消</button>
        </div>
      </div>
    </div>

    <!-- ✅ 评分详情弹窗 (保持原有功能并增强) -->
    <div v-if="showScoreDetail" class="modal-overlay" @click="closeScoreDetail">
      <div class="modal-content score-detail-modal" @click.stop>
        <h4>{{ selectedStock?.symbol }} - {{ selectedStock?.name }} 评分详情</h4>
        <div class="score-detail-content">
          <div class="score-item total-score">
            <span class="score-label">总分</span>
            <span class="score-value" :style="getScoreStyle(selectedStock?.composite_score)">
              {{ selectedStock?.composite_score }}
            </span>
          </div>
          <div class="score-breakdown">
            <div class="score-item">
              <span class="score-label">周期评分</span>
              <span class="score-value cycle">{{ selectedStock?.cycle_score }}</span>
              <span class="score-weight">(权重: 25%)</span>
            </div>
            <div class="score-item">
              <span class="score-label">成长评分</span>
              <span class="score-value growth">{{ selectedStock?.growth_score }}</span>
              <span class="score-weight">(权重: 25%)</span>
            </div>
            <div class="score-item">
              <span class="score-label">基本面评分</span>
              <span class="score-value fundamental">{{ selectedStock?.fundamental_score }}</span>
              <span class="score-weight">(权重: 35%)</span>
            </div>
            <div class="score-item">
              <span class="score-label">价值评分</span>
              <span class="score-value value">{{ selectedStock?.value_score }}</span>
              <span class="score-weight">(权重: 35%)</span>
            </div>
            <div class="score-item">
              <span class="score-label">技术面评分</span>
              <span class="score-value technical">{{ selectedStock?.technical_score }}</span>
              <span class="score-weight">(权重: 25%)</span>
            </div>
            <div class="score-item">
              <span class="score-label">资金流评分</span>
              <span class="score-value money">{{ selectedStock?.money_flow_score }}</span>
              <span class="score-weight">(权重: 15%)</span>
            </div>
          </div>
          <div class="score-detail-actions">
            <button @click="viewChart(selectedStock?.symbol)" class="btn-chart-detail">查看走势图</button>
            <button @click="toggleWatchlist(selectedStock?.symbol)" class="btn-watchlist-detail">
              {{ isInWatchlist(selectedStock?.symbol) ? '从自选股移除' : '添加到自选股' }}
            </button>
          </div>
        </div>
        <button @click="closeScoreDetail" class="btn-close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { getCompositeScore, formatDateDisplay, generateCSV as utilGenerateCSV, deduplicateStocksByLatestDate } from '../utils/scoreUtils.js'
import { computeDisplayRows } from '../utils/displayRows.js'

const emit = defineEmits(['view-chart'])

// -------------------------
// Reactive state (grouped and documented)
// -------------------------
// Core data
// rankings: array of stock score objects returned from the backend.
// Each item typically contains: { symbol, name, composite_score, score_date, per_date_scores?, per_date_fields?, ... }
const rankings = ref([])
const loading = ref(false)
const displayLimit = ref(50)

// UI mode & inputs
// viewMode: one of 'ranking' | 'selected' | 'watchlist'
// stockInput / stockSuggestions: helpers for the stock input autocomplete
// selectedStocks: array of selected symbols for 'selected' mode
const viewMode = ref('ranking') // 'ranking' | 'selected' | 'watchlist'
const stockInput = ref('')
const stockSuggestions = ref([])
const selectedStocks = ref([])

// Date / multi-date selections
// selectedDate: single date input (ISO yyyy-mm-dd)
// selectedDateInput: auxiliary input used when adding to selectedDates
// selectedDates: array of selected yyyyMMdd strings used for multi-date flattening
const selectedDate = ref('')
const selectedDateInput = ref('')
const selectedDates = ref([])

// Strategy controls
// rankingStrategy: global strategy used across modes unless a per-stock override is set
// perStockStrategies: map { SYMBOL: 'balanced'|'aggressive'|'conservative' } for per-symbol overrides
const rankingStrategy = ref('balanced')
const perStockStrategies = ref({})

// UI helpers / tokens
// refreshKey: small integer token bumped to force expensive computed properties to re-evaluate
// loadingMessage / lastUpdateTime: UI strings
const refreshKey = ref(0) // bump to force computed refresh when needed
const loadingMessage = ref('')
const lastUpdateTime = ref('')
// AbortController for cancelling in-flight fetchRankings requests
const currentRequestController = ref(null)

// Modals / lists
// Quick select modal state and sample categories (static fallback data)
const showQuickSelect = ref(false)
const quickSelectCategories = ref([
  { key: 'finance', name: '金融股', stocks: [ { symbol: '000001', name: '平安银行' }, { symbol: '600036', name: '招商银行' } ] },
  { key: 'consume', name: '消费股', stocks: [ { symbol: '000858', name: '五粮液' }, { symbol: '600519', name: '贵州茅台' } ] }
])
const selectedCategory = ref(quickSelectCategories.value[0].key)
const watchlist = ref([])

// Available-dates modal (used when picking dates for a single symbol)
const showAvailableDatesModal = ref(false)
const availableDatesForSymbol = ref([]) // array of yyyyMMdd strings returned by /api/stock-dates
const availableDatesSelection = ref([])
const pickingForSymbol = ref('')

// Score detail modal
const showScoreDetail = ref(false)
const selectedStock = ref(null)

// ✅ 计算属性
const getCurrentCategoryStocks = computed(() => {
  const category = quickSelectCategories.value.find(cat => cat.key === selectedCategory.value)
  return category ? category.stocks : []
})

// ✅ 检查用户是否已登录
function isUserLoggedIn() {
  return localStorage.getItem('access_token') !== null
}

// ✅ 获取 axios 配置（包含认证头）
function getAuthHeaders() {
  const token = localStorage.getItem('access_token')
  return token ? {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  } : {}
}

// -------------------------
// Helper utilities (pure, small)
// -------------------------
// Return effective strategy key for a stock (per-stock override > selected-mode global > rankingStrategy)
function getEffectiveStrategyFor(symbol) {
  return (perStockStrategies.value && perStockStrategies.value[symbol]) || rankingStrategy.value
}

// getCompositeScore imported from utils

// ✅ 主数据获取方法 - 根据模式调用不同API
async function fetchRankings() {
  loading.value = true
  try {
    console.log('[fetchRankings] start, viewMode=', viewMode.value)
    // cancel any previous in-flight request
    try {
      if (currentRequestController.value) {
        currentRequestController.value.abort()
      }
    } catch (e) {
      // no-op
    }
    currentRequestController.value = new AbortController()
    const signal = currentRequestController.value.signal
    let response
    // 构造日期参数
    let dateParam = ''
    if (selectedDate.value) {
      // 期望格式：yyyyMMdd
      const d = new Date(selectedDate.value)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      dateParam = `${yyyy}${mm}${dd}`
    }
    switch (viewMode.value) {
      case 'ranking': {
        loadingMessage.value = `加载前 ${displayLimit.value} 名股票评分...`
        let url = `/api/stock-rankings?limit=${displayLimit.value}`
        if (dateParam) url += `&date=${dateParam}`
  response = await axios.get(url, { signal })
        break
      }
      case 'selected': {
        if (selectedStocks.value.length === 0) {
          rankings.value = []
          loading.value = false
          return
        }
        loadingMessage.value = `加载指定股票评分...`
        const payload = { symbols: selectedStocks.value }
        // 如果有多日期，传递 dates 数组；否则继续使用单日期参数
        let url = '/api/stock-rankings/selected'
        if (selectedDates.value.length > 0) {
          payload.dates = selectedDates.value
          console.log('[fetchRankings] posting with dates', payload.dates)
          response = await axios.post(url, payload, { signal })
        } else {
          if (dateParam) url += `?date=${dateParam}`
          console.log('[fetchRankings] posting without dates to', url)
          response = await axios.post(url, payload, { signal })
        }
        break
      }
      case 'watchlist': {
        if (!isUserLoggedIn()) {
          alert('请先登录后查看自选股评分')
          viewMode.value = 'ranking'
          await fetchRankings()
          return
        }
        if (watchlist.value.length === 0) {
          rankings.value = []
          loading.value = false
          return
        }
        loadingMessage.value = `加载自选股评分...`
        const payload = { symbols: watchlist.value }
        let url = '/api/stock-rankings/selected'
        if (dateParam) url += `?date=${dateParam}`
  response = await axios.post(url, payload, { signal })
        break
      }
      default:
        throw new Error('无效的查看模式')
    }
    console.log('[fetchRankings] got response, status:', response?.status, 'data=', response?.data)
    // 处理响应数据（防御性检查）
    if (!response) {
      console.error('[fetchRankings] empty response')
      rankings.value = []
    } else if (response.data && typeof response.data === 'object') {
      if (response.data.success && response.data.data) {
        rankings.value = response.data.data
      } else if (Array.isArray(response.data)) {
        rankings.value = response.data
      } else {
        // server returned object but not expected shape
        rankings.value = []
      }
    } else if (Array.isArray(response)) {
      // fallback if axios returned array directly
      rankings.value = response
    } else {
      rankings.value = []
    }
    console.log('[fetchRankings] rankings count after response:', (rankings.value || []).length)
      // NOTE: do not auto-populate perStockStrategies here. Keep perStockStrategies
      // empty unless the user explicitly sets a per-stock override. That allows the
      // top-level `selectedModeStrategy` to take effect in 'selected' mode.
      // ✅ 新增：确保前端也做去重处理 (防御性编程)
      try {
        if (!(viewMode.value === 'selected' && selectedDates.value.length > 0)) {
          console.log('[fetchRankings] calling deduplicateStocksByLatestDate')
          rankings.value = deduplicateStocksByLatestDate(rankings.value)
          console.log('[fetchRankings] dedupe done, count now:', (rankings.value || []).length)
        }
      } catch (e) {
        console.error('[fetchRankings] error during deduplication:', e)
      }
    // 排序处理
  // 如果是多日期并且后端返回每个股票包含 per_date_scores 对象，按当前全局 rankingStrategy 对应某个日期合并排序（默认用首个日期）
  if (viewMode.value === 'selected' && selectedDates.value.length > 0) {
    const primaryDate = selectedDates.value[0]
    rankings.value.sort((a, b) => {
      const aStrat = getEffectiveStrategyFor(a.symbol)
      const bStrat = getEffectiveStrategyFor(b.symbol)
      const aScore = a.per_date_scores?.[primaryDate]?.[aStrat] ?? 0
      const bScore = b.per_date_scores?.[primaryDate]?.[bStrat] ?? 0
      return bScore - aScore
    })
  } else {
    rankings.value.sort((a, b) => getCompositeScore(b, rankingStrategy.value) - getCompositeScore(a, rankingStrategy.value))
  }
    // 更新时间
    if (rankings.value.length > 0) {
      const scoreDate = rankings.value[0].score_date
      if (scoreDate) {
        const year = scoreDate.substring(0, 4)
        const month = scoreDate.substring(4, 6)
        const day = scoreDate.substring(6, 8)
        lastUpdateTime.value = `${year}-${month}-${day}`
      } else {
        lastUpdateTime.value = new Date().toLocaleDateString()
      }
    }
    } catch (error) {
    // Ignore abort errors triggered by new requests
    if (error.name === 'CanceledError' || error.name === 'AbortError') {
      console.log('[fetchRankings] request canceled')
      return
    }
    console.error('获取股票排行失败:', error)
    console.error('错误详情:', error.response?.data)
    if (error.response?.status === 404) {
      rankings.value = []
    } else {
      alert('获取股票评分失败: ' + (error.response?.data?.detail || error.message))
    }
  } finally {
    loading.value = false
    // clear controller if this request finished (success or error other than cancel)
    if (currentRequestController.value) {
      try { currentRequestController.value = null } catch (e) {}
    }
  }
}
// 日期选择变化时自动刷新
function onDateChange() {
  fetchRankings()
}

// 如果处于 selected 模式并且只选了一只股票，点击日期输入时打开可用日期选择
function maybeOpenAvailableDatesForTop() {
  if (viewMode.value === 'selected' && selectedStocks.value.length === 1) {
    pickingForSymbol.value = selectedStocks.value[0]
    fetchAvailableDatesForSymbol(pickingForSymbol.value).then(() => {
      showAvailableDatesModal.value = true
    })
  }
}

// 当用户在多日期选择框中点击时，也在单只股票场景打开可用日期列表
function maybeOpenAvailableDatesForMulti() {
  if (viewMode.value === 'selected' && selectedStocks.value.length === 1) {
    pickingForSymbol.value = selectedStocks.value[0]
    fetchAvailableDatesForSymbol(pickingForSymbol.value).then(() => {
      showAvailableDatesModal.value = true
    })
  }
}

// centralized opener used by the consolidated button
function openAvailableDatesPicker() {
  if (selectedStocks.value.length !== 1) {
    alert('请选择单只股票以查看该股票的可用评分日期')
    return
  }
  pickingForSymbol.value = selectedStocks.value[0]
  fetchAvailableDatesForSymbol(pickingForSymbol.value).then(() => {
    showAvailableDatesModal.value = true
  })
}

// 多日期管理方法
// formatDateDisplay imported from utils

function addDateToSelection() {
  // 如果当前在指定股票模式且只选择了一只股票，优先从后端获取该股票可用评分日期供选择
  if (viewMode.value === 'selected' && selectedStocks.value.length === 1) {
    // open available-dates modal for that symbol
    pickingForSymbol.value = selectedStocks.value[0]
    fetchAvailableDatesForSymbol(pickingForSymbol.value).then(() => {
      showAvailableDatesModal.value = true
    })
    return
  }

  if (!selectedDateInput.value) return
  const d = new Date(selectedDateInput.value)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const ymd = `${yyyy}${mm}${dd}`
  if (!selectedDates.value.includes(ymd)) {
  selectedDates.value.push(ymd)
    // 若处于 selected 模式且已有股票，刷新数据
    if (viewMode.value === 'selected' && selectedStocks.value.length > 0) fetchRankings()
  }
}

async function fetchAvailableDatesForSymbol(symbol) {
  try {
    const resp = await axios.get(`/api/stock-dates?symbol=${symbol}`)
    if (resp.data && resp.data.success && Array.isArray(resp.data.data)) {
      // expect data like ['20250918','20250917',...]
      availableDatesForSymbol.value = resp.data.data
      // prefill selection with dates already chosen by user
      availableDatesSelection.value = availableDatesForSymbol.value.filter(d => selectedDates.value.includes(d))
    } else {
      availableDatesForSymbol.value = []
    }
  } catch (err) {
    console.error('获取可用评分日期失败:', err)
    availableDatesForSymbol.value = []
  }
}

function selectAllAvailableDates() {
  availableDatesSelection.value = [...availableDatesForSymbol.value]
}

function deselectAllAvailableDates() {
  availableDatesSelection.value = []
}

function applyAvailableDatesSelection(selectedArray) {
  // merge into selectedDates
  selectedArray.forEach(ymd => {
    if (!selectedDates.value.includes(ymd)) {
      selectedDates.value.push(ymd)
    }
  })
  showAvailableDatesModal.value = false
  if (viewMode.value === 'selected' && selectedStocks.value.length > 0) fetchRankings()
}

function closeAvailableDatesModal() {
  showAvailableDatesModal.value = false
}

function removeDateFromSelection(date) {
  selectedDates.value = selectedDates.value.filter(d => d !== date)
  if (viewMode.value === 'selected' && selectedStocks.value.length > 0) fetchRankings()
}

function clearSelectedDates() {
  selectedDates.value = []
  if (viewMode.value === 'selected' && selectedStocks.value.length > 0) fetchRankings()
}


// ✅ 股票输入相关方法
function onStockInputChange() {
  // 简单的股票代码提示 (实际应该调用API获取)
  if (stockInput.value.length >= 3) {
    // 这里可以调用股票搜索API
    // 暂时使用静态数据模拟
    const allStocks = quickSelectCategories.value.flatMap(cat => cat.stocks)
    stockSuggestions.value = allStocks.filter(stock => 
      stock.symbol.includes(stockInput.value.toUpperCase()) || 
      stock.name.includes(stockInput.value)
    ).slice(0, 5)
  } else {
    stockSuggestions.value = []
  }
}

function selectSuggestion(suggestion) {
  stockInput.value = suggestion.symbol
  stockSuggestions.value = []
  addStockToQuery()
}

function addStockToQuery() {
  const symbol = stockInput.value.toUpperCase().trim()
  if (symbol && !selectedStocks.value.includes(symbol)) {
    selectedStocks.value.push(symbol)
    stockInput.value = ''
    stockSuggestions.value = []
    // Do not initialize perStockStrategies for the new symbol here. If the user
    // wants a per-stock override they can set it explicitly via the UI (onPerStockSelect/onPerStockStrategyChange).
    // 如果是第一次添加股票，自动刷新数据
    if (selectedStocks.value.length === 1) {
      fetchRankings()
    }
  }
}

function removeStockFromQuery(symbol) {
  selectedStocks.value = selectedStocks.value.filter(s => s !== symbol)
  // 清理对应的 per-stock 策略
  if (perStockStrategies.value && perStockStrategies.value[symbol]) {
    const copy = { ...perStockStrategies.value }
    delete copy[symbol]
    perStockStrategies.value = copy
  }
  if (viewMode.value === 'selected') {
    fetchRankings()
  }
}

function clearSelectedStocks() {
  selectedStocks.value = []
  perStockStrategies.value = {}
  if (viewMode.value === 'selected') {
    fetchRankings()
  }
}

// ✅ 模式切换相关方法
function onViewModeChange() {
  rankings.value = []
  
  switch (viewMode.value) {
    case 'ranking':
      fetchRankings()
      break
    case 'selected':
      if (selectedStocks.value.length > 0) {
        fetchRankings()
      }
      break
    case 'watchlist':
      fetchWatchlist().then(() => {
        if (watchlist.value.length > 0) {
          fetchRankings()
        }
      })
      break
  }
}

// ✅ 快速选择相关方法
function showQuickSelectModal() {
  showQuickSelect.value = true
}

function closeQuickSelect() {
  showQuickSelect.value = false
}

function toggleQuickSelectStock(symbol) {
  if (selectedStocks.value.includes(symbol)) {
    selectedStocks.value = selectedStocks.value.filter(s => s !== symbol)
  } else {
    selectedStocks.value.push(symbol)
  }
}

function applyQuickSelection() {
  closeQuickSelect()
  if (selectedStocks.value.length > 0) {
    viewMode.value = 'selected'
    fetchRankings()
  }
}

// ✅ 获取无数据提示信息
function getNoDataMessage() {
  switch (viewMode.value) {
    case 'ranking':
      return '暂无排行数据'
    case 'selected':
      return '请选择要查看的股票'
    case 'watchlist':
      return isUserLoggedIn() ? '自选股列表为空' : '请先登录'
    default:
      return '暂无数据'
  }
}

function getNoDataSubMessage() {
  switch (viewMode.value) {
    case 'ranking':
      return '请稍后再试或联系管理员'
    case 'selected':
      return '在上方输入框中输入股票代码，或点击快速选择按钮'
    case 'watchlist':
      return isUserLoggedIn() ? '请先添加一些股票到自选股' : '登录后可以查看自选股评分'
    default:
      return ''
  }
}

function getModeTitle() {
  switch (viewMode.value) {
    case 'ranking':
      return `股票评分排行榜 (前 ${displayLimit.value} 名)`
    case 'selected':
      return '指定股票评分'
    case 'watchlist':
      return '自选股评分'
    default:
      return '股票评分'
  }
}

// ✅ 导出功能
async function exportScores() {
  try {
    const csvContent = utilGenerateCSV(rankings.value, selectedDates.value, getEffectiveStrategyFor, getCompositeScore)
    downloadCSV(csvContent, `stock-scores-${viewMode.value}-${new Date().toISOString().split('T')[0]}.csv`)
  } catch (error) {
    console.error('导出失败:', error)
    alert('导出失败: ' + error.message)
  }
}

function downloadCSV(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}


// ✅ 获取用户自选股列表
async function fetchWatchlist() {
  if (!isUserLoggedIn()) {
    console.log('用户未登录，跳过获取自选股')
    return
  }
  
  try {
    const response = await axios.get('/api/user/watchlist', getAuthHeaders())
    console.log('自选股响应:', response.data)
    
    if (response.data.success && response.data.data) {
      watchlist.value = response.data.data.symbols || []
    }
  } catch (error) {
    console.error('获取自选股失败:', error)
    if (error.response?.status === 401) {
      console.log('认证失败，请重新登录')
    }
  }
}

// ✅ 统一的自选股切换方法
async function toggleWatchlist(symbol) {
  if (!isUserLoggedIn()) {
    alert('❌ 请先登录后再操作自选股')
    return
  }
  
  if (isInWatchlist(symbol)) {
    await removeFromWatchlist(symbol)
  } else {
    await addToWatchlist(symbol)
  }
}

// ✅ 修改添加到自选股功能
async function addToWatchlist(symbol) {
  try {
    const response = await axios.post('/api/user/watchlist/add', 
      { symbol: symbol }, 
      getAuthHeaders()
    )
    
    console.log('添加自选股响应:', response.data)
    
    if (response.data.success) {
      watchlist.value.push(symbol)
      alert(`✅ 已将 ${symbol} 添加到自选股`)
    } else {
      alert('❌ 添加自选股失败')
    }
    
  } catch (error) {
    console.error('添加自选股失败:', error)
    alert('❌ 添加自选股失败: ' + (error.response?.data?.detail || error.message))
  }
}

// ✅ 添加从自选股移除功能
async function removeFromWatchlist(symbol) {
  try {
    const response = await axios.delete(`/api/user/watchlist/remove/${symbol}`, getAuthHeaders())
    
    if (response.data.success) {
      watchlist.value = watchlist.value.filter(s => s !== symbol)
      alert(`✅ 已将 ${symbol} 从自选股中移除`)
      
      // 如果当前是自选股模式，刷新数据
      if (viewMode.value === 'watchlist') {
        fetchRankings()
      }
    } else {
      alert('❌ 移除失败')
    }
    
  } catch (error) {
    console.error('移除自选股失败:', error)
    alert('❌ 移除自选股失败: ' + (error.response?.data?.detail || error.message))
  }
}

// ✅ 查看自选股详细信息
async function viewWatchlistStocks() {
  if (!isUserLoggedIn()) {
    alert('❌ 请先登录后查看自选股')
    return
  }
  
  try {
    const response = await axios.get('/api/user/watchlist-stocks', getAuthHeaders())
    console.log('自选股详细信息:', response.data)
    
    if (response.data.success) {
      const stocks = response.data.data
      if (stocks.length === 0) {
        alert('📝 自选股列表为空')
      } else {
        const stockInfo = stocks.map(stock => 
          `${stock.symbol} ${stock.name}: ¥${stock.close || 'N/A'} (${stock.change_percent ? stock.change_percent.toFixed(2) + '%' : 'N/A'})`
        ).join('\n')
        alert(`📋 自选股详细信息:\n${stockInfo}`)
      }
    } else {
      alert('❌ 获取自选股信息失败')
    }
    
  } catch (error) {
    console.error('获取自选股详细信息失败:', error)
    alert('❌ 获取自选股信息失败: ' + (error.response?.data?.detail || error.message))
  }
}

// ✅ 检查股票是否在自选股中
function isInWatchlist(symbol) {
  return watchlist.value.includes(symbol)
}

// ✅ 修改清空自选股功能
async function clearWatchlist() {
  if (!isUserLoggedIn()) {
    alert('❌ 请先登录')
    return
  }
  
  if (!confirm('确定要清空自选股列表吗?')) {
    return
  }
  
  try {
    const response = await axios.put('/api/user/watchlist', 
      { symbols: [] }, 
      getAuthHeaders()
    )
    
    if (response.data.success) {
      watchlist.value = []
      alert('🗑️ 自选股列表已清空')
      
      // 如果当前是自选股模式，刷新数据
      if (viewMode.value === 'watchlist') {
        fetchRankings()
      }
    } else {
      alert('❌ 清空失败')
    }
    
  } catch (error) {
    console.error('清空自选股失败:', error)
    alert('❌ 清空自选股失败: ' + (error.response?.data?.detail || error.message))
  }
}

function getRankStyle(stock, rank) {
  if (viewMode.value === 'ranking') {
    // 排行榜模式：按排名着色
    if (rank <= 3) {
      return { 
        background: 'linear-gradient(135deg, #ff6b6b, #ff5252)',
        color: 'white',
        fontWeight: 'bold', 
        fontSize: '16px',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
      }
    } else if (rank <= 10) {
      return { 
        background: 'linear-gradient(135deg, #ffa726, #ff9800)',
        color: 'white',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
      }
    } else if (rank <= 30) {
      return { 
        background: 'linear-gradient(135deg, #66bb6a, #4caf50)',
        color: 'white',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
      }
    }
  } else {
    // 其他模式：按分数着色
  const score = getCompositeScore(stock, rankingStrategy.value)
    if (score >= 80) {
      return { 
        background: 'linear-gradient(135deg, #ff6b6b, #ff5252)',
        color: 'white',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
      }
    } else if (score >= 70) {
      return { 
        background: 'linear-gradient(135deg, #ffa726, #ff9800)',
        color: 'white',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
      }
    } else if (score >= 60) {
      return { 
        background: 'linear-gradient(135deg, #66bb6a, #4caf50)',
        color: 'white',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
      }
    }
  }
  
  return { 
    background: 'linear-gradient(135deg, #90a4ae, #78909c)',
    color: 'white'
  }
}

function getScoreStyle(score) {
  if (score >= 80) {
    return { 
      background: 'linear-gradient(135deg, #4caf50, #388e3c)',
      color: 'white', 
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  } else if (score >= 70) {
    return { 
      background: 'linear-gradient(135deg, #ff9800, #f57c00)',
      color: 'white', 
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  } else if (score >= 60) {
    return { 
      background: 'linear-gradient(135deg, #2196f3, #1976d2)',
      color: 'white',
      fontWeight: 'bold',
      textShadow: '1px 1px 2px rgba(0,0,0,0.3)'
    }
  }
  return { 
    background: 'linear-gradient(135deg, #9e9e9e, #757575)',
    color: 'white'
  }
}

function getRowClass(stock, rank) {
  if (viewMode.value === 'ranking') {
    if (rank <= 3) return 'top-three'
    if (rank <= 10) return 'top-ten'
    if (rank <= 30) return 'top-thirty'
  } else {
  const score = getCompositeScore(stock, rankingStrategy.value)
    if (score >= 80) return 'top-three'
    if (score >= 70) return 'top-ten'
    if (score >= 60) return 'top-thirty'
  }
  return ''
}

function viewChart(symbol) {
  emit('view-chart', symbol)
}

function showScoreDetailModal(stock) {
  selectedStock.value = stock
  showScoreDetail.value = true
}

function closeScoreDetail() {
  showScoreDetail.value = false
  selectedStock.value = null
}

// ✅ 新增：股票去重函数 - 确保每只股票只保留最新日期的评分
// deduplicateStocksByLatestDate imported from utils

// ✅ 监听选择股票变化
watch(selectedStocks, (newStocks) => {
  if (viewMode.value === 'selected' && newStocks.length > 0) {
    fetchRankings()
  }
}, { deep: true })

onMounted(() => {
  fetchRankings()
  fetchWatchlist()
})
function onRankingStrategyChange() {
  // If in ranking or watchlist mode, re-fetch to get server-side sorted/updated results
  if (viewMode.value === 'ranking' || viewMode.value === 'watchlist') {
    fetchRankings()
    return
  }
  // Otherwise locally re-sort existing rankings
  rankings.value.sort((a, b) => (b.composite_score?.[rankingStrategy.value] || 0) - (a.composite_score?.[rankingStrategy.value] || 0))
}

// removed selectedModeStrategy handler: now `rankingStrategy` is global across modes

function onPerStockStrategyChange(symbol) {
  // 确保选项变化后重新计算展示行和排序
  // perStockStrategies 已经通过 v-model 更新
  if (viewMode.value === 'selected') {
    // 重新整理 displayRows 依赖的 rankings（触发 computed 重算）
    // 强制刷新：小技巧是修改一个不重要的状态或直接重新排序 rankings
    rankings.value = [...rankings.value]
  }
}

function onPerStockSelect(evt, symbol) {
  const val = evt.target.value
  perStockStrategies.value = { ...perStockStrategies.value, [symbol]: val }
  // trigger refresh
  if (viewMode.value === 'selected') rankings.value = [...rankings.value]
}

// 生成显示行：如果在指定模式并选择了多个日期，则为每个 symbol/date 生成单独行
const displayRows = computed(() => {
  // small reactive token to force re-evaluation when UI-level strategy changes
  const _rk = refreshKey.value
  return computeDisplayRows({
    rankings: rankings.value,
    viewMode: viewMode.value,
    selectedDates: selectedDates.value,
    rankingStrategy: rankingStrategy.value,
    perStockStrategies: perStockStrategies.value,
    getCompositeScore
  })
})

</script>

<style scoped>
/* ✅ 新增控制区域样式 */
.control-section {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.control-group {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.control-group:last-child {
  margin-bottom: 0;
}

.stock-input-area {
  flex: 1;
  min-width: 300px;
  position: relative;
}

.input-row {
  display: flex;
  gap: 10px;
  margin-top: 5px;
}

.stock-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

 .btn-add, .btn-clear, .btn-export, .btn-manage-watchlist, .btn-clear-watchlist {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
  margin-right: 10px;
}

.btn-add {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.btn-clear, .btn-clear-watchlist {
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: white;
}


.btn-export {
  background: linear-gradient(135deg, #6f42c1, #5a31a8);
  color: white;
}

.btn-manage-watchlist {
  background: linear-gradient(135deg, #17a2b8, #138496);
  color: white;
}


.suggestions-list {
  position: absolute;
  z-index: 1000;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  max-height: 200px;
  overflow-y: auto;
  margin-top: 2px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  width: 100%;
}

.suggestion-item {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}

.suggestion-item:hover {
  background-color: #f8f9fa;
}

.selected-stocks {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.stock-tag {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.tag-remove {
  background: none;
  border: none;
  color: white;
  margin-left: 5px;
  cursor: pointer;
  font-weight: bold;
  padding: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tag-remove:hover {
  background-color: rgba(255,255,255,0.2);
}

.watchlist-info {
  color: #666;
  font-size: 14px;
}

.last-update {
  color: #666;
  font-size: 12px;
  margin-left: 10px;
}

.loading-container, .no-data-container {
  text-align: center;
  padding: 40px 20px;
}

.loading-spinner {
  display: inline-block;
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-right: 10px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.no-data-icon {
  font-size: 48px;
  margin-bottom: 20px;
}

.btn-quick-select {
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 15px;
}

.mode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px 0;
  border-bottom: 2px solid #e9ecef;
}

.stock-count {
  color: #666;
  font-size: 14px;
}

.th-date { width: 120px; }
.td-date { text-align: center; }

/* 提升日期相关文本的对比度，使“日期”更醒目 */
.td-date span {
  color: #0f1724; /* 更深的近黑色，常态更醒目 */
  font-weight: 800;
  font-size: 15px;
  background: linear-gradient(180deg, #ffffff, #f7f9fc);
  padding: 6px 10px;
  border-radius: 6px;
  display: inline-block;
  box-shadow: 0 1px 0 rgba(0,0,0,0.04);
  border: 1px solid rgba(15,23,36,0.06);
}

/* 控制区内的标签（例如“选择日期：”）更醒目 */
.control-section .control-group label {
  color: #1f2937; /* 深灰/接近黑色 */
  font-weight: 700;
}

/* 多日期标签中的日期文本 */
.date-chip strong {
  color: #0f1724;
  font-weight: 800;
  padding-right: 6px;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  opacity: 0.8;
  transform: scale(1.05);
}

.btn-watch-active {
  background: linear-gradient(135deg, #ffc107, #e0a800) !important;
  color: #000 !important;
}

.btn-remove {
  background: linear-gradient(135deg, #dc3545, #c82333);
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  margin: 0 2px;
  cursor: pointer;
  font-size: 12px;
}

/* ✅ 快速选择模态框样式 */
.quick-select-modal {
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.quick-select-tabs {
  display: flex;
  margin-bottom: 15px;
  border-bottom: 1px solid #ddd;
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-size: 14px;
}

.tab-btn.active {
  border-bottom-color: #007bff;
  color: #007bff;
  font-weight: bold;
}

.quick-select-content {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 15px;
}

.quick-stock-item {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.quick-stock-item:hover {
  background-color: #f8f9fa;
}

.quick-stock-item.selected {
  background-color: #e7f3ff;
  border-left: 3px solid #007bff;
}

.quick-stock-symbol {
  font-weight: bold;
  margin-right: 10px;
  min-width: 80px;
}

.quick-stock-name {
  flex: 1;
  color: #666;
}

.selected-indicator {
  color: #007bff;
  font-weight: bold;
}

.quick-select-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.selected-dates {
  margin-top: 8px;
}

.date-chip select {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 6px;
}

.btn-apply, .btn-cancel {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-apply {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.btn-cancel {
  background: linear-gradient(135deg, #6c757d, #545b62);
  color: white;
}

/* ✅ 评分详情模态框增强样式 */
.score-detail-modal {
  max-width: 500px;
}

.score-detail-content {
  margin: 20px 0;
}

.score-item {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 6px;
  background-color: #f8f9fa;
}

.score-item.total-score {
  background: linear-gradient(135deg, #e3f2fd, #f3e5f5);
  border: 2px solid #2196f3;
  font-size: 18px;
  font-weight: bold;
}

.score-label {
  flex: 1;
  font-weight: bold;
  color: #495057;
}

.score-value {
  padding: 4px 12px;
  border-radius: 12px;
  color: white;
  font-weight: bold;
  min-width: 50px;
  text-align: center;
  margin-right: 10px;
}


.score-value.cycle {
  background: linear-gradient(135deg, #42a5f5, #1976d2); /* 蓝色系，和周期相关 */
}


.score-value.growth {
  background: linear-gradient(135deg, #43e97b, #38f9d7); /* 亮绿色-青色，突出成长 */
  color: #222;
}

.score-value.fundamental {
  background: linear-gradient(135deg, #ffa726, #fb8c00); /* 橙色系，基本面 */
}


.score-value.value {
  background: linear-gradient(135deg, #ffd700, #ffb300); /* 金色系，突出价值 */
  color: #222;
}

.score-value.technical {
  background: linear-gradient(135deg, #26c6da, #00838f); /* 青色系，技术 */
}

.score-value.money {
  background: linear-gradient(135deg, #ef5350, #b71c1c); /* 红色系，资金 */
}

.score-weight {
  color: #6c757d;
  font-size: 12px;
}

.score-breakdown {
  border-top: 1px solid #ddd;
  padding-top: 15px;
}

.score-detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #ddd;
}

.btn-chart-detail, .btn-watchlist-detail {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-chart-detail {
  background: linear-gradient(135deg, #17a2b8, #138496);
  color: white;
}

.btn-watchlist-detail {
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
}

.btn-close {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #6c757d, #545b62);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  margin-top: 15px;
}

/* ✅ 保持原有表格样式 */

/* 提升表格字体对比度和醒目度 */
.ranking-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
  overflow: hidden;
  font-size: 16px;
  color: #222;
}

.table-header {
  background: linear-gradient(135deg, #23272f, #34495e);
  color: #fff;
  font-size: 17px;
  letter-spacing: 1px;
}

.table-header th {
  border: 1px solid #34495e;
  padding: 14px 10px;
  font-weight: bold;
  text-shadow: 1px 1px 4px rgba(0,0,0,0.35);
  color: #fff;
}

.th-rank {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  width: 40px;
  min-width: 40px;
  max-width: 40px;
}
.th-symbol { background: linear-gradient(135deg, #3498db, #2980b9); }
.th-name { background: linear-gradient(135deg, #9b59b6, #8e44ad); }
.th-score { background: linear-gradient(135deg, #e67e22, #d35400); }
.th-cycle { background: linear-gradient(135deg, #1abc9c, #16a085); }
.th-growth { background: linear-gradient(135deg, #43e97b, #38f9d7); }
.th-fundamental { background: linear-gradient(135deg, #f39c12, #e67e22); }
.th-value { background: linear-gradient(135deg, #ffd700, #ffb300); }
.th-technical { background: linear-gradient(135deg, #2ecc71, #27ae60); }
.th-money { background: linear-gradient(135deg, #e74c3c, #c0392b); }
.th-action { background: linear-gradient(135deg, #95a5a6, #7f8c8d); }

.table-row {
  transition: all 0.3s ease;
}

.table-row:hover {
  background-color: #f8f9fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.top-three {
  background: linear-gradient(135deg, #fff5f5, #ffebee);
  border-left: 4px solid #ff5252;
}

.top-ten {
  background: linear-gradient(135deg, #fff8e1, #fffde7);
  border-left: 4px solid #ffa726;
}

.top-thirty {
  background: linear-gradient(135deg, #f1f8e9, #f9fbe7);
  border-left: 4px solid #66bb6a;
}

.ranking-table td {
  border: 1px solid #e0e0e0;
  padding: 12px 10px;
  vertical-align: middle;
  color: #1a1a1a;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(255,255,255,0.15);
}

.rank-badge {
  display: inline-block;
  min-width: 30px;
  height: 30px;
  line-height: 30px;
  text-align: center;
  border-radius: 50%;
  font-weight: bold;
}

.symbol-text {
  display: inline-block;
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}

.name-text {
  display: inline-block;
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-badge {
  display: inline-block;
  min-width: 50px;
  padding: 7px 14px;
  border-radius: 20px;
  font-weight: bold;
  text-align: center;
  font-size: 18px;
  color: #fff;
  text-shadow: 1px 1px 6px rgba(0,0,0,0.18);
  letter-spacing: 1px;
}

.cycle-score, .fundamental-score, .technical-score, .money-score, .growth-score, .value-score {
  display: inline-block;
  padding: 5px 10px;
  border-radius: 5px;
  font-weight: bold;
  min-width: 44px;
  text-align: center;
  font-size: 16px;
  color: #fff;
  text-shadow: 1px 1px 6px rgba(0,0,0,0.18);
  letter-spacing: 1px;
}

.cycle-score {
  background: linear-gradient(135deg, #1abc9c, #16a085);
  color: white;
}
.fundamental-score {
  background: linear-gradient(135deg, #f39c12, #e67e22);
  color: white;
}
.technical-score {
  background: linear-gradient(135deg, #2ecc71, #27ae60);
  color: white;
}
.money-score {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
  color: white;
}
.growth-score {
  background: linear-gradient(135deg, #43e97b, #38f9d7);
  color: #0a2a0a;
}
.value-score {
  background: linear-gradient(135deg, #ffd700, #ffb300);
  color: #7a4a00;
}

.btn-chart, .btn-watch {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  padding: 6px 10px;
  border-radius: 4px;
  margin: 0 2px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-chart:hover, .btn-watch:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.btn-watch {
  background: linear-gradient(135deg, #f39c12, #e67e22);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

/* 更亮的排行榜标题样式 */
.ranking-title {
  color: #fffbe8;
  font-size: 2.1rem;
  font-weight: 900;
  letter-spacing: 2px;
  text-shadow: 0 2px 16px #ffd700, 0 1px 0 #fff, 0 0 8px #ffb300;
  background: linear-gradient(90deg, #ffb300 0%, #ffd700 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 18px;
}

/* ✅ 响应式设计 */
@media (max-width: 768px) {
  .control-section {
    padding: 10px;
  }
  
  .control-group {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .input-row {
    flex-direction: column;
  }
  
  .stock-input {
    width: 100%;
    margin-bottom: 10px;
  }
  
  .ranking-table {
    font-size: 12px;
  }
  
  .symbol-text, .name-text {
    padding: 2px 4px;
    font-size: 11px;
  }
  
  .cycle-score, .fundamental-score, .technical-score, .money-score {
    padding: 2px 4px;
    font-size: 11px;
  }
  
  .quick-select-modal {
    width: 95%;
    max-height: 90vh;
  }

  .date-input {
    padding: 6px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    margin-left: 8px;
    margin-right: 8px;
  }

  .helper-text {
    color: #6c757d;
    font-size: 12px;
  }
}
</style>