import { computed, onUnmounted, ref, watch } from 'vue'
import request, { isRequestCanceled } from '../utils/request'
import {
  DEFAULT_RANKING_WEIGHTS,
  deduplicateStocksByLatestDate,
  getCompositeScore,
  normalizeRankingWeights,
  serializeRankingWeights,
  weightedDimensionScore,
} from '../utils/scoreUtils.js'
import { computeDisplayRows } from '../utils/displayRows.js'
import { loadStockRankingPrefs, saveStockRankingPrefs } from '../utils/stockRankingPrefs.js'
import {
  buildStockRankingCacheKey,
  readStockRankingCache,
  scoreDateMatchesRequest,
  STOCK_RANKINGS_PAGE_SIZE,
  writeStockRankingCache,
} from '../utils/stockRankingCache.js'
import { useCancellableRequest } from './useCancellableRequest.js'
import { useRankingIndexConstituents } from './useRankingIndexConstituents.js'
import { useRankingWatchlist } from './useRankingWatchlist.js'

const INDEX_RANKING_VIEW_MODES = new Set([
  'hs300',
  'csi500',
  'csi1000',
  'csi2000',
  'a500',
  'star50',
])

const SORT_SCORE_FIELDS = {
  cycle: 'cycle_score',
  growth: 'growth_score',
  fundamental: 'fundamental_score',
  value: 'value_score',
  technical: 'technical_score',
  money_flow: 'money_flow_score',
}

export function isIndexRankingViewMode(mode) {
  return INDEX_RANKING_VIEW_MODES.has(String(mode || ''))
}

export function rowsMatchIndexViewMode(rows, mode) {
  if (!isIndexRankingViewMode(mode)) return true
  if (!Array.isArray(rows) || rows.length === 0) return true
  return rows.every((row) => {
    const codes = row?.index_codes
    if (!Array.isArray(codes) || codes.length === 0) return true
    return codes.includes(mode)
  })
}

export function buildRankingRequestContext(state) {
  return {
    viewMode: state.viewMode,
    displayLimit: state.displayLimit,
    rankingStrategy: state.rankingStrategy,
    sortBy: state.sortBy,
    rankingWeights: { ...(state.rankingWeights || {}) },
    selectedDate: state.selectedDate,
    selectedDates: [...(state.selectedDates || [])],
    selectedStocks: [...(state.selectedStocks || [])],
    watchlistSymbols: [...(state.watchlistSymbols || [])],
    indexSymbols: [...(state.indexSymbols || [])],
    perStockStrategies: { ...(state.perStockStrategies || {}) },
    pageOffset: state.pageOffset,
    usePagedRankingsFetch: Boolean(state.usePagedRankingsFetch),
  }
}

export function shouldAcceptRankingResponse({ isCurrent, rows, requestContext }) {
  if (!isCurrent) return false
  if (rows === undefined) return true
  return rowsMatchIndexViewMode(rows, requestContext?.viewMode)
}

