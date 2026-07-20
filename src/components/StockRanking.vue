<!-- dashboard/src/components/StockRanking.vue -->
<template>
  <div>
  <h3 class="ranking-title">股票评分排行榜</h3>
    <div style="margin-bottom: 20px;">
  <StockRankingControls
    :viewMode="viewMode"
    :selectedDate="selectedDate"
    :maxDate="maxDate"
    :displayLimit="displayLimit"
    :rankingStrategy="rankingStrategy"
    :sortBy="sortBy"
    :rankingWeights="rankingWeights"
    :stockInput="stockInput"
    :stockSuggestions="stockSuggestions"
    :selectedStocks="selectedStocks"
    :selectedDates="selectedDates"
    :watchlistLength="watchlist.length"
    :lastUpdateTime="lastUpdateTime"
    :selectSuggestionCb="selectSuggestion"
    :addStockCb="addStockToQuery"
    @change-view-mode="handleChangeViewMode"
    @change-date="handleChangeDate"
    @change-display-limit="handleChildDisplayLimitChange"
    @change-ranking-strategy="handleChildRankingStrategyChange"
    @change-sort-by="handleChildSortByChange"
    @change-ranking-weights="handleChildRankingWeightsChange"
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
    @export-scores="exportScores"
      />
    </div>

    <!-- ✅ 加载状态 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-spinner"></div>
      <span>{{ loadingMessage }}</span>
    </div>

    <!-- ✅ 无数据提示 -->
    <div v-else-if="!hasCurrentModeRankings" class="no-data-container">
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
        <div class="mode-header-row">
          <span class="stock-count">
            <template v-if="viewMode === 'selected' && selectedDates.length > 0">
              共 {{ displayRows.length }} 只股票
            </template>
            <template v-else-if="usePagedRankingsFetch">
              本页 {{ rankings.length }} 条 · 共 {{ rankingTotal || rankings.length }} 条
            </template>
            <template v-else>
              共 {{ rankings.length }} 只股票
            </template>
          </span>
          <div
            v-if="usePagedRankingsFetch && rankingTotal > STOCK_RANKINGS_PAGE_SIZE"
            class="ranking-pager"
          >
            <button
              type="button"
              class="btn-base btn-sm btn-gradient-gray"
              :disabled="rankingPageOffset <= 0"
              @click="rankingPrevPage"
            >
              上一页
            </button>
            <span class="pager-meta">第 {{ rankingPageLabel }} 页</span>
            <button
              type="button"
              class="btn-base btn-sm btn-gradient-gray"
              :disabled="rankingPageOffset + rankings.length >= rankingTotal"
              @click="rankingNextPage"
            >
              下一页
            </button>
          </div>
        </div>
      </div>

      <div class="ranking-table-scroll">
        <RankingTable
          :key="`${viewMode}-${rankingPageOffset}`"
          :displayRows="displayRows"
          :viewMode="viewMode"
          :sortBy="sortBy"
          :formatDateDisplay="formatDateDisplay"
          :getScoreClass="getScoreClass"
          :getRankClass="getRankClass"
          :getRowClass="getRowClass"
          :isInWatchlist="isInWatchlist"
          @toggle-watchlist="toggleWatchlist"
          @remove-stock="removeStockFromQuery"
          @show-score="stock => fetchScoreDetails(stock, 'composite')"
          @show-score-detail="({ stock, category }) => fetchScoreDetails(stock, category)"
        />
      </div>
    </div>

    <RankingQuickSelectModal
      v-model:selected-category="selectedCategory"
      :show="showQuickSelect"
      :categories="quickSelectCategories"
      :selected-stocks="selectedStocks"
      :index-stocks="{
        hs300: hs300Stocks,
        a500: a500Stocks,
        csi500: csi500Stocks,
        csi1000: csi1000Stocks,
        csi2000: csi2000Stocks,
        star50: star50Stocks
      }"
      :index-loading="{
        hs300: hs300Loading,
        a500: a500Loading,
        csi500: csi500Loading,
        csi1000: csi1000Loading,
        csi2000: csi2000Loading,
        star50: star50Loading
      }"
      @toggle-stock="toggleQuickSelectStock"
      @select-all-index="selectAllIndex"
      @deselect-all-index="deselectAllIndex"
      @reload-index="reloadIndex"
      @apply="applyQuickSelection"
      @close="closeQuickSelect"
    />

    <AvailableDatesModal
      :show="showAvailableDatesModal"
      :symbol="pickingForSymbol"
      :available-dates="availableDatesForSymbol"
      :selected="availableDatesSelection"
      :format-date-display="formatDateDisplay"
      @select-all="selectAllAvailableDates"
      @deselect-all="deselectAllAvailableDates"
      @toggle="toggleAvailableDate"
      @apply="applyAvailableDatesSelection"
      @close="closeAvailableDatesModal"
    />

    <RankingScoreDetailModal
      :show="showScoreDetail"
      :stock="selectedStock"
      :category="scoreDetailCategory"
      :details="scoreDetailData"
      :weights="scoreDetailWeights"
      :dimensions="scoreDetailDimensions"
      :loading="loadingDetail"
      :in-watchlist="isInWatchlist(selectedStock?.symbol)"
      @view-chart="viewChart"
      @toggle-watchlist="toggleWatchlist"
      @close="closeScoreDetail"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import AvailableDatesModal from './AvailableDatesModal.vue'
