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

export function buildRecordsUrl({ symbol, limit, sort = '-trade_date', startDate, endDate, adjust = 'qfq' }) {
  const params = new URLSearchParams()
  params.set('limit', String(limit))
  params.set('sort', sort)
  if (symbol) params.set('symbol', symbol)
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  params.set('adjust', VALID_PRICE_ADJUST.includes(adjust) ? adjust : 'qfq')
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

async function fetchMoneyFlowRecords(symbol) {
  try {
    const body = await request({
      url: '/money-flow-records',
      method: 'get',
      params: { symbol },
    })
    return body.data || []
  } catch (err) {
    console.error('获取资金流向数据时出错:', err)
    return []
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
  const chartSymbol = computed(() => (
    chartSymbols.value.length > 0 ? chartSymbols.value[currentIndex.value] : ''
  ))
  const hasPrev = computed(() => currentIndex.value > 0)
  const hasNext = computed(() => currentIndex.value < chartSymbols.value.length - 1)

  let appChartWatchlistInFlight = null

  async function loadAppChartWatchlist() {
    if (!localStorage.getItem('access_token') || !isAuthenticated.value) {
      return
    }
    if (appChartWatchlistInFlight) {
      return appChartWatchlistInFlight
    }
    appChartWatchlistInFlight = (async () => {
      try {
        const body = await request({ url: '/user/watchlist-stocks', method: 'get' })
        if (body && body.success && Array.isArray(body.data)) {
          watchlist.value = body.data.map((stock) => stock.symbol)
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

  async function loadStockData(symbol) {
    if (!symbol) return

    try {
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
      const startDate = toYmd(start)
      const endDate = toYmd(end)

      const klineUrl = buildRecordsUrl({
        symbol,
        limit: 500,
        startDate,
        endDate,
        adjust: priceAdjust.value,
      })
      const klineReq = request({ url: klineUrl, method: 'get', timeout: 10000 })
      const moneyFlowReq = fetchMoneyFlowRecords(symbol)

      let tradeHistoryReq = Promise.resolve({ data: { trades: [] } })
      if (symbol) {
        console.log('准备获取交易历史，symbol:', symbol, 'currentStrategy:', currentStrategy.value)
        let tradeUrl = `/strategy-pool/trade-history?symbol=${symbol}`
        if (currentStrategy.value) {
          tradeUrl += `&strategy=${currentStrategy.value}`
          if (currentPreset.value) {
            tradeUrl += `&preset=${currentPreset.value}`
          }
        } else {
          console.log('未选择策略，获取所有策略的交易历史。')
        }

        console.log('正在请求交易历史:', tradeUrl)
        tradeHistoryReq = request({ url: tradeUrl, method: 'get', timeout: 5000 })
          .then((body) => {
            console.log('交易历史API响应:', body)
            console.log('完整的响应对象:', body)
            return body
          })
          .catch((err) => {
            console.warn('获取交易历史失败:', err)
            return {
              success: false,
              data: {
                symbol,
                strategy: currentStrategy.value,
                preset: currentPreset.value,
                count: 0,
                trades: [],
              },
            }
          })
      } else {
        console.log('股票代码为空，跳过获取交易历史。')
      }

      const [klineRes, moneyFlowRes, tradeHistoryRes] = await Promise.all([
        klineReq,
        moneyFlowReq,
        tradeHistoryReq,
      ])

      const trades = tradeHistoryRes.data.trades || []
      tradeMarkers.value = trades.map((trade) => ({
        date: normalizeDateForComparison(trade.datetime.split(' ')[0]),
        action: trade.action,
        price: trade.price,
        pnl: trade.pnl || 0,
      }))

      console.log(`股票 ${symbol} 交易历史: 共 ${trades.length} 条记录`)

      const allTradeDates = trades.map((trade) => normalizeDateForComparison(trade.datetime.split(' ')[0]))
      let adjustedStartDate = normalizeDateForComparison(startDate)
      let adjustedEndDate = normalizeDateForComparison(endDate)

      if (allTradeDates.length > 0) {
        const earliestTradeDate = allTradeDates.reduce((earliest, current) => (
          current < earliest ? current : earliest
        ), adjustedEndDate)
        if (earliestTradeDate < adjustedStartDate) {
          adjustedStartDate = earliestTradeDate
        }
      }

      if (allTradeDates.length > 0) {
        const latestTradeDate = allTradeDates.reduce((latest, current) => (
          current > latest ? current : latest
        ), adjustedStartDate)
        if (latestTradeDate > adjustedEndDate) {
          adjustedEndDate = latestTradeDate
        }
      }

      if (
        adjustedStartDate !== normalizeDateForComparison(startDate)
        || adjustedEndDate !== normalizeDateForComparison(endDate)
      ) {
        console.log(`调整日期范围以包含交易记录: ${adjustedStartDate} 到 ${adjustedEndDate}`)
        const adjustedKlineUrl = buildRecordsUrl({
          symbol,
          limit: 500,
          startDate: adjustedStartDate,
          endDate: adjustedEndDate,
          adjust: priceAdjust.value,
        })
        const adjustedKlineRes = await request({ url: adjustedKlineUrl, method: 'get', timeout: 10000 })
        chartRecords.value = adjustedKlineRes
      } else {
        chartRecords.value = klineRes
      }

      moneyFlowRecords.value = moneyFlowRes

      const stockInfo = chartRecords.value.find((stock) => stock.symbol === symbol)
      if (stockInfo) {
        const nameFields = ['name', 'stock_name', 'company_name', 'title']
        let foundName = ''
        nameFields.forEach((field) => {
          if (stockInfo[field]) {
            foundName = stockInfo[field]
          }
        })
        stockName.value = foundName
      } else {
        stockName.value = ''
      }
    } catch (error) {
      console.error(`获取股票${symbol}数据失败:`, error)
      chartRecords.value = []
      moneyFlowRecords.value = []
      stockName.value = ''
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

  function prevStock() {
    if (hasPrev.value) {
      currentIndex.value -= 1
    }
  }

  function nextStock() {
    if (hasNext.value) {
      currentIndex.value += 1
    }
  }

  function applyChartSymbolSelection(stockSymbol, navSymbols) {
    if (navSymbols.length > 0) {
      const nextSymbols = navSymbols.includes(stockSymbol)
        ? [...navSymbols]
        : [...navSymbols, stockSymbol]
      chartSymbols.value = nextSymbols
      currentIndex.value = nextSymbols.indexOf(stockSymbol)
      return
    }

    const index = chartSymbols.value.indexOf(stockSymbol)
    if (index !== -1) {
      if (currentIndex.value === index) {
        loadStockData(stockSymbol)
      } else {
        currentIndex.value = index
      }
      return
    }

    chartSymbols.value.push(stockSymbol)
    currentIndex.value = chartSymbols.value.length - 1
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