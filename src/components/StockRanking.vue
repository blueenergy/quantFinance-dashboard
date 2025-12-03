<!-- dashboard/src/components/StockRanking.vue -->
<template>
  <div>
  <h3 class="ranking-title">股票评分排行榜</h3>
    <div style="margin-bottom: 20px;">
      <!-- Use extracted controls component (original control-section kept but hidden for safe review) -->
  <StockRankingControls
    :viewMode="viewMode"
    :selectedDate="selectedDate"
    :maxDate="maxDate"
    :displayLimit="displayLimit"
    :rankingStrategy="rankingStrategy"
    :stockInput="stockInput"
    :stockSuggestions="stockSuggestions"
    :selectedStocks="selectedStocks"
    :selectedDates="selectedDates"
    :watchlistLength="watchlist.length"
    :hs300StocksLength="hs300Stocks.length"
    :hs300Loading="hs300Loading"
    :lastUpdateTime="lastUpdateTime"
    :selectSuggestionCb="selectSuggestion"
    :addStockCb="addStockToQuery"
    @change-view-mode="handleChangeViewMode"
    @change-date="handleChangeDate"
    @change-display-limit="handleChildDisplayLimitChange"
    @change-ranking-strategy="handleChildRankingStrategyChange"
    @stock-input="handleChildStockInput"
    @add-stock="addStockToQuery"
    @clear-selected-stocks="clearSelectedStocks"
    @select-suggestion="selectSuggestion"
    @remove-stock="removeStockFromQuery"
    @maybe-open-available-dates-top="maybeOpenAvailableDatesForTop"
    @open-available-dates-selected="openAvailableDatesPicker"
    @clear-selected-dates="clearSelectedDates"
    @view-watchlist-stocks="viewWatchlistStocks"
    @clear-watchlist="clearWatchlist"
  @refresh-hs300="() => refreshIndexData('hs300')"
  @export-hs300="() => exportIndexInfo('hs300')"
    @export-scores="exportScores"
      />
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
      <button v-if="viewMode === 'selected'" @click="showQuickSelectModal" class="btn-base btn-md btn-gradient-gold btn-badge-star">
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

      <RankingTable
        :displayRows="displayRows"
        :viewMode="viewMode"
        :formatDateDisplay="formatDateDisplay"
        :getScoreClass="getScoreClass"
        :getRankClass="getRankClass"
        :getRowClass="getRowClass"
        :isInWatchlist="isInWatchlist"
        @view-chart="viewChart"
        @toggle-watchlist="toggleWatchlist"
        @remove-stock="removeStockFromQuery"
        @show-score="stock => fetchScoreDetails(stock, 'composite')"
        @show-score-detail="({ stock, category }) => fetchScoreDetails(stock, category)"
      />
    </div>

    <!-- ✅ 快速选择模态框 -->
    <div v-if="showQuickSelect" class="modal-overlay" @click="closeQuickSelect">
      <div class="modal-content quick-select-modal" @click.stop>
        <h4>快速选择热门股票</h4>
        <div class="quick-select-tabs-wrapper">
          <button v-if="showTabsScrollLeft" class="tabs-nav left" @click="scrollTabs('left')">‹</button>
          <div class="quick-select-tabs" ref="tabsScrollRef" @scroll="updateTabsScrollState">
            <button 
              v-for="category in quickSelectCategories" 
              :key="category.key"
              @click="selectedCategory = category.key"
              :class="['tab-btn', { active: selectedCategory === category.key }]"
            >
              <span class="tab-label">{{ category.name }}</span>
              <span 
                v-if="getCategorySelectedCount(category.key) > 0" 
                class="tab-badge"
                :title="formatCategoryBadgeTitle(category.key)"
              >{{ getCategorySelectedCount(category.key) }}</span>
            </button>
          </div>
          <button v-if="showTabsScrollRight" class="tabs-nav right" @click="scrollTabs('right')">›</button>
        </div>
        <div class="quick-select-content">
          <!-- HS300 loading state -->
          <div v-if="selectedCategory === 'hs300' && hs300Loading" class="center-block text-bold color-primary-dark">
            正在加载沪深300成分股...
          </div>
          <!-- HS300 empty state -->
          <div v-else-if="selectedCategory === 'hs300' && !hs300Loading && getCurrentCategoryStocks.length === 0" class="center-block text-subtle">
            未获取到成分股数据。
            <button @click="manualReloadHS300" class="btn-primary-lite ml-sm">重新加载</button>
          </div>
          <!-- Stock list -->
          <div v-else>
            <!-- 🆕 HS300 批量操作条 -->
            <div v-if="selectedCategory === 'hs300' && hs300Stocks.length > 0" class="bulk-select-bar">
              <button @click="() => selectAllIndex('hs300')" class="btn-base btn-sm btn-gradient-green" :disabled="hs300SelectedCount === hs300Stocks.length">
                全选沪深300 ({{ hs300Stocks.length }})
              </button>
              <button @click="() => deselectAllIndex('hs300')" class="btn-base btn-sm btn-gradient-gray" :disabled="hs300SelectedCount === 0">
                取消选择
              </button>
              <span class="bulk-selected-count">已选 {{ hs300SelectedCount }} / {{ hs300Stocks.length }}</span>
            </div>
            <!-- 🆕 A500 批量操作条 -->
            <div v-if="selectedCategory === 'a500' && a500Stocks.length > 0" class="bulk-select-bar">
              <button @click="() => selectAllIndex('a500')" class="btn-base btn-sm btn-gradient-green" :disabled="a500SelectedCount === a500Stocks.length">
                全选中证A500 ({{ a500Stocks.length }})
              </button>
              <button @click="() => deselectAllIndex('a500')" class="btn-base btn-sm btn-gradient-gray" :disabled="a500SelectedCount === 0">
                取消选择
              </button>
              <span class="bulk-selected-count">已选 {{ a500SelectedCount }} / {{ a500Stocks.length }}</span>
            </div>
            <!-- 🆕 CSI500 批量操作条 -->
            <div v-if="selectedCategory === 'csi500' && csi500Stocks.length > 0" class="bulk-select-bar">
              <button @click="() => selectAllIndex('csi500')" class="btn-base btn-sm btn-gradient-green" :disabled="csi500SelectedCount === csi500Stocks.length">
                全选中证500 ({{ csi500Stocks.length }})
              </button>
              <button @click="() => deselectAllIndex('csi500')" class="btn-base btn-sm btn-gradient-gray" :disabled="csi500SelectedCount === 0">
                取消选择
              </button>
              <span class="bulk-selected-count">已选 {{ csi500SelectedCount }} / {{ csi500Stocks.length }}</span>
            </div>
            <!-- 🆕 STAR50 批量操作条 -->
            <div v-if="selectedCategory === 'star50' && star50Stocks.length > 0" class="bulk-select-bar">
              <button @click="() => selectAllIndex('star50')" class="btn-base btn-sm btn-gradient-green" :disabled="star50SelectedCount === star50Stocks.length">
                全选科创50 ({{ star50Stocks.length }})
              </button>
              <button @click="() => deselectAllIndex('star50')" class="btn-base btn-sm btn-gradient-gray" :disabled="star50SelectedCount === 0">
                取消选择
              </button>
              <span class="bulk-selected-count">已选 {{ star50SelectedCount }} / {{ star50Stocks.length }}</span>
            </div>
            <div 
              v-for="stock in getCurrentCategoryStocks" 
              :key="stock.symbol"
              @click="toggleQuickSelectStock(stock.symbol)"
              :class="['quick-stock-item', { selected: isSelectedStock(stock.symbol) }]"
            >
              <span class="quick-stock-symbol">{{ stock.symbol }}</span>
              <span class="quick-stock-name">{{ stock.name }}</span>
              <span v-if="isSelectedStock(stock.symbol)" class="selected-indicator">✓</span>
            </div>
          </div>
        </div>
        <div class="quick-select-actions">
          <button @click="applyQuickSelection" class="btn-base btn-md btn-gradient-green">应用选择 ({{ selectedStocks.length }})</button>
          <button @click="closeQuickSelect" class="btn-base btn-md btn-gradient-gray">取消</button>
        </div>
      </div>
    </div>

    <!-- ✅ 可用评分日期模态框（在指定股票模式且选择单只股票时弹出） -->
    <div v-if="showAvailableDatesModal" class="modal-overlay" @click="closeAvailableDatesModal">
  <div class="modal-content" @click.stop style="max-width:520px;">
        <h4>选择 {{ pickingForSymbol }} 的可用评分日期</h4>
  <div class="scroll-box mt-sm" style="max-height:320px;">
            <div v-if="availableDatesForSymbol.length === 0">未找到可用日期。</div>
            <div v-else>
              <div class="flex-row gap-sm mb-sm">
                <button @click="selectAllAvailableDates" class="btn-base btn-sm btn-gradient-green">全选</button>
                <button @click="deselectAllAvailableDates" class="btn-base btn-sm btn-gradient-gray">全不选</button>
              </div>
              <label v-for="d in availableDatesForSymbol" :key="d" class="flex-row-center gap-sm pad-xs">
                <input type="checkbox" :value="d" v-model="availableDatesSelection" />
                <span>{{ formatDateDisplay(d) }}</span>
              </label>
            </div>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
          <button @click="applyAvailableDatesSelection(availableDatesSelection || [])" class="btn-base btn-md btn-gradient-green">应用 ({{ (availableDatesSelection || []).length }})</button>
          <button @click="closeAvailableDatesModal" class="btn-base btn-md btn-gradient-gray">取消</button>
        </div>
      </div>
    </div>

    <!-- ✅ 评分详情弹窗 (保持原有功能并增强) -->
    <div v-if="showScoreDetail" class="modal-overlay" @click="closeScoreDetail">
      <div class="modal-content score-detail-modal" @click.stop ref="scoreDetailModalRef">
  <h4 class="flex-row-center gap-md wrap">
          <span>{{ selectedStock?.symbol }} - {{ selectedStock?.name }} 评分详情</span>
          <span v-if="scoreDetailCategory" class="category-chip">{{ translateCategory(scoreDetailCategory) }}</span>
        </h4>
        <div class="score-detail-content">
          <div v-if="scoreDetailCategory === 'composite'" class="detail-inline-block">
            <div class="detail-block">
              <div class="text-bold color-primary-dark mb-sm">总分由以下分项加权计算：</div>
              <ul class="detail-list compact">
                <li v-for="(val, key) in scoreDetailData" :key="key" class="flex-row gap-xs">
                  <strong>{{ key }}:</strong>
                  <span>{{ formatDetailValue(val) }}</span>
                </li>
              </ul>
            </div>
          </div>
          <div v-else class="detail-inline-block">
            <div v-if="loadingDetail" class="detail-loading">正在加载 {{ translateCategory(scoreDetailCategory) }} 详情...</div>
            <div v-else-if="scoreDetailData && Object.keys(scoreDetailData).length > 0" class="detail-block">
              <ul class="detail-list compact">
                <li v-for="(val, key) in scoreDetailData" :key="key" class="flex-row gap-xs">
                  <strong>{{ key }}:</strong>
                  <span>{{ formatDetailValue(val) }}</span>
                </li>
              </ul>
            </div>
            <div v-else-if="!loadingDetail" class="detail-empty">暂无 {{ translateCategory(scoreDetailCategory) }} 详情</div>
          </div>
          <div class="score-detail-actions">
            <button @click="viewChart(selectedStock?.symbol)" class="btn-base btn-md btn-gradient-teal">查看走势图</button>
            <button @click="toggleWatchlist(selectedStock?.symbol)" class="btn-base btn-md btn-gradient-green">
              {{ isInWatchlist(selectedStock?.symbol) ? '从自选股移除' : '添加到自选股' }}
            </button>
          </div>
        </div>
  <button @click="closeScoreDetail" class="btn-base btn-md btn-gradient-gray">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import StockRankingControls from './StockRankingControls.vue'
