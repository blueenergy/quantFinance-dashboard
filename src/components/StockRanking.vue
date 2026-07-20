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
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import AvailableDatesModal from './AvailableDatesModal.vue'
import RankingQuickSelectModal from './ranking/RankingQuickSelectModal.vue'
import RankingScoreDetailModal from './ranking/RankingScoreDetailModal.vue'
import StockRankingControls from './StockRankingControls.vue'
import RankingTable from './RankingTable.vue'
import request from '../utils/request'
import {
  DEFAULT_RANKING_WEIGHTS,
  getCompositeScore,
  formatDateDisplay,
  generateCSV as utilGenerateCSV,
  deduplicateStocksByLatestDate,
  normalizeRankingWeights,
  serializeRankingWeights,
  weightedDimensionScore,
} from '../utils/scoreUtils.js'
import { computeDisplayRows } from '../utils/displayRows.js'
import { loadStockRankingPrefs, saveStockRankingPrefs } from '../utils/stockRankingPrefs.js'
import {
  buildStockRankingCacheKey,
  readStockRankingCache,
  writeStockRankingCache,
  scoreDateMatchesRequest,
  STOCK_RANKINGS_PAGE_SIZE,
} from '../utils/stockRankingCache.js'

const emit = defineEmits(['view-chart'])

// Centralized debug logger (auto disabled in production build)
const DEBUG = import.meta.env?.DEV === true
function dlog(...args) { if (DEBUG) { try { console.debug('[StockRanking]', ...args) } catch(e) {} } }

const _srp = loadStockRankingPrefs()

// -------------------------
// Reactive state (grouped and documented)
// -------------------------
// Core data
// rankings: array of stock score objects returned from the backend.
// Each item typically contains: { symbol, name, composite_score, score_date, per_date_scores?, per_date_fields?, ... }
const rankings = ref([])
const rankingDataViewMode = ref('')
const loading = ref(false)
const displayLimit = ref(_srp?.displayLimit ?? 30)

// UI mode & inputs
// viewMode: one of 'ranking' | 'selected' | 'watchlist'
// stockInput / stockSuggestions: helpers for the stock input autocomplete
// selectedStocks: array of selected symbols for 'selected' mode
const viewMode = ref(_srp?.viewMode ?? 'ranking') // 'ranking' | 'selected' | 'watchlist'
const stockInput = ref('')
const stockSuggestions = ref([])
const selectedStocks = ref(_srp?.selectedStocks?.length ? [..._srp.selectedStocks] : [])
const hasCurrentModeRankings = computed(
  () => rankings.value.length > 0 && rankingDataViewMode.value === viewMode.value
)
// 评分详情（单类别）
const scoreDetailCategory = ref(null)
const scoreDetailData = ref(null)
const scoreDetailWeights = ref({})
const scoreDetailDimensions = ref([])
const loadingDetail = ref(false)
const scoreDetailRequestSeq = ref(0)
let scoreDetailRequestController = null

// 获取当前股票有效策略（优先单股票策略，其次全局策略）
function getEffectiveStrategyFor(symbol) {
  return (perStockStrategies.value && perStockStrategies.value[symbol]) || rankingStrategy.value || 'balanced'
}

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

// Date / multi-date selections
// selectedDate: single date input (ISO yyyy-mm-dd)
// selectedDateInput: auxiliary input used when adding to selectedDates
// selectedDates: array of selected yyyyMMdd strings used for multi-date flattening
const selectedDate = ref(_srp?.selectedDate ?? '')
const selectedDateInput = ref('')
const selectedDates = ref(_srp?.selectedDates?.length ? [..._srp.selectedDates] : [])

// Strategy controls
// rankingStrategy: global strategy used across modes unless a per-stock override is set
// perStockStrategies: map { SYMBOL: 'balanced'|'aggressive'|'conservative' } for per-symbol overrides
const rankingStrategy = ref(_srp?.rankingStrategy ?? 'balanced')
const sortBy = ref(_srp?.sortBy ?? 'composite')
const rankingWeights = ref(normalizeRankingWeights(_srp?.rankingWeights || DEFAULT_RANKING_WEIGHTS))
const perStockStrategies = ref(
  _srp?.perStockStrategies && typeof _srp.perStockStrategies === 'object'
    ? { ..._srp.perStockStrategies }
    : {}
)

