import { computed, nextTick, ref, watch } from 'vue'
import request from '../utils/request'

export const PRICE_ADJUST_STORAGE_KEY = 'chart-price-adjust'
export const VALID_PRICE_ADJUST = ['qfq', 'none', 'hfq']

function readStoredPriceAdjust() {
  try {
    const stored = localStorage.getItem(PRICE_ADJUST_STORAGE_KEY)
    if (VALID_PRICE_ADJUST.includes(stored)) return stored
  } catch {
    // ignore quota / private-mode failures
  }
  return 'qfq'
}

export const CHART_PREFETCH_RADIUS = 2
export const CHART_CACHE_LIMIT = 40

export function buildRecordsUrl({
  symbol,
  limit,
  sort = '-trade_date',
  startDate,
  endDate,
  adjust = 'qfq',
  includeScores,
}) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('sort', sort)
  if (symbol) params.set('symbol', symbol)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  params.set('adjust', VALID_PRICE_ADJUST.includes(adjust) ? adjust : 'qfq')
  if (includeScores === false) params.set('include_scores', 'false')
  if (includeScores === true) params.set('include_scores', 'true')
  return `/records/?${params.toString()}`
}

export function normalizeChartNavSymbols(symbols) {
  if (!Array.isArray(symbols)) return []
  const seen = new Set()
  const out = []
  for (const item of symbols) {
    if (typeof item !== 'string') continue
    const symbol = item.trim()
    if (!symbol || seen.has(symbol)) continue
    seen.add(symbol)
    out.push(symbol)
  }
  return out
}

function normalizeDateForComparison(dateStr) {
  if (!dateStr) return ''

  if (/^\d{8}$/.test(dateStr)) {
    return dateStr
  }

  if (dateStr.includes('-')) {
    return dateStr.replace(/-/g, '')
  }

  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) {
      return dateStr
    }
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  } catch {
    return dateStr
  }
}