import RankingTable from './RankingTable.vue'
import axios from 'axios'
import { getCompositeScore, formatDateDisplay, generateCSV as utilGenerateCSV, deduplicateStocksByLatestDate } from '../utils/scoreUtils.js'
import { computeDisplayRows } from '../utils/displayRows.js'

const emit = defineEmits(['view-chart'])

// Centralized debug logger (auto disabled in production build)
const DEBUG = import.meta.env?.DEV === true
function dlog(...args) { if (DEBUG) { try { console.debug('[StockRanking]', ...args) } catch(e) {} } }

// -------------------------
// Reactive state (grouped and documented)
// -------------------------
// Core data
// rankings: array of stock score objects returned from the backend.
// Each item typically contains: { symbol, name, composite_score, score_date, per_date_scores?, per_date_fields?, ... }
const rankings = ref([])
const loading = ref(false)
const displayLimit = ref(30)

// UI mode & inputs
// viewMode: one of 'ranking' | 'selected' | 'watchlist'
// stockInput / stockSuggestions: helpers for the stock input autocomplete
// selectedStocks: array of selected symbols for 'selected' mode
const viewMode = ref('ranking') // 'ranking' | 'selected' | 'watchlist'
const stockInput = ref('')
const stockSuggestions = ref([])
const selectedStocks = ref([])
// 评分详情（单类别）
const scoreDetailCategory = ref(null)
const scoreDetailData = ref(null)
const loadingDetail = ref(false)