function dateParamFromIsoDate(selectedDate) {
  if (!selectedDate) return ''
  const date = new Date(selectedDate)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

function effectiveStrategyFor(symbol, context) {
  return context.perStockStrategies?.[symbol] || context.rankingStrategy || 'balanced'
}

function sortScoreForRow(row, date, context) {
  const key = context.sortBy || 'composite'
  if (key === 'composite') {
    const strategy = effectiveStrategyFor(row.symbol, context)
    if (date && row.per_date_scores?.[date]) {
      return Number(row.per_date_scores[date]?.[strategy] || 0)
    }
    return Number(getCompositeScore(row, strategy) || 0)
  }
  if (key === 'weighted') {
    if (date && row.per_date_fields?.[date]) {
      return weightedDimensionScore(row.per_date_fields[date], context.rankingWeights)
    }
    return Number(row.weighted_score ?? weightedDimensionScore(row, context.rankingWeights) ?? 0)
  }
  const field = SORT_SCORE_FIELDS[key]
  if (!field) return 0
  if (date && row.per_date_fields?.[date]) {
    return Number(row.per_date_fields[date]?.[field] || 0)
  }
  return Number(row[field] || 0)
}

function responseRowsAndTotal(response) {
  if (!response) return { rows: [], total: 0 }
  if (response && typeof response === 'object') {
    if (response.success && response.data) {
      return {
        rows: response.data,
        total: typeof response.total === 'number' ? response.total : (response.data || []).length,
      }
    }
    if (Array.isArray(response)) return { rows: response, total: response.length }
    if (Array.isArray(response.data)) return { rows: response.data, total: response.data.length }
    return { rows: [], total: 0 }
  }
  if (Array.isArray(response)) return { rows: response, total: response.length }
  return { rows: [], total: 0 }
}

export function useStockRanking(options = {}) {
  const requestClient = options.requestClient || request
  const notify = options.notify || ((message) => globalThis.alert?.(message))
  const isUserLoggedIn = options.isUserLoggedIn || (() => localStorage.getItem('access_token') !== null)
  const dlog = options.dlog || (() => {})
  const indexConstituents = useRankingIndexConstituents({
    requestClient,
    warn: options.warn,
  })
  const getIndexSymbols = options.getIndexSymbols || indexConstituents.getIndexSymbols

  const prefs = loadStockRankingPrefs()
  const rankings = ref([])
  const rankingDataViewMode = ref('')
  const loading = ref(false)
  const displayLimit = ref(prefs?.displayLimit ?? 30)
  const viewMode = ref(prefs?.viewMode ?? 'ranking')
  const selectedStocks = ref(prefs?.selectedStocks?.length ? [...prefs.selectedStocks] : [])
  const selectedDate = ref(prefs?.selectedDate ?? '')
  const selectedDates = ref(prefs?.selectedDates?.length ? [...prefs.selectedDates] : [])
  const rankingStrategy = ref(prefs?.rankingStrategy ?? 'balanced')
  const sortBy = ref(prefs?.sortBy ?? 'composite')
  const rankingWeights = ref(normalizeRankingWeights(prefs?.rankingWeights || DEFAULT_RANKING_WEIGHTS))
  const perStockStrategies = ref(
    prefs?.perStockStrategies && typeof prefs.perStockStrategies === 'object'
      ? { ...prefs.perStockStrategies }
      : {}
  )
  const refreshKey = ref(0)
  const loadingMessage = ref('')
  const lastUpdateTime = ref('')
  const rankingPageOffset = ref(0)
  const rankingTotal = ref(0)
  const watchlistOps = useRankingWatchlist({
    requestClient,
    isUserLoggedIn,
    notify,
    confirmAction: options.confirmAction,
    dlog,
    getViewMode: () => viewMode.value,
    onRankingRefresh: () => fetchRankings(),
  })
  const { watchlist } = watchlistOps

  const hasCurrentModeRankings = computed(
    () => rankings.value.length > 0 && rankingDataViewMode.value === viewMode.value
  )
  const maxDate = computed(() => new Date().toISOString().slice(0, 10))
  const usePagedRankingsFetch = computed(() => {
    const mode = viewMode.value
    if (isIndexRankingViewMode(mode)) return true
    if (mode === 'watchlist' && watchlist.value.length > STOCK_RANKINGS_PAGE_SIZE) return true
    return (
      mode === 'selected'
      && selectedDates.value.length === 0
      && selectedStocks.value.length > STOCK_RANKINGS_PAGE_SIZE
    )
  })
  const rankingPageLabel = computed(
    () => Math.floor(rankingPageOffset.value / STOCK_RANKINGS_PAGE_SIZE) + 1
  )
  const displayRows = computed(() => {
    void refreshKey.value
    if (rankings.value.length > 0 && rankingDataViewMode.value !== viewMode.value) return []
    return computeDisplayRows({
      rankings: rankings.value,
      viewMode: viewMode.value,
      selectedDates: selectedDates.value,
      rankingStrategy: rankingStrategy.value,
      sortBy: sortBy.value,
      rankingWeights: rankingWeights.value,
      perStockStrategies: perStockStrategies.value,
      getCompositeScore,
    })
  })

  let prefsSaveTimer = null
  function schedulePersistStockRankingPrefs() {
    clearTimeout(prefsSaveTimer)
    prefsSaveTimer = setTimeout(() => {
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
    [
      viewMode,
      displayLimit,
      rankingStrategy,
      sortBy,
      rankingWeights,
      selectedDate,
      selectedDates,
      selectedStocks,
      perStockStrategies,
    ],
    schedulePersistStockRankingPrefs,
    { deep: true }
  )

  const {
    beginRequest,
    abortAll: abortRankingRequests,
    requestSeq: rankingRequestSeq,
  } = useCancellableRequest()

  function getEffectiveStrategyFor(symbol) {
    return perStockStrategies.value?.[symbol] || rankingStrategy.value || 'balanced'
  }

  async function fetchRankings() {
    const { seq: requestId, signal, isCurrent } = beginRequest()
    const mode = viewMode.value
    const requestContext = buildRankingRequestContext({
      viewMode: mode,
      displayLimit: displayLimit.value,
      rankingStrategy: rankingStrategy.value,
      sortBy: sortBy.value,
      rankingWeights: rankingWeights.value,
      selectedDate: selectedDate.value,
      selectedDates: selectedDates.value,
      selectedStocks: selectedStocks.value,
      watchlistSymbols: watchlist.value,
      indexSymbols: getIndexSymbols(mode),
      perStockStrategies: perStockStrategies.value,
      pageOffset: rankingPageOffset.value,
      usePagedRankingsFetch: usePagedRankingsFetch.value,
    })
    dlog('fetchRankings start viewMode=', requestContext.viewMode, 'requestId=', requestId)

    try {
      let response
      const dateParam = dateParamFromIsoDate(requestContext.selectedDate)
      const cacheState = {
        viewMode: requestContext.viewMode,
        displayLimit: requestContext.displayLimit,
        rankingStrategy: requestContext.rankingStrategy,
        sortBy: requestContext.sortBy,
        rankingWeights: requestContext.rankingWeights,
        dateParam,
        selectedDates: requestContext.selectedDates,
        selectedStocks: requestContext.selectedStocks,
        watchlistSymbols: requestContext.watchlistSymbols,
        indexSymbols: requestContext.indexSymbols,
        pageOffset: requestContext.usePagedRankingsFetch ? requestContext.pageOffset : 0,
        pageSize: requestContext.usePagedRankingsFetch ? STOCK_RANKINGS_PAGE_SIZE : null,
      }
      const cacheKey = buildStockRankingCacheKey(cacheState)
      const cached = readStockRankingCache(cacheKey)
      let hadWarmCache = false
      const cacheDateOk = scoreDateMatchesRequest(dateParam, cached?.primaryScoreDate)
      if (
        cached
        && cacheDateOk
        && shouldAcceptRankingResponse({
          isCurrent: isCurrent(),
          rows: cached.rankings,
          requestContext,
        })
      ) {
        rankings.value = JSON.parse(JSON.stringify(cached.rankings))
        rankingDataViewMode.value = requestContext.viewMode
        if (cached.lastUpdateTime) lastUpdateTime.value = cached.lastUpdateTime
        hadWarmCache = true
      } else if (cached && cacheDateOk && isCurrent()) {
        dlog('ranking cache ignored: index membership mismatch', {
          key: cacheKey,
          mode: requestContext.viewMode,
        })
      }
      loading.value = !hadWarmCache

      const weightsParam = requestContext.sortBy === 'weighted'
        ? serializeRankingWeights(requestContext.rankingWeights)
        : ''
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
          if (requestContext.rankingStrategy) {
            url += `&strategy=${encodeURIComponent(requestContext.rankingStrategy)}`
          }
          if (requestContext.sortBy) url += `&sort_by=${encodeURIComponent(requestContext.sortBy)}`
          if (weightsParam) url += `&weights=${encodeURIComponent(weightsParam)}`
          if (dateParam) url += `&date=${dateParam}`
          response = await requestClient({ method: 'get', url, signal })
          break
        }
        case 'hs300':
        case 'csi500':
        case 'csi1000':
        case 'csi2000':
        case 'a500':
        case 'star50': {
          const labels = {
            hs300: '沪深300',
            csi500: '中证500',
            csi1000: '中证1000',
            csi2000: '中证2000',
            a500: '中证A500',
            star50: '科创50',
          }
          loadingMessage.value = `加载${labels[requestContext.viewMode]}指数成分股评分...`
          let url = `/stock-rankings/by-index/${encodeURIComponent(requestContext.viewMode)}`
          const query = []
          if (requestContext.rankingStrategy) {
            query.push(`strategy=${encodeURIComponent(requestContext.rankingStrategy)}`)
          }
          if (requestContext.sortBy) query.push(`sort_by=${encodeURIComponent(requestContext.sortBy)}`)
          appendWeightedQuery(query)
          if (dateParam) query.push(`date=${encodeURIComponent(dateParam)}`)
          if (query.length) url += `?${query.join('&')}`
          url = appendRequestPageQuery(url)
          dlog('index rankings GET', url)
          response = await requestClient({ method: 'get', url, signal })
          break
        }
        case 'selected': {
          if (requestContext.selectedStocks.length === 0) {
            rankings.value = []
            rankingTotal.value = 0
            loading.value = false
            return
          }
          loadingMessage.value = '加载指定股票评分...'
          const payload = {
            symbols: requestContext.selectedStocks,
            strategy: requestContext.rankingStrategy,
          }
          let url = '/stock-rankings/selected'
          const query = []
          if (requestContext.selectedDates.length > 0) {
            payload.dates = requestContext.selectedDates
          } else if (dateParam) {
            query.push(`date=${dateParam}`)
          }
          if (requestContext.rankingStrategy) {
            query.push(`strategy=${encodeURIComponent(requestContext.rankingStrategy)}`)
          }
          if (requestContext.sortBy) query.push(`sort_by=${encodeURIComponent(requestContext.sortBy)}`)
          appendWeightedQuery(query)
          if (query.length) url += `?${query.join('&')}`
          url = appendRequestPageQuery(url)
          response = await requestClient({ method: 'post', url, data: payload, signal })
          break
        }
        case 'watchlist': {
          if (!isUserLoggedIn()) {
            notify('请先登录后查看自选股评分')
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
          loadingMessage.value = '加载自选股评分...'
          const payload = { symbols: requestContext.watchlistSymbols }
          let url = '/stock-rankings/selected'
          const query = []
          if (dateParam) query.push(`date=${dateParam}`)
          if (requestContext.rankingStrategy) {
            query.push(`strategy=${encodeURIComponent(requestContext.rankingStrategy)}`)
          }
          if (requestContext.sortBy) query.push(`sort_by=${encodeURIComponent(requestContext.sortBy)}`)
          appendWeightedQuery(query)
          if (query.length) url += `?${query.join('&')}`
          url = appendRequestPageQuery(url)
          response = await requestClient({ method: 'post', url, data: payload, signal })
          break
        }
        default:
          throw new Error('无效的查看模式')
      }

      if (!shouldAcceptRankingResponse({ isCurrent: isCurrent(), requestContext })) {
        dlog('stale response dropped: superseded by a newer fetch', {
          requestId,
          mode: requestContext.viewMode,
        })
        return
      }
      dlog(
        'response items=',
        Array.isArray(response?.data) ? response.data.length : (Array.isArray(response) ? response.length : 'n/a')
      )
      if (!response) console.error('[fetchRankings] empty response')
      const normalized = responseRowsAndTotal(response)
      let nextRows = normalized.rows
      let nextTotal = normalized.total
      if (
        !shouldAcceptRankingResponse({
          isCurrent: isCurrent(),
          rows: nextRows,
          requestContext,
        })
      ) {
        dlog('ranking response ignored: index membership mismatch', {
          mode: requestContext.viewMode,
          symbols: nextRows.slice(0, 5).map((row) => row?.symbol),
        })
        nextRows = []
        nextTotal = 0
      }

      rankings.value = nextRows
      rankingTotal.value = nextTotal
      rankingDataViewMode.value = requestContext.viewMode
      try {
        if (!(requestContext.viewMode === 'selected' && requestContext.selectedDates.length > 0)) {
          rankings.value = deduplicateStocksByLatestDate(rankings.value)
        }
      } catch (error) {
        console.error('[fetchRankings] error during deduplication:', error)
      }

      if (requestContext.viewMode === 'selected' && requestContext.selectedDates.length > 0) {
        const primaryDate = requestContext.selectedDates[0]
        rankings.value.sort(
          (a, b) => sortScoreForRow(b, primaryDate, requestContext) - sortScoreForRow(a, primaryDate, requestContext)
        )
      } else {
        rankings.value.sort(
          (a, b) => sortScoreForRow(b, '', requestContext) - sortScoreForRow(a, '', requestContext)
        )
      }

      if (rankings.value.length > 0) {
        const scoreDate = rankings.value[0].score_date
        if (scoreDate) {
          lastUpdateTime.value = `${scoreDate.substring(0, 4)}-${scoreDate.substring(4, 6)}-${scoreDate.substring(6, 8)}`
        } else {
          lastUpdateTime.value = new Date().toLocaleDateString()
        }
      }
      if (cacheKey && rankings.value.length > 0) {
        writeStockRankingCache(cacheKey, {
          rankings: rankings.value,
          lastUpdateTime: lastUpdateTime.value,
          primaryScoreDate: rankings.value[0]?.score_date,
        })
      }
    } catch (error) {
      if (isRequestCanceled(error)) {
        dlog('request canceled')
        return
      }
      console.error('获取股票排行失败:', error)
      console.error('错误详情:', error.response?.data)
      if (error.response?.status === 404) {
        rankings.value = []
      } else {
        notify(`获取股票评分失败: ${error.response?.data?.detail || error.message}`)
      }
    } finally {
      if (isCurrent()) loading.value = false
    }
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

  onUnmounted(() => {
    clearTimeout(prefsSaveTimer)
    abortRankingRequests()
  })

  return {
    ...indexConstituents,
    ...watchlistOps,
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
    refreshKey,
    loadingMessage,
    lastUpdateTime,
    rankingPageOffset,
    rankingTotal,
    rankingRequestSeq,
    hasCurrentModeRankings,
    maxDate,
    usePagedRankingsFetch,
    rankingPageLabel,
    displayRows,
    getEffectiveStrategyFor,
    fetchRankings,
    rankingPrevPage,
    rankingNextPage,
    abortRankingRequests,
  }
}