let _prefsSaveTimer = null
function schedulePersistStockRankingPrefs() {
  clearTimeout(_prefsSaveTimer)
  _prefsSaveTimer = setTimeout(() => {
    saveStockRankingPrefs({
      viewMode: viewMode.value,
      displayLimit: displayLimit.value,
      rankingStrategy: rankingStrategy.value,
      sortBy: sortBy.value,
      rankingWeights: rankingWeights.value,
      selectedDate: selectedDate.value,
      selectedDates: [...selectedDates.value],
      selectedStocks: [...selectedStocks.value],
      perStockStrategies: { ...perStockStrategies.value },
    })
  }, 320)
}

watch(
  [viewMode, displayLimit, rankingStrategy, sortBy, rankingWeights, selectedDate, selectedDates, selectedStocks, perStockStrategies],
  schedulePersistStockRankingPrefs,
  { deep: true }
)

// UI helpers / tokens
// refreshKey: small integer token bumped to force expensive computed properties to re-evaluate
// loadingMessage / lastUpdateTime: UI strings
const refreshKey = ref(0) // bump to force computed refresh when needed
const loadingMessage = ref('')
const lastUpdateTime = ref('')
// Date picker max: calendar today only. Do not use lastUpdateTime: in "latest per
// symbol" mode, rows can have different score_date, and the top row's date may be
// older than dates that still exist in DB, which would incorrectly block the picker.
const maxDate = computed(() => new Date().toISOString().slice(0, 10))
// AbortController for cancelling in-flight fetchRankings requests
const currentRequestController = ref(null)
const rankingRequestSeq = ref(0)

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
const watchlist = ref([])

/** 服务端分页：offset + page_size；指数恒分页；自选股/指定股仅当标的数 > 每页条数 */
const rankingPageOffset = ref(0)
const rankingTotal = ref(0)
const usePagedRankingsFetch = computed(() => {
  const vm = viewMode.value
  if (vm === 'hs300' || vm === 'csi500' || vm === 'csi1000' || vm === 'csi2000' || vm === 'a500' || vm === 'star50') return true
  if (vm === 'watchlist' && (watchlist.value || []).length > STOCK_RANKINGS_PAGE_SIZE) return true
  if (
    vm === 'selected' &&
    selectedDates.value.length === 0 &&
    (selectedStocks.value || []).length > STOCK_RANKINGS_PAGE_SIZE
  ) {
    return true
  }
  return false
})
const rankingPageLabel = computed(
  () => Math.floor(rankingPageOffset.value / STOCK_RANKINGS_PAGE_SIZE) + 1
)

const INDEX_RANKING_VIEW_MODES = new Set(['hs300', 'csi500', 'csi1000', 'csi2000', 'a500', 'star50'])

function isIndexRankingViewMode(mode) {
  return INDEX_RANKING_VIEW_MODES.has(String(mode || ''))
}

function rowsMatchIndexViewMode(rows, mode) {
  if (!isIndexRankingViewMode(mode)) return true
  if (!Array.isArray(rows) || rows.length === 0) return true
  // New backend rows carry index_codes. If present, require every row to belong
  // to the requested index before using cache / response data. Rows from older
  // backends without index_codes are tolerated, but v4 cache avoids old polluted
  // localStorage entries.
  return rows.every((row) => {
    const codes = row?.index_codes
    if (!Array.isArray(codes) || codes.length === 0) return true
    return codes.includes(mode)
  })
}

function rankingPrevPage() {
  rankingPageOffset.value = Math.max(0, rankingPageOffset.value - STOCK_RANKINGS_PAGE_SIZE)
  fetchRankings()
}

function rankingNextPage() {
  const next = rankingPageOffset.value + STOCK_RANKINGS_PAGE_SIZE
  if (next < rankingTotal.value) {
    rankingPageOffset.value = next
    fetchRankings()
  }
}

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
// 指数成分股 ref：快选等用；指数 Tab 排行榜走 GET by-index，不依赖此处是否已加载。
const csi500Stocks = ref([])
const csi500Loading = ref(false)
const csi1000Stocks = ref([])
const csi1000Loading = ref(false)
const csi2000Stocks = ref([])
const csi2000Loading = ref(false)

// ✅ 检查用户是否已登录
function isUserLoggedIn() {
  return localStorage.getItem('access_token') !== null
}