// 获取当前股票有效策略（优先单股票策略，其次全局策略）
function getEffectiveStrategyFor(symbol) {
  return (perStockStrategies.value && perStockStrategies.value[symbol]) || rankingStrategy.value || 'balanced'
}

async function fetchScoreDetails(row, category) {
  try {
    loadingDetail.value = true
    scoreDetailCategory.value = category
    selectedStock.value = row
    scoreDetailData.value = null
    // 强制刷新弹窗：隐藏后下一帧显示
    showScoreDetail.value = false
    await Promise.resolve()
    showScoreDetail.value = true
    const params = new URLSearchParams({ symbol: row.symbol, category })
    if (row.score_date) params.append('score_date', row.score_date)
    if (category === 'composite') params.append('strategy', getEffectiveStrategyFor(row.symbol))
    const res = await fetch(`/api/stock-score-detail?${params.toString()}`)
    const json = await res.json()
    if (json && json.success) {
      scoreDetailData.value = json.data.details
      if (category === 'composite') {
        const keys = Object.keys(scoreDetailData.value || {})
        const hasWeight = keys.some(k => k.includes('权重'))
        const hasStrategy = '当前策略' in (scoreDetailData.value || {})
        if (!hasWeight || !hasStrategy) {
          scoreDetailData.value = {
            ...(scoreDetailData.value || {}),
            '(提示) 权重信息缺失': '后端未返回策略权重，可能该策略未配置或数据缺失'
          }
        }
      }
    } else {
      scoreDetailData.value = { 错误: (json && (json.detail || json.message)) || '获取详情失败' }
    }
  } catch (e) {
    scoreDetailData.value = { 错误: e.message || '请求异常' }
  } finally {
    loadingDetail.value = false
  }
}

function translateCategory(cat) {
  const map = {
    cycle: '周期评分',
    growth: '成长评分',
    fundamental: '基本面评分',
    value: '价值评分',
    technical: '技术面评分',
    money_flow: '资金流评分'
  }
  return map[cat] || cat
}