import RankingQuickSelectModal from './ranking/RankingQuickSelectModal.vue'
import RankingScoreDetailModal from './ranking/RankingScoreDetailModal.vue'
import StockRankingControls from './StockRankingControls.vue'
import RankingTable from './RankingTable.vue'
import { useStockRanking } from '../composables/useStockRanking.js'
import request from '../utils/request'
import {
  getCompositeScore,
  formatDateDisplay,
  generateCSV as utilGenerateCSV,
  normalizeRankingWeights,
} from '../utils/scoreUtils.js'
import { STOCK_RANKINGS_PAGE_SIZE } from '../utils/stockRankingCache.js'

const emit = defineEmits(['view-chart'])

// Centralized debug logger (auto disabled in production build)
const DEBUG = import.meta.env?.DEV === true
function dlog(...args) { if (DEBUG) { try { console.debug('[StockRanking]', ...args) } catch(e) {} } }

const {
  rankings,
  rankingDataViewMode,
  loading,
  displayLimit,
  viewMode,
  selectedStocks,
  selectedDate,
  selectedDates,
  rankingStrategy,
  sortBy,
  rankingWeights,
  perStockStrategies,
  watchlist,
  refreshKey,
  loadingMessage,
  lastUpdateTime,
  rankingPageOffset,
  rankingTotal,
  hasCurrentModeRankings,
  maxDate,
  usePagedRankingsFetch,
  rankingPageLabel,
  displayRows,
  getEffectiveStrategyFor,
  fetchRankings,
  rankingPrevPage,
  rankingNextPage,
  indexStateMap,
  hs300Stocks,
  hs300Loading,
  a500Stocks,
  a500Loading,
  csi500Stocks,
  csi500Loading,
  csi1000Stocks,
  csi1000Loading,
  csi2000Stocks,
  csi2000Loading,
  star50Stocks,
  star50Loading,
  fetchIndexConstituents,
  fetchWatchlist,
  isInWatchlist,
  toggleWatchlist,
  clearWatchlist,
  viewWatchlistStocks,
} = useStockRanking({
  dlog,
  isUserLoggedIn,
})

const stockInput = ref('')
const stockSuggestions = ref([])
// 评分详情（单类别）
const scoreDetailCategory = ref(null)
const scoreDetailData = ref(null)
const scoreDetailWeights = ref({})
const scoreDetailDimensions = ref([])
const loadingDetail = ref(false)
const scoreDetailRequestSeq = ref(0)
let scoreDetailRequestController = null

async function fetchScoreDetails(row, category) {
  const requestId = ++scoreDetailRequestSeq.value
  scoreDetailRequestController?.abort()
  const controller = new AbortController()
  scoreDetailRequestController = controller
  const requestStillCurrent = () => (
    scoreDetailRequestSeq.value === requestId
    && scoreDetailRequestController === controller
  )

  try {
    loadingDetail.value = true
    scoreDetailCategory.value = category
    selectedStock.value = row
    scoreDetailData.value = null
    scoreDetailWeights.value = {}
    scoreDetailDimensions.value = []
    showScoreDetail.value = true

    const params = { symbol: row.symbol, category }
    if (row.score_date) params.score_date = row.score_date
    if (category === 'composite') params.strategy = getEffectiveStrategyFor(row.symbol)
    const json = await request({
      url: '/stock-score-detail',
      method: 'get',
      params,
      signal: controller.signal,
    })
    if (!requestStillCurrent()) return

    if (json && json.success) {
      scoreDetailData.value = json.data.details
      scoreDetailWeights.value = json.data.weights || {}
      scoreDetailDimensions.value = json.data.dimensions || []
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
      scoreDetailWeights.value = {}
      scoreDetailDimensions.value = []
    }
  } catch (e) {
    if (!requestStillCurrent()) return
    if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.name === 'AbortError') {
      return
    }
    scoreDetailData.value = { 错误: e.message || '请求异常' }
    scoreDetailWeights.value = {}
    scoreDetailDimensions.value = []
  } finally {
    if (requestStillCurrent()) {
      scoreDetailRequestController = null
      loadingDetail.value = false
    }
  }
}