// -------------------------
// Helper utilities (pure, small)
// -------------------------
// (removed duplicate getEffectiveStrategyFor; unified definition earlier)

// getCompositeScore imported from utils

const SORT_SCORE_FIELDS = {
  cycle: 'cycle_score',
  growth: 'growth_score',
  fundamental: 'fundamental_score',
  value: 'value_score',
  technical: 'technical_score',
  money_flow: 'money_flow_score',
}

function getSortScoreForRow(row, date = '') {
  const key = sortBy.value || 'composite'
  if (key === 'composite') {
    const strategy = getEffectiveStrategyFor(row.symbol)
    if (date && row.per_date_scores?.[date]) {
      return Number(row.per_date_scores[date]?.[strategy] || 0)
    }
    return Number(getCompositeScore(row, strategy) || 0)
  }
  if (key === 'weighted') {
    if (date && row.per_date_fields?.[date]) {
      return weightedDimensionScore(row.per_date_fields[date], rankingWeights.value)
    }
    return Number(row.weighted_score ?? weightedDimensionScore(row, rankingWeights.value) ?? 0)
  }
  const field = SORT_SCORE_FIELDS[key]
  if (!field) return 0
  if (date && row.per_date_fields?.[date]) {
    return Number(row.per_date_fields[date]?.[field] || 0)
  }
  return Number(row[field] || 0)
}

