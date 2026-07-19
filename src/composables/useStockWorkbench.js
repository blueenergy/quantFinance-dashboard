import {
  computed,
  getCurrentInstance,
  onBeforeUnmount,
  onMounted,
  ref,
  toValue,
  watch,
} from 'vue'
import {
  getStockWorkbench,
  getStockWorkbenchAi,
  getStockWorkbenchFinancials,
  getStockWorkbenchKline,
  getStockWorkbenchMoneyFlow,
  getStockWorkbenchNineTurn,
  getStockWorkbenchQuote,
  getStockWorkbenchScores,
  getStockWorkbenchShareholders,
  getStockWorkbenchSignals,
  getStockWorkbenchTrading,
  getStockWorkbenchValuation,
} from '../api/stock'
import { canonicalSymbol } from '../utils/workbenchFormat'

const RECENT_SYMBOLS_KEY = 'stock-workbench:recent-symbols'
const EMPTY_SECTION_STATE = {
  quote: false,
  nine_turn: false,
  scores: false,
  financials: false,
  valuation: false,
  ai: false,
  trading: false,
  shareholders: false,
  signals: false,
}

export function useStockWorkbench(options = {}) {
  const {
    pendingNavigation,
    onBeforeLoadSymbol = () => {},
    onAfterShellReady = () => {},
    onScoresLoaded = () => {},
    onShareholdersLoaded = () => {},
    onDisposeShareholderCharts = () => {},
  } = options

  const loading = ref(false)
  const error = ref('')
  const payload = ref(null)
  const activePanel = ref('overview')
  const directSymbol = ref('')
  const recentStocks = ref([])
  const incomeRows = ref([])
  const indicatorRows = ref([])
  const balanceRows = ref([])
  const cashflowRows = ref([])
  const earnings = ref({})
  const tradingContext = ref({})
  const valuationData = ref({})
  const quoteKlineTf = ref('1d')
  const quoteKlineLoading = ref({ '1d': false, '1w': false, '1m': false })
  const moneyFlowLoading = ref({ '1d': false, '1w': false, '1m': false })
  const sectionLoading = ref({ ...EMPTY_SECTION_STATE })
  const sectionLoaded = ref({ ...EMPTY_SECTION_STATE })
  const shareholderData = ref({})
  const swotData = ref({})
  const swotError = ref('')

  const stockSymbol = computed(
    () => payload.value?.stock?.symbol || payload.value?.symbol || directSymbol.value || '-',
  )
  const quoteDailyRows = computed(
    () => Array.isArray(payload.value?.daily_quotes) ? payload.value.daily_quotes : [],
  )
  const quoteWeeklyRows = computed(
    () => Array.isArray(payload.value?.weekly_quotes) ? payload.value.weekly_quotes : [],
  )
  const quoteMonthlyRows = computed(
    () => Array.isArray(payload.value?.monthly_quotes) ? payload.value.monthly_quotes : [],
  )
  const moneyFlowHistory = computed(
    () => Array.isArray(payload.value?.money_flow_history) ? payload.value.money_flow_history : [],
  )

  function createWorkbenchShell(symbol) {
    const normalized = String(symbol || '').trim().toUpperCase()
    return {
      symbol: normalized,
      stock: { symbol: normalized },
      quote: null,
      score: null,
      deep_analysis: null,
      data_status: {
        stock_found: true,
        quote_found: false,
        score_found: false,
        deep_analysis_found: false,
        quote_date: '',
        score_date: '',
        analysis_created_at: '',
        sections: {},
      },
    }
  }

  function scheduleIdleTask(callback) {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(callback, { timeout: 800 })
      return
    }
    window.setTimeout(callback, 80)
  }

  function scheduleIdleSectionLoad(section) {
    scheduleIdleTask(() => {
      loadWorkbenchSection(section, { force: true }).catch((loadError) => {
        console.warn(`load deferred stock workbench section ${section} failed`, loadError)
      })
    })
  }

  function queueInitialSectionLoads(loadOptions = {}) {
    const tasks = []
    if (loadOptions.deferQuote) {
      scheduleIdleSectionLoad('quote')
      if (activePanel.value === 'quote' && quoteKlineTf.value !== '1d') {
        scheduleIdleTask(() => {
          void Promise.all([
            ensureQuoteKline(quoteKlineTf.value),
            ensureQuoteMoneyFlow(quoteKlineTf.value),
          ])
        })
      }
    } else {
      tasks.push(loadWorkbenchSection('quote', { force: true }))
    }
    if (activePanel.value === 'scores') {
      tasks.push(loadWorkbenchSection('scores', { force: true }))
    } else if (activePanel.value === 'nine-turn') {
      tasks.push(loadWorkbenchSection('nine_turn', { force: true }))
    } else if (activePanel.value === 'financial') {
      tasks.push(loadWorkbenchSection('financials', { force: true }))
    } else if (activePanel.value === 'valuation') {
      tasks.push(loadWorkbenchSection('valuation', { force: true }))
    } else if (activePanel.value === 'shareholders') {
      tasks.push(loadWorkbenchSection('shareholders', { force: true }))
    } else if (activePanel.value === 'swot') {
      tasks.push(loadWorkbenchSection('signals', { force: true }))
    } else if (activePanel.value === 'analysis') {
      tasks.push(loadWorkbenchSection('ai', { force: true }))
      tasks.push(loadWorkbenchSection('trading', { force: true }))
    }
    if (tasks.length) {
      Promise.all(tasks).catch((loadError) => {
        console.warn('load initial stock workbench sections failed', loadError)
      })
    }
  }

  function normalizeRecentStock(value) {
    if (typeof value === 'string') {
      return { symbol: value.trim().toUpperCase(), name: '' }
    }
    if (!value || typeof value !== 'object') {
      return { symbol: '', name: '' }
    }
    return {
      symbol: String(value.symbol || value.ts_code || '').trim().toUpperCase(),
      name: String(value.name || value.stock_name || '').trim(),
    }
  }

  function loadRecentSymbols() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_SYMBOLS_KEY) || '[]')
      recentStocks.value = Array.isArray(parsed)
        ? parsed.map(normalizeRecentStock).filter((item) => item.symbol).slice(0, 8)
        : []
    } catch (_) {
      recentStocks.value = []
    }
  }

  function rememberRecentStock(stockItem) {
    const item = normalizeRecentStock(stockItem)
    if (!item.symbol) return
    const next = [
      item,
      ...recentStocks.value.filter(
        (row) => canonicalSymbol(row.symbol) !== canonicalSymbol(item.symbol),
      ),
    ].slice(0, 8)
    recentStocks.value = next
    localStorage.setItem(RECENT_SYMBOLS_KEY, JSON.stringify(next))
  }

  function clearRecentSymbols() {
    recentStocks.value = []
    localStorage.removeItem(RECENT_SYMBOLS_KEY)
  }

  function mergeWorkbenchSection(section, data, updates) {
    const status = data?.data_status || {}
    const nextStatus = {
      ...(payload.value?.data_status || {}),
      sections: {
        ...(payload.value?.data_status?.sections || {}),
        [section]: status,
      },
    }
    if (section === 'quote') {
      nextStatus.quote_found = Boolean(updates.quote)
      nextStatus.quote_date = status.as_of || nextStatus.quote_date
    } else if (section === 'nine_turn') {
      nextStatus.nine_turn_found = Boolean(status.found)
      nextStatus.nine_turn_date = status.as_of || nextStatus.nine_turn_date
    } else if (section === 'scores') {
      nextStatus.score_found = Boolean(updates.score)
      nextStatus.score_date = status.as_of || nextStatus.score_date
    } else if (section === 'financials') {
      nextStatus.financials_found = Boolean(status.found)
      nextStatus.financials_date = status.as_of || nextStatus.financials_date
    } else if (section === 'valuation') {
      nextStatus.valuation_found = Boolean(status.found)
      nextStatus.valuation_date = status.as_of || nextStatus.valuation_date
    } else if (section === 'ai') {
      nextStatus.deep_analysis_found = Boolean(updates.deep_analysis)
      nextStatus.analysis_created_at = status.as_of || nextStatus.analysis_created_at
    } else if (section === 'trading') {
      nextStatus.trading_found = Boolean(status.found)
      nextStatus.trading_date = status.as_of || nextStatus.trading_date
    }

    payload.value = {
      ...(payload.value || {}),
      ...updates,
      data_status: nextStatus,
    }
  }

  function isCurrentWorkbenchSymbol(symbol) {
    const current = stockSymbol.value && stockSymbol.value !== '-'
      ? stockSymbol.value
      : directSymbol.value
    return canonicalSymbol(symbol) === canonicalSymbol(current)
  }

  async function loadSymbol(symbol) {
    const clean = String(symbol || '').trim()
    if (!clean) return
    directSymbol.value = clean
    const optimistic = createWorkbenchShell(clean)
    payload.value = optimistic
    loading.value = true
    error.value = ''
    try {
      await onBeforeLoadSymbol()
      sectionLoaded.value = { ...EMPTY_SECTION_STATE }
      sectionLoading.value = { ...EMPTY_SECTION_STATE }
      swotError.value = ''
      quoteKlineLoading.value = { '1d': false, '1w': false, '1m': false }
      moneyFlowLoading.value = { '1d': false, '1w': false, '1m': false }
      const workbench = await getStockWorkbench(clean)
      if (canonicalSymbol(directSymbol.value) !== canonicalSymbol(clean)) return
      payload.value = {
        ...optimistic,
        ...workbench,
        data_status: {
          ...(optimistic.data_status || {}),
          ...(workbench?.data_status || {}),
          sections: {
            ...(optimistic.data_status?.sections || {}),
            ...(workbench?.data_status?.sections || {}),
          },
        },
      }
      rememberRecentStock({
        symbol: workbench?.stock?.symbol || workbench?.symbol || clean,
        name: workbench?.stock?.name || workbench?.stock?.stock_name || '',
      })
      sectionLoaded.value = {
        quote: Boolean(workbench?.quote),
        nine_turn: false,
        scores: Boolean(workbench?.score),
        financials: false,
        valuation: false,
        ai: Boolean(workbench?.deep_analysis),
        trading: false,
        shareholders: false,
        signals: false,
      }
      incomeRows.value = []
      indicatorRows.value = []
      balanceRows.value = []
      cashflowRows.value = []
      earnings.value = {}
      tradingContext.value = {}
      valuationData.value = {}
      shareholderData.value = {}
      swotData.value = {}
      onDisposeShareholderCharts()
      queueInitialSectionLoads({ deferQuote: true })
      await onAfterShellReady()
    } catch (loadError) {
      if (canonicalSymbol(directSymbol.value) === canonicalSymbol(clean)) {
        error.value = loadError?.message || '股票工作台数据加载失败'
      }
    } finally {
      if (canonicalSymbol(directSymbol.value) === canonicalSymbol(clean)) {
        loading.value = false
      }
    }
  }

  async function loadWorkbenchSection(section, loadOptions = {}) {
    const force = Boolean(loadOptions.force)
    const symbol = stockSymbol.value && stockSymbol.value !== '-'
      ? stockSymbol.value
      : directSymbol.value
    if (!symbol || !payload.value) return
    if (!force && sectionLoaded.value[section]) return

    sectionLoading.value = { ...sectionLoading.value, [section]: true }
    if (section === 'signals') swotError.value = ''
    try {
      if (section === 'quote') {
        const data = await getStockWorkbenchQuote(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        const dailyMoneyFlowHistory = Array.isArray(data?.money_flow_history)
          ? data.money_flow_history
          : []
        mergeWorkbenchSection('quote', data, {
          quote: data?.quote || null,
          daily_quotes: Array.isArray(data?.daily_quotes) ? data.daily_quotes : [],
          daily_basic: data?.daily_basic || null,
          money_flow: data?.money_flow || null,
          money_flow_history: dailyMoneyFlowHistory,
          money_flow_history_by_tf: {
            ...(payload.value?.money_flow_history_by_tf || {}),
            '1d': dailyMoneyFlowHistory,
          },
          money_flow_summary: data?.money_flow_summary || {},
          entry_risk: data?.entry_risk || {},
        })
      } else if (section === 'nine_turn') {
        const data = await getStockWorkbenchNineTurn(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        mergeWorkbenchSection('nine_turn', data, {
          nine_turn_daily_quotes: Array.isArray(data?.daily_quotes) ? data.daily_quotes : [],
          nine_turn_rows: Array.isArray(data?.nine_turn_rows) ? data.nine_turn_rows : [],
          nine_turn_signals: Array.isArray(data?.signals) ? data.signals : [],
          latest_nine_turn_signal: data?.latest_signal || null,
        })
      } else if (section === 'scores') {
        const data = await getStockWorkbenchScores(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        mergeWorkbenchSection('scores', data, {
          score: data?.score || null,
          score_history: Array.isArray(data?.score_history) ? data.score_history : [],
        })
        await onScoresLoaded()
      } else if (section === 'financials') {
        const data = await getStockWorkbenchFinancials(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        incomeRows.value = Array.isArray(data?.income) ? data.income : []
        indicatorRows.value = Array.isArray(data?.indicators) ? data.indicators : []
        balanceRows.value = Array.isArray(data?.balance) ? data.balance : []
        cashflowRows.value = Array.isArray(data?.cashflow) ? data.cashflow : []
        earnings.value = data?.earnings || {}
        mergeWorkbenchSection('financials', data, {})
      } else if (section === 'valuation') {
        const data = await getStockWorkbenchValuation(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        valuationData.value = data || {}
        mergeWorkbenchSection('valuation', data, { valuation: data || {} })
      } else if (section === 'ai') {
        const data = await getStockWorkbenchAi(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        mergeWorkbenchSection('ai', data, {
          deep_analysis: data?.deep_analysis || null,
          analysis_history: Array.isArray(data?.analysis_history) ? data.analysis_history : [],
          analysis_history_total: data?.analysis_history_total || 0,
          evaluation_summary: data?.evaluation_summary || {},
        })
      } else if (section === 'trading') {
        const data = await getStockWorkbenchTrading(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        tradingContext.value = data || {}
        mergeWorkbenchSection('trading', data, {})
      } else if (section === 'shareholders') {
        const data = await getStockWorkbenchShareholders(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        shareholderData.value = data || {}
        mergeWorkbenchSection('shareholders', data, {})
        await onShareholdersLoaded()
      } else if (section === 'signals') {
        const data = await getStockWorkbenchSignals(symbol)
        if (!isCurrentWorkbenchSymbol(symbol)) return
        swotData.value = data || {}
        mergeWorkbenchSection('signals', data, {})
      }
      sectionLoaded.value = { ...sectionLoaded.value, [section]: true }
    } catch (loadError) {
      console.warn(`load stock workbench section ${section} failed`, loadError)
      if (section === 'signals' && isCurrentWorkbenchSymbol(symbol)) {
        swotError.value = 'SWOT 数据加载失败，请稍后重试。'
      }
    } finally {
      sectionLoading.value = { ...sectionLoading.value, [section]: false }
    }
  }

  async function ensureQuoteKline(tf = quoteKlineTf.value) {
    if (!payload.value) return
    if (tf === '1d') {
      if (!quoteDailyRows.value.length) await loadWorkbenchSection('quote')
      return
    }
    if (tf === '1w' && quoteWeeklyRows.value.length) return
    if (tf === '1m' && quoteMonthlyRows.value.length) return
    if (quoteKlineLoading.value[tf]) return

    const symbol = stockSymbol.value && stockSymbol.value !== '-'
      ? stockSymbol.value
      : directSymbol.value
    if (!symbol) return
    quoteKlineLoading.value = { ...quoteKlineLoading.value, [tf]: true }
    try {
      const data = await getStockWorkbenchKline(symbol, tf)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      const rows = Array.isArray(data?.rows) ? data.rows : []
      payload.value = {
        ...(payload.value || {}),
        ...(tf === '1w' ? { weekly_quotes: rows } : {}),
        ...(tf === '1m' ? { monthly_quotes: rows } : {}),
        data_status: {
          ...(payload.value?.data_status || {}),
          sections: {
            ...(payload.value?.data_status?.sections || {}),
            [`kline_${tf}`]: data?.data_status || {},
          },
        },
      }
    } catch (loadError) {
      console.warn(`load stock workbench kline ${tf} failed`, loadError)
    } finally {
      if (isCurrentWorkbenchSymbol(symbol)) {
        quoteKlineLoading.value = { ...quoteKlineLoading.value, [tf]: false }
      }
    }
  }

  async function ensureQuoteMoneyFlow(tf = quoteKlineTf.value) {
    if (!payload.value) return
    if (tf === '1d') {
      if (!moneyFlowHistory.value.length) await loadWorkbenchSection('quote')
      return
    }
    const existing = payload.value?.money_flow_history_by_tf?.[tf]
    if (Array.isArray(existing) && existing.length) return
    if (moneyFlowLoading.value[tf]) return

    const symbol = stockSymbol.value && stockSymbol.value !== '-'
      ? stockSymbol.value
      : directSymbol.value
    if (!symbol) return
    moneyFlowLoading.value = { ...moneyFlowLoading.value, [tf]: true }
    try {
      const data = await getStockWorkbenchMoneyFlow(symbol, tf)
      if (!isCurrentWorkbenchSymbol(symbol)) return
      const rows = Array.isArray(data?.history) ? data.history : []
      payload.value = {
        ...(payload.value || {}),
        money_flow: payload.value?.money_flow || data?.latest || null,
        money_flow_summary: payload.value?.money_flow_summary || data?.summary || {},
        money_flow_history_by_tf: {
          ...(payload.value?.money_flow_history_by_tf || {}),
          [tf]: rows,
        },
        data_status: {
          ...(payload.value?.data_status || {}),
          sections: {
            ...(payload.value?.data_status?.sections || {}),
            [`money_flow_${tf}`]: data?.data_status || {},
          },
        },
      }
    } catch (loadError) {
      console.warn(`load stock workbench money flow ${tf} failed`, loadError)
    } finally {
      if (isCurrentWorkbenchSymbol(symbol)) {
        moneyFlowLoading.value = { ...moneyFlowLoading.value, [tf]: false }
      }
    }
  }

  async function refreshQuoteSection() {
    const symbol = stockSymbol.value && stockSymbol.value !== '-'
      ? stockSymbol.value
      : directSymbol.value
    if (!symbol || !payload.value) return
    payload.value = {
      ...payload.value,
      weekly_quotes: [],
      monthly_quotes: [],
      money_flow_history_by_tf: {
        ...(payload.value.money_flow_history_by_tf || {}),
        '1w': [],
        '1m': [],
      },
    }
    try {
      await loadWorkbenchSection('quote', { force: true })
      if (quoteKlineTf.value !== '1d') {
        await Promise.all([
          ensureQuoteKline(quoteKlineTf.value),
          ensureQuoteMoneyFlow(quoteKlineTf.value),
        ])
      }
    } catch (loadError) {
      console.warn('refresh quote section failed', loadError)
    }
  }

  function refreshValuationSection() {
    loadWorkbenchSection('valuation', { force: true }).catch((loadError) => {
      console.warn('refresh valuation section failed', loadError)
    })
  }

  function refreshSwotSection() {
    loadWorkbenchSection('signals', { force: true }).catch((loadError) => {
      console.warn('refresh swot section failed', loadError)
    })
  }

  function selectSearchCandidate(item) {
    if (!item) return
    const symbol = item.symbol || item.ts_code
    if (!symbol) return
    directSymbol.value = symbol
    loadSymbol(symbol)
  }

  function submitDirectSymbol() {
    loadSymbol(directSymbol.value)
  }

  watch(activePanel, async (panel) => {
    if (!payload.value) return
    if (panel === 'quote') {
      await loadWorkbenchSection('quote')
      if (quoteKlineTf.value !== '1d') {
        await Promise.all([
          ensureQuoteKline(quoteKlineTf.value),
          ensureQuoteMoneyFlow(quoteKlineTf.value),
        ])
      }
    } else if (panel === 'nine-turn') {
      await loadWorkbenchSection('nine_turn')
    } else if (panel === 'scores') {
      await loadWorkbenchSection('scores')
    } else if (panel === 'financial') {
      await loadWorkbenchSection('financials')
    } else if (panel === 'valuation') {
      await loadWorkbenchSection('valuation')
    } else if (panel === 'shareholders') {
      await loadWorkbenchSection('shareholders')
    } else if (panel === 'swot') {
      await loadWorkbenchSection('signals')
    } else if (panel === 'analysis') {
      await Promise.all([
        loadWorkbenchSection('ai'),
        loadWorkbenchSection('trading'),
      ])
    }
  })

  watch(quoteKlineTf, (tf) => {
    void Promise.all([
      ensureQuoteKline(tf),
      ensureQuoteMoneyFlow(tf),
    ])
  })

  watch(
    () => toValue(pendingNavigation),
    async (detail) => {
      const symbol = detail?.symbol
      if (!symbol) return
      directSymbol.value = symbol
      if (detail?.panel) activePanel.value = detail.panel
      await loadSymbol(symbol)
    },
    { immediate: true },
  )

  async function onOpenWorkbench(event) {
    const detail = event?.detail || {}
    const symbol = typeof detail === 'string' ? detail : detail.symbol
    if (symbol) {
      directSymbol.value = symbol
      await loadSymbol(symbol)
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      loadRecentSymbols()
      window.addEventListener('stock-workbench:set-symbol', onOpenWorkbench)
    })

    onBeforeUnmount(() => {
      window.removeEventListener('stock-workbench:set-symbol', onOpenWorkbench)
      onDisposeShareholderCharts()
    })
  }

  return {
    loading,
    error,
    payload,
    activePanel,
    directSymbol,
    recentStocks,
    sectionLoading,
    sectionLoaded,
    incomeRows,
    indicatorRows,
    balanceRows,
    cashflowRows,
    earnings,
    tradingContext,
    valuationData,
    shareholderData,
    swotData,
    swotError,
    quoteKlineTf,
    quoteKlineLoading,
    moneyFlowLoading,
    stockSymbol,
    createWorkbenchShell,
    scheduleIdleTask,
    scheduleIdleSectionLoad,
    queueInitialSectionLoads,
    mergeWorkbenchSection,
    isCurrentWorkbenchSymbol,
    loadSymbol,
    loadWorkbenchSection,
    ensureQuoteKline,
    ensureQuoteMoneyFlow,
    refreshQuoteSection,
    refreshValuationSection,
    refreshSwotSection,
    selectSearchCandidate,
    submitDirectSymbol,
    clearRecentSymbols,
    loadRecentSymbols,
    rememberRecentStock,
  }
}