function formatDetailValue(v) {
  if (v === null || v === undefined) return '-'
  if (typeof v === 'number') {
    if (Math.abs(v) > 1000) return v.toFixed(2)
    return Number.isInteger(v) ? v : v.toFixed(2)
  }
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

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
// maxDate used by date inputs: prefer lastUpdateTime when available, otherwise today
const maxDate = computed(() => {
  if (lastUpdateTime.value) return lastUpdateTime.value
  return new Date().toISOString().slice(0, 10)
})
// AbortController for cancelling in-flight fetchRankings requests
const currentRequestController = ref(null)

// Modals / lists
// Quick select modal state and sample categories (static fallback data)
const showQuickSelect = ref(false)
const quickSelectCategories = ref([
  { key: 'finance', name: '金融股', stocks: [ { symbol: '000001', name: '平安银行' }, { symbol: '600036', name: '招商银行' } ] },
  { key: 'consume', name: '消费股', stocks: [ { symbol: '000858', name: '五粮液' }, { symbol: '600519', name: '贵州茅台' } ] },
  { key: 'tech', name: '科技股', stocks: [ { symbol: '000977', name: '浪潮信息' }, { symbol: '600460', name: '士兰微' } ] },
  { key: 'pharma', name: '医药股', stocks: [ { symbol: '600276', name: '恒瑞医药' }, { symbol: '000538', name: '云南白药' } ] },
  { key: 'energy', name: '能源', stocks: [ { symbol: '600028', name: '中国石化' }, { symbol: '601857', name: '中国石油' } ] },
  { key: 'ev', name: '新能源车', stocks: [ { symbol: '002594', name: '比亚迪' }, { symbol: '300750', name: '宁德时代' } ] },
  { key: 'semi', name: '半导体', stocks: [ { symbol: '688981', name: '中芯国际' }, { symbol: '603986', name: '兆易创新' } ] },
  { key: 'hs300', name: '沪深300 成分股', stocks: [] },
  { key: 'a500', name: '中证A500 成分股', stocks: [] },
  { key: 'csi500', name: '中证500 成分股', stocks: [] },
  { key: 'star50', name: '科创50 成分股', stocks: [] }
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

// 🆕 添加沪深300相关状态变量
const hs300Stocks = ref([]) // 沪深300成分股列表
const hs300Loading = ref(false) // 加载状态
// 🆕 添加科创50相关状态变量
const star50Stocks = ref([])
const star50Loading = ref(false)
// 🆕 添加中证A500相关状态变量
const a500Stocks = ref([])
const a500Loading = ref(false)
// 🆕 添加中证500相关状态变量
const csi500Stocks = ref([])
const csi500Loading = ref(false)
// Tabs horizontal scroll helpers
const tabsScrollRef = ref(null)
const showTabsScrollLeft = ref(false)
const showTabsScrollRight = ref(false)

function updateTabsScrollState() {
  const el = tabsScrollRef.value
  if (!el) return
  showTabsScrollLeft.value = el.scrollLeft > 5
  showTabsScrollRight.value = el.scrollWidth - el.clientWidth - el.scrollLeft > 5
}

function scrollTabs(direction) {
  const el = tabsScrollRef.value
  if (!el) return
  const delta = Math.round(el.clientWidth * 0.6)
  const target = direction === 'left' ? el.scrollLeft - delta : el.scrollLeft + delta
  el.scrollTo({ left: target, behavior: 'smooth' })
}

// ✅ 计算属性
const getCurrentCategoryStocks = computed(() => {
  // if user selected the HS300 tab, return the dynamic hs300Stocks list
  if (selectedCategory.value === 'hs300') {
    return hs300Stocks.value || []
  }
  if (selectedCategory.value === 'star50') {
    return star50Stocks.value || []
  }
  if (selectedCategory.value === 'a500') {
    return a500Stocks.value || []
  }
  if (selectedCategory.value === 'csi500') {
    return csi500Stocks.value || []
  }
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
// (removed duplicate getEffectiveStrategyFor; unified definition earlier)

// getCompositeScore imported from utils

// ✅ 主数据获取方法 - 根据模式调用不同API
async function fetchRankings() {
  loading.value = true
  try {
  dlog('fetchRankings start viewMode=', viewMode.value)
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
        // include selected ranking strategy so server can sort accordingly
        if (rankingStrategy.value) url += `&strategy=${encodeURIComponent(rankingStrategy.value)}`
        if (dateParam) url += `&date=${dateParam}`
        response = await axios.get(url, { signal })
        break
      }
      // 🆕 添加沪深300模式
      case 'hs300': {
        loadingMessage.value = '加载沪深300指数成分股评分...'
        
        // 🔧 先确保成分股数据已加载
        if (hs300Stocks.value.length === 0) {
          await fetchIndexConstituents('hs300')
        }
        
        // 🆕 使用指定股票模式的API，传入沪深300成分股代码
        const hs300Symbols = hs300Stocks.value.map(stock => stock.symbol)
        const payload = { symbols: hs300Symbols }
        
        let url = '/api/stock-rankings/selected'
        const qp = []
        if (dateParam) qp.push(`date=${dateParam}`)
        if (rankingStrategy.value) qp.push(`strategy=${encodeURIComponent(rankingStrategy.value)}`)
        if (qp.length) url += `?${qp.join('&')}`
        
        dlog(`获取 ${hs300Symbols.length} 只沪深300成分股评分`)
        response = await axios.post(url, payload, { signal })
        break
      }
      case 'csi500': {
        loadingMessage.value = '加载中证500指数成分股评分...'
        if (csi500Stocks.value.length === 0) {
          await fetchIndexConstituents('csi500')
        }
        const csi500Symbols = csi500Stocks.value.map(stock => stock.symbol)
        if (csi500Symbols.length === 0) {
          console.warn('[fetchRankings] csi500 成分股为空，使用回退数据')
        }
        const payload = { symbols: csi500Symbols }
        let url = '/api/stock-rankings/selected'
        const qp = []
        if (dateParam) qp.push(`date=${dateParam}`)
        if (rankingStrategy.value) qp.push(`strategy=${encodeURIComponent(rankingStrategy.value)}`)
        if (qp.length) url += `?${qp.join('&')}`
        dlog(`获取 ${csi500Symbols.length} 只中证500成分股评分`)
        response = await axios.post(url, payload, { signal })
        break
      }
      case 'a500': {
        loadingMessage.value = '加载中证A500指数成分股评分...'
        if (a500Stocks.value.length === 0) {
          await fetchIndexConstituents('a500')
        }
        const a500Symbols = a500Stocks.value.map(stock => stock.symbol)
        const payload = { symbols: a500Symbols }
        let url = '/api/stock-rankings/selected'
        const qp = []
        if (dateParam) qp.push(`date=${dateParam}`)
        if (rankingStrategy.value) qp.push(`strategy=${encodeURIComponent(rankingStrategy.value)}`)
        if (qp.length) url += `?${qp.join('&')}`
        dlog(`获取 ${a500Symbols.length} 只中证A500成分股评分`)
        response = await axios.post(url, payload, { signal })
        break
      }
      case 'star50': {
        loadingMessage.value = '加载科创50指数成分股评分...'
        if (star50Stocks.value.length === 0) {
          await fetchIndexConstituents('star50')
        }
        const star50Symbols = star50Stocks.value.map(stock => stock.symbol)
        const payload = { symbols: star50Symbols }
        dlog('star50 payload size=', star50Symbols.length)
        let url = '/api/stock-rankings/selected'
        const qp = []
        if (dateParam) qp.push(`date=${dateParam}`)
        if (rankingStrategy.value) qp.push(`strategy=${encodeURIComponent(rankingStrategy.value)}`)
        if (qp.length) url += `?${qp.join('&')}`
        dlog(`获取 ${star50Symbols.length} 只科创50成分股评分`)
        response = await axios.post(url, payload, { signal })
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
        dlog('selectedStocks', selectedStocks.value)
        // 如果有多日期，传递 dates 数组；否则继续使用单日期参数
        let url = '/api/stock-rankings/selected'
        // include strategy in payload so server can choose ranking method for selected fetch
        payload.strategy = rankingStrategy.value
        if (selectedDates.value.length > 0) {
          payload.dates = selectedDates.value
          dlog('posting with dates', payload.dates)
          response = await axios.post(url, payload, { signal })
        } else {
          if (dateParam) url += `?date=${dateParam}`
          dlog('posting without dates url=', url)
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
        // include strategy and date as query parameters
        const qp2 = []
        if (dateParam) qp2.push(`date=${dateParam}`)
        if (rankingStrategy.value) qp2.push(`strategy=${encodeURIComponent(rankingStrategy.value)}`)
        if (qp2.length) url += `?${qp2.join('&')}`
        response = await axios.post(url, payload, { signal })
        break
      }
      default: {
        throw new Error('无效的查看模式')
      }
    }
    dlog('response status', response?.status, 'items=', Array.isArray(response?.data?.data) ? response.data.data.length : (Array.isArray(response?.data) ? response.data.length : 'n/a'))
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
    dlog('rankings count after response', (rankings.value || []).length)
      try {
        if (!(viewMode.value === 'selected' && selectedDates.value.length > 0)) {
          // console.log('[fetchRankings] calling deduplicateStocksByLatestDate')
          rankings.value = deduplicateStocksByLatestDate(rankings.value)
          // console.log('[fetchRankings] dedupe done, count now:', (rankings.value || []).length)
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
      dlog('request canceled')
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
  dlog('selectSuggestion', suggestion)
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
    case 'hs300':
  fetchIndexConstituents('hs300').then(() => {
        fetchRankings()
      })
      break
    case 'csi500':
      fetchIndexConstituents('csi500').then(() => {
        fetchRankings()
      })
      break
    case 'a500':
      fetchIndexConstituents('a500').then(() => {
        fetchRankings()
      })
      break
    case 'star50':
      fetchIndexConstituents('star50').then(() => {
        fetchRankings()
      })
      break
    default:
      break
  }
}
// explicit handlers used by the new controls component
function handleChangeViewMode(newMode) {
  if (!newMode) { console.warn('handleChangeViewMode called with empty value:', newMode); return }
  try { console.debug('[StockRanking] handleChangeViewMode received ->', newMode) } catch (err) {}
  viewMode.value = newMode
  onViewModeChange()
}

function handleChangeDate(newDate) {
  if (!newDate) { console.warn('handleChangeDate called with empty value:', newDate); return }
  try { console.debug('[StockRanking] handleChangeDate received ->', newDate) } catch (err) {}
  selectedDate.value = newDate
  onDateChange()
}

// Defensive handlers for child component emits
function handleChildDisplayLimitChange(v) {
  const val = (v && typeof v === 'object' && v.target && 'value' in v.target) ? v.target.value : v
  displayLimit.value = Number(val) || displayLimit.value || 50
  fetchRankings()
}

function handleChildRankingStrategyChange(v) {
  const newVal = (v && typeof v === 'object' && v.target && 'value' in v.target) ? v.target.value : v
  // Only update the ref's value; never reassign the ref itself (avoids const reassignment build errors)
  if (typeof newVal === 'string' && newVal.trim()) {
    rankingStrategy.value = newVal.trim()
  } else {
    console.warn('handleChildRankingStrategyChange ignored invalid value:', newVal)
    return
  }
  try {
    onRankingStrategyChange()
  } catch (e) {
    console.error('onRankingStrategyChange error', e)
  }
}

function handleChildStockInput(v) {
  const newVal = (v && typeof v === 'object' && v.target && 'value' in v.target) ? v.target.value : v
  stockInput.value = newVal
  onStockInputChange()
}

// ✅ 快速选择相关方法
async function showQuickSelectModal() {
  try {
      dlog('showQuickSelectModal state', {
      selectedStocks: selectedStocks?.value,
      quickSelectCategories: quickSelectCategories?.value,
      selectedCategory: selectedCategory?.value,
      viewMode: viewMode?.value
    })
    // If HS300 tab is selected, ensure constituents are loaded
    if (selectedCategory.value === 'hs300' && (!hs300Stocks.value || hs300Stocks.value.length === 0)) {
  try { await fetchIndexConstituents('hs300') } catch (e) { console.warn('fetchIndexConstituents hs300 failed', e) }
    }
    if (selectedCategory.value === 'star50' && (!star50Stocks.value || star50Stocks.value.length === 0)) {
  try { await fetchIndexConstituents('star50') } catch (e) { console.warn('fetchIndexConstituents star50 failed', e) }
    }
    if (selectedCategory.value === 'a500' && (!a500Stocks.value || a500Stocks.value.length === 0)) {
  try { await fetchIndexConstituents('a500') } catch (e) { console.warn('fetchIndexConstituents a500 failed', e) }
    }
    if (selectedCategory.value === 'csi500' && (!csi500Stocks.value || csi500Stocks.value.length === 0)) {
  try { await fetchIndexConstituents('csi500') } catch (e) { console.warn('fetchIndexConstituents csi500 failed', e) }
    }
    showQuickSelect.value = true
  } catch (e) {
    console.error('[StockRanking] showQuickSelectModal error:', e)
    // Avoid throwing during render/update by setting a safe fallback
    try { showQuickSelect.value = false } catch (e2) {}
  }
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

// ✅ 通用指数批量选择工具
function selectAllIndex(indexKey) {
  const st = indexStateMap[indexKey]
  if (!st || !Array.isArray(st.list.value) || st.list.value.length === 0) return
  const existing = new Set(selectedStocks.value)
  st.list.value.forEach(s => existing.add(s.symbol))
  selectedStocks.value = Array.from(existing)
}
function deselectAllIndex(indexKey) {
  const st = indexStateMap[indexKey]
  if (!st || !Array.isArray(st.list.value) || st.list.value.length === 0) return
  const removeSet = new Set(st.list.value.map(s => s.symbol))
  selectedStocks.value = selectedStocks.value.filter(s => !removeSet.has(s))
}

// Manual reload button handler for HS300 inside quick select modal
async function manualReloadHS300() {
  try {
    hs300Stocks.value = []
    await fetchIndexConstituents('hs300')
  } catch (e) {
    console.error('manualReloadHS300 failed', e)
    alert('重新加载失败: ' + (e.message || e))
  }
}

// defensive helper used by template to avoid calling .includes on undefined
function isSelectedStock(symbol) {
  try {
    return Array.isArray(selectedStocks.value) && selectedStocks.value.includes(symbol)
  } catch (e) {
    console.warn('isSelectedStock check failed', e)
    return false
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
    case 'hs300':
      return '暂无沪深300指数数据'
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
    case 'hs300':
      return '暂无沪深300指数数据'
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
    case 'hs300':
      return `沪深300指数成分股评分 (共 ${hs300Stocks.value.length} 只)`
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
    dlog('skip watchlist fetch (not logged in)')
    return
  }
  
  try {
    const response = await axios.get('/api/user/watchlist', getAuthHeaders())
    dlog('watchlist response', response.data)
    
    if (response.data.success && response.data.data) {
      watchlist.value = response.data.data.symbols || []
    }
  } catch (error) {
    console.error('获取自选股失败:', error)
    if (error.response?.status === 401) {
      dlog('auth failed while fetching watchlist')
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
    
  dlog('add watchlist response', response.data)
    
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
    dlog('watchlist stocks detail', response.data)
    
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

function getRankClass(stock, rank) {
  if (viewMode.value === 'ranking') {
    if (rank <= 3) return 'rank-top-three'
    if (rank <= 10) return 'rank-top-ten'
    if (rank <= 30) return 'rank-top-thirty'
    return 'rank-default'
  }
  const score = getCompositeScore(stock, rankingStrategy.value)
  if (score >= 80) return 'rank-top-three'
  if (score >= 70) return 'rank-top-ten'
  if (score >= 60) return 'rank-top-thirty'
  return 'rank-default'
}

function getScoreClass(score) {
  if (score >= 80) return 'score-high'
  if (score >= 70) return 'score-mid-high'
  if (score >= 60) return 'score-mid'
  return 'score-low'
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
  // 保留兼容：若只是查看不含细节，通过总分构造展示
  selectedStock.value = stock
  fetchScoreDetails(stock, 'composite')
}

// 分类已选数量统计（含动态指数分类）
function getCategorySelectedCount(key) {
  if (key === 'hs300') return hs300SelectedCount.value
  if (key === 'a500') return a500SelectedCount.value
  if (key === 'csi500') return csi500SelectedCount.value
  if (key === 'star50') return star50SelectedCount.value
  const cat = quickSelectCategories.value.find(c => c.key === key)
  if (!cat) return 0
  const set = new Set(selectedStocks.value)
  return (cat.stocks || []).filter(s => set.has(s.symbol)).length
}

function getCategoryTotalCount(key) {
  if (key === 'hs300') return hs300Stocks.value.length
  if (key === 'a500') return a500Stocks.value.length
  if (key === 'csi500') return csi500Stocks.value.length
  if (key === 'star50') return star50Stocks.value.length
  const cat = quickSelectCategories.value.find(c => c.key === key)
  return cat && Array.isArray(cat.stocks) ? cat.stocks.length : 0
}

function formatCategoryBadgeTitle(key) {
  const sel = getCategorySelectedCount(key)
  const total = getCategoryTotalCount(key)
  return `已选 ${sel} / 总 ${total}`
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

// 当全局策略改变并且当前打开的是综合总分详情时自动刷新
watch(rankingStrategy, () => {
  if (showScoreDetail.value && scoreDetailCategory.value === 'composite' && selectedStock.value) {
    fetchScoreDetails(selectedStock.value, 'composite')
  }
})
// 当单股票策略映射变化时自动刷新当前综合详情（深度监听）
watch(perStockStrategies, () => {
  if (showScoreDetail.value && scoreDetailCategory.value === 'composite' && selectedStock.value) {
    fetchScoreDetails(selectedStock.value, 'composite')
  }
}, { deep: true })

// Load HS300 constituents automatically when user switches quick-select tab to hs300
watch(selectedCategory, async (val) => {
  if (val === 'hs300' && (!hs300Stocks.value || hs300Stocks.value.length === 0) && !hs300Loading.value) {
  try { await fetchIndexConstituents('hs300') } catch (e) { console.warn('auto hs300 fetch failed', e) }
  }
  if (val === 'star50' && (!star50Stocks.value || star50Stocks.value.length === 0) && !star50Loading.value) {
  try { await fetchIndexConstituents('star50') } catch (e) { console.warn('auto star50 fetch failed', e) }
  }
  if (val === 'a500' && (!a500Stocks.value || a500Stocks.value.length === 0) && !a500Loading.value) {
  try { await fetchIndexConstituents('a500') } catch (e) { console.warn('auto a500 fetch failed', e) }
  }
  if (val === 'csi500' && (!csi500Stocks.value || csi500Stocks.value.length === 0) && !csi500Loading.value) {
    try { await fetchCSI500Constituents() } catch (e) { console.warn('auto csi500 fetch failed', e) }
  }
})

onMounted(() => {
  fetchRankings()
  fetchWatchlist()
  // next tick update scroll state
  setTimeout(updateTabsScrollState, 0)
  // window resize listener to recompute
  window.addEventListener('resize', updateTabsScrollState)
})

// cleanup (optional)
try {
  onUnmounted(() => { window.removeEventListener('resize', updateTabsScrollState) })
} catch (e) {}
function onRankingStrategyChange() {
  // If in ranking or watchlist mode, re-fetch to get server-side sorted/updated results
  if (viewMode.value === 'ranking' || viewMode.value === 'watchlist') {
    fetchRankings()
    return
  }
  // Otherwise locally re-sort existing rankings using getCompositeScore
  try {
    rankings.value.sort((a, b) => getCompositeScore(b, rankingStrategy.value) - getCompositeScore(a, rankingStrategy.value))
  } catch (e) {
    console.error('排序失败:', e)
  }
  // bump refreshKey to ensure dependent computed properties update
  try { refreshKey.value = (refreshKey.value || 0) + 1 } catch (e) {}
}

// =============================
// ✅ 指数成分股通用工具
// =============================
const indexStateMap = {
  hs300: { list: hs300Stocks, loading: hs300Loading, path: '/api/index/hs300/constituents', fallback: [
    { symbol: '000001', name: '平安银行', industry: '银行', market_cap: 280000000000, weight: 0.85 },
    { symbol: '000002', name: '万科A', industry: '房地产开发', market_cap: 250000000000, weight: 0.78 }
  ] },
  a500: { list: a500Stocks, loading: a500Loading, path: '/api/index/a500/constituents', fallback: [
    { symbol: '600519', name: '贵州茅台', industry: '白酒', market_cap: 2500000000000, weight: 2.50 },
    { symbol: '000333', name: '美的集团', industry: '家电', market_cap: 450000000000, weight: 1.20 }
  ] },
  // 修复: 中证500 应使用自身 loading ref 且提供更贴近该指数的示例成分
  csi500: { list: csi500Stocks, loading: csi500Loading, path: '/api/index/csi500/constituents', fallback: [
    { symbol: '000001', name: '平安银行', industry: '银行', market_cap: 280000000000, weight: 0.35 },
    { symbol: '600036', name: '招商银行', industry: '银行', market_cap: 340000000000, weight: 0.40 },
    { symbol: '002415', name: '海康威视', industry: '电子', market_cap: 310000000000, weight: 0.45 }
  ] },
  star50: { list: star50Stocks, loading: star50Loading, path: '/api/index/star50/constituents', fallback: [
    { symbol: '688001', name: '华兴源创', industry: '半导体', market_cap: 45000000000, weight: 1.10 },
    { symbol: '688012', name: '中微公司', industry: '半导体设备', market_cap: 120000000000, weight: 2.20 }
  ] }
}

async function fetchIndexConstituents(indexKey) {
  const st = indexStateMap[indexKey]
  if (!st) throw new Error(`未知指数: ${indexKey}`)
  if (st.list.value.length > 0) return st.list.value
  st.loading.value = true
  try {
    const resp = await axios.get(st.path)
    if (resp.data.success && resp.data.data) {
      st.list.value = resp.data.data
      console.log(`📊 获取到 ${st.list.value.length} 只 ${indexKey} 成分股`)
      return st.list.value
    }
    throw new Error('API返回数据格式错误')
  } catch (e) {
    console.warn(`获取 ${indexKey} 成分股失败，使用本地数据:`, e.message)
    st.list.value = st.fallback
    return st.list.value
  } finally {
    st.loading.value = false
  }
}

async function refreshIndexData(indexKey) {
  const st = indexStateMap[indexKey]
  if (!st) return
  try {
    st.list.value = []
    await fetchIndexConstituents(indexKey)
    if (viewMode.value === indexKey) await fetchRankings()
  } catch (e) {
    console.error(`刷新 ${indexKey} 数据失败:`, e)
    alert(`刷新失败，已使用本地数据: ${e.message}`)
  }
}

function buildIndexCSVData(list) {
  return list.map(stock => ({
    '股票代码': stock.symbol,
    '股票名称': stock.name,
    '所属行业': stock.industry || '未知',
    '市值(亿)': stock.market_cap ? (stock.market_cap / 100000000).toFixed(2) : '',
    '权重(%)': stock.weight ? stock.weight.toFixed(2) : ''
  }))
}

async function exportIndexInfo(indexKey) {
  const st = indexStateMap[indexKey]
  if (!st) return
  try {
    if (st.list.value.length === 0) await fetchIndexConstituents(indexKey)
    if (st.list.value.length === 0) {
      alert(`无${indexKey}成分股数据可导出`)
      return
    }
    const csvData = buildIndexCSVData(st.list.value)
    const csv = utilGenerateCSV(csvData)
    downloadCSV(csv, `${indexKey}-constituents-${new Date().toISOString().split('T')[0]}.csv`)
  } catch (e) {
    console.error(`导出 ${indexKey} 成分股失败:`, e)
    alert('导出失败: ' + e.message)
  }
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

// 🆕 计算已选中沪深300数量
const hs300SelectedCount = computed(() => {
  if (!hs300Stocks.value || hs300Stocks.value.length === 0) return 0
  const set = new Set(selectedStocks.value)
  return hs300Stocks.value.filter(s => set.has(s.symbol)).length
})

// 🆕 A500 已选数量
const a500SelectedCount = computed(() => {
  if (!a500Stocks.value || a500Stocks.value.length === 0) return 0
  const set = new Set(selectedStocks.value)
  return a500Stocks.value.filter(s => set.has(s.symbol)).length
})
// 🆕 CSI500 已选数量
const csi500SelectedCount = computed(() => {
  if (!csi500Stocks.value || csi500Stocks.value.length === 0) return 0
  const set = new Set(selectedStocks.value)
  return csi500Stocks.value.filter(s => set.has(s.symbol)).length
})

const star50SelectedCount = computed(() => {
  if (!star50Stocks.value || star50Stocks.value.length === 0) return 0
  const set = new Set(selectedStocks.value)
  return star50Stocks.value.filter(s => set.has(s.symbol)).length
})


</script>

<style scoped>
/* Control styles moved to StockRankingControls.vue (scoped). */

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
  position: relative;
  background: linear-gradient(135deg, #ffb300, #ff8c00);
  color: #212121;
  border: none;
  padding: 12px 26px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 1px;
  margin-top: 18px;
  box-shadow: 0 4px 12px rgba(255,140,0,0.45), 0 2px 4px rgba(0,0,0,0.18);
  text-shadow: 0 1px 0 rgba(255,255,255,0.6);
  transition: transform .18s ease, box-shadow .18s ease, background .25s;
}
.btn-quick-select::after {
  content: '★';
  position: absolute;
  top: -10px;
  right: -10px;
  background: radial-gradient(circle at 30% 30%, #fff6d5, #ffb300);
  color: #b34700;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 900;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  pointer-events: none;
}
.btn-quick-select:hover {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 6px 16px rgba(255,140,0,0.55), 0 3px 6px rgba(0,0,0,0.25);
}
.btn-quick-select:active {
  transform: translateY(0) scale(0.99);
  box-shadow: 0 3px 10px rgba(255,140,0,0.4), 0 1px 3px rgba(0,0,0,0.3);
}
.quick-select-modal h4 {
  font-size: 24px;
  font-weight: 900;
  letter-spacing: 1.5px;
  background: linear-gradient(90deg,#ff9800,#ffb300,#ffd54f);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 2px 12px rgba(255,152,0,0.35), 0 1px 0 #fff;
  margin-bottom: 16px;
  position: relative;
  padding-left: 6px;
}
.quick-select-modal h4::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 70%;
  background: linear-gradient(180deg,#ffb300,#ff8c00);
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(255,140,0,0.6);
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
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #9ca3af transparent;
  scroll-behavior: smooth;
}

.quick-select-tabs::-webkit-scrollbar {
  height: 8px;
}
.quick-select-tabs::-webkit-scrollbar-track {
  background: transparent;
}
.quick-select-tabs::-webkit-scrollbar-thumb {
  background: rgba(0,0,0,0.25);
  border-radius: 4px;
}
.quick-select-tabs::-webkit-scrollbar-thumb:hover {
  background: rgba(0,0,0,0.4);
}

.quick-select-tabs-wrapper {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 4px;
}

.tabs-nav {
  background: linear-gradient(135deg,#0466c8,#0353a4);
  color: #fff;
  border: none;
  width: 34px;
  border-radius: 8px;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  transition: background .18s, transform .18s;
}
.tabs-nav:hover { transform: translateY(-2px); }
.tabs-nav:active { transform: translateY(0); }
.tabs-nav.left { order: -1; }
.tabs-nav.right { order: 2; }

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 6px;
  background: linear-gradient(135deg,#ff6b6b,#ff3d3d);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.25);
  letter-spacing: .5px;
}
@media (prefers-color-scheme: dark) {
  .tab-badge { background: linear-gradient(135deg,#f87171,#dc2626); }
}

.tab-btn {
  padding: 8px 16px;
  border: none;
  background: rgba(255,255,255,0.85);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  font-size: 14px;
  color: #0f172a; /* 深色高对比度 */
  font-weight: 600;
  position: relative;
  border-radius: 8px 8px 0 0;
  margin-right: 4px;
  transition: background .18s ease, color .18s ease, transform .18s ease, box-shadow .18s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}

.tab-btn.active {
  border-bottom-color: #0466c8;
  background: linear-gradient(135deg,#e3f2ff,#ffffff);
  color: #023e8a;
  font-weight: 800;
  box-shadow: 0 3px 10px rgba(4,102,200,0.25), 0 1px 2px rgba(0,0,0,0.08);
}

.tab-btn:not(.active):hover {
  background: #f1f5f9;
  color: #0353a4;
  transform: translateY(-2px);
}

.tab-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(4,102,200,0.45);
}

@media (prefers-color-scheme: dark) {
  .tab-btn {
    background: rgba(30,41,59,0.85);
    color: #f1f5f9;
    box-shadow: 0 2px 4px rgba(0,0,0,0.4);
  }
  .tab-btn.active {
    background: linear-gradient(135deg,#0f3d66,#1e3a8a);
    color: #ffffff;
    border-bottom-color: #60a5fa;
  }
  .tab-btn:not(.active):hover {
    background: #1e293b;
    color: #60a5fa;
  }
}

.quick-select-content {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 15px;
}

/* 🆕 HS300 批量操作条样式 */
.bulk-select-bar {
  position: sticky;
  top: 0;
  background: linear-gradient(90deg,#fdfdfd,#f6f9ff);
  border-bottom: 1px solid #e2e8f0;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 2;
  box-shadow: 0 2px 4px rgba(0,0,0,0.04);
}
.btn-bulk-select, .btn-bulk-deselect {
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .5px;
  transition: background .18s, transform .18s;
}
.btn-bulk-select {
  background: linear-gradient(135deg,#28a745,#20c997);
  color: #fff;
}
.btn-bulk-select:disabled {
  background: linear-gradient(135deg,#9fb9a6,#8aa596);
  cursor: not-allowed;
  opacity: .8;
}
.btn-bulk-deselect {
  background: linear-gradient(135deg,#6c757d,#545b62);
  color: #fff;
}
.btn-bulk-deselect:disabled {
  background: linear-gradient(135deg,#c0c4c7,#a2a7aa);
  cursor: not-allowed;
  opacity: .8;
}
.btn-bulk-select:not(:disabled):hover, .btn-bulk-deselect:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0,0,0,0.12);
}
.bulk-selected-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  background: #eef6ff;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #d0e3f8;
}

.quick-stock-item {
  display: flex;
  align-items: center;
  padding: 10px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.12s, transform 0.12s;
  background: #ffffff;
  color: #0f172a; /* high contrast base text */
  font-weight: 600;
}

.quick-stock-item:hover {
  background-color: #eef6ff; /* higher contrast hover */
  transform: translateY(-1px);
}

.quick-stock-item.selected {
  background-color: #cfe8ff; /* stronger, still light */
  border-left: 4px solid #0466c8;
  color: #0b2540;
}

.quick-stock-symbol {
  font-weight: 700;
  margin-right: 10px;
  min-width: 80px;
  background: linear-gradient(135deg, #0466c8, #0353a4);
  color: #ffffff !important;
  padding: 4px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(3,83,164,0.25);
}

.quick-stock-name {
  flex: 1;
  color: #102a43; /* accessible dark blue-gray */
  font-weight: 600;
}

.selected-indicator {
  color: #03467a;
  font-weight: 800;
}

/* Optional high-contrast override hook */
.force-high-contrast .quick-stock-item { background:#fff !important; color:#0a0f18 !important; }
.force-high-contrast .quick-stock-item.selected { background:#bcdfff !important; }

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


/* ✅ 保持原有表格样式 */

/* 表格样式改由 RankingTable.vue 维护，避免重复定义 */


/* modal overlay and modal-content moved to
   src/assets/styles/stock-ranking-tokens.css */

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
/* 🆕 沪深300相关样式 */
.hs300-info {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
}

.index-info {
  color: #2c3e50;
  font-weight: bold;
  font-size: 16px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #e8f5e8, #f0f8f0);
  border: 2px solid #27ae60;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.btn-refresh, .btn-export-info {
  background: linear-gradient(135deg, #3498db, #2980b9);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s ease;
}

.btn-refresh:disabled {
  background: linear-gradient(135deg, #bdc3c7, #95a5a6);
  cursor: not-allowed;
}

.btn-export-info {
  background: linear-gradient(135deg, #9b59b6, #8e44ad);
}
.category-chip {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .5px;
}
.detail-inline-block {
  background: #fafafa;
  border: 1px solid #eee;
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 8px;
  max-height: 180px;
  overflow: auto;
}
.detail-loading { color:#555; font-size:13px; }
.detail-empty { color:#777; font-size:13px; }
.detail-list { list-style:none; padding:0; margin:0; }
.detail-list.compact li { padding:2px 0; font-size:13px; line-height:1.3; }
</style>