// ✅ 主数据获取方法 - 根据模式调用不同API
async function fetchRankings() {
  const requestId = ++rankingRequestSeq.value
  const requestContext = {
    viewMode: viewMode.value,
    displayLimit: displayLimit.value,
    rankingStrategy: rankingStrategy.value,
    sortBy: sortBy.value,
    rankingWeights: { ...(rankingWeights.value || {}) },
    selectedDate: selectedDate.value,
    selectedDates: [...(selectedDates.value || [])],
    selectedStocks: [...(selectedStocks.value || [])],
    watchlistSymbols: [...(watchlist.value || [])],
    pageOffset: rankingPageOffset.value,
    usePagedRankingsFetch: usePagedRankingsFetch.value,
  }
  dlog('fetchRankings start viewMode=', requestContext.viewMode, 'requestId=', requestId)
  const abortThis = new AbortController()
  const requestStillCurrent = () =>
    rankingRequestSeq.value === requestId && currentRequestController.value === abortThis
  try {
    // cancel any previous in-flight request
    try {
      if (currentRequestController.value) {
        currentRequestController.value.abort()
      }
    } catch (e) {
      // no-op
    }
    currentRequestController.value = abortThis
    const signal = abortThis.signal
    let response
    // 构造日期参数
    let dateParam = ''
    if (requestContext.selectedDate) {
      // 期望格式：yyyyMMdd
      const d = new Date(requestContext.selectedDate)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      dateParam = `${yyyy}${mm}${dd}`
    }

    function symbolsForIndexMode(vm) {
      switch (vm) {
        case 'hs300':
          return (hs300Stocks.value || []).map((s) => s.symbol)
        case 'csi500':
          return (csi500Stocks.value || []).map((s) => s.symbol)
        case 'csi1000':
          return (csi1000Stocks.value || []).map((s) => s.symbol)
        case 'csi2000':
          return (csi2000Stocks.value || []).map((s) => s.symbol)
        case 'a500':
          return (a500Stocks.value || []).map((s) => s.symbol)
        case 'star50':
          return (star50Stocks.value || []).map((s) => s.symbol)
        default:
          return []
      }
    }

    const cacheKey = buildStockRankingCacheKey({
      viewMode: requestContext.viewMode,
      displayLimit: requestContext.displayLimit,
      rankingStrategy: requestContext.rankingStrategy,
      sortBy: requestContext.sortBy,
      rankingWeights: requestContext.rankingWeights,
      dateParam,
      selectedDates: requestContext.selectedDates,
      selectedStocks: requestContext.selectedStocks,
      watchlistSymbols: requestContext.watchlistSymbols,
      indexSymbols: symbolsForIndexMode(requestContext.viewMode),
      pageOffset: requestContext.usePagedRankingsFetch ? requestContext.pageOffset : 0,
      pageSize: requestContext.usePagedRankingsFetch ? STOCK_RANKINGS_PAGE_SIZE : null,
    })
    const cached = readStockRankingCache(cacheKey)
    let hadWarmCache = false
    const cacheDateOk = scoreDateMatchesRequest(
      dateParam,
      cached?.primaryScoreDate
    )
    if (cached && cacheDateOk && rowsMatchIndexViewMode(cached.rankings, requestContext.viewMode)) {
      rankings.value = JSON.parse(JSON.stringify(cached.rankings))
      rankingDataViewMode.value = requestContext.viewMode
      if (cached.lastUpdateTime) lastUpdateTime.value = cached.lastUpdateTime
      hadWarmCache = true
    } else if (cached && cacheDateOk) {
      dlog('ranking cache ignored: index membership mismatch', {
        key: cacheKey,
        mode: requestContext.viewMode,
      })
    }
    loading.value = !hadWarmCache
    const weightsParam = requestContext.sortBy === 'weighted' ? serializeRankingWeights(requestContext.rankingWeights) : ''
    const appendWeightedQuery = (parts) => {
      if (weightsParam) parts.push(`weights=${encodeURIComponent(weightsParam)}`)
    }
    const appendRequestPageQuery = (url) => {
      if (!requestContext.usePagedRankingsFetch) return url
      const joiner = url.includes('?') ? '&' : '?'
      return `${url}${joiner}offset=${requestContext.pageOffset}&page_size=${STOCK_RANKINGS_PAGE_SIZE}`
    }

    switch (requestContext.viewMode) {
      case 'ranking': {
        loadingMessage.value = `加载前 ${requestContext.displayLimit} 名股票评分...`
        let url = `/stock-rankings?limit=${requestContext.displayLimit}`
        // include selected ranking strategy so server can sort accordingly
        if (requestContext.rankingStrategy) url += `&strategy=${encodeURIComponent(requestContext.rankingStrategy)}`
        if (requestContext.sortBy) url += `&sort_by=${encodeURIComponent(requestContext.sortBy)}`
        if (weightsParam) url += `&weights=${encodeURIComponent(weightsParam)}`
        if (dateParam) url += `&date=${dateParam}`
        response = await request({ method: 'get', url, signal })
        break
      }
      case 'hs300':
      case 'csi500':
      case 'csi1000':
      case 'csi2000':
      case 'a500':
      case 'star50': {
        const indexLabels = {
          hs300: '沪深300',
          csi500: '中证500',
          csi1000: '中证1000',
          csi2000: '中证2000',
          a500: '中证A500',
          star50: '科创50',
        }
        loadingMessage.value = `加载${indexLabels[requestContext.viewMode]}指数成分股评分...`
        let url = `/stock-rankings/by-index/${encodeURIComponent(requestContext.viewMode)}`
        const qpIdx = []
        if (requestContext.rankingStrategy) {
          qpIdx.push(`strategy=${encodeURIComponent(requestContext.rankingStrategy)}`)
        }
        if (requestContext.sortBy) {
          qpIdx.push(`sort_by=${encodeURIComponent(requestContext.sortBy)}`)
        }
        appendWeightedQuery(qpIdx)
        if (dateParam) {
          qpIdx.push(`date=${encodeURIComponent(dateParam)}`)
        }
        if (qpIdx.length) url += `?${qpIdx.join('&')}`
        url = appendRequestPageQuery(url)
        dlog('index rankings GET', url)
        response = await request({ method: 'get', url, signal })
        break
      }
      case 'selected': {
        if (requestContext.selectedStocks.length === 0) {
          rankings.value = []
          rankingTotal.value = 0
          loading.value = false
          return
        }
        loadingMessage.value = `加载指定股票评分...`
        const payload = { symbols: requestContext.selectedStocks }
        dlog('selectedStocks', requestContext.selectedStocks)
        // 如果有多日期，传递 dates 数组；否则继续使用单日期参数
        let url = '/stock-rankings/selected'
        // include strategy in payload so server can choose ranking method for selected fetch
        payload.strategy = requestContext.rankingStrategy
        if (requestContext.selectedDates.length > 0) {
          payload.dates = requestContext.selectedDates
          const qpSel = []
          if (requestContext.rankingStrategy) qpSel.push(`strategy=${encodeURIComponent(requestContext.rankingStrategy)}`)
          if (requestContext.sortBy) qpSel.push(`sort_by=${encodeURIComponent(requestContext.sortBy)}`)
          appendWeightedQuery(qpSel)
          if (qpSel.length) url += `?${qpSel.join('&')}`
          url = appendRequestPageQuery(url)
          dlog('posting with dates', payload.dates)
          response = await request({ method: 'post', url, data: payload, signal })
        } else {
          const qpSel = []
          if (dateParam) qpSel.push(`date=${dateParam}`)
          if (requestContext.rankingStrategy) qpSel.push(`strategy=${encodeURIComponent(requestContext.rankingStrategy)}`)
          if (requestContext.sortBy) qpSel.push(`sort_by=${encodeURIComponent(requestContext.sortBy)}`)
          appendWeightedQuery(qpSel)
          if (qpSel.length) url += `?${qpSel.join('&')}`
          url = appendRequestPageQuery(url)
          dlog('posting without dates url=', url)
          response = await request({ method: 'post', url, data: payload, signal })
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
        if (requestContext.watchlistSymbols.length === 0) {
          rankings.value = []
          rankingTotal.value = 0
          loading.value = false
          return
        }
        loadingMessage.value = `加载自选股评分...`
        const payload = { symbols: requestContext.watchlistSymbols }
        let url = '/stock-rankings/selected'
        // include strategy and date as query parameters
        const qp2 = []
        if (dateParam) qp2.push(`date=${dateParam}`)
        if (requestContext.rankingStrategy) qp2.push(`strategy=${encodeURIComponent(requestContext.rankingStrategy)}`)
        if (requestContext.sortBy) qp2.push(`sort_by=${encodeURIComponent(requestContext.sortBy)}`)
        appendWeightedQuery(qp2)
        if (qp2.length) url += `?${qp2.join('&')}`
        url = appendRequestPageQuery(url)
        response = await request({ method: 'post', url, data: payload, signal })
        break
      }
      default: {
        throw new Error('无效的查看模式')
      }
    }
    // 竞态防护：等待网络期间用户可能已切换模式并发起新请求。仅靠 abort 不够——
    // 已经到达的响应仍可能正常 resolve，从而用旧数据（读取的是共享的 viewMode.value，
    // 此时已是新模式）覆盖新请求结果、甚至写错缓存 key。若本请求已被更新的请求取代，直接丢弃。
    if (!requestStillCurrent()) {
      dlog('stale response dropped: superseded by a newer fetch', { requestId, mode: requestContext.viewMode })
      return
    }
    dlog('response items=', Array.isArray(response?.data) ? response.data.length : (Array.isArray(response) ? response.length : 'n/a'))
    // 处理响应数据（防御性检查）；request 已解包为 HTTP body
    if (!response) {
      console.error('[fetchRankings] empty response')
      rankings.value = []
      rankingTotal.value = 0
    } else if (response && typeof response === 'object') {
      if (response.success && response.data) {
        rankings.value = response.data
        const t = response.total
        rankingTotal.value = typeof t === 'number' ? t : (response.data || []).length
      } else if (Array.isArray(response)) {
        rankings.value = response
        rankingTotal.value = response.length
      } else if (Array.isArray(response.data)) {
        rankings.value = response.data
        rankingTotal.value = response.data.length
      } else {
        // server returned object but not expected shape
        rankings.value = []
        rankingTotal.value = 0
      }
    } else if (Array.isArray(response)) {
      // fallback if body is array directly
      rankings.value = response
      rankingTotal.value = response.length
    } else {
      rankings.value = []
      rankingTotal.value = 0
    }
    if (!rowsMatchIndexViewMode(rankings.value, requestContext.viewMode)) {
      dlog('ranking response ignored: index membership mismatch', {
        mode: requestContext.viewMode,
        symbols: (rankings.value || []).slice(0, 5).map((row) => row?.symbol),
      })
      rankings.value = []
      rankingTotal.value = 0
    }
    rankingDataViewMode.value = requestContext.viewMode
    dlog('rankings count after response', (rankings.value || []).length)
      try {
        if (!(requestContext.viewMode === 'selected' && requestContext.selectedDates.length > 0)) {
          // console.log('[fetchRankings] calling deduplicateStocksByLatestDate')
          rankings.value = deduplicateStocksByLatestDate(rankings.value)
          // console.log('[fetchRankings] dedupe done, count now:', (rankings.value || []).length)
        }
      } catch (e) {
        console.error('[fetchRankings] error during deduplication:', e)
      }
    // 排序处理
  // 如果是多日期并且后端返回每个股票包含 per_date_scores 对象，按当前全局 rankingStrategy 对应某个日期合并排序（默认用首个日期）
    if (requestContext.viewMode === 'selected' && requestContext.selectedDates.length > 0) {
      const primaryDate = requestContext.selectedDates[0]
      rankings.value.sort((a, b) => {
        return getSortScoreForRow(b, primaryDate) - getSortScoreForRow(a, primaryDate)
      })
  } else {
    rankings.value.sort((a, b) => getSortScoreForRow(b) - getSortScoreForRow(a))
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

    const writeKey = buildStockRankingCacheKey({
      viewMode: requestContext.viewMode,
      displayLimit: requestContext.displayLimit,
      rankingStrategy: requestContext.rankingStrategy,
      sortBy: requestContext.sortBy,
      rankingWeights: requestContext.rankingWeights,
      dateParam,
      selectedDates: requestContext.selectedDates,
      selectedStocks: requestContext.selectedStocks,
      watchlistSymbols: requestContext.watchlistSymbols,
      indexSymbols: symbolsForIndexMode(requestContext.viewMode),
      pageOffset: requestContext.usePagedRankingsFetch ? requestContext.pageOffset : 0,
      pageSize: requestContext.usePagedRankingsFetch ? STOCK_RANKINGS_PAGE_SIZE : null,
    })
    if (writeKey && rankings.value.length > 0) {
      writeStockRankingCache(writeKey, {
        rankings: rankings.value,
        lastUpdateTime: lastUpdateTime.value,
        primaryScoreDate: rankings.value[0]?.score_date,
      })
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
    // 仅当本 invocation 仍是「当前」请求时收尾，避免被 abort 的旧任务清空新任务的 controller
    if (requestStillCurrent()) {
      currentRequestController.value = null
      loading.value = false
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


// ✅ 获取用户自选股列表
async function fetchWatchlist() {
  if (!isUserLoggedIn()) {
    dlog('skip watchlist fetch (not logged in)')
    return
  }
  
  try {
    const response = await request({ method: 'get', url: '/user/watchlist' })
    dlog('watchlist response', response)
    
    if (response.success && response.data) {
      watchlist.value = response.data.symbols || []
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
    const response = await request({
      method: 'post',
      url: '/user/watchlist/add',
      data: { symbol: symbol },
    })
    
  dlog('add watchlist response', response)
    
    if (response.success) {
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
    // Check if the stock has any active strategies
    const stratCheckResponse = await request({ method: 'get', url: '/user/watchlist/strategies' })
    
    if (stratCheckResponse.success) {
      const activeStrategies = stratCheckResponse.data
        .filter(s => s.symbol === symbol && s.enabled === true)
      
      if (activeStrategies.length > 0) {
        const strategyNames = activeStrategies.map(s => s.strategy_key).join(', ')
        alert(`❌ 无法删除：该股票还有 ${activeStrategies.length} 个策略处于激活状态 (${strategyNames})\n\n请先在“策略配置”页面停用相关策略，然后再删除股票。`)
        return
      }
    }
    
    const response = await request({ method: 'delete', url: `/user/watchlist/remove/${symbol}` })
    
    if (response.success) {
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
    const response = await request({ method: 'get', url: '/user/watchlist-stocks' })
    dlog('watchlist stocks detail', response)
    
    if (response.success) {
      const stocks = response.data
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
    const response = await request({
      method: 'put',
      url: '/user/watchlist',
      data: { symbols: [] },
    })
    
    if (response.success) {
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

// =============================
// ✅ 指数成分股通用工具
// =============================
const indexStateMap = {
  hs300: { list: hs300Stocks, loading: hs300Loading, path: '/index/hs300/constituents', fallback: [
    { symbol: '000001.SZ', name: '平安银行', industry: '银行', market_cap: 280000000000, weight: 0.85 },
    { symbol: '000002.SZ', name: '万科A', industry: '房地产开发', market_cap: 250000000000, weight: 0.78 }
  ] },
  a500: { list: a500Stocks, loading: a500Loading, path: '/index/a500/constituents', fallback: [
    { symbol: '600519.SH', name: '贵州茅台', industry: '白酒', market_cap: 2500000000000, weight: 2.50 },
    { symbol: '000333.SZ', name: '美的集团', industry: '家电', market_cap: 450000000000, weight: 1.20 }
  ] },
  // 修复: 中证500 应使用自身 loading ref 且提供更贴近该指数的示例成分
  csi500: { list: csi500Stocks, loading: csi500Loading, path: '/index/csi500/constituents', fallback: [
    { symbol: '000001.SZ', name: '平安银行', industry: '银行', market_cap: 280000000000, weight: 0.35 },
    { symbol: '600036.SH', name: '招商银行', industry: '银行', market_cap: 340000000000, weight: 0.40 },
    { symbol: '002415.SZ', name: '海康威视', industry: '电子', market_cap: 310000000000, weight: 0.45 }
  ] },
  csi1000: { list: csi1000Stocks, loading: csi1000Loading, path: '/index/csi1000/constituents', fallback: [
    { symbol: '300014.SZ', name: '亿纬锂能', industry: '电力设备', market_cap: 80000000000, weight: 0.32 },
    { symbol: '002304.SZ', name: '洋河股份', industry: '食品饮料', market_cap: 120000000000, weight: 0.28 },
    { symbol: '600887.SH', name: '伊利股份', industry: '食品饮料', market_cap: 150000000000, weight: 0.30 }
  ] },
  csi2000: { list: csi2000Stocks, loading: csi2000Loading, path: '/index/csi2000/constituents', fallback: [
    { symbol: '300014.SZ', name: '亿纬锂能', industry: '电力设备', market_cap: 80000000000, weight: 0.20 },
    { symbol: '002304.SZ', name: '洋河股份', industry: '食品饮料', market_cap: 120000000000, weight: 0.18 },
    { symbol: '603986.SH', name: '兆易创新', industry: '电子', market_cap: 90000000000, weight: 0.16 }
  ] },
  star50: { list: star50Stocks, loading: star50Loading, path: '/index/star50/constituents', fallback: [
    { symbol: '688001.SH', name: '华兴源创', industry: '半导体', market_cap: 45000000000, weight: 1.10 },
    { symbol: '688012.SH', name: '中微公司', industry: '半导体设备', market_cap: 120000000000, weight: 2.20 }
  ] }
}

async function fetchIndexConstituents(indexKey) {
  const st = indexStateMap[indexKey]
  if (!st) throw new Error(`未知指数: ${indexKey}`)
  if (st.list.value.length > 0) return st.list.value
  st.loading.value = true
  try {
    const resp = await request({ method: 'get', url: st.path })
    // 注意：[] 在 JS 中为 truthy，不能写 `if (resp.data)`，否则 success + 空列表会误采纳、且不走 fallback
    const rows = Array.isArray(resp?.data) ? resp.data : null
    if (resp?.success && rows && rows.length > 0) {
      st.list.value = rows
      console.log(`📊 获取到 ${st.list.value.length} 只 ${indexKey} 成分股`)
      return st.list.value
    }
    if (resp?.success && rows && rows.length === 0) {
      console.warn(`获取 ${indexKey} 成分股返回空列表，使用本地 fallback`)
      st.list.value = [...st.fallback]
      return st.list.value
    }
    throw new Error('API返回数据格式错误')
  } catch (e) {
    console.warn(`获取 ${indexKey} 成分股失败，使用本地数据:`, e.message)
    st.list.value = [...st.fallback]
    return st.list.value
  } finally {
    st.loading.value = false
  }
}

// 生成显示行：如果在指定模式并选择了多个日期，则为每个 symbol/date 生成单独行
const displayRows = computed(() => {
  // small reactive token to force re-evaluation when UI-level strategy changes
  const _rk = refreshKey.value
  if (rankings.value.length > 0 && rankingDataViewMode.value !== viewMode.value) {
    return []
  }
  return computeDisplayRows({
    rankings: rankings.value,
    viewMode: viewMode.value,
    selectedDates: selectedDates.value,
    rankingStrategy: rankingStrategy.value,
    sortBy: sortBy.value,
    rankingWeights: rankingWeights.value,
    perStockStrategies: perStockStrategies.value,
    getCompositeScore
  })
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