export function useChartWorkspace({ activeTab, isAuthenticated, switchTab }) {
  const currentIndex = ref(0)
  const chartSymbols = ref([])
  const watchlist = ref([])
  const chartRecords = ref([])
  const moneyFlowRecords = ref([])
  const stockName = ref('')
  const signalDates = ref([])
  const currentStrategy = ref('')
  const currentPreset = ref('')
  const tradeMarkers = ref([])
  const priceAdjust = ref(readStoredPriceAdjust())
  const chartLoading = ref(false)
  const chartSymbol = computed(() => (
    chartSymbols.value.length > 0 ? chartSymbols.value[currentIndex.value] : ''
  ))
  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value < chartSymbols.value.length - 1)

  const chartCache = new Map()
  const inflightSnapshots = new Map()
  let appChartWatchlistInFlight = null

  function snapshotCacheKey(symbol, adjust = priceAdjust.value) {
    return `${symbol}|${adjust}`
  }

  function readCachedSnapshot(symbol) {
    const key = snapshotCacheKey(symbol)
    if (!chartCache.has(key)) return null
    const snapshot = chartCache.get(key)
    chartCache.delete(key)
    chartCache.set(key, snapshot)
    return snapshot
  }

  function writeCachedSnapshot(symbol, snapshot, adjust = priceAdjust.value) {
    const key = snapshotCacheKey(symbol, adjust)
    if (chartCache.has(key)) chartCache.delete(key)
    chartCache.set(key, snapshot)
    while (chartCache.size > CHART_CACHE_LIMIT) {
      const oldest = chartCache.keys().next().value
      chartCache.delete(oldest)
    }
  }

  function applyChartSnapshot(snapshot) {
    chartRecords.value = snapshot.records || []
    moneyFlowRecords.value = snapshot.moneyFlow || []
    tradeMarkers.value = snapshot.tradeMarkers || []
    stockName.value = snapshot.stockName || ''
  }

  function readStockName(records, symbol) {
    const rows = Array.isArray(records) ? records : []
    const stockInfo = rows.find((row) => row?.symbol === symbol) || rows[0]
    if (!stockInfo) return ''
    return stockInfo.name || stockInfo.stock_name || stockInfo.company_name || stockInfo.title || ''
  }

  function chartDateWindow() {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 360)
    if (signalDates.value.length > 0) {
      const sDate = signalDates.value[0]
      const sDateStr = sDate.length === 8
        ? `${sDate.slice(0, 4)}-${sDate.slice(4, 6)}-${sDate.slice(6, 8)}`
        : sDate
      const sigDate = new Date(sDateStr)
      if (sigDate < start) {
        start.setTime(sigDate.getTime() - (30 * 24 * 60 * 60 * 1000))
      }
    }
    const toYmd = (date) => date.toISOString().slice(0, 10).replace(/-/g, '')
    return { startDate: toYmd(start), endDate: toYmd(end) }
  }

  async function loadAppChartWatchlist() {
    if (!localStorage.getItem('access_token') || !isAuthenticated.value) {
      return
    }
    if (appChartWatchlistInFlight) {
      return appChartWatchlistInFlight
    }
    appChartWatchlistInFlight = (async () => {
      try {
        const body = await request({ url: '/user/watchlist', method: 'get' })
        const symbols = body?.data?.symbols
        if (body && body.success && Array.isArray(symbols)) {
          watchlist.value = symbols
        } else {
          watchlist.value = ['000001', '000002', '000003']
        }
      } catch (e) {
        console.error('获取自选股失败:', e)
        watchlist.value = ['000001', '000002', '000003']
      } finally {
        appChartWatchlistInFlight = null
      }
    })()
    return appChartWatchlistInFlight
  }

  async function fetchChartSnapshot(symbol) {
    const adjust = priceAdjust.value
    const key = snapshotCacheKey(symbol, adjust)
    if (inflightSnapshots.has(key)) {
      return inflightSnapshots.get(key)
    }
    const pending = (async () => {
      const { startDate, endDate } = chartDateWindow()
      const klineUrl = buildRecordsUrl({
        symbol,
        limit: 500,
        startDate,
        endDate,
        adjust,
        includeScores: false,
      })
      const records = await request({ url: klineUrl, method: 'get', timeout: 10000 })
      const snapshot = {
        records: Array.isArray(records) ? records : [],
        moneyFlow: [],
        tradeMarkers: [],
        stockName: readStockName(records, symbol),
      }
      writeCachedSnapshot(symbol, snapshot, adjust)
      return snapshot
    })()
    inflightSnapshots.set(key, pending)
    try {
      return await pending
    } finally {
      if (inflightSnapshots.get(key) === pending) {
        inflightSnapshots.delete(key)
      }
    }
  }

  function prefetchSymbol(symbol) {
    if (!symbol) return
    const key = snapshotCacheKey(symbol)
    if (chartCache.has(key) || inflightSnapshots.has(key)) return
    if (inflightSnapshots.size >= 4) return
    void fetchChartSnapshot(symbol).catch((error) => {
      console.warn(`prefetch kline ${symbol} failed:`, error)
    })
  }

  function prefetchNeighbors() {
    const symbols = chartSymbols.value
    const idx = currentIndex.value
    if (!symbols.length) return
    for (let offset = 1; offset <= CHART_PREFETCH_RADIUS; offset += 1) {
      prefetchSymbol(symbols[idx + offset])
      prefetchSymbol(symbols[idx - offset])
    }
  }

  async function loadStockData(symbol) {
    if (!symbol) return

    prefetchNeighbors()
    const cached = readCachedSnapshot(symbol)
    if (cached) {
      applyChartSnapshot(cached)
      chartLoading.value = false
      return
    }

    chartLoading.value = true
    try {
      const snapshot = await fetchChartSnapshot(symbol)
      if (chartSymbol.value !== symbol) return
      applyChartSnapshot(snapshot)
    } catch (error) {
      if (chartSymbol.value !== symbol) return
      console.error(`获取股票${symbol}数据失败:`, error)
      chartRecords.value = []
      moneyFlowRecords.value = []
      tradeMarkers.value = []
      stockName.value = ''
    } finally {
      if (chartSymbol.value === symbol) {
        chartLoading.value = false
      }
      prefetchNeighbors()
    }
  }

  async function handleLoadMore(earliestDate) {
    if (!chartSymbol.value || !earliestDate) return

    try {
      const symbol = chartSymbol.value
      const currentStart = new Date(earliestDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
      const prevStart = new Date(currentStart)
      prevStart.setDate(prevStart.getDate() - 180)

      const toYmd = (date) => date.toISOString().slice(0, 10).replace(/-/g, '')
      const startDateStr = toYmd(prevStart)
      const endDateStr = earliestDate.replace(/-/g, '')
      const klineUrl = buildRecordsUrl({
        symbol,
        limit: 1000,
        startDate: startDateStr,
        endDate: endDateStr,
        adjust: priceAdjust.value,
        includeScores: false,
      })

      const [klineRes, moneyFlowRes] = await Promise.all([
        request({ url: klineUrl, method: 'get', timeout: 15000 }),
        request({
          url: `/money-flow-records?symbol=${symbol}&start_date=${startDateStr}&end_date=${endDateStr}`,
          method: 'get',
        }),
      ])

      const newRecords = klineRes || []
      const newMoneyFlow = moneyFlowRes.data || []
      if (newRecords.length === 0) {
        return
      }

      const recordMap = new Map()
      newRecords.forEach((record) => recordMap.set(normalizeDateForComparison(record.trade_date), record))
      chartRecords.value.forEach((record) => recordMap.set(normalizeDateForComparison(record.trade_date), record))
      chartRecords.value = Array.from(recordMap.values()).sort((a, b) => b.trade_date.localeCompare(a.trade_date))

      const moneyFlowMap = new Map()
      newMoneyFlow.forEach((record) => moneyFlowMap.set(normalizeDateForComparison(record.trade_date), record))
      moneyFlowRecords.value.forEach((record) => moneyFlowMap.set(normalizeDateForComparison(record.trade_date), record))
      moneyFlowRecords.value = Array.from(moneyFlowMap.values()).sort((a, b) => b.trade_date.localeCompare(a.trade_date))
      writeCachedSnapshot(symbol, {
        records: chartRecords.value,
        moneyFlow: moneyFlowRecords.value,
        tradeMarkers: tradeMarkers.value,
        stockName: stockName.value,
      })
    } catch (error) {
      console.error('[App] handleLoadMore failed:', error)
    }
  }

  function goBackToStrategyPool(context) {
    if (window.currentSourceInfo) {
      const sourceInfo = window.currentSourceInfo
      switchTab(sourceInfo.tab)

      if (sourceInfo.tab === 'strategy-pool' && sourceInfo.strategy) {
        nextTick(() => {
          const event = new CustomEvent('restore-strategy-context', {
            detail: {
              strategy: sourceInfo.strategy,
              preset: sourceInfo.preset,
              date: context?.date,
            },
          })
          window.dispatchEvent(event)
        })
      }
      return
    }

    if (context && context.strategy) {
      switchTab('strategy-pool')
      nextTick(() => {
        const event = new CustomEvent('restore-strategy-context', {
          detail: {
            strategy: context.strategy,
            preset: context.preset,
            date: context.date,
          },
        })
        window.dispatchEvent(event)
      })
    }
  }

  function revealCachedSymbol(symbol) {
    if (!symbol) return false
    const cached = readCachedSnapshot(symbol)
    if (!cached) return false
    applyChartSnapshot(cached)
    chartLoading.value = false
    return true
  }

  function prevStock() {
    if (!hasPrev.value) return
    currentIndex.value -= 1
    if (!revealCachedSymbol(chartSymbol.value)) {
      chartLoading.value = true
    }
  }

  function nextStock() {
    if (!hasNext.value) return
    currentIndex.value += 1
    if (!revealCachedSymbol(chartSymbol.value)) {
      chartLoading.value = true
    }
  }

  function applyChartSymbolSelection(stockSymbol, navSymbols) {
    if (navSymbols.length > 0) {
      const nextSymbols = navSymbols.includes(stockSymbol)
        ? [...navSymbols]
        : [...navSymbols, stockSymbol]
      chartSymbols.value = nextSymbols
      currentIndex.value = nextSymbols.indexOf(stockSymbol)
      revealCachedSymbol(stockSymbol)
      return
    }

    const index = chartSymbols.value.indexOf(stockSymbol)
    if (index !== -1) {
      if (currentIndex.value === index) {
        loadStockData(stockSymbol)
      } else {
        currentIndex.value = index
        revealCachedSymbol(stockSymbol)
      }
      return
    }

    chartSymbols.value.push(stockSymbol)
    currentIndex.value = chartSymbols.value.length - 1
    revealCachedSymbol(stockSymbol)
  }

  async function selectStockForChart(stockData) {
    let stockSymbol = ''
    let signalDate = null
    let strategy = ''
    let preset = ''
    let navSymbols = []
    const sourceTab = activeTab.value

    if (typeof stockData === 'string') {
      stockSymbol = stockData
    } else if (stockData && stockData.symbol) {
      stockSymbol = stockData.symbol
      signalDate = stockData.signalDate
      strategy = stockData.strategy || ''
      preset = stockData.preset || ''
      navSymbols = normalizeChartNavSymbols(stockData.symbols)
    }

    if (!stockSymbol) return

    // Opening from the watchlist tab should cycle the current 自选股 list.
    // Deep links / ranking still pass a single symbol so they stay isolated.
    if (navSymbols.length === 0 && sourceTab === 'watchlist') {
      navSymbols = normalizeChartNavSymbols(watchlist.value)
    }

    currentStrategy.value = strategy
    currentPreset.value = preset

    const sourceInfo = {
      tab: sourceTab,
      strategy,
      preset,
    }

    if (signalDate) {
      signalDates.value = [signalDate]
    } else {
      signalDates.value = []
    }

    applyChartSymbolSelection(stockSymbol, navSymbols)

    switchTab('chart')
    window.currentSourceInfo = sourceInfo
  }

  function setPriceAdjust(mode) {
    const next = VALID_PRICE_ADJUST.includes(mode) ? mode : 'qfq'
    if (priceAdjust.value === next) return
    priceAdjust.value = next
    try {
      localStorage.setItem(PRICE_ADJUST_STORAGE_KEY, next)
    } catch {
      // ignore
    }
    if (chartSymbol.value) {
      void loadStockData(chartSymbol.value)
    }
  }

  watch(activeTab, (tabId) => {
    if (tabId === 'watchlist') {
      void loadAppChartWatchlist()
    }
  })

  watch(chartSymbol, (newSymbol) => {
    if (newSymbol) {
      void loadStockData(newSymbol)
    }
  }, { immediate: true })

  return {
    currentIndex,
    chartSymbols,
    watchlist,
    chartRecords,
    moneyFlowRecords,
    stockName,
    chartSymbol,
    signalDates,
    currentStrategy,
    currentPreset,
    tradeMarkers,
    chartLoading,
    hasPrev,
    hasNext,
    loadAppChartWatchlist,
    handleLoadMore,
    goBackToStrategyPool,
    prevStock,
    nextStock,
    selectStockForChart,
    priceAdjust,
    setPriceAdjust,
  }
}