const selectedDateInput = ref('')

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
  { key: 'csi1000', name: '中证1000 成分股', stocks: [] },
  { key: 'csi2000', name: '中证2000 成分股', stocks: [] },
  { key: 'star50', name: '科创50 成分股', stocks: [] }
])
const selectedCategory = ref(quickSelectCategories.value[0].key)

// Available-dates modal (used when picking dates for a single symbol)
const showAvailableDatesModal = ref(false)
const availableDatesForSymbol = ref([]) // array of yyyyMMdd strings returned by /api/stock-dates
const availableDatesSelection = ref([])
const pickingForSymbol = ref('')

// Score detail modal
const showScoreDetail = ref(false)
const selectedStock = ref(null)

// ✅ 检查用户是否已登录
function isUserLoggedIn() {
  return localStorage.getItem('access_token') !== null
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
    const resp = await request({ method: 'get', url: '/stock-dates', params: { symbol } })
    if (resp && resp.success && Array.isArray(resp.data)) {
      // expect data like ['20250918','20250917',...]
      availableDatesForSymbol.value = resp.data
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

function toggleAvailableDate(date, checked) {
  if (checked) {
    if (!availableDatesSelection.value.includes(date)) {
      availableDatesSelection.value = [...availableDatesSelection.value, date]
    }
    return
  }

  availableDatesSelection.value = availableDatesSelection.value.filter(item => item !== date)
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
  rankingTotal.value = 0
  rankingDataViewMode.value = ''
  
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
    case 'csi500':
    case 'csi1000':
    case 'csi2000':
    case 'a500':
    case 'star50':
      // 指数榜数据来自 GET by-index，不依赖成分列表；避免 .then 晚到与快速切换 viewMode 竞态
      fetchRankings()
      break
    default:
      break
  }
}
// explicit handlers used by the new controls component
function handleChangeViewMode(newMode) {
  if (!newMode) { console.warn('handleChangeViewMode called with empty value:', newMode); return }
  try { console.debug('[StockRanking] handleChangeViewMode received ->', newMode) } catch (err) {}
  rankingPageOffset.value = 0
  viewMode.value = newMode
  onViewModeChange()
}

function handleChangeDate(newDate) {
  if (!newDate) { console.warn('handleChangeDate called with empty value:', newDate); return }
  try { console.debug('[StockRanking] handleChangeDate received ->', newDate) } catch (err) {}
  rankingPageOffset.value = 0
  selectedDate.value = newDate
  onDateChange()
}

// Defensive handlers for child component emits
function handleChildDisplayLimitChange(v) {
  const val = (v && typeof v === 'object' && v.target && 'value' in v.target) ? v.target.value : v
  displayLimit.value = Number(val) || displayLimit.value || 50
  rankingPageOffset.value = 0
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

function handleChildSortByChange(v) {
  const newVal = (v && typeof v === 'object' && v.target && 'value' in v.target) ? v.target.value : v
  if (typeof newVal === 'string' && newVal.trim()) {
    sortBy.value = newVal.trim()
  } else {
    console.warn('handleChildSortByChange ignored invalid value:', newVal)
    return
  }
  onRankingSortChange()
}

function handleChildRankingWeightsChange(v) {
  rankingWeights.value = normalizeRankingWeights(v)
  if (sortBy.value === 'weighted') {
    rankingPageOffset.value = 0
    fetchRankings()
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
    if (selectedCategory.value === 'csi1000' && (!csi1000Stocks.value || csi1000Stocks.value.length === 0)) {
  try { await fetchIndexConstituents('csi1000') } catch (e) { console.warn('fetchIndexConstituents csi1000 failed', e) }
    }
    if (selectedCategory.value === 'csi2000' && (!csi2000Stocks.value || csi2000Stocks.value.length === 0)) {
  try { await fetchIndexConstituents('csi2000') } catch (e) { console.warn('fetchIndexConstituents csi2000 failed', e) }
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

async function reloadIndex(indexKey) {
  const state = indexStateMap[indexKey]
  if (!state) return
  try {
    state.list.value = []
    await fetchIndexConstituents(indexKey)
  } catch (e) {
    console.error(`reloadIndex ${indexKey} failed`, e)
    alert('重新加载失败: ' + (e.message || e))
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
    case 'csi500':
      return '暂无中证500指数数据'
    case 'csi1000':
      return '暂无中证1000指数数据'
    case 'csi2000':
      return '暂无中证2000指数数据'
    case 'a500':
      return '暂无中证A500指数数据'
    case 'star50':
      return '暂无科创50指数数据'
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
    case 'csi500':
      return '暂无中证500指数数据'
    case 'csi1000':
      return '暂无中证1000指数数据'
    case 'csi2000':
      return '暂无中证2000指数数据'
    case 'a500':
      return '暂无中证A500指数数据'
    case 'star50':
      return '暂无科创50指数数据'
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
    case 'csi500':
      return `中证500指数成分股评分 (共 ${csi500Stocks.value.length} 只)`
    case 'csi1000':
      return `中证1000指数成分股评分 (共 ${csi1000Stocks.value.length} 只)`
    case 'csi2000':
      return `中证2000指数成分股评分 (共 ${csi2000Stocks.value.length} 只)`
    case 'a500':
      return `中证A500指数成分股评分 (共 ${a500Stocks.value.length} 只)`
    case 'star50':
      return `科创50指数成分股评分 (共 ${star50Stocks.value.length} 只)`
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


function getRankClass(stock, rank) {
  if (viewMode.value === 'ranking') {
    if (rank <= 3) return 'rank-top-three'
    if (rank <= 10) return 'rank-top-ten'
    if (rank <= 30) return 'rank-top-thirty'
    return 'rank-default'
  }
  // Colour by the score actually shown (follows sortBy: composite / weighted / dimension),
  // so switching to 自定义加权 recolours the badge instead of staying on 总分.
  const score = Number(stock?.display_composite_score ?? getCompositeScore(stock, rankingStrategy.value))
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
    const score = Number(stock?.display_composite_score ?? getCompositeScore(stock, rankingStrategy.value))
    if (score >= 80) return 'top-three'
    if (score >= 70) return 'top-ten'
    if (score >= 60) return 'top-thirty'
  }
  return ''
}

function viewChart(symbol) {
  emit('view-chart', symbol)
}

function closeScoreDetail() {
  scoreDetailRequestSeq.value += 1
  scoreDetailRequestController?.abort()
  scoreDetailRequestController = null
  loadingDetail.value = false
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
    try { await fetchIndexConstituents('csi500') } catch (e) { console.warn('auto csi500 fetch failed', e) }
  }
  if (val === 'csi1000' && (!csi1000Stocks.value || csi1000Stocks.value.length === 0) && !csi1000Loading.value) {
    try { await fetchIndexConstituents('csi1000') } catch (e) { console.warn('auto csi1000 fetch failed', e) }
  }
  if (val === 'csi2000' && (!csi2000Stocks.value || csi2000Stocks.value.length === 0) && !csi2000Loading.value) {
    try { await fetchIndexConstituents('csi2000') } catch (e) { console.warn('auto csi2000 fetch failed', e) }
  }
})

onMounted(() => {
  fetchRankings()
  fetchWatchlist()
})

onUnmounted(() => {
  scoreDetailRequestSeq.value += 1
  scoreDetailRequestController?.abort()
  scoreDetailRequestController = null
})

function onRankingStrategyChange() {
  const serverSortedModes = new Set([
    'ranking',
    'watchlist',
    'selected',
    'hs300',
    'csi500',
    'csi1000',
    'csi2000',
    'a500',
    'star50',
  ])
  if (serverSortedModes.has(viewMode.value)) {
    rankingPageOffset.value = 0
    fetchRankings()
    return
  }
  try {
    rankings.value.sort((a, b) => getCompositeScore(b, rankingStrategy.value) - getCompositeScore(a, rankingStrategy.value))
  } catch (e) {
    console.error('排序失败:', e)
  }
  try { refreshKey.value = (refreshKey.value || 0) + 1 } catch (e) {}
}

function onRankingSortChange() {
  rankingPageOffset.value = 0
  fetchRankings()
}

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

.mode-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 15px;
  padding: 10px 0;
  border-bottom: 2px solid #e9ecef;
}

.mode-header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.ranking-pager {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pager-meta {
  font-size: 13px;
  color: #555;
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

.selected-dates {
  margin-top: 8px;
}

.date-chip select {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 6px;
}

/* 宽表：保证右侧列仍在可视区内（可横向滚动），避免被父级裁切 */
.ranking-table-scroll {
  max-width